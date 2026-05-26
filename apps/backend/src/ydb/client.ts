import { EnvironCredentialsProvider } from "@ydbjs/auth/environ";
import { Driver } from "@ydbjs/core";
import { query, type QueryClient } from "@ydbjs/query";

import type { AppConfig } from "../config.js";

let queryClientPromise: Promise<QueryClient> | undefined;

function getYdbQueryClient(config: AppConfig): Promise<QueryClient> {
  queryClientPromise ??= createYdbQueryClient(config);

  return queryClientPromise;
}

async function createYdbQueryClient(config: AppConfig): Promise<QueryClient> {
  const credentialsProvider = new EnvironCredentialsProvider(config.ydbConnectionString);
  const driver = new Driver(config.ydbConnectionString, {
    credentialsProvider,
    secureOptions: credentialsProvider.secureOptions,
  });

  await driver.ready();

  return query(driver);
}

export { getYdbQueryClient };
export type { QueryClient };
