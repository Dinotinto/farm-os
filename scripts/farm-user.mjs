#!/usr/bin/env node
// Creates password hashes for Farm OS accounts. The password is typed at a hidden
// prompt (or piped on stdin), so it never ends up in shell history or a file.
//
//   npm run user:hash                                        -> prints a hash (e.g. for ADMIN_PASSWORD_HASH)
//   npm run user:add -- --email a@b.com --name Ada --role owner
//                                                            -> prints one FARM_USERS entry
//
// Put the entries in a JSON array in the FARM_USERS environment variable.
// Must stay in step with src/lib/passwords.ts (same scrypt format).
import { randomBytes, scryptSync } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const ROLES = ["owner", "manager", "marketer"];

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[(i += 1)] : "true";
    args[key.slice(2)] = value;
  }
  return args;
}

function readPiped() {
  return new Promise((resolve) => {
    let text = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (text += chunk));
    process.stdin.on("end", () => resolve(text.replace(/\r?\n$/, "")));
  });
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    process.stderr.write(question);
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    const onData = (char) => {
      if (char === "\u0003") {
        process.stdin.setRawMode(false);
        reject(new Error("Cancelled"));
      } else if (char === "\r" || char === "\n" || char === "\u0004") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stderr.write("\n");
        resolve(value);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function readPassword() {
  if (!process.stdin.isTTY) return readPiped();
  const first = await promptHidden("Password: ");
  const second = await promptHidden("Repeat password: ");
  if (first !== second) throw new Error("Passwords didn't match.");
  return first;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const addingUser = Boolean(args.email || args.name || args.role);

  if (addingUser) {
    if (!args.email || !args.email.includes("@")) throw new Error("--email is required.");
    if (!args.name || args.name === "true") throw new Error("--name is required (shown in the app).");
    if (!ROLES.includes(args.role)) throw new Error(`--role must be one of: ${ROLES.join(", ")}.`);
  }

  const password = await readPassword();
  if (password.length < 10) throw new Error("Use at least 10 characters.");
  const passwordHash = hashPassword(password);

  if (addingUser) {
    const entry = { email: args.email.toLowerCase().trim(), displayName: args.name, role: args.role, passwordHash };
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  } else {
    process.stdout.write(`${passwordHash}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
