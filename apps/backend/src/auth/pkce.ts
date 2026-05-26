import { createHash, randomBytes } from "node:crypto";

function createRandomUrlToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

function createPkcePair(): { codeChallenge: string; codeVerifier: string } {
  const codeVerifier = createRandomUrlToken(32);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    codeChallenge,
    codeVerifier,
  };
}

export { createPkcePair, createRandomUrlToken };
