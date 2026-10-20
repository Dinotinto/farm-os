import { execFileSync } from "node:child_process";

const isVercel = process.env.VERCEL === "1";
const schema = isVercel ? "prisma/schema.postgres.prisma" : "prisma/schema.prisma";

execFileSync("npx", ["prisma", "generate", "--schema", schema], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
