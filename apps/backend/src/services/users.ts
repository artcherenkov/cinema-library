import type { VerifiedTelegramIdentity } from "../auth/oidc-client.js";

type AuthUser = {
  avatarUrl: string;
  displayName: string;
  userId: string;
};

type UsersRepository = {
  findOrCreateByTelegramIdentity(identity: VerifiedTelegramIdentity, now: Date): Promise<AuthUser>;
};

type UsersService = {
  findOrCreateTelegramUser(identity: VerifiedTelegramIdentity, now: Date): Promise<AuthUser>;
};

function createUsersService(repository: UsersRepository): UsersService {
  return {
    findOrCreateTelegramUser(identity, now) {
      return repository.findOrCreateByTelegramIdentity(identity, now);
    },
  };
}

export { createUsersService };
export type { AuthUser, UsersRepository, UsersService };
