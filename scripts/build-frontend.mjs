import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main();

async function main() {
  const paths = createPaths();

  logStep("Собираю frontend");
  runCommand("pnpm", ["--filter", "@cinema-library/frontend", "build"]);

  logStep("Копирую frontend artifact");
  await rm(paths.frontendArtifactDir, { force: true, recursive: true });
  await mkdir(path.dirname(paths.frontendArtifactDir), { recursive: true });
  await cp(paths.frontendDistDir, paths.frontendArtifactDir, { recursive: true });

  await assertFile(path.join(paths.frontendArtifactDir, "index.html"));

  logStep(`Готово: ${path.relative(rootDir, paths.frontendArtifactDir)}`);
}

function createPaths() {
  return {
    frontendArtifactDir: path.join(rootDir, "artifacts", "frontend"),
    frontendDistDir: path.join(rootDir, "apps", "frontend", "dist"),
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

async function assertFile(filePath) {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error(`Expected file does not exist: ${filePath}`);
  }
}

function logStep(message) {
  console.log(`==> ${message}`);
}
