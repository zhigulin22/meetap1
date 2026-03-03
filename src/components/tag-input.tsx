"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

const palette = [
  "bg-blue/14 text-text border-blue/35",
  "bg-mint/14 text-text border-mint/35",
  "bg-amber/14 text-text border-amber/35",
  "bg-surface3/70 text-text border-borderStrong",
  "bg-surface3/72 text-text border-blue/30",
];

export function TagInput({
  value,
  onChange,
  placeholder = "Добавь интерес и нажми Enter",
  suggestions = [],
  min = 0,
  max = 20,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  min?: number;
  max?: number;
}) {
  const [input, setInput] = useState("");

  const normalized = useMemo(() => value.map((x) => x.trim()).filter(Boolean), [value]);

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions.filter((x) => x.toLowerCase().includes(q) && !normalized.includes(x)).slice(0, 8);
  }, [input, suggestions, normalized]);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (normalized.includes(tag)) return;
    if (normalized.length >= max) return;
    onChange([...normalized, tag]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(normalized.filter((x) => x !== tag));
  }

  return (
    <div className="space-y-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
        }}
        placeholder={placeholder}
      />

      {!!filteredSuggestions.length && input.trim().length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-border bg-surface2/62 px-3 py-1 text-xs text-muted hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {normalized.map((tag, idx) => (
          <span key={tag} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${palette[idx % palette.length]}`}>
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="opacity-80 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <p className="text-xs text-muted">
        {normalized.length}/{max} тегов {normalized.length < min ? `· минимум ${min}` : ""}
      </p>
    </div>
  );
}
