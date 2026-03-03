"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/tag-input";
import { api } from "@/lib/api-client";

const popularTags = [
  "дизайн",
  "маркетинг",
  "музыка",
  "стартапы",
  "спорт",
  "кино",
  "психология",
  "предпринимательство",
  "продукт",
  "фотография",
  "чтение",
  "кофе",
  "путешествия",
  "AI",
  "финансы",
  "креатив",
];

const schema = z.object({
  bio: z.string().trim().max(320, "Слишком длинное bio"),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  university: z.string().trim().max(120).optional(),
  work: z.string().trim().max(120).optional(),
  activity: z.string().trim().max(120).optional(),
  specialty: z.string().trim().max(120).optional(),
  facts: z.array(z.string().trim().min(2, "Факт слишком короткий").max(120)).min(2).max(3),
  interests: z.array(z.string().trim().min(2).max(40)).min(3, "Минимум 3 интереса").max(20),
  hobbies: z.array(z.string().trim().max(40)).max(20),
  avatar_url: z.string().url().optional(),
});

export default function ProfileEditPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [university, setUniversity] = useState("");
  const [work, setWork] = useState("");
  const [activity, setActivity] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [facts, setFacts] = useState<string[]>(["", "", ""]);
  const [interests, setInterests] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["profile-edit-me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  useEffect(() => {
    const p = meQuery.data?.profile;
    if (!p) return;
    setAvatar(p.avatar_url ?? "");
    setBio(p.bio ?? "");
    setCountry(p.country ?? "");
    setCity(p.city ?? "");
    setUniversity(p.university ?? "");
    setWork(p.work ?? "");
    setActivity(p.preferences?.activity ?? "");
    setSpecialty(p.preferences?.specialty ?? "");

    const nextFacts = (Array.isArray(p.facts) ? p.facts : []).slice(0, 3);
    while (nextFacts.length < 3) nextFacts.push("");
    setFacts(nextFacts);
    setInterests(Array.isArray(p.interests) ? p.interests : []);
    setHobbies(Array.isArray(p.hobbies) ? p.hobbies : []);
  }, [meQuery.data]);

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Можно загрузить только изображение");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const fd = new FormData();
      fd.append("avatar", file);
      const result = await api<{ url: string }>("/api/profile/avatar", { method: "POST", body: fd });
      setAvatar(result.url);
      toast.success("Фото обновлено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const normalizedFacts = facts.map((x) => x.trim()).filter(Boolean).slice(0, 3);
    const payload = {
      bio,
      country: country || undefined,
      city: city || undefined,
      university: university || undefined,
      work: work || undefined,
      activity: activity || undefined,
      specialty: specialty || undefined,
      facts: normalizedFacts,
      interests,
      hobbies,
      avatar_url: avatar || undefined,
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверь поля");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify({
          bio: parsed.data.bio,
          country: parsed.data.country,
          city: parsed.data.city,
          university: parsed.data.university,
          work: parsed.data.work,
          facts: parsed.data.facts,
          interests: parsed.data.interests,
          hobbies: parsed.data.hobbies,
          avatar_url: parsed.data.avatar_url,
          preferences: {
            ...(meQuery.data?.profile?.preferences ?? {}),
            activity: parsed.data.activity,
            specialty: parsed.data.specialty,
          },
        }),
      });
      toast.success("Профиль сохранён");
      await meQuery.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Профиль" subtitle="Фото, bio, факты и интересы для качественных рекомендаций.">
      <Card className="overflow-hidden border-border bg-surface/90 backdrop-blur-2xl">
        <div className="relative h-52 overflow-hidden rounded-[22px] border border-border bg-[linear-gradient(140deg,rgb(var(--surface-2-rgb)),rgb(var(--surface-3-rgb))_56%,rgb(var(--blue-rgb)/0.78))]">
          <div className="absolute -left-14 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--mint-rgb)/0.34),transparent_68%)]" />
          <div className="absolute -right-14 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--amber-rgb)/0.25),transparent_68%)]" />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-[32px] border-2 border-white/75 transition active:scale-[0.98]">
              <Image src={avatar || "https://placehold.co/360x360"} alt="avatar" width={164} height={164} className="h-36 w-36 rounded-[32px] object-cover" unoptimized />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-borderStrong bg-black/70 p-1.5 text-white"><Camera className="h-4 w-4" /></span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
          </div>
        </div>
        <CardContent className="p-3">
          <p className="text-xs text-text2">{uploading ? "Загрузка фото..." : "Нажми на фото для обновления"}</p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Коротко о себе: чем живешь и что ищешь" />

        <div className="grid grid-cols-2 gap-2">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Страна" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" />
        </div>

        <Card className="border-border bg-surface/88 backdrop-blur-2xl">
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-text2">Профессиональный контекст (необязательно: вуз / работа / деятельность / специальность)</p>
            <Input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="ВУЗ (опционально)" />
            <Input value={work} onChange={(e) => setWork(e.target.value)} placeholder="Работа (опционально)" />
            <Input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Деятельность (например: стартап, фриланс)" />
            <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Специальность (например: Product Manager)" />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface/88 backdrop-blur-2xl">
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-text2">Факты о себе (2–3). Пример: «провёл 50 нетворк-встреч».</p>
            {facts.map((fact, idx) => (
              <Input
                key={`fact-${idx}`}
                value={fact}
                onChange={(e) => {
                  const next = [...facts];
                  next[idx] = e.target.value;
                  setFacts(next);
                }}
                placeholder={`Факт ${idx + 1}`}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-surface/88 backdrop-blur-2xl">
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-text2">Интересы (минимум 3)</p>
            <TagInput value={interests} onChange={setInterests} suggestions={popularTags} min={3} max={20} placeholder="Добавь интерес и Enter" />
          </CardContent>
        </Card>

        <Card className="border-border bg-surface/88 backdrop-blur-2xl">
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-text2">Хобби (опционально)</p>
            <TagInput value={hobbies} onChange={setHobbies} suggestions={popularTags} max={20} placeholder="Хобби" />
          </CardContent>
        </Card>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <Button className="w-full" onClick={save} disabled={saving || meQuery.isLoading}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </ProfileSettingsLayout>
  );
}
