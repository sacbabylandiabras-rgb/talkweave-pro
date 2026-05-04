import { describe, it, expect } from "vitest";

/**
 * Mirrors the normalization logic in `supabase/functions/send-message/index.ts`
 * to guarantee that group IDs from both providers (Z-API `<id>-group` and
 * UAZAPI `<id>@g.us`) are accepted and routed correctly.
 */

function isGroupPhone(phone: string): boolean {
  return (
    phone.includes("-group") ||
    phone.includes("@g.us") ||
    /^12036\d{13,}$/.test(phone.replace(/\D/g, ""))
  );
}

function toUazapiGroupId(phone: string): string {
  const numeric = String(phone)
    .replace(/@g\.us$/i, "")
    .replace(/-group$/i, "")
    .replace(/\D/g, "");
  return `${numeric}@g.us`;
}

function toZapiGroupId(phone: string): string {
  const numeric = String(phone)
    .replace(/@g\.us$/i, "")
    .replace(/-group$/i, "")
    .replace(/\D/g, "");
  return `${numeric}-group`;
}

const SAMPLE_GROUP_NUMERIC = "120363019502650977";

describe("group ID detection (isGroupPhone)", () => {
  it("detects UAZAPI @g.us format", () => {
    expect(isGroupPhone(`${SAMPLE_GROUP_NUMERIC}@g.us`)).toBe(true);
  });

  it("detects Z-API -group suffix format", () => {
    expect(isGroupPhone(`${SAMPLE_GROUP_NUMERIC}-group`)).toBe(true);
  });

  it("detects bare numeric group ID with 12036 prefix", () => {
    expect(isGroupPhone(SAMPLE_GROUP_NUMERIC)).toBe(true);
  });

  it("does NOT classify regular phones as group", () => {
    expect(isGroupPhone("5511999999999")).toBe(false);
    expect(isGroupPhone("+55 11 99999-9999")).toBe(false);
  });

  it("does NOT classify @lid as group", () => {
    expect(isGroupPhone("170850309374190@lid")).toBe(false);
  });
});

describe("UAZAPI group ID normalization", () => {
  it("converts -group suffix to @g.us", () => {
    expect(toUazapiGroupId(`${SAMPLE_GROUP_NUMERIC}-group`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}@g.us`
    );
  });

  it("keeps @g.us format idempotent", () => {
    expect(toUazapiGroupId(`${SAMPLE_GROUP_NUMERIC}@g.us`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}@g.us`
    );
  });

  it("normalizes raw numeric ID to @g.us", () => {
    expect(toUazapiGroupId(SAMPLE_GROUP_NUMERIC)).toBe(
      `${SAMPLE_GROUP_NUMERIC}@g.us`
    );
  });
});

describe("Z-API group ID normalization", () => {
  it("converts @g.us to -group suffix", () => {
    expect(toZapiGroupId(`${SAMPLE_GROUP_NUMERIC}@g.us`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}-group`
    );
  });

  it("keeps -group format idempotent", () => {
    expect(toZapiGroupId(`${SAMPLE_GROUP_NUMERIC}-group`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}-group`
    );
  });

  it("normalizes raw numeric ID to -group", () => {
    expect(toZapiGroupId(SAMPLE_GROUP_NUMERIC)).toBe(
      `${SAMPLE_GROUP_NUMERIC}-group`
    );
  });
});

describe("cross-provider compatibility", () => {
  const inputs = [
    `${SAMPLE_GROUP_NUMERIC}@g.us`,
    `${SAMPLE_GROUP_NUMERIC}-group`,
    SAMPLE_GROUP_NUMERIC,
  ];

  it("all input variants are detected as group", () => {
    for (const input of inputs) {
      expect(isGroupPhone(input)).toBe(true);
    }
  });

  it("all input variants normalize to the same UAZAPI ID", () => {
    const targets = inputs.map(toUazapiGroupId);
    expect(new Set(targets).size).toBe(1);
    expect(targets[0]).toBe(`${SAMPLE_GROUP_NUMERIC}@g.us`);
  });

  it("all input variants normalize to the same Z-API ID", () => {
    const targets = inputs.map(toZapiGroupId);
    expect(new Set(targets).size).toBe(1);
    expect(targets[0]).toBe(`${SAMPLE_GROUP_NUMERIC}-group`);
  });

  it("the numeric core is preserved across both providers", () => {
    for (const input of inputs) {
      const uaz = toUazapiGroupId(input).replace(/@g\.us$/, "");
      const zapi = toZapiGroupId(input).replace(/-group$/, "");
      expect(uaz).toBe(zapi);
      expect(uaz).toBe(SAMPLE_GROUP_NUMERIC);
    }
  });
});

describe("edge cases", () => {
  it("strips non-numeric characters before normalization", () => {
    expect(toUazapiGroupId(`${SAMPLE_GROUP_NUMERIC} @g.us`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}@g.us`
    );
    expect(toZapiGroupId(`+${SAMPLE_GROUP_NUMERIC}-group`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}-group`
    );
  });

  it("handles uppercase suffixes", () => {
    expect(toUazapiGroupId(`${SAMPLE_GROUP_NUMERIC}@G.US`)).toBe(
      `${SAMPLE_GROUP_NUMERIC}@g.us`
    );
  });
});