import { MongoClient } from "mongodb";
import type { Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var __erdMongoClient: MongoClient | undefined;
}

function mongoUri() {
  const uri = process.env.MONGODB_URI;
  if (uri) return uri;
  if (process.env.NODE_ENV === "production") throw new Error("MONGODB_URI is required in production.");
  return "mongodb://127.0.0.1:27017";
}

export function getMongoClient() {
  if (!globalThis.__erdMongoClient) {
    globalThis.__erdMongoClient = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 5000 });
  }
  return globalThis.__erdMongoClient;
}

export function getDatabase(): Db {
  return getMongoClient().db(process.env.MONGODB_DB || "erd_studio");
}
