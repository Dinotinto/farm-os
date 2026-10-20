import { prisma } from "@/lib/prisma";

export const sampleFarmId = "sample-farm";

export async function getFarmDashboardData() {
  let farm = await prisma.farm.findUnique({
    where: { id: sampleFarmId },
    include: {
      plots: {
        orderBy: { name: "asc" }
      },
      cycles: {
        include: { plot: true },
        orderBy: { createdAt: "asc" }
      },
      items: {
        orderBy: { item: "asc" }
      },
      tasks: {
        include: { cropCycle: true },
        orderBy: { dueDate: "asc" }
      },
      logs: {
        orderBy: { activityDate: "desc" },
        take: 12
      }
    }
  });

  if (!farm) {
    farm = await prisma.farm.create({
      data: {
        id: sampleFarmId,
        name: "Dinotinto Farm",
        location: "Nigeria"
      },
      include: {
        plots: true,
        cycles: { include: { plot: true } },
        items: true,
        tasks: { include: { cropCycle: true } },
        logs: true
      }
    });
  }

  return farm;
}
