import "server-only";
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getIntegrationConfig } from "./integration-config";

export async function testR2Connection() {
  const config = await getIntegrationConfig();
  if (
    !config.r2Endpoint ||
    !config.r2Bucket ||
    !config.r2AccessKeyId ||
    !config.r2SecretAccessKey
  )
    throw new Error("Cấu hình Cloudflare R2 chưa đầy đủ.");
  const client = new S3Client({
    region: "auto",
    endpoint: config.r2Endpoint.replace(/\/$/, ""),
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
  const key = `system-checks/nichiei-crm-${Date.now()}.txt`;
  await client.send(new HeadBucketCommand({ Bucket: config.r2Bucket }));
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: `Nichiei CRM R2 check ${new Date().toISOString()}`,
      ContentType: "text/plain; charset=utf-8",
    }),
  );
  await client.send(
    new DeleteObjectCommand({ Bucket: config.r2Bucket, Key: key }),
  );
  return { bucket: config.r2Bucket, checkedAt: new Date().toISOString() };
}
