import crypto from "node:crypto";
import { env } from "@/core/env";

const IV_BYTES = 12;

function getSecretKey() {
  const material = env.tokenEncryptionKey || env.adminSessionSecret;
  if (!material) {
    throw new Error("TOKEN_ENCRYPTION_KEY or ADMIN_SESSION_SECRET is required to protect sensitive tokens.");
  }

  return crypto.createHash("sha256").update(material).digest();
}

export function sealJson(value: unknown) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openJson<T>(value: string): T | null {
  try {
    const [ivPart, tagPart, payloadPart] = String(value || "").split(".");
    if (!ivPart || !tagPart || !payloadPart) {
      return null;
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getSecretKey(),
      Buffer.from(ivPart, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}
