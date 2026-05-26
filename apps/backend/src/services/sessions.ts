import { createSessionToken, hashSessionToken } from "../auth/session-token.js";
import type { AuthUser } from "./users.js";

type CurrentUser = AuthUser;

type SessionRecord = {
  expiresAt: Date;
  user: CurrentUser;
};

type SessionsRepository = {
  create(session: {
    createdAt: Date;
    expiresAt: Date;
    lastSeenAt: Date;
    sessionIdHash: string;
    userId: string;
  }): Promise<void>;
  findActiveByHash(sessionIdHash: string, now: Date): Promise<SessionRecord | null>;
  revokeByHash(sessionIdHash: string, revokedAt: Date): Promise<void>;
  touch(sessionIdHash: string, lastSeenAt: Date): Promise<void>;
};

type SessionsService = {
  createSession(userId: string, now: Date): Promise<{ expiresAt: Date; token: string }>;
  findCurrentUser(token: string | undefined, now: Date): Promise<CurrentUser | null>;
  revokeSession(token: string | undefined, now: Date): Promise<void>;
};

function createSessionsService(
  repository: SessionsRepository,
  sessionMaxAgeSeconds: number,
): SessionsService {
  return {
    async createSession(userId, now) {
      const token = createSessionToken();
      const sessionIdHash = hashSessionToken(token);
      const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds * 1000);

      await repository.create({
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
        sessionIdHash,
        userId,
      });

      return {
        expiresAt,
        token,
      };
    },

    async findCurrentUser(token, now) {
      if (token === undefined || token === "") {
        return null;
      }

      const sessionIdHash = hashSessionToken(token);
      const session = await repository.findActiveByHash(sessionIdHash, now);

      if (session === null) {
        return null;
      }

      await repository.touch(sessionIdHash, now);

      return session.user;
    },

    async revokeSession(token, now) {
      if (token === undefined || token === "") {
        return;
      }

      await repository.revokeByHash(hashSessionToken(token), now);
    },
  };
}

export { createSessionsService };
export type { CurrentUser, SessionsRepository, SessionsService };
