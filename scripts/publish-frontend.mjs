import { spawnSync } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const immutableCacheControl = "public, max-age=31536000, immutable";
const shellCacheControl = "no-cache";

await main(process.argv.slice(2), process.env);

async function main(argv, env) {
  const config = createConfig(normalizeArgv(argv), env);
  const paths = createPaths();

  logStep("Проверяю frontend artifact");
  await assertFrontendArtifact(paths);

  const artifactFiles = await collectArtifactFiles(paths.frontendArtifactDir);
  const publishPlan = createPublishPlan(config, {
    artifactFiles,
  });

  logStep(config.dryRun ? "Показываю план публикации" : "Публикую frontend в Object Storage");
  publishPlan.forEach(config.dryRun ? printCommand : runCommand);

  logStep("Готово");
}

function normalizeArgv(argv) {
  return argv[0] === "--" ? argv.slice(1) : argv;
}

function createConfig(argv, env) {
  const { values } = parseArgs({
    allowPositionals: false,
    args: argv,
    options: {
      bucket: { type: "string" },
      clear: { default: false, type: "boolean" },
      "dry-run": { default: false, type: "boolean" },
      prefix: { type: "string" },
    },
    strict: true,
  });
  const bucket = values.bucket ?? env.FRONTEND_BUCKET;

  if (!bucket) {
    throw new Error("Set FRONTEND_BUCKET or pass --bucket <bucket-name>.");
  }

  return {
    bucket,
    dryRun: values["dry-run"] === true || env.FRONTEND_DRY_RUN === "1",
    prefix: normalizePrefix(values.prefix ?? env.FRONTEND_PREFIX ?? ""),
    shouldClear: values.clear === true || env.FRONTEND_CLEAR_BEFORE_UPLOAD === "1",
  };
}

function createPaths() {
  const frontendArtifactDir = path.join(rootDir, "artifacts", "frontend");

  return {
    frontendArtifactDir,
    indexHtmlPath: path.join(frontendArtifactDir, "index.html"),
  };
}

async function assertFrontendArtifact(paths) {
  await assertDirectory(paths.frontendArtifactDir);
  await assertFile(paths.indexHtmlPath);
}

function createPublishPlan(config, { artifactFiles }) {
  return [
    ...createClearBucketCommand(config),
    ...createUploadArtifactCommands(config, artifactFiles),
  ];
}

function createClearBucketCommand(config) {
  if (!config.shouldClear) {
    return [];
  }

  return [
    {
      args: [
        "storage",
        "s3",
        "rm",
        toS3Uri(config.bucket, config.prefix),
        "--recursive",
        "--only-show-errors",
      ],
      command: "yc",
    },
  ];
}

function createUploadArtifactCommands(config, artifactFiles) {
  return artifactFiles.map((artifactFile) => ({
    args: [
      "storage",
      "s3",
      "cp",
      artifactFile.absolutePath,
      toS3Uri(config.bucket, `${config.prefix}${artifactFile.key}`),
      "--cache-control",
      getCacheControl(artifactFile.key),
      "--content-type",
      getContentType(artifactFile.key),
      "--only-show-errors",
    ],
    command: "yc",
  }));
}

function normalizePrefix(prefix) {
  if (prefix === "") {
    return "";
  }

  const withoutLeadingSlash = prefix.replace(/^\/+/, "");

  return withoutLeadingSlash.endsWith("/") ? withoutLeadingSlash : `${withoutLeadingSlash}/`;
}

function toS3Uri(bucket, prefix) {
  return `s3://${bucket}/${prefix}`;
}

async function collectArtifactFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectArtifactFiles(entryPath);
      }

      if (entry.isFile()) {
        return [createArtifactFile(entryPath)];
      }

      return [];
    }),
  );

  return files.flat().sort((left, right) => left.key.localeCompare(right.key));
}

function createArtifactFile(absolutePath) {
  return {
    absolutePath,
    key: path
      .relative(path.join(rootDir, "artifacts", "frontend"), absolutePath)
      .split(path.sep)
      .join("/"),
  };
}

function getCacheControl(key) {
  return key.startsWith("assets/") ? immutableCacheControl : shellCacheControl;
}

function getContentType(key) {
  const extension = path.extname(key).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".woff2": "font/woff2",
  };

  return contentTypes[extension] ?? "application/octet-stream";
}

function runCommand({ args, command }) {
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

function printCommand(command) {
  console.log(formatCommand(command));
}

function formatCommand({ args, command }) {
  return [command, ...args].map(quoteShellArgument).join(" ");
}

function quoteShellArgument(value) {
  if (/^[\w./:=,@+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function assertDirectory(directoryPath) {
  const directoryStat = await stat(directoryPath);

  if (!directoryStat.isDirectory()) {
    throw new Error(`Expected directory does not exist: ${directoryPath}`);
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
