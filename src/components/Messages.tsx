"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, MessageSquare, Send } from "lucide-react";

export type RosterUser = { email: string; displayName: string; role: string };
export type Message = { id: string; fromEmail: string; toEmail: string; body: string; createdAt: string; readAt: string | null };
export type Conversation = { user: RosterUser; messages: Message[]; last?: Message; unread: number };

const norm = (e: string) => (e || "").toLowerCase().trim();

const AVATAR_COLORS = ["#0f8b6f", "#d99a28", "#14213d", "#2563eb", "#b4530a", "#7c3aed"];
function avatarColor(email: string) {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
function relTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = new Date(iso);
  const days = Math.floor(diff / 86400000);
  if (days < 7) return d.toLocaleDateString("en-NG", { weekday: "short" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
}

export type MessagingState = ReturnType<typeof useMessages>;

export function useMessages(meEmail?: string) {
  const me = norm(meEmail || "");
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    if (!me) return;
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { users?: RosterUser[]; messages?: Message[] };
      if (j.users) setUsers(j.users);
      const msgs = j.messages || [];
      // Notify on genuinely new INCOMING messages (skip the first load).
      if (!firstLoad.current) {
        const fresh = msgs.filter((m) => norm(m.toEmail) === me && !seenIds.current.has(m.id));
        for (const m of fresh) {
          const sender = (j.users || []).find((u) => norm(u.email) === norm(m.fromEmail));
          notify(sender?.displayName || "New message", m.body);
        }
      }
      msgs.forEach((m) => seenIds.current.add(m.id));
      firstLoad.current = false;
      setMessages(msgs);
      setReady(true);
    } catch {
      /* offline — keep what we have */
    }
  }, [me]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const send = useCallback(async (to: string, body: string) => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic append.
    const optimistic: Message = { id: `tmp-${Date.now()}`, fromEmail: me, toEmail: norm(to), body: text, createdAt: new Date().toISOString(), readAt: null };
    setMessages((cur) => [...cur, optimistic]);
    try {
      await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, body: text }) });
      await refresh();
    } catch {
      /* keep optimistic copy */
    } finally {
      setSending(false);
    }
  }, [me, refresh, sending]);

  const markRead = useCallback(async (withEmail: string) => {
    const w = norm(withEmail);
    setMessages((cur) => cur.map((m) => (norm(m.fromEmail) === w && norm(m.toEmail) === me && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    try {
      await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withEmail: w }) });
    } catch {
      /* will retry next mark */
    }
  }, [me]);

  const conversations = useMemo<Conversation[]>(() => {
    const others = users.filter((u) => norm(u.email) !== me);
    const convos = others.map((user) => {
      const ue = norm(user.email);
      const thread = messages
        .filter((m) => (norm(m.fromEmail) === ue && norm(m.toEmail) === me) || (norm(m.fromEmail) === me && norm(m.toEmail) === ue))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const unread = thread.filter((m) => norm(m.toEmail) === me && !m.readAt).length;
      return { user, messages: thread, last: thread[thread.length - 1], unread };
    });
    return convos.sort((a, b) => {
      if (!a.last && !b.last) return a.user.displayName.localeCompare(b.user.displayName);
      if (!a.last) return 1;
      if (!b.last) return -1;
      return b.last.createdAt.localeCompare(a.last.createdAt);
    });
  }, [users, messages, me]);

  const unreadCount = conversations.reduce((sum, c) => sum + c.unread, 0);

  return { me, users, ready, sending, conversations, unreadCount, send, markRead, refresh };
}

function notify(title: string, body: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(`💬 ${title}`, { body, tag: "farm-message" });
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  } catch {
    /* notifications unsupported */
  }
}

export function MessagesView({ msg }: { msg: MessagingState }) {
  const [openEmail, setOpenEmail] = useState<string>("");
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const open = msg.conversations.find((c) => norm(c.user.email) === norm(openEmail));

  // Ask for notification permission once, on first open.
  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch { /* ignore */ }
  }, []);

  // Mark read + scroll to bottom when a conversation is open / grows.
  useEffect(() => {
    if (!open) return;
    if (open.unread) msg.markRead(open.user.email);
    endRef.current?.scrollIntoView({ block: "end" });
  }, [open, open?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!open || !draft.trim()) return;
    msg.send(open.user.email, draft);
    setDraft("");
  }

  // ---- Thread view ----
  if (open) {
    let lastDay = "";
    return (
      <div className="mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-3xl flex-col">
        <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-[#e6e9df] bg-white p-3">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#d8dece] bg-white text-[#4b5a76]" onClick={() => setOpenEmail("")} type="button"><ArrowLeft size={18} /></button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-white" style={{ background: avatarColor(open.user.email) }}>{initials(open.user.displayName)}</div>
          <div className="min-w-0">
            <p className="truncate font-black text-[#14213d]">{open.user.displayName}</p>
            <p className="text-xs font-bold capitalize text-[#667085]">{open.user.role}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-x border-[#e6e9df] bg-[#f7f8f4] p-3 dt-scroll-x">
          {open.messages.length ? open.messages.map((m) => {
            const mine = norm(m.fromEmail) === msg.me;
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDay ? <p className="my-3 text-center text-xs font-black text-[#9aa39a]">{day}</p> : null}
                <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm font-bold leading-6 shadow-sm ${mine ? "rounded-br-md bg-[#0f8b6f] text-white" : "rounded-bl-md border border-[#e6e9df] bg-white text-[#14213d]"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <span className={`mt-0.5 flex items-center justify-end gap-1 text-[0.65rem] font-black ${mine ? "text-white/70" : "text-[#9aa39a]"}`}>
                      {clockTime(m.createdAt)}
                      {mine ? (m.readAt ? <CheckCheck size={13} /> : <Check size={13} />) : null}
                    </span>
                  </div>
                </div>
              </div>
            );
          }) : <p className="mt-8 text-center text-sm font-bold text-[#667085]">No messages yet. Say hello 👋</p>}
          <div ref={endRef} />
        </div>

        <form className="flex items-end gap-2 rounded-b-2xl border border-t-0 border-[#e6e9df] bg-white p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <textarea
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[#d8dece] bg-white px-3 py-2.5 text-sm font-bold text-[#14213d]"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Message ${open.user.displayName}…`}
            rows={1}
            value={draft}
          />
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f8b6f] text-white disabled:opacity-50" disabled={!draft.trim() || msg.sending} type="submit" aria-label="Send"><Send size={18} /></button>
        </form>
      </div>
    );
  }

  // ---- Inbox ----
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-3.5 pb-0 sm:gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Messages</h2>
          <p className="text-sm font-bold text-[#667085]">{msg.unreadCount ? `${msg.unreadCount} unread` : "Team chat"}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e7f5ef] text-[#0f8b6f]"><MessageSquare size={20} /></span>
      </div>

      <div className="dt-panel divide-y divide-[#edf1e7] overflow-hidden">
        {msg.conversations.length ? msg.conversations.map((c) => {
          const last = c.last;
          const minePrefix = last && norm(last.fromEmail) === msg.me ? "You: " : "";
          return (
            <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-[#fbfcf9]" key={c.user.email} onClick={() => setOpenEmail(c.user.email)} type="button">
              <div className="relative shrink-0">
                <div className="grid h-12 w-12 place-items-center rounded-full text-sm font-black text-white" style={{ background: avatarColor(c.user.email) }}>{initials(c.user.displayName)}</div>
                {c.unread ? <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#b42318] px-1 text-[0.65rem] font-black text-white">{c.unread}</span> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate font-black ${c.unread ? "text-[#14213d]" : "text-[#14213d]"}`}>{c.user.displayName}</p>
                  {last ? <span className="shrink-0 text-xs font-bold text-[#9aa39a]">{relTime(last.createdAt)}</span> : null}
                </div>
                <p className={`truncate text-sm ${c.unread ? "font-black text-[#14213d]" : "font-bold text-[#667085]"}`}>
                  {last ? `${minePrefix}${last.body}` : <span className="italic text-[#9aa39a]">Start a conversation</span>}
                </p>
              </div>
            </button>
          );
        }) : <p className="p-6 text-center text-sm font-bold text-[#667085]">No teammates to message yet.</p>}
      </div>
      <p className="text-center text-xs font-bold text-[#9aa39a]">Messages sync across devices. New messages alert you even on other tabs.</p>
    </div>
  );
}
