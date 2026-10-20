import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const [, , filePath = "data/sample-farm.json"] = process.argv;
const prisma = new PrismaClient();

async function main() {
  const source = JSON.parse(await readFile(filePath, "utf8"));
  const farm = await prisma.farm.create({
    data: {
      name: source.farm.name,
      location: source.farm.location,
      plots: {
        create: source.plots ?? []
      },
      items: {
        create: source.inventory ?? []
      }
    }
  });

  console.log(`Imported farm ${farm.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
