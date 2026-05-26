import type { SessionsRepository } from "../services/sessions.js";
import type { AuthUser } from "../services/users.js";
import type { QueryClient } from "../ydb/client.js";

type SessionRow = {
  expires_at: Date;
  user_id: string;
};

type UserRow = {
  avatar_url: string;
  display_name: string;
  user_id: string;
};

class YdbSessionsRepository implements SessionsRepository {
  readonly #getQueryClient: () => Promise<QueryClient>;

  constructor(getQueryClient: () => Promise<QueryClient>) {
    this.#getQueryClient = getQueryClient;
  }

  async create(session: {
    createdAt: Date;
    expiresAt: Date;
    lastSeenAt: Date;
    sessionIdHash: string;
    userId: string;
  }): Promise<void> {
    const sql = await this.#getQueryClient();

    await sql`
      INSERT INTO sessions (
        session_id_hash,
        user_id,
        created_at,
        last_seen_at,
        expires_at
      )
      VALUES (
        ${session.sessionIdHash},
        ${session.userId},
        ${session.createdAt},
        ${session.lastSeenAt},
        ${session.expiresAt}
      );
    `;
  }

  async findActiveByHash(
    sessionIdHash: string,
    now: Date,
  ): Promise<{ expiresAt: Date; user: AuthUser } | null> {
    const sql = await this.#getQueryClient();
    const [sessionRows] = await sql<[SessionRow]>`
      SELECT user_id, expires_at
      FROM sessions
      WHERE session_id_hash = ${sessionIdHash}
        AND expires_at > ${now}
        AND revoked_at IS NULL
      LIMIT 1;
    `;
    const session = sessionRows[0];

    if (session === undefined) {
      return null;
    }

    const [userRows] = await sql<[UserRow]>`
      SELECT user_id, display_name, avatar_url
      FROM users
      WHERE user_id = ${session.user_id}
      LIMIT 1;
    `;
    const user = userRows[0];

    if (user === undefined) {
      return null;
    }

    return {
      expiresAt: session.expires_at,
      user: {
        avatarUrl: user.avatar_url,
        displayName: user.display_name,
        userId: user.user_id,
      },
    };
  }

  async revokeByHash(sessionIdHash: string, revokedAt: Date): Promise<void> {
    const sql = await this.#getQueryClient();

    await sql`
      UPDATE sessions
      SET revoked_at = ${revokedAt}
      WHERE session_id_hash = ${sessionIdHash};
    `;
  }

  async touch(sessionIdHash: string, lastSeenAt: Date): Promise<void> {
    const sql = await this.#getQueryClient();

    await sql`
      UPDATE sessions
      SET last_seen_at = ${lastSeenAt}
      WHERE session_id_hash = ${sessionIdHash};
    `;
  }
}

export { YdbSessionsRepository };
