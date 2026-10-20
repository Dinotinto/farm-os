import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { readFarmState, writeFarmState } from "@/lib/farm-state-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const state = await readFarmState();
  if (!state) {
    return NextResponse.json({ persisted: false, data: null });
  }
  try {
    return NextResponse.json({ persisted: true, updatedAt: state.updatedAt, data: JSON.parse(state.blob) });
  } catch {
    return NextResponse.json({ persisted: false, data: null });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const blob = JSON.stringify(payload);
  const ok = await writeFarmState(blob);
  if (!ok) {
    // Database not configured/migrated yet — client keeps using local storage.
    return NextResponse.json({ ok: false, persisted: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true, persisted: true });
}
