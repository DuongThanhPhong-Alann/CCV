import { ObjectId } from "mongodb";
import type { Document } from "mongodb";
import { getSupabaseClient } from "@/lib/supabase";
import { getDatabase } from "@/lib/mongodb";

export type AppCollection = "users" | "diagrams" | "tasks";
export type AppDocument = { _id: ObjectId; _revision?: number; [key: string]: unknown };
export type AppFilters = {
  id?: string;
  ownerId?: string;
  assignedToId?: string;
  ownerOrAssigneeId?: string;
  sourceId?: string;
  status?: string;
  notStatus?: string;
  email?: string;
  excludeId?: string;
  nameOrEmailContains?: string;
};
export type AppGuard = {
  status?: string;
  createdById?: string;
  assignedToId?: string;
  submissionVersion?: number | null;
};

type RecordRow = {
  _id: string;
  document: Record<string, unknown>;
  revision: number;
  mongo_synced?: boolean;
  deleted?: boolean;
};
type OutboxDoc = {
  _id: string;
  collection: AppCollection;
  id: string;
  operation: "upsert" | "delete";
  data?: Record<string, unknown>;
  revision?: number;
  createdAt: Date;
};

function idString(value: unknown) {
  if (value instanceof ObjectId) return value.toString();
  return typeof value === "string" ? value : "";
}

function isoDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function nextRevision(...values: number[]) {
  return Math.max(Date.now() * 1000, ...values.map((value) => value + 1));
}

function plainData(document: AppDocument) {
  const { _id: _ignoredId, _revision: _ignoredRevision, ...content } = document;
  return JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
}

function toRow(collection: AppCollection, document: AppDocument, revision: number, mongoSynced = false) {
  const data = plainData(document);
  const id = document._id.toString();
  const row = {
    _id: id,
    revision,
    mongo_synced: mongoSynced,
    deleted: false,
    document: { ...data, _id: id },
  };
  if (collection === "users") {
    return {
      ...row,
      name: typeof data.name === "string" ? data.name : null,
      email: typeof data.email === "string" ? data.email.toLowerCase() : null,
      passwordHash: typeof data.passwordHash === "string" ? data.passwordHash : null,
      emailVerified: data.emailVerified instanceof Date || typeof data.emailVerified === "string"
        ? isoDate(data.emailVerified)
        : null,
      image: typeof data.image === "string" ? data.image : null,
      createdAt: isoDate(data.createdAt),
    };
  }
  if (collection === "diagrams") {
    return {
      ...row,
      ownerId: idString(data.ownerId) || null,
      name: typeof data.name === "string" ? data.name : null,
      taskId: idString(data.taskId) || null,
      entities: Array.isArray(data.entities) ? data.entities : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
      decorations: Array.isArray(data.decorations) ? data.decorations : [],
      createdAt: isoDate(data.createdAt),
      updatedAt: isoDate(data.updatedAt ?? data.createdAt),
    };
  }
  return {
      ...row,
      title: typeof data.title === "string" ? data.title : null,
      description: typeof data.description === "string" ? data.description : null,
      createdById: idString(data.createdById) || null,
      createdByName: typeof data.createdByName === "string" ? data.createdByName : null,
      createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : null,
      assignedToId: idString(data.assignedToId) || null,
      assignedToName: typeof data.assignedToName === "string" ? data.assignedToName : null,
      assignedToEmail: typeof data.assignedToEmail === "string" ? data.assignedToEmail : null,
      sourceTaskId: idString(data.sourceTaskId) || null,
      status: typeof data.status === "string" ? data.status : null,
      diagramId: idString(data.diagramId) || null,
      acceptedAt: data.acceptedAt instanceof Date || typeof data.acceptedAt === "string" ? isoDate(data.acceptedAt) : null,
      submission: data.submission ?? null,
      grade: data.grade ?? null,
      createdAt: isoDate(data.createdAt),
      updatedAt: isoDate(data.updatedAt ?? data.createdAt),
  };
}

function fromRow(row: RecordRow): AppDocument {
  const document = { ...row.document, _id: new ObjectId(row._id), _revision: Number(row.revision) } as AppDocument;
  for (const field of ["ownerId", "createdById", "assignedToId", "sourceTaskId", "diagramId", "taskId"]) {
    const value = document[field];
    if (typeof value === "string" && /^[0-9a-f]{24}$/i.test(value)) document[field] = new ObjectId(value);
  }
  for (const field of ["createdAt", "updatedAt", "acceptedAt", "emailVerified"]) {
    const value = document[field];
    if (typeof value === "string") document[field] = new Date(value);
  }
  const submission = document.submission;
  if (submission && typeof submission === "object" && typeof (submission as Record<string, unknown>).submittedAt === "string") {
    (submission as Record<string, unknown>).submittedAt = new Date((submission as Record<string, string>).submittedAt);
  }
  const grade = document.grade;
  if (grade && typeof grade === "object" && typeof (grade as Record<string, unknown>).gradedAt === "string") {
    (grade as Record<string, unknown>).gradedAt = new Date((grade as Record<string, string>).gradedAt);
  }
  return document;
}

function fromMongo<T extends AppDocument>(document: (Document & { _id: ObjectId }) | null) {
  if (!document) return null;
  return document as unknown as T;
}

function primaryError(message: string, error: unknown) {
  console.error(`[app-data] ${message}`, error);
}

async function saveOutbox(entry: OutboxDoc) {
  try {
    await getDatabase().collection<OutboxDoc>("app_sync_outbox").replaceOne({ _id: entry._id }, entry, { upsert: true });
  } catch (error) {
    primaryError(`Could not queue ${entry.operation} for ${entry.collection}/${entry.id}.`, error);
    throw error;
  }
}

async function clearOutbox(collection: AppCollection, id: string) {
  try {
    await getDatabase().collection<OutboxDoc>("app_sync_outbox").deleteOne({ _id: `${collection}:${id}` });
  } catch (error) {
    primaryError(`Could not clear sync queue for ${collection}/${id}.`, error);
  }
}

async function flushOutbox(collection: AppCollection) {
  let primaryChanged = false;
  let client: ReturnType<typeof getSupabaseClient>;
  let pending: OutboxDoc[];
  try {
    client = getSupabaseClient();
    pending = await getDatabase().collection<OutboxDoc>("app_sync_outbox").find({ collection }).toArray();
  } catch {
    return false;
  }

  for (const entry of pending) {
    try {
      if (entry.operation === "delete") {
        const { data, error } = await client.from(collection).select("revision,deleted")
          .eq("_id", entry.id).maybeSingle();
        if (error) throw error;
        if (data && !data.deleted && (!entry.revision || Number(data.revision) <= entry.revision)) {
          const { error: deleteError } = await client.from(collection).delete()
            .eq("_id", entry.id).eq("revision", data.revision).eq("deleted", false);
          if (deleteError) throw deleteError;
          primaryChanged = true;
        }
      } else if (entry.data) {
        const { data, error } = await client.from(collection).select("revision,deleted")
          .eq("_id", entry.id).maybeSingle();
        if (error) throw error;
        if ((!data || !data.deleted) && (!data || !entry.revision || Number(data.revision) < entry.revision)) {
          await upsertPrimary(collection, { ...entry.data, _id: new ObjectId(entry.id) } as AppDocument, true, entry.revision ?? 0);
          primaryChanged = true;
        }
      }
      await clearOutbox(collection, entry.id);
    } catch (error) {
      primaryError(`Could not sync queued ${entry.operation} for ${collection}/${entry.id}.`, error);
      return primaryChanged;
    }
  }

  try {
    const { data, error } = await client.from(collection).select("_id,document,revision,mongo_synced,deleted")
      .eq("mongo_synced", false).limit(5000);
    if (error) throw error;
    for (const row of data ?? []) {
      const record = row as RecordRow;
      try {
        if (record.deleted) {
          await getDatabase().collection(collection).deleteOne({ _id: new ObjectId(record._id) });
          const { error: removeError } = await client.from(collection).delete()
            .eq("_id", record._id).eq("revision", record.revision).eq("deleted", true);
          if (removeError) throw removeError;
        } else {
          const mirrored = await mirrorToMongo(collection, fromRow(record), Number(record.revision));
          if (!mirrored) continue;
          const { error: markError } = await client.from(collection).update({ mongo_synced: true })
            .eq("_id", record._id).eq("revision", record.revision).eq("deleted", false);
          if (markError) throw markError;
        }
      } catch (error) {
        primaryError(`Could not mirror pending Supabase record ${collection}/${record._id} to MongoDB.`, error);
      }
    }
  } catch (error) {
    primaryError(`Could not read pending MongoDB mirror records for ${collection}.`, error);
  }
  return primaryChanged;
}

async function upsertPrimary(collection: AppCollection, document: AppDocument, mongoSynced = false, minimumRevision = 0) {
  const client = getSupabaseClient();
  const id = document._id.toString();
  const { data: existing, error: readError } = await client.from(collection).select("revision").eq("_id", id).maybeSingle();
  if (readError) throw readError;
  const revision = Math.max(nextRevision(Number(existing?.revision ?? 0)), minimumRevision);
  const { error } = await client.from(collection).upsert(toRow(collection, document, revision, mongoSynced), { onConflict: "_id" });
  if (error) throw error;
  return revision;
}

async function mirrorToMongo(collection: AppCollection, document: AppDocument, revision: number) {
  const { _revision: _ignoredRevision, ...mongoDocument } = document;
  const mongoCollection = getDatabase().collection(collection);
  const pending = await getDatabase().collection<OutboxDoc>("app_sync_outbox").findOne({ _id: `${collection}:${document._id}` });
  if (pending?.operation === "upsert" && typeof pending.revision === "number" && pending.revision > revision) return false;
  await mongoCollection.replaceOne({ _id: document._id }, mongoDocument, { upsert: true });
  return true;
}

async function nextMongoRevision(collection: AppCollection, id: ObjectId) {
  const pending = await getDatabase().collection<OutboxDoc>("app_sync_outbox").findOne({ _id: `${collection}:${id}` });
  return nextRevision(typeof pending?.revision === "number" ? pending.revision : 0);
}

function applyFilters(query: any, collection: AppCollection, filters: AppFilters) {
  let result = query.eq("deleted", false);
  if (filters.id) result = result.eq("_id", filters.id);
  if (filters.ownerId) result = result.eq(collection === "tasks" ? "createdById" : "ownerId", filters.ownerId);
  if (filters.assignedToId) result = result.eq("assignedToId", filters.assignedToId);
  if (filters.ownerOrAssigneeId) {
    const ownerField = collection === "tasks" ? "createdById" : "ownerId";
    result = result.or(`${ownerField}.eq.${filters.ownerOrAssigneeId},assignedToId.eq.${filters.ownerOrAssigneeId}`);
  }
  if (filters.sourceId) result = result.eq("sourceTaskId", filters.sourceId);
  if (filters.status) result = result.eq("status", filters.status);
  if (filters.notStatus) result = result.neq("status", filters.notStatus);
  if (filters.email) result = result.eq("email", filters.email.toLowerCase());
  if (filters.excludeId) result = result.neq("_id", filters.excludeId);
  return result;
}

async function readPrimaryList(collection: AppCollection, filters: AppFilters, limit: number) {
  const client = getSupabaseClient();
  const queryPrimary = async () => {
    if (filters.nameOrEmailContains !== undefined) {
      const escaped = filters.nameOrEmailContains.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escaped}%`;
      let byName = applyFilters(client.from(collection).select("_id,document,revision"), collection, filters).ilike("name", pattern);
      let byEmail = applyFilters(client.from(collection).select("_id,document,revision"), collection, filters).ilike("email", pattern);
      byName = byName.limit(limit);
      byEmail = byEmail.limit(limit);
      const [names, emails] = await Promise.all([byName, byEmail]);
      if (names.error) throw names.error;
      if (emails.error) throw emails.error;
      const rows = new Map<string, RecordRow>();
      for (const row of [...(names.data ?? []), ...(emails.data ?? [])]) rows.set(row._id, row as RecordRow);
      return [...rows.values()].map(fromRow).sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""))).slice(0, limit);
    }
    const { data, error } = await applyFilters(client.from(collection).select("_id,document,revision"), collection, filters)
      .order("updatedAt", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => fromRow(row as RecordRow));
  };
  const result = await queryPrimary();
  if (await flushOutbox(collection)) return await queryPrimary();
  return result;
}

export async function findAppDocument<T extends AppDocument>(
  collection: AppCollection,
  id: string,
  mongoFallback: () => Promise<(Document & { _id: ObjectId }) | null>,
) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from(collection).select("_id,document,revision").eq("_id", id).eq("deleted", false).maybeSingle();
    if (error) throw error;
    const changed = await flushOutbox(collection);
    if (!changed) return data ? fromRow(data as RecordRow) as T : null;
    const { data: refreshed, error: refreshError } = await client.from(collection).select("_id,document,revision")
      .eq("_id", id).eq("deleted", false).maybeSingle();
    if (refreshError) throw refreshError;
    return refreshed ? fromRow(refreshed as RecordRow) as T : null;
  } catch (error) {
    primaryError(`Supabase read failed for ${collection}/${id}; using MongoDB.`, error);
    return fromMongo<T>(await mongoFallback());
  }
}

export async function listAppDocuments<T extends AppDocument>(
  collection: AppCollection,
  filters: AppFilters,
  mongoFallback: () => Promise<Array<Document & { _id: ObjectId }>>,
  limit = 5000,
) {
  try {
    return await readPrimaryList(collection, filters, limit) as T[];
  } catch (error) {
    primaryError(`Supabase list failed for ${collection}; using MongoDB.`, error);
    return await mongoFallback() as T[];
  }
}

export async function writeAppDocument(collection: AppCollection, document: AppDocument) {
  const id = document._id.toString();
  let primaryRevision = 0;
  let primaryFailure: unknown;
  try {
    await flushOutbox(collection);
    primaryRevision = await upsertPrimary(collection, document);
  } catch (error) {
    primaryFailure = error;
    primaryError(`Supabase write failed for ${collection}/${id}; saving to MongoDB.`, error);
  }

  if (typeof primaryFailure === "object" && primaryFailure !== null && "code" in primaryFailure && primaryFailure.code === "23505") {
    throw primaryFailure;
  }

  let mongoFailure: unknown;
  let mongoRevision = primaryRevision;
  try {
    if (!mongoRevision) mongoRevision = await nextMongoRevision(collection, document._id);
    const mirrored = await mirrorToMongo(collection, document, mongoRevision);
    if (!mirrored) throw new Error(`MongoDB has a newer revision of ${collection}/${id}.`);
  } catch (error) {
    mongoFailure = error;
    primaryError(`MongoDB mirror write failed for ${collection}/${id}.`, error);
  }

  if (primaryRevision) {
    if (!mongoFailure) {
      const { error } = await getSupabaseClient().from(collection).update({ mongo_synced: true })
        .eq("_id", id).eq("revision", primaryRevision).eq("deleted", false);
      if (error) primaryError(`Could not confirm MongoDB mirror for ${collection}/${id}.`, error);
      else await clearOutbox(collection, id);
    }
    return { primary: true, secondary: !mongoFailure };
  }
  if (!mongoFailure) {
    await saveOutbox({ _id: `${collection}:${id}`, collection, id, operation: "upsert", data: plainData(document), revision: mongoRevision, createdAt: new Date() });
    return { primary: false, secondary: true };
  }
  throw new AggregateError([primaryFailure, mongoFailure], `Could not save ${collection}/${id} to Supabase or MongoDB.`);
}

function guardMatches(document: AppDocument, guard: AppGuard) {
  if (guard.status !== undefined && document.status !== guard.status) return false;
  if (guard.createdById && idString(document.createdById) !== guard.createdById) return false;
  if (guard.assignedToId && idString(document.assignedToId) !== guard.assignedToId) return false;
  const submission = document.submission as { version?: number } | undefined;
  if (guard.submissionVersion === null && submission !== undefined) return false;
  if (typeof guard.submissionVersion === "number" && submission?.version !== guard.submissionVersion) return false;
  return true;
}

function mongoGuard(guard: AppGuard) {
  const filter: Record<string, unknown> = {};
  if (guard.status !== undefined) filter.status = guard.status;
  if (guard.createdById) filter.createdById = new ObjectId(guard.createdById);
  if (guard.assignedToId) filter.assignedToId = new ObjectId(guard.assignedToId);
  if (guard.submissionVersion === null) filter.submission = { $exists: false };
  if (typeof guard.submissionVersion === "number") filter["submission.version"] = guard.submissionVersion;
  return filter;
}

export async function patchAppDocument(
  collection: AppCollection,
  id: string,
  patch: Record<string, unknown>,
  guard: AppGuard,
) {
  let primaryErrorValue: unknown;
  try {
    const client = getSupabaseClient();
    await flushOutbox(collection);
    const { data: currentRow, error: readError } = await client.from(collection).select("_id,document,revision").eq("_id", id).eq("deleted", false).maybeSingle();
    if (readError) throw readError;
    if (!currentRow) return { updated: false, primary: true, document: null };
    const current = fromRow(currentRow as RecordRow);
    if (!guardMatches(current, guard)) return { updated: false, primary: true, document: current };
    const updatedAt = patch.updatedAt ?? new Date();
    const updated = { ...current, ...patch, _id: current._id, updatedAt } as AppDocument;
    const revision = nextRevision(Number(currentRow.revision));
    const row = toRow(collection, updated, revision);
    const { data, error } = await client.from(collection).update(row).eq("_id", id).eq("revision", currentRow.revision).select("_id,document,revision").maybeSingle();
    if (error) throw error;
    if (!data) return { updated: false, primary: true, document: current };
    const saved = fromRow(data as RecordRow);
    try {
      const mirrored = await mirrorToMongo(collection, saved, revision);
      if (!mirrored) throw new Error(`MongoDB has a newer revision of tasks/${id}.`);
      const { error: markError } = await client.from(collection).update({ mongo_synced: true })
        .eq("_id", id).eq("revision", revision).eq("deleted", false);
      if (markError) throw markError;
    } catch (error) {
      primaryError(`MongoDB mirror update failed for ${collection}/${id}.`, error);
    }
    return { updated: true, primary: true, document: saved };
  } catch (error) {
    primaryErrorValue = error;
    primaryError(`Supabase update failed for ${collection}/${id}; using MongoDB.`, error);
  }

  const objectId = new ObjectId(id);
  const now = patch.updatedAt ?? new Date();
  try {
    const mongoCollection = getDatabase().collection(collection);
    const before = await mongoCollection.findOne({ _id: objectId, ...mongoGuard(guard) });
    if (!before) return { updated: false, primary: false, document: null };
    const revision = await nextMongoRevision(collection, objectId);
    const result = await mongoCollection.updateOne(
      { _id: objectId, ...mongoGuard(guard) },
      { $set: { ...patch, updatedAt: now }, $unset: { _revision: "" } },
    );
    if (!result.matchedCount) return { updated: false, primary: false, document: null };
    const saved = await mongoCollection.findOne({ _id: objectId });
    if (!saved) return { updated: false, primary: false, document: null };
    await saveOutbox({ _id: `${collection}:${id}`, collection, id, operation: "upsert", data: plainData(saved as AppDocument), revision, createdAt: new Date() });
    return { updated: true, primary: false, document: saved as unknown as AppDocument };
  } catch (mongoFailure) {
    throw new AggregateError([primaryErrorValue, mongoFailure], `Could not update ${collection}/${id} in Supabase or MongoDB.`);
  }
}

export async function deleteAppDocument(collection: AppCollection, id: string) {
  let primaryFailure: unknown;
  let primarySucceeded = false;
  try {
    const client = getSupabaseClient();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: current, error: readError } = await client.from(collection).select("revision")
        .eq("_id", id).eq("deleted", false).maybeSingle();
      if (readError) throw readError;
      if (!current) break;
      const revision = nextRevision(Number(current.revision));
      const { data, error } = await client.from(collection).update({ deleted: true, mongo_synced: false, revision })
        .eq("_id", id).eq("revision", current.revision).eq("deleted", false)
        .select("_id").maybeSingle();
      if (error) throw error;
      if (data) break;
      if (attempt === 3) throw new Error(`Could not delete ${collection}/${id} because it kept changing.`);
    }
    primarySucceeded = true;
  } catch (error) {
    primaryFailure = error;
    primaryError(`Supabase delete failed for ${collection}/${id}; deleting from MongoDB.`, error);
  }

  let mongoFailure: unknown;
  let mongoRevision = nextRevision(0);
  try {
    const mongoCollection = getDatabase().collection(collection);
    const objectId = new ObjectId(id);
    mongoRevision = await nextMongoRevision(collection, objectId);
    await mongoCollection.deleteOne({ _id: objectId });
  } catch (error) {
    mongoFailure = error;
    primaryError(`MongoDB mirror delete failed for ${collection}/${id}.`, error);
  }

  if (primarySucceeded) {
    if (!mongoFailure) {
      const { error } = await getSupabaseClient().from(collection).delete().eq("_id", id).eq("deleted", true);
      if (error) primaryError(`Could not clear delete tombstone for ${collection}/${id}.`, error);
      else await clearOutbox(collection, id);
    }
    return { primary: true, secondary: !mongoFailure };
  }
  if (!mongoFailure) {
    await saveOutbox({ _id: `${collection}:${id}`, collection, id, operation: "delete", revision: mongoRevision, createdAt: new Date() });
    return { primary: false, secondary: true };
  }
  throw new AggregateError([primaryFailure, mongoFailure], `Could not delete ${collection}/${id} from Supabase or MongoDB.`);
}
