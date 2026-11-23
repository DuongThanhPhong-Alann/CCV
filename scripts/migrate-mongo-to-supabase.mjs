import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { MongoClient, ObjectId } from "mongodb";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "erd_studio";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!mongoUri || !supabaseUrl || !supabaseSecretKey) {
  throw new Error("Set MONGODB_URI, SUPABASE_URL, and SUPABASE_SECRET_KEY in .env.local first.");
}

function jsonValue(value) {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, jsonValue(nested)]));
  }
  return value;
}

function timestamp(value, fallback) {
  const parsed = value instanceof Date ? value : new Date(value ?? fallback);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function toRecord(collection, source) {
  const id = String(source._id);
  if (!/^[0-9a-f]{24}$/i.test(id)) {
    throw new Error(`Document in ${collection} has an ID that is not a MongoDB ObjectId.`);
  }
  const { _id, _revision, ...rest } = source;
  const data = jsonValue(rest);
  const base = {
    _id: id,
    revision: typeof _revision === "number" ? _revision : Date.now() * 1000,
    mongo_synced: true,
    deleted: false,
    document: { ...data, _id: id },
  };

  if (collection === "users") {
    return {
      ...base,
      name: typeof data.name === "string" ? data.name : null,
      email: typeof data.email === "string" ? data.email.toLowerCase() : null,
      passwordHash: typeof data.passwordHash === "string" ? data.passwordHash : null,
      emailVerified: data.emailVerified ? timestamp(data.emailVerified, new Date()) : null,
      image: typeof data.image === "string" ? data.image : null,
      createdAt: timestamp(data.createdAt, new Date()),
    };
  }

  if (collection === "diagrams") {
    return {
      ...base,
      ownerId: data.ownerId ? String(data.ownerId) : null,
      name: typeof data.name === "string" ? data.name : null,
      taskId: data.taskId ? String(data.taskId) : null,
      entities: Array.isArray(data.entities) ? data.entities : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
      decorations: Array.isArray(data.decorations) ? data.decorations : [],
      createdAt: timestamp(data.createdAt, new Date()),
      updatedAt: timestamp(data.updatedAt ?? data.createdAt, new Date()),
    };
  }

  return {
    ...base,
    title: typeof data.title === "string" ? data.title : null,
    description: typeof data.description === "string" ? data.description : null,
    createdById: data.createdById ? String(data.createdById) : null,
    createdByName: typeof data.createdByName === "string" ? data.createdByName : null,
    createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : null,
    assignedToId: data.assignedToId ? String(data.assignedToId) : null,
    assignedToName: typeof data.assignedToName === "string" ? data.assignedToName : null,
    assignedToEmail: typeof data.assignedToEmail === "string" ? data.assignedToEmail : null,
    sourceTaskId: data.sourceTaskId ? String(data.sourceTaskId) : null,
    status: typeof data.status === "string" ? data.status : null,
    diagramId: data.diagramId ? String(data.diagramId) : null,
    acceptedAt: data.acceptedAt ? timestamp(data.acceptedAt, new Date()) : null,
    submission: data.submission ?? null,
    grade: data.grade ?? null,
    createdAt: timestamp(data.createdAt, new Date()),
    updatedAt: timestamp(data.updatedAt ?? data.createdAt, new Date()),
  };
}

const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

try {
  await mongo.connect();
  const database = mongo.db(databaseName);
  for (const collection of ["users", "diagrams", "tasks"]) {
    const documents = await database.collection(collection).find({}).toArray();
    let migrated = 0;
    let preserved = 0;
    for (let start = 0; start < documents.length; start += 250) {
      const records = documents.slice(start, start + 250).map((document) => toRecord(collection, document));
      const { data: existing, error: readError } = await supabase.from(collection)
        .select("_id,revision").in("_id", records.map((record) => record._id));
      if (readError) throw new Error(`Could not read existing ${collection}: ${readError.message}`);
      const existingIds = new Set((existing ?? []).map((record) => record._id));
      const toWrite = records.filter((record) => !existingIds.has(record._id));
      const { error } = toWrite.length
        ? await supabase.from(collection).upsert(toWrite, { onConflict: "_id" })
        : { error: null };
      if (error) throw new Error(`Could not migrate ${collection}: ${error.message}`);
      migrated += toWrite.length;
      preserved += records.length - toWrite.length;
    }
    console.log(`Migrated ${migrated} ${collection} records; kept ${preserved} records already in Supabase.`);
  }
  console.log("Migration complete.");
} finally {
  await mongo.close();
}
