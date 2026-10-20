import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `DO $$ BEGIN CREATE TYPE "CropStage" AS ENUM ('PLANNING', 'NURSERY', 'TRANSPLANTED', 'FLOWERING', 'HARVESTING', 'COMPLETED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `DO $$ BEGIN CREATE TYPE "FarmTaskStatus" AS ENUM ('OPEN', 'PLANNED', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `CREATE TABLE IF NOT EXISTS "Farm" (
    "id" text PRIMARY KEY,
    "name" text NOT NULL,
    "location" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "Plot" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "name" text NOT NULL,
    "sizeHectares" numeric,
    "soilNotes" text,
    "currentCrop" text,
    "healthStatus" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "CropCycle" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "plotId" text REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "crop" text NOT NULL,
    "variety" text,
    "stage" "CropStage" NOT NULL DEFAULT 'PLANNING',
    "nurseryDate" timestamp(3),
    "transplantDate" timestamp(3),
    "expectedHarvestStart" timestamp(3),
    "expectedHarvestEnd" timestamp(3),
    "plants" integer NOT NULL DEFAULT 0,
    "inputCost" numeric NOT NULL DEFAULT 0,
    "projectedRevenue" numeric NOT NULL DEFAULT 0,
    "notes" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "item" text NOT NULL,
    "category" text NOT NULL,
    "stock" numeric NOT NULL DEFAULT 0,
    "unit" text NOT NULL,
    "reorderAt" numeric NOT NULL DEFAULT 0,
    "value" numeric NOT NULL DEFAULT 0,
    "supplier" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "FarmTask" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "cropCycleId" text REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "title" text NOT NULL,
    "taskType" text NOT NULL,
    "dueDate" timestamp(3) NOT NULL,
    "status" "FarmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "FarmLog" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "cropCycleId" text REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "activityDate" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity" text NOT NULL,
    "subject" text NOT NULL,
    "amount" numeric NOT NULL DEFAULT 0,
    "notes" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "Harvest" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "cropCycleId" text NOT NULL REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "harvestDate" timestamp(3) NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" text NOT NULL,
    "damagedQuantity" numeric NOT NULL DEFAULT 0,
    "notes" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "Sale" (
    "id" text PRIMARY KEY,
    "farmId" text NOT NULL REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "cropCycleId" text REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "saleDate" timestamp(3) NOT NULL,
    "buyer" text,
    "quantity" numeric NOT NULL,
    "unit" text NOT NULL,
    "unitPrice" numeric NOT NULL,
    "paymentStatus" text NOT NULL DEFAULT 'UNPAID',
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS "Plot_farmId_idx" ON "Plot"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "CropCycle_farmId_idx" ON "CropCycle"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "CropCycle_plotId_idx" ON "CropCycle"("plotId");`,
  `CREATE INDEX IF NOT EXISTS "InventoryItem_farmId_idx" ON "InventoryItem"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "FarmTask_farmId_idx" ON "FarmTask"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "FarmTask_dueDate_idx" ON "FarmTask"("dueDate");`,
  `CREATE INDEX IF NOT EXISTS "FarmLog_farmId_idx" ON "FarmLog"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "FarmLog_activityDate_idx" ON "FarmLog"("activityDate");`,
  `CREATE INDEX IF NOT EXISTS "Harvest_farmId_idx" ON "Harvest"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "Harvest_cropCycleId_idx" ON "Harvest"("cropCycleId");`,
  `CREATE INDEX IF NOT EXISTS "Sale_farmId_idx" ON "Sale"("farmId");`,
  `CREATE INDEX IF NOT EXISTS "Sale_cropCycleId_idx" ON "Sale"("cropCycleId");`
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log("Farm OS UAT tables are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
