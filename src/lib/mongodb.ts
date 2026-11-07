import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "nichiei_crm";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

export function hasDatabase() {
  return Boolean(uri);
}

export async function getDatabase() {
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!global.mongoClientPromise) {
    global.mongoClientPromise = new MongoClient(uri, {
      maxPoolSize: 10,
    }).connect();
  }
  return (await global.mongoClientPromise).db(databaseName);
}
