import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { collections } from "./data-store";
import { getDatabase, hasDatabase } from "./mongodb";
export type IntegrationConfig = {
  haravanShop?: string;
  haravanAccessToken?: string;
  haravanWebhookSecret?: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
};
function key() {
  return createHash("sha256")
    .update(process.env.SESSION_SECRET || "nichiei-local-settings-key")
    .digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv),
    body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    body.toString("base64"),
  ].join(".");
}
function decrypt(value: string) {
  try {
    const [iv, tag, body] = value.split("."),
      d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      d.update(Buffer.from(body, "base64")),
      d.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  const env = {
    haravanShop: process.env.HARAVAN_SHOP,
    haravanAccessToken: process.env.HARAVAN_ACCESS_TOKEN,
    haravanWebhookSecret: process.env.HARAVAN_WEBHOOK_SECRET,
    r2Endpoint: process.env.R2_ENDPOINT,
    r2Bucket: process.env.R2_BUCKET,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  };
  if (!hasDatabase()) return env;
  const row = await (
    await getDatabase()
  )
    .collection(collections.settings)
    .findOne({ id: "integrations" });
  if (!row?.payload) return env;
  return { ...env, ...JSON.parse(decrypt(String(row.payload)) || "{}") };
}
export async function saveIntegrationConfig(input: IntegrationConfig) {
  if (!hasDatabase()) throw new Error("Kho dữ liệu chưa sẵn sàng");
  const current = await getIntegrationConfig(),
    next = {
      ...current,
      ...Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined && v !== ""),
      ),
    };
  await (await getDatabase()).collection(collections.settings).updateOne(
    { id: "integrations" },
    {
      $set: {
        id: "integrations",
        payload: encrypt(JSON.stringify(next)),
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return next;
}
export function configStatus(c: IntegrationConfig) {
  return {
    haravan: Boolean(c.haravanAccessToken),
    r2: Boolean(
      c.r2Endpoint && c.r2Bucket && c.r2AccessKeyId && c.r2SecretAccessKey,
    ),
  };
}
