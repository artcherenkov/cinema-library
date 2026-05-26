import { randomUUID } from "node:crypto";

import type { VerifiedTelegramIdentity } from "../auth/oidc-client.js";
import type { AuthUser, UsersRepository } from "../services/users.js";
import type { QueryClient } from "../ydb/client.js";

type UserRow = {
  avatar_url: string;
  display_name: string;
  user_id: string;
};

type TelegramAccountRow = {
  user_id: string;
};

type YqlExecutor = <T extends any[] = unknown[], P extends any[] = unknown[]>(
  strings: string | TemplateStringsArray,
  ...values: P
) => PromiseLike<{ [K in keyof T]: T[K][] }>;

class YdbUsersRepository implements UsersRepository {
  readonly #getQueryClient: () => Promise<QueryClient>;

  constructor(getQueryClient: () => Promise<QueryClient>) {
    this.#getQueryClient = getQueryClient;
  }

  async findOrCreateByTelegramIdentity(
    identity: VerifiedTelegramIdentity,
    now: Date,
  ): Promise<AuthUser> {
    const sql = await this.#getQueryClient();
    const existingUser = await this.#findExistingTelegramUser(sql, identity, now);

    if (existingUser !== null) {
      return existingUser;
    }

    try {
      return await this.#createTelegramUser(sql, identity, now);
    } catch (error) {
      const userCreatedByConcurrentLogin = await this.#findExistingTelegramUser(sql, identity, now);

      if (userCreatedByConcurrentLogin !== null) {
        return userCreatedByConcurrentLogin;
      }

      throw error;
    }
  }

  async #findExistingTelegramUser(
    sql: QueryClient,
    identity: VerifiedTelegramIdentity,
    now: Date,
  ): Promise<AuthUser | null> {
    return sql.transaction(async (tx) => {
      const account = await selectTelegramAccount(tx, identity.sub);

      if (account === null) {
        return null;
      }

      const user = await selectUser(tx, account.user_id);

      if (user === null) {
        throw new Error("Telegram account points to a missing user.");
      }

      await updateTelegramAccount(tx, identity, now);
      await updateUserAfterLogin(tx, account.user_id, identity, now);

      return toAuthUser({
        ...user,
        avatar_url: identity.pictureUrl,
        display_name: createDisplayName(identity),
      });
    });
  }

  async #createTelegramUser(
    sql: QueryClient,
    identity: VerifiedTelegramIdentity,
    now: Date,
  ): Promise<AuthUser> {
    const userId = randomUUID();
    const user: AuthUser = {
      avatarUrl: identity.pictureUrl,
      displayName: createDisplayName(identity),
      userId,
    };

    await sql.transaction(async (tx) => {
      await tx`
        INSERT INTO users (
          user_id,
          display_name,
          avatar_url,
          created_at,
          updated_at,
          last_login_at
        )
        VALUES (
          ${user.userId},
          ${user.displayName},
          ${user.avatarUrl},
          ${now},
          ${now},
          ${now}
        );
      `;

      await tx`
        INSERT INTO telegram_accounts (
          telegram_sub,
          user_id,
          telegram_user_id,
          username,
          name,
          picture_url,
          linked_at,
          updated_at
        )
        VALUES (
          ${identity.sub},
          ${user.userId},
          ${identity.telegramUserId},
          ${identity.preferredUsername},
          ${identity.name},
          ${identity.pictureUrl},
          ${now},
          ${now}
        );
      `;
    });

    return user;
  }
}

async function selectTelegramAccount(
  sql: YqlExecutor,
  telegramSub: string,
): Promise<TelegramAccountRow | null> {
  const [rows] = await sql<[TelegramAccountRow]>`
    SELECT user_id
    FROM telegram_accounts
    WHERE telegram_sub = ${telegramSub}
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

async function selectUser(sql: YqlExecutor, userId: string): Promise<UserRow | null> {
  const [rows] = await sql<[UserRow]>`
    SELECT user_id, display_name, avatar_url
    FROM users
    WHERE user_id = ${userId}
    LIMIT 1;
  `;

  return rows[0] ?? null;
}

async function updateTelegramAccount(
  sql: YqlExecutor,
  identity: VerifiedTelegramIdentity,
  now: Date,
): Promise<void> {
  await sql`
    UPDATE telegram_accounts
    SET
      telegram_user_id = ${identity.telegramUserId},
      username = ${identity.preferredUsername},
      name = ${identity.name},
      picture_url = ${identity.pictureUrl},
      updated_at = ${now}
    WHERE telegram_sub = ${identity.sub};
  `;
}

async function updateUserAfterLogin(
  sql: YqlExecutor,
  userId: string,
  identity: VerifiedTelegramIdentity,
  now: Date,
): Promise<void> {
  await sql`
    UPDATE users
    SET
      display_name = ${createDisplayName(identity)},
      avatar_url = ${identity.pictureUrl},
      updated_at = ${now},
      last_login_at = ${now}
    WHERE user_id = ${userId};
  `;
}

function createDisplayName(identity: VerifiedTelegramIdentity): string {
  return identity.name || identity.preferredUsername || "Пользователь Telegram";
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    avatarUrl: row.avatar_url,
    displayName: row.display_name,
    userId: row.user_id,
  };
}

export { YdbUsersRepository };
