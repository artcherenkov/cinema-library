import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main(process.argv.slice(2), process.env);

async function main(argv, env) {
  const config = createConfig(normalizeArgv(argv), env);
  const paths = createPaths();

  logStep("Проверяю Cloud Function artifact");
  await assertFile(paths.artifactPath);

  const publishCommand = createPublishCommand(config, paths);

  logStep(config.dryRun ? "Показываю команду публикации" : "Публикую Cloud Function");
  (config.dryRun ? printCommand : runCommand)(publishCommand);

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
      description: { type: "string" },
      "dry-run": { default: false, type: "boolean" },
      entrypoint: { type: "string" },
      "execution-timeout": { type: "string" },
      "function-id": { type: "string" },
      "function-name": { type: "string" },
      memory: { type: "string" },
      runtime: { type: "string" },
      "service-account-id": { type: "string" },
    },
    strict: true,
  });
  const functionId = values["function-id"] ?? env.CLOUD_FUNCTION_ID;
  const functionName = values["function-name"] ?? env.CLOUD_FUNCTION_NAME;

  if (!functionId && !functionName) {
    throw new Error(
      "Set CLOUD_FUNCTION_ID or CLOUD_FUNCTION_NAME, or pass --function-id/--function-name.",
    );
  }

  if (functionId && functionName) {
    throw new Error("Pass only one function reference: --function-id or --function-name.");
  }

  return {
    description: values.description ?? env.CLOUD_FUNCTION_DESCRIPTION,
    dryRun: values["dry-run"] === true || env.CLOUD_FUNCTION_DRY_RUN === "1",
    entrypoint: values.entrypoint ?? env.CLOUD_FUNCTION_ENTRYPOINT ?? "index.handler",
    executionTimeout: values["execution-timeout"] ?? env.CLOUD_FUNCTION_EXECUTION_TIMEOUT ?? "3s",
    functionId,
    functionName,
    memory: values.memory ?? env.CLOUD_FUNCTION_MEMORY ?? "128MB",
    runtime: values.runtime ?? env.CLOUD_FUNCTION_RUNTIME ?? "nodejs22",
    serviceAccountId: values["service-account-id"] ?? env.CLOUD_FUNCTION_SERVICE_ACCOUNT_ID,
  };
}

function createPaths() {
  const artifactDir = path.join(rootDir, "artifacts");

  return {
    artifactPath: path.join(artifactDir, "cloud-function.zip"),
  };
}

function createPublishCommand(config, paths) {
  return {
    args: [
      "serverless",
      "function",
      "version",
      "create",
      ...createFunctionReferenceArgs(config),
      "--runtime",
      config.runtime,
      "--entrypoint",
      config.entrypoint,
      "--memory",
      config.memory,
      "--execution-timeout",
      config.executionTimeout,
      "--source-path",
      paths.artifactPath,
      ...createOptionalArg("--service-account-id", config.serviceAccountId),
      ...createOptionalArg("--description", config.description),
    ],
    command: "yc",
  };
}

function createFunctionReferenceArgs(config) {
  if (config.functionId) {
    return ["--function-id", config.functionId];
  }

  return ["--function-name", config.functionName];
}

function createOptionalArg(name, value) {
  return value ? [name, value] : [];
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

async function assertFile(filePath) {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error(`Expected file does not exist: ${filePath}`);
  }
}

function logStep(message) {
  console.log(`==> ${message}`);
}
