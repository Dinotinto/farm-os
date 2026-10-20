// Fails the deploy early when production settings are missing or unsafe.
// Runs before every Vercel build (see vercel.json) and in `npm run deploy:check`.
const problems = [];
const warnings = [];

const required = ["DATABASE_URL", "SESSION_SECRET", "FARM_USERS"];
for (const key of required) {
  if (!process.env[key]) problems.push(`${key} is not set.`);
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgresql://")) {
  problems.push("DATABASE_URL must be a PostgreSQL connection string for UAT/production deploys.");
}

if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
  problems.push("SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32");
}

const isHash = (value) => typeof value === "string" && value.startsWith("scrypt$") && value.split("$").length === 6;

if (process.env.FARM_USERS) {
  try {
    const users = JSON.parse(process.env.FARM_USERS);
    if (!Array.isArray(users) || users.length === 0) {
      problems.push("FARM_USERS must be a non-empty JSON array.");
    } else {
      users.forEach((user, index) => {
        if (!user?.email || !user?.displayName || !["owner", "manager", "marketer"].includes(user?.role)) {
          problems.push(`FARM_USERS[${index}] needs email, displayName and role (owner, manager or marketer).`);
        }
        if (!isHash(user?.passwordHash)) {
          problems.push(`FARM_USERS[${index}].passwordHash must be a hash from \`npm run user:add\`.`);
        }
        if ("password" in (user ?? {})) {
          problems.push(`FARM_USERS[${index}] contains a plain "password" field. Remove it; only passwordHash is used.`);
        }
      });
      if (!users.some((user) => user?.role === "owner")) warnings.push("FARM_USERS has no owner account.");
    }
  } catch {
    problems.push("FARM_USERS is not valid JSON.");
  }
}

if (process.env.ADMIN_PASSWORD) {
  problems.push("ADMIN_PASSWORD is no longer used. Replace it with ADMIN_PASSWORD_HASH from `npm run user:hash`.");
}
if (process.env.ADMIN_PASSWORD_HASH && !isHash(process.env.ADMIN_PASSWORD_HASH)) {
  problems.push("ADMIN_PASSWORD_HASH must be a hash from `npm run user:hash`.");
}
if (!process.env.ADMIN_PASSWORD_HASH) warnings.push("ADMIN_PASSWORD_HASH is not set, so /admin is locked.");
if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
  warnings.push("NEXT_PUBLIC_GEMINI_API_KEY is set. Rename it to GEMINI_API_KEY: NEXT_PUBLIC_ values can end up in browser code.");
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);

if (problems.length > 0) {
  console.error("Production environment is not ready:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("Production environment looks ready.");
