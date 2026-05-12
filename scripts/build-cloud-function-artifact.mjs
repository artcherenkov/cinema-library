import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(rootDir, "artifacts");
const artifactPath = path.join(artifactDir, "cloud-function.zip");
const functionEntryPath = path.join(rootDir, "apps", "backend", "dist", "index.js");

run("pnpm", ["--filter", "@cinema-library/backend", "build"]);

await mkdir(artifactDir, { recursive: true });
await rm(artifactPath, { force: true });

run("zip", ["-j", artifactPath, functionEntryPath]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}
