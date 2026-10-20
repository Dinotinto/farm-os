import { PrismaClient } from "@prisma/client";
import sample from "../data/sample-farm.json" with { type: "json" };

const prisma = new PrismaClient();

async function main() {
  const farm = await prisma.farm.upsert({
    where: { id: "sample-farm" },
    update: {
      name: sample.farm.name,
      location: sample.farm.location
    },
    create: {
      id: "sample-farm",
      name: sample.farm.name,
      location: sample.farm.location
    }
  });

  await prisma.plot.deleteMany({ where: { farmId: farm.id } });
  await prisma.inventoryItem.deleteMany({ where: { farmId: farm.id } });
  await prisma.farmTask.deleteMany({ where: { farmId: farm.id } });
  await prisma.farmLog.deleteMany({ where: { farmId: farm.id } });
  await prisma.cropCycle.deleteMany({ where: { farmId: farm.id } });

  await prisma.plot.createMany({
    data: sample.plots.map((plot) => ({
      farmId: farm.id,
      name: plot.name,
      sizeHectares: plot.sizeHectares,
      currentCrop: plot.currentCrop,
      healthStatus: plot.healthStatus
    }))
  });

  await prisma.inventoryItem.createMany({
    data: sample.inventory.map((item) => ({
      farmId: farm.id,
      item: item.item,
      category: item.category,
      stock: item.stock,
      unit: item.unit,
      reorderAt: item.reorderAt,
      value: item.value
    }))
  });

  const plots = await prisma.plot.findMany({ where: { farmId: farm.id } });
  const plotByName = new Map(plots.map((plot) => [plot.name, plot]));

  const cropCycles = await Promise.all(
    sample.cropCycles.map((cycle) =>
      prisma.cropCycle.create({
        data: {
          farmId: farm.id,
          plotId: plotByName.get(cycle.plotName)?.id,
          crop: cycle.crop,
          variety: cycle.variety,
          stage: cycle.stage,
          nurseryDate: cycle.nurseryDate ? new Date(`${cycle.nurseryDate}T00:00:00`) : null,
          transplantDate: cycle.transplantDate ? new Date(`${cycle.transplantDate}T00:00:00`) : null,
          plants: cycle.plants,
          inputCost: cycle.inputCost,
          projectedRevenue: cycle.projectedRevenue,
          notes: cycle.notes
        }
      })
    )
  );

  const cycleByCrop = new Map(cropCycles.map((cycle) => [cycle.crop, cycle]));

  await prisma.farmTask.createMany({
    data: sample.tasks.map((task) => ({
      farmId: farm.id,
      cropCycleId: cycleByCrop.get(task.crop)?.id,
      title: task.title,
      taskType: task.taskType,
      dueDate: new Date(`${task.dueDate}T00:00:00`),
      status: task.status
    }))
  });

  await prisma.farmLog.createMany({
    data: sample.logs.map((log) => ({
      farmId: farm.id,
      activityDate: new Date(`${log.activityDate}T00:00:00`),
      activity: log.activity,
      subject: log.subject,
      amount: log.amount,
      notes: log.notes
    }))
  });

  console.log(`Seeded ${farm.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
