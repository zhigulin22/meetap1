"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

const schema = z.object({
  name: z.string().trim().min(2, "Имя минимум 2 символа").max(50),
  username: z.string().trim().max(32).optional(),
  email: z
    .string()
    .trim()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Некорректный email")
    .optional(),
});

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "Не указан";
  const clean = phone.replace(/\s/g, "");
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 3)} *** ${clean.slice(-2)}`;
}

export default function ProfileAccountPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const meQuery = useQuery({
    queryKey: ["profile-account-me"],
    queryFn: () => api<{ profile: any }>("/api/profile/me"),
  });

  useEffect(() => {
    const p = meQuery.data?.profile;
    if (!p) return;
    setName(p.name ?? "");
    setUsername(typeof p.username === "string" ? p.username : "");
    setEmail(typeof p.email === "string" ? p.email : "");
    setAvatar(p.avatar_url ?? "");
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
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify({ avatar_url: result.url }) });
      toast.success("Фото обновлено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить фото");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const payload = { name, username: username || undefined, email: email || undefined };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Проверь поля");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const body: Record<string, any> = { name: parsed.data.name };
      if (typeof meQuery.data?.profile?.username === "string") body.username = parsed.data.username || null;
      if (typeof meQuery.data?.profile?.email === "string") body.email = parsed.data.email || null;
      await api("/api/profile/me", { method: "PUT", body: JSON.stringify(body) });
      toast.success("Аккаунт сохранён");
      await meQuery.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Удалить аккаунт безвозвратно?")) return;
    await api("/api/profile/account", { method: "DELETE" });
    router.push("/register");
  }

  const profile = meQuery.data?.profile;

  return (
    <ProfileSettingsLayout title="Аккаунт" subtitle="Основные данные и контроль аккаунта">
      <Card className="border-border bg-surface/90 backdrop-blur-2xl">
        <CardContent className="p-4">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative rounded-3xl border-2 border-borderStrong outline-none transition active:scale-[0.98]"
            >
              <Image src={avatar || "https://placehold.co/200x200"} alt="avatar" width={132} height={132} className="h-24 w-24 rounded-3xl object-cover" unoptimized />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-borderStrong bg-[rgb(var(--bg-rgb)/0.64)] p-1.5 text-white"><Camera className="h-4 w-4" /></span>
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
            <div>
              <p className="text-sm font-semibold text-text">{profile?.name || "Пользователь"}</p>
              <p className="text-xs text-text2">{maskPhone(profile?.phone)}</p>
              <p className="text-xs text-blue/70">{uploading ? "Загрузка фото..." : "Нажми на фото для обновления"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />

        {typeof profile?.username === "string" ? <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" /> : null}

        {typeof profile?.email === "string" ? (
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        ) : (
          <Card className="border-border bg-surface2/64">
            <CardContent className="p-3 text-xs text-text2">Email не подключен для этого аккаунта</CardContent>
          </Card>
        )}

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <Button className="w-full" onClick={save} disabled={saving || meQuery.isLoading}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>

        <Button variant="danger" className="w-full" onClick={deleteAccount}>
          <Trash2 className="mr-2 h-4 w-4" /> Удалить аккаунт
        </Button>
      </div>
    </ProfileSettingsLayout>
  );
}
