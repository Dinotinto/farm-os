import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/user-session";
import { farmRoster } from "@/lib/farm-users";

export const dynamic = "force-dynamic";

function norm(email: unknown) {
  return String(email || "").toLowerCase().trim();
}

// GET: every message involving the current user + the team roster.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const myEmail = norm(me.email);
  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ fromEmail: myEmail }, { toEmail: myEmail }] },
      orderBy: { createdAt: "asc" },
      take: 2000
    });
    return NextResponse.json({ ok: true, me: myEmail, users: farmRoster(), messages, persisted: true });
  } catch {
    // Table not migrated yet — return empty so the UI still renders.
    return NextResponse.json({ ok: true, me: myEmail, users: farmRoster(), messages: [], persisted: false });
  }
}

// POST: send a message { to, body }.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  let payload: { to?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const to = norm(payload.to);
  const body = String(payload.body || "").trim().slice(0, 4000);
  if (!body) return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
  if (!farmRoster().some((u) => norm(u.email) === to)) {
    return NextResponse.json({ ok: false, error: "Unknown recipient" }, { status: 400 });
  }
  if (to === norm(me.email)) return NextResponse.json({ ok: false, error: "Cannot message yourself" }, { status: 400 });
  try {
    const message = await prisma.message.create({ data: { fromEmail: norm(me.email), toEmail: to, body } });
    return NextResponse.json({ ok: true, message });
  } catch {
    return NextResponse.json({ ok: false, error: "Messaging database not ready. Push the Message table." }, { status: 503 });
  }
}

// PATCH: mark all messages from { withEmail } to me as read.
export async function PATCH(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  let payload: { withEmail?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const withEmail = norm(payload.withEmail);
  if (!withEmail) return NextResponse.json({ ok: false, error: "Missing withEmail" }, { status: 400 });
  try {
    await prisma.message.updateMany({
      where: { toEmail: norm(me.email), fromEmail: withEmail, readAt: null },
      data: { readAt: new Date() }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
