import { useEffect, useState, useCallback } from "react";

export type TgGroupOption = {
  id: string;
  title: string;
  group_id: string;
  kind: "group" | "channel" | "free";
  link?: string;
};

const GC_KEY = "telegram_groups_channels";
const FREE_KEY = "telegram_canal_free";
const EVT = "telegram-groups-updated";

export function readTelegramGroupsChannels(): TgGroupOption[] {
  try {
    const raw = localStorage.getItem(GC_KEY);
    return raw ? (JSON.parse(raw) as TgGroupOption[]) : [];
  } catch {
    return [];
  }
}

export function writeTelegramGroupsChannels(items: TgGroupOption[]) {
  localStorage.setItem(GC_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVT));
}

export function readCanalFree(): TgGroupOption | null {
  try {
    const raw = localStorage.getItem(FREE_KEY);
    return raw ? (JSON.parse(raw) as TgGroupOption) : null;
  } catch {
    return null;
  }
}

export function writeCanalFree(item: TgGroupOption | null) {
  if (item) localStorage.setItem(FREE_KEY, JSON.stringify(item));
  else localStorage.removeItem(FREE_KEY);
  window.dispatchEvent(new Event(EVT));
}

export function useTelegramAllGroups(): TgGroupOption[] {
  const load = useCallback(() => {
    const list = readTelegramGroupsChannels();
    const free = readCanalFree();
    return free ? [free, ...list] : list;
  }, []);
  const [items, setItems] = useState<TgGroupOption[]>(load);

  useEffect(() => {
    const refresh = () => setItems(load());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [load]);

  return items;
}