"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/tag-input";
import { ProfileEmojiBadge } from "@/components/profile-emoji-badge";
import { api } from "@/lib/api-client";
import { PROFILE_COLOR_THEMES, PROFILE_EMOJI_PRESETS, getThemeId, resolveEmojiConfig } from "@/lib/profile-style";

const emojiSchema = z.union([
  z.object({ type: z.literal("preset"), id: z.string().min(1).max(40) }),
  z.object({ type: z.literal("custom"), glyph: z.string().min(1).max(2), color: z.string().min(3).max(80) }),
]);

const schema = z.object({
  mode: z.enum(["dating", "networking", "both"]),
  intent: z.string().trim().max(120),
  meetupFrequency: z.enum(["low", "medium", "high"]),
  lookingFor: z.array(z.string().trim().max(40)).min(1).max(6),
  profileColor: z.string().trim().min(1).max(32),
  profileEmoji: emojiSchema,
});

export default function ProfilePreferencesPage() {
  const [mode, setMode] = useState<"dating" | "networking" | "both">("both");
  const [intent, setIntent] = useState("");
  const [meetupFrequency, setMeetupFrequency] = useState<"low" | "medium" | "high">("medium");
  const [lookingFor, setLookingFor] = useState<string[]>(["друзья", "нетворк"]);

  const [profileColor, setProfileColor] = useState(getThemeId(null));
  const [emojiMode, setEmojiMode] = useState<"preset" | "custom">("preset");
  const [emojiPresetId, setEmojiPresetId] = useState<string>(PROFILE_EMOJI_PRESETS[0].id);
  const [emojiGlyph, setEmojiGlyph] = useState("✦");
  const [emojiColor, setEmojiColor] = useState("#4C8DFF");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["profile-preferences-me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  useEffect(() => {
    const p = meQuery.data?.profile?.preferences;
    if (!p) return;

    setMode(p.mode ?? "both");
    setIntent(p.intent ?? "");
    setMeetupFrequency(p.meetupFrequency ?? "medium");
    setLookingFor(Array.isArray(p.lookingFor) && p.lookingFor.length ? p.lookingFor : ["друзья", "нетворк"]);
    setProfileColor(getThemeId(p.profileColor));

    const emoji = resolveEmojiConfig(p.profileEmoji);
    if (emoji?.type === "custom") {
      setEmojiMode("custom");
      setEmojiGlyph(emoji.glyph || "✦");
      setEmojiColor(emoji.color || "#4C8DFF");
    } else if (emoji?.type === "preset") {
      setEmojiMode("preset");
      setEmojiPresetId(emoji.id);
    }
  }, [meQuery.data]);

  const previewEmoji = useMemo(() => {
    if (emojiMode === "preset") return { type: "preset" as const, id: emojiPresetId };
    return { type: "custom" as const, glyph: emojiGlyph.slice(0, 2) || "✦", color: emojiColor || "#4C8DFF" };
  }, [emojiMode, emojiPresetId, emojiGlyph, emojiColor]);

  async function save() {
    const parsed = schema.safeParse({
      mode,
      intent,
      meetupFrequency,
      lookingFor,
      profileColor,
      profileEmoji: previewEmoji,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверь настройки");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify({ preferences: parsed.data }),
      });
      await meQuery.refetch();
      toast.success("Настройки сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Настройки знакомств/нетворкинга" subtitle="Влияют на рекомендации, match и стиль публичного профиля.">
      <Card className="border-white/15 bg-surface/90 backdrop-blur-2xl">
        <CardContent className="space-y-3 p-3">
          <p className="text-xs text-[#b4c2db]">Что ищу</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["dating", "Знакомства"],
              ["networking", "Нетворк"],
              ["both", "Оба"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as typeof mode)}
                className={`rounded-xl border px-3 py-2 text-xs transition ${
                  mode === value
                    ? "border-[#4C8DFF]/45 bg-[#4C8DFF]/16 text-[#dce9ff]"
                    : "border-white/15 bg-white/6 text-[#a8b7ce]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="Цель: кого хочешь встретить сейчас" />

      <Card className="border-white/15 bg-surface/88 backdrop-blur-2xl">
        <CardContent className="space-y-2 p-3">
          <p className="text-xs text-[#b4c2db]">Фокус поиска</p>
          <TagInput
            value={lookingFor}
            onChange={setLookingFor}
            suggestions={["друзья", "нетворк", "отношения", "ивенты", "кофаундер", "партнер", "ментор"]}
            min={1}
            max={6}
            placeholder="Добавь цель и Enter"
          />
        </CardContent>
      </Card>

      <select
        value={meetupFrequency}
        onChange={(e) => setMeetupFrequency(e.target.value as typeof meetupFrequency)}
        className="h-11 w-full rounded-xl border border-white/20 bg-white/8 px-3 text-sm text-[#eaf1ff]"
      >
        <option value="low" className="text-black">Редко</option>
        <option value="medium" className="text-black">Средне</option>
        <option value="high" className="text-black">Часто</option>
      </select>

      <Card className="border-white/15 bg-surface/88 backdrop-blur-2xl">
        <CardContent className="space-y-3 p-3">
          <p className="inline-flex items-center gap-1 text-xs text-[#b4c2db]"><Palette className="h-3.5 w-3.5" /> Цвет профиля</p>
          <div className="grid grid-cols-2 gap-2">
            {PROFILE_COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setProfileColor(theme.id)}
                className={`rounded-xl border p-2 text-left ${
                  profileColor === theme.id ? "border-[#4C8DFF]/50 ring-1 ring-[#4C8DFF]/45" : "border-white/15"
                }`}
              >
                <div className="h-10 rounded-lg" style={{ background: theme.gradient }} />
                <p className="mt-2 text-xs text-[#eaf1ff]">{theme.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/15 bg-surface/88 backdrop-blur-2xl">
        <CardContent className="space-y-3 p-3">
          <p className="inline-flex items-center gap-1 text-xs text-[#b4c2db]"><Sparkles className="h-3.5 w-3.5" /> Эмодзи рядом с именем</p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEmojiMode("preset")}
              className={`rounded-xl border px-3 py-2 text-xs ${emojiMode === "preset" ? "border-[#4C8DFF]/45 bg-[#4C8DFF]/16 text-[#dce9ff]" : "border-white/15 bg-white/6 text-[#a8b7ce]"}`}
            >
              Коллекция
            </button>
            <button
              type="button"
              onClick={() => setEmojiMode("custom")}
              className={`rounded-xl border px-3 py-2 text-xs ${emojiMode === "custom" ? "border-[#4C8DFF]/45 bg-[#4C8DFF]/16 text-[#dce9ff]" : "border-white/15 bg-white/6 text-[#a8b7ce]"}`}
            >
              Свой
            </button>
          </div>

          {emojiMode === "preset" ? (
            <div className="grid grid-cols-3 gap-2">
              {PROFILE_EMOJI_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setEmojiPresetId(preset.id)}
                  className={`rounded-xl border p-2 ${emojiPresetId === preset.id ? "border-[#4C8DFF]/45 ring-1 ring-[#4C8DFF]/45" : "border-white/15"}`}
                >
                  <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-sm text-white" style={{ background: preset.bg }}>
                    {preset.glyph}
                  </span>
                  <p className="mt-1 text-[11px] text-[#dfe9ff]">{preset.label}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Input value={emojiGlyph} onChange={(e) => setEmojiGlyph(e.target.value.slice(0, 2))} placeholder="Символ (до 2 знаков)" />
              <label className="flex items-center justify-between rounded-xl border border-white/15 bg-white/7 px-3 py-2 text-xs text-[#b4c2db]">
                Цвет эмодзи
                <input
                  type="color"
                  value={emojiColor}
                  onChange={(e) => setEmojiColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
                />
              </label>
            </div>
          )}

          <div className="rounded-xl border border-white/15 bg-white/7 p-3">
            <p className="mb-2 text-xs text-[#b4c2db]">Превью</p>
            <div className="inline-flex items-center gap-2">
              <span className="text-sm font-medium text-[#eaf1ff]">Твоё имя</span>
              <ProfileEmojiBadge value={previewEmoji} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <Button className="w-full" onClick={save} disabled={saving || meQuery.isLoading}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </ProfileSettingsLayout>
  );
}
