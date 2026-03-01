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
  country: z.string().trim().min(2, "Укажи страну"),
  city: z.string().trim().min(2, "Укажи город"),
  university: z.string().trim().min(2, "Укажи ВУЗ"),
  work: z.string().trim().min(2, "Укажи работу"),
  facts: z.array(z.string().trim().min(2, "Факт слишком короткий").max(120)).min(2).max(3),
  interests: z.array(z.string().trim().min(2).max(40)).min(3, "Минимум 3 интереса").max(20),
  hobbies: z.array(z.string().trim().max(40)).max(20),
});

export default function ProfileEditPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [university, setUniversity] = useState("");
  const [work, setWork] = useState("");
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
      country,
      city,
      university,
      work,
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
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify(parsed.data) });
      toast.success("Профиль сохранён");
      await meQuery.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileSettingsLayout title="Профиль" subtitle="Фото, био, факты, интересы — это влияет на match">
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-end gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-3xl border-2 border-white/70">
              <Image src={avatar || "https://placehold.co/300x300"} alt="avatar" width={128} height={128} className="h-24 w-24 rounded-3xl object-cover" unoptimized />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/70 p-1.5 text-white"><Camera className="h-4 w-4" /></span>
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
            <p className="text-xs text-muted">{uploading ? "Загрузка фото..." : "Нажми на фото для обновления"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Коротко о себе: чем живешь и что ищешь" />

        <div className="grid grid-cols-2 gap-2">
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Страна" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город" />
        </div>

        <Input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="ВУЗ" />
        <Input value={work} onChange={(e) => setWork(e.target.value)} placeholder="Работа" />

        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-muted">Факты о себе (2–3). Пример: «провёл 50 нетворк-встреч».</p>
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

        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-muted">Интересы (минимум 3)</p>
            <TagInput value={interests} onChange={setInterests} suggestions={popularTags} min={3} max={20} placeholder="Добавь интерес и Enter" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-muted">Хобби (опционально)</p>
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
