import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main();

async function main() {
  const paths = createPaths();

  logStep("Собираю backend");
  runCommand("pnpm", ["--filter", "@cinema-library/backend", "build"]);

  logStep("Упаковываю Cloud Function");
  await mkdir(paths.artifactDir, { recursive: true });
  await rm(paths.artifactPath, { force: true });
  runCommand("zip", ["-j", paths.artifactPath, paths.functionEntryPath]);

  logStep(`Готово: ${path.relative(rootDir, paths.artifactPath)}`);
}

function createPaths() {
  const artifactDir = path.join(rootDir, "artifacts");

  return {
    artifactDir,
    artifactPath: path.join(artifactDir, "cloud-function.zip"),
    functionEntryPath: path.join(rootDir, "apps", "backend", "dist", "index.js"),
  };
}

function runCommand(command, args) {
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

function logStep(message) {
  console.log(`==> ${message}`);
}
