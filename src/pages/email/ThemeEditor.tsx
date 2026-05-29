import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";

type ElementStyle = {
  color?: string;
  background?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  decoration?: string;
  textTransform?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
};

export type ThemeStyles = Record<string, ElementStyle>;

const ELEMENTS = [
  { key: "text", label: "Text", selector: "p", fields: ["typography"] },
  { key: "title", label: "Title", selector: "h1", fields: ["typography"] },
  { key: "subtitle", label: "Subtitle", selector: "h2", fields: ["typography"] },
  { key: "heading", label: "Heading", selector: "h3", fields: ["typography"] },
  { key: "link", label: "Link", selector: "a", fields: ["typography"] },
  { key: "image", label: "Image", selector: "img", fields: ["border"] },
  { key: "button", label: "Button", selector: "button, .btn", fields: ["typography", "padding", "border", "background"] },
  { key: "codeblock", label: "Code Block", selector: "pre", fields: ["padding", "border"] },
  { key: "inlinecode", label: "Inline Code", selector: "code", fields: ["typography", "border", "background"] },
];

function styleToCss(s: ElementStyle): string {
  const parts: string[] = [];
  if (s.color) parts.push(`color: ${s.color}`);
  if (s.background) parts.push(`background-color: ${s.background}`);
  if (s.fontSize) parts.push(`font-size: ${s.fontSize}px`);
  if (s.fontWeight) parts.push(`font-weight: ${s.fontWeight}`);
  if (s.lineHeight) parts.push(`line-height: ${s.lineHeight}%`);
  if (s.letterSpacing != null) parts.push(`letter-spacing: ${s.letterSpacing}px`);
  if (s.decoration) parts.push(`text-decoration: ${s.decoration}`);
  if (s.textTransform) parts.push(`text-transform: ${s.textTransform}`);
  if (s.paddingTop != null || s.paddingRight != null || s.paddingBottom != null || s.paddingLeft != null) {
    parts.push(`padding: ${s.paddingTop ?? 0}px ${s.paddingRight ?? 0}px ${s.paddingBottom ?? 0}px ${s.paddingLeft ?? 0}px`);
  }
  if (s.borderRadius != null) parts.push(`border-radius: ${s.borderRadius}px`);
  if (s.borderWidth != null) parts.push(`border-width: ${s.borderWidth}px; border-style: solid`);
  if (s.borderColor) parts.push(`border-color: ${s.borderColor}`);
  return parts.join("; ");
}

export function buildThemeCss(styles: ThemeStyles, scope = "#email-editor"): string {
  return ELEMENTS.map((el) => {
    const s = styles[el.key];
    if (!s) return "";
    const css = styleToCss(s);
    if (!css) return "";
    const selectors = el.selector.split(",").map((sel) => `${scope} ${sel.trim()}`).join(", ");
    return `${selectors} { ${css} }`;
  }).join("\n");
}

interface Props {
  styles: ThemeStyles;
  onChange: (next: ThemeStyles) => void;
}

export default function ThemeEditor({ styles, onChange }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const update = (key: string, patch: Partial<ElementStyle>) => {
    onChange({ ...styles, [key]: { ...(styles[key] || {}), ...patch } });
  };

  return (
    <div className="space-y-1">
      {ELEMENTS.map((el) => {
        const s = styles[el.key] || {};
        const isOpen = open === el.key;
        const hasTypography = el.fields.includes("typography");
        const hasPadding = el.fields.includes("padding");
        const hasBorder = el.fields.includes("border");
        const hasBackground = el.fields.includes("background");
        return (
          <div key={el.key} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : el.key)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50"
            >
              <span className="text-[11px] font-semibold text-slate-700">{el.label}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="p-3 border-t border-slate-100 space-y-3 bg-slate-50/40">
                {hasBackground && (
                  <Row label="Background">
                    <ColorInput value={s.background || "#ffffff"} onChange={(v) => update(el.key, { background: v })} />
                  </Row>
                )}
                {hasTypography && (
                  <>
                    <Row label="Color">
                      <ColorInput value={s.color || "#000000"} onChange={(v) => update(el.key, { color: v })} />
                    </Row>
                    <div className="grid grid-cols-2 gap-2">
                      <SmallInput label="Size" suffix="px" value={s.fontSize} onChange={(v) => update(el.key, { fontSize: v })} />
                      <SmallInput label="Weight" value={s.fontWeight} onChange={(v) => update(el.key, { fontWeight: v })} />
                      <SmallInput label="Height" suffix="%" value={s.lineHeight} onChange={(v) => update(el.key, { lineHeight: v })} />
                      <SmallInput label="Spacing" suffix="px" value={s.letterSpacing} onChange={(v) => update(el.key, { letterSpacing: v })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">Decoration</Label>
                      <div className="flex gap-1">
                        {[
                          { v: "none", l: "Aa" },
                          { v: "underline", l: "U" },
                          { v: "line-through", l: "S" },
                          { v: "uppercase", l: "AA", transform: true },
                          { v: "lowercase", l: "aa", transform: true },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => {
                              if ((opt as any).transform) {
                                update(el.key, { textTransform: opt.v });
                              } else {
                                update(el.key, { decoration: opt.v });
                              }
                            }}
                            className={`flex-1 h-7 text-[10px] border border-slate-200 rounded bg-white hover:bg-slate-100 ${
                              s.decoration === opt.v || s.textTransform === opt.v ? "ring-2 ring-indigo-400" : ""
                            }`}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {hasPadding && (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-500">Padding</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <SmallInput suffix="px" value={s.paddingTop} onChange={(v) => update(el.key, { paddingTop: v })} placeholder="T" />
                      <SmallInput suffix="px" value={s.paddingRight} onChange={(v) => update(el.key, { paddingRight: v })} placeholder="R" />
                      <SmallInput suffix="px" value={s.paddingBottom} onChange={(v) => update(el.key, { paddingBottom: v })} placeholder="B" />
                      <SmallInput suffix="px" value={s.paddingLeft} onChange={(v) => update(el.key, { paddingLeft: v })} placeholder="L" />
                    </div>
                  </div>
                )}
                {hasBorder && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <SmallInput label="Corner radius" suffix="px" value={s.borderRadius} onChange={(v) => update(el.key, { borderRadius: v })} />
                      <SmallInput label="Border" suffix="px" value={s.borderWidth} onChange={(v) => update(el.key, { borderWidth: v })} />
                    </div>
                    <Row label="Border color">
                      <ColorInput value={s.borderColor || "#e2e8f0"} onChange={(v) => update(el.key, { borderColor: v })} />
                    </Row>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[10px] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 font-mono uppercase">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden"
      />
    </div>
  );
}

function SmallInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  suffix?: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-[10px] text-slate-500">{label}</Label>}
      <div className="relative">
        <Input
          type="number"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className="h-7 text-[10px] pr-6 bg-white border-slate-200"
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}