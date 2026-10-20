import { prisma } from "@/lib/prisma";

export const FARM_STATE_ID = "default";

/**
 * Read the persisted farm state blob from the database.
 * Returns null if there is no row yet OR if the table/connection is unavailable
 * (e.g. migration not yet pushed) so callers can fall back to local storage.
 */
export async function readFarmState(): Promise<{ blob: string; updatedAt: string } | null> {
  try {
    const row = await prisma.farmOsState.findUnique({ where: { id: FARM_STATE_ID } });
    if (!row) return null;
    return { blob: row.blob, updatedAt: row.updatedAt.toISOString() };
  } catch {
    return null;
  }
}

/** Persist the farm state blob. Returns false if the database is unavailable. */
export async function writeFarmState(blob: string): Promise<boolean> {
  try {
    await prisma.farmOsState.upsert({
      where: { id: FARM_STATE_ID },
      create: { id: FARM_STATE_ID, blob },
      update: { blob }
    });
    return true;
  } catch {
    return false;
  }
}
