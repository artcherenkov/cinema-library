import { createHash, randomBytes } from "node:crypto";

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export { createSessionToken, hashSessionToken };
