import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const [, , envFile, command, ...args] = process.argv;

if (!envFile || !command) {
  console.error("Usage: node scripts/with-env.mjs <env-file> <command> [...args]");
  process.exit(1);
}

const env = { ...process.env };
const lines = readFileSync(envFile, "utf8").split(/\r?\n/);

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;

  const key = trimmed.slice(0, separator).trim();
  const rawValue = trimmed.slice(separator + 1).trim();
  env[key] = rawValue.replace(/^["']|["']$/g, "");
}

const child = spawn(command, args, {
  env,
  shell: true,
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
