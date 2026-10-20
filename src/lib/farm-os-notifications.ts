"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FarmOsData } from "@/lib/farm-os-types";
import { buildFarmInsights, type FarmInsight } from "@/lib/farm-os-advisor";

export type FarmNotification = {
  id: string;
  title: string;
  body: string;
  severity: FarmInsight["severity"];
  category: FarmInsight["category"];
};

const READ_KEY = "dinotinto-farm-os-notifications-read";
const PUSHED_KEY = "dinotinto-farm-os-notifications-pushed";

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveIds(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

export function notificationsFromInsights(data: FarmOsData): FarmNotification[] {
  return buildFarmInsights(data)
    .filter((insight) => insight.severity !== "info")
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      body: insight.detail,
      severity: insight.severity,
      category: insight.category
    }));
}

export function taskReminderNotifications(data: FarmOsData): FarmNotification[] {
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  return data.tasks
    .filter((t) => t.status !== "completed" && t.dueDate >= today && t.dueDate <= in3)
    .map((t) => {
      const daysLeft = Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / 86400000);
      const when = daysLeft <= 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : `due in ${daysLeft} days`;
      return {
        id: `task-due-${t.id}`,
        title: `Task ${when}: ${t.taskTitle}`,
        body: `${t.dueDate}${t.cropName ? ` · ${t.cropName}` : ""}. Priority: ${t.priority}.`,
        severity: (t.priority === "urgent" || daysLeft <= 0 ? "action" : "watch") as FarmNotification["severity"],
        category: "crop" as FarmNotification["category"]
      };
    });
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function useFarmNotifications(data: FarmOsData) {
  const notifications = useMemo(() => [
    ...notificationsFromInsights(data),
    ...taskReminderNotifications(data)
  ], [data]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [pushPermission, setPushPermission] = useState<PushPermission>("default");
  const pushedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setReadIds(loadIds(READ_KEY));
    pushedRef.current = loadIds(PUSHED_KEY);
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPermission("unsupported");
    } else {
      setPushPermission(Notification.permission as PushPermission);
    }
  }, []);

  const unread = notifications.filter((notification) => !readIds.has(notification.id));

  // Browser push: notify once per new action-level item when permission is granted.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const fresh = notifications.filter(
      (notification) => notification.severity === "action" && !pushedRef.current.has(notification.id)
    );
    if (!fresh.length) return;
    for (const notification of fresh.slice(0, 4)) {
      try {
        new Notification(`Farm OS · ${notification.title}`, { body: notification.body, tag: notification.id });
      } catch {
        // ignore environments that block constructed notifications
      }
      pushedRef.current.add(notification.id);
    }
    saveIds(PUSHED_KEY, pushedRef.current);
  }, [notifications, pushPermission]);

  const requestPush = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPermission("unsupported");
      return "unsupported" as PushPermission;
    }
    const result = (await Notification.requestPermission()) as PushPermission;
    setPushPermission(result);
    if (result === "granted") {
      try {
        new Notification("Farm OS notifications enabled", {
          body: "You'll get alerts for urgent farm actions on this device."
        });
      } catch {
        // ignore
      }
    }
    return result;
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      saveIds(READ_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(() => {
      const next = new Set(notifications.map((notification) => notification.id));
      saveIds(READ_KEY, next);
      return next;
    });
  }, [notifications]);

  return { notifications, unread, unreadCount: unread.length, pushPermission, requestPush, markRead, markAllRead };
}
