import { describe, it, expect, beforeEach } from "vitest";
import {
  isGroupPhone,
  resolveGroupConversationName,
  rememberGroupDisplayName,
  isUsableGroupDisplayName,
  normalizeConversationPhone,
  type SavedContactLike,
} from "@/lib/group-name-resolution";
import {
  GROUP_PHONE,
  GROUP_RAW_ID,
  goodPlaceholderLog,
  genericPlaceholderLog,
  realInboundLog,
  savedContactWithGoodName,
  savedContactWithNumericName,
  savedContactWithGenericName,
} from "@/test/fixtures/messageLogs";

const buildSavedContacts = (entries: SavedContactLike[]) => {
  const map = new Map<string, SavedContactLike>();
  entries.forEach((c) => map.set(c.phone, c));
  return map;
};

describe("isGroupPhone", () => {
  it("recognizes community ids even when they contain formatting suffixes", () => {
    expect(isGroupPhone("120363405412051886")).toBe(true);
    expect(isGroupPhone("120363405412051886-group")).toBe(true);
    expect(isGroupPhone("120363405412051886@g.us")).toBe(true);
  });
});

describe("isUsableGroupDisplayName", () => {
  it.each([
    ["", false],
    ["   ", false],
    ["Grupo", false],
    ["grupo sem nome", false],
    ["Conversa com Grupo", false],
    ["Conversa com 5511999999999", false],
    ["120363405412051886", false],
    ["120363405412051886@g.us", false],
    ["120363405412051886-group", false],
    ["+55 11 99999-9999", false],
    ["Equipe Vendas", true],
    ["Suporte 24h", true],
    ["AULA 2 LIBERADA 🎉", true],
  ])("classifies %s -> %s", (value, expected) => {
    expect(isUsableGroupDisplayName(value)).toBe(expected);
  });
});

describe("normalizeConversationPhone", () => {
  it("normalizes any group identifier to <id>-group", () => {
    expect(normalizeConversationPhone(GROUP_RAW_ID)).toBe(GROUP_PHONE);
    expect(normalizeConversationPhone(GROUP_PHONE)).toBe(GROUP_PHONE);
    expect(normalizeConversationPhone("120363405412051886")).toBe(GROUP_PHONE);
  });
});

describe("resolveGroupConversationName", () => {
  let stable: Map<string, string>;

  beforeEach(() => {
    stable = new Map();
  });

  it("returns the live group name when get-whatsapp-groups resolved it", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [goodPlaceholderLog, realInboundLog],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map([[GROUP_PHONE, "Equipe Vendas"]]),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
    expect(stable.get(GROUP_PHONE)).toBe("Equipe Vendas");
  });

  it("ignores raw @g.us identifiers returned as the live group name", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [goodPlaceholderLog],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map([[GROUP_PHONE, GROUP_RAW_ID]]),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });

  it("falls back to the saved contact name when live names are missing", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [],
      savedContacts: buildSavedContacts([savedContactWithGoodName]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });

  it("ignores numeric ids stored as saved_contacts.name", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [],
      savedContacts: buildSavedContacts([savedContactWithNumericName]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBeNull();
  });

  it('ignores "Grupo sem nome" stored as saved_contacts.name', () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [],
      savedContacts: buildSavedContacts([savedContactWithGenericName]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBeNull();
  });

  it("uses the placeholder log subject when no live/saved name is available", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [goodPlaceholderLog, realInboundLog],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });

  it('skips a generic "Conversa com Grupo" placeholder', () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [genericPlaceholderLog],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBeNull();
  });

  it("prefers a usable older placeholder over a newer generic one (regression)", () => {
    // This is the reported bug: a fresh sync re-inserts a generic placeholder
    // and we used to pick it because it was newer. Now we must skip it and
    // keep the good name.
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [goodPlaceholderLog, genericPlaceholderLog, realInboundLog],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });

  it("locks the resolved name into stableGroupNames so refreshes can recover it", () => {
    // First render: live name is available.
    resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map([[GROUP_PHONE, "Equipe Vendas"]]),
      stableGroupNames: stable,
    });

    // Refresh: live name disappears, saved contact still numeric, only generic
    // placeholder exists. We must keep the previously resolved name.
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [genericPlaceholderLog],
      savedContacts: buildSavedContacts([savedContactWithNumericName]),
      groupNames: new Map(),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });

  it("never returns a generic placeholder under any combination", () => {
    const stable2 = new Map<string, string>();
    rememberGroupDisplayName(stable2, GROUP_PHONE, "Conversa com Grupo");
    rememberGroupDisplayName(stable2, GROUP_PHONE, "120363405412051886");
    expect(stable2.size).toBe(0);

    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [genericPlaceholderLog],
      savedContacts: buildSavedContacts([
        { phone: GROUP_PHONE, name: "Conversa com Grupo" },
      ]),
      groupNames: new Map([[GROUP_PHONE, "Grupo sem nome"]]),
      stableGroupNames: stable2,
      campaignContactName: "120363405412051886",
    });
    expect(name).toBeNull();
  });

  it("matches normalized phone even when groupNames was keyed by raw @g.us id", () => {
    const name = resolveGroupConversationName({
      phone: GROUP_PHONE,
      logs: [],
      savedContacts: buildSavedContacts([]),
      groupNames: new Map([
        [GROUP_RAW_ID, "Equipe Vendas"],
        [GROUP_PHONE, "Equipe Vendas"],
      ]),
      stableGroupNames: stable,
    });
    expect(name).toBe("Equipe Vendas");
  });
});
