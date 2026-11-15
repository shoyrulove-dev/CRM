import "server-only";
import { getIntegrationConfig } from "./integration-config";

export async function sendEmail(to: string, subject: string, text: string, idempotencyKey?: string) {
  const config = await getIntegrationConfig();
  if (!config.resendApiKey || !config.emailFrom) throw new Error("EMAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from: config.emailFrom, to, subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("EMAIL_SEND_FAILED");
  return (await response.json()) as { id: string };
}
