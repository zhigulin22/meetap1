"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

export default function LanguageSettingsPage() {
  const [lang, setLang] = useState("ru");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = localStorage.getItem("app_language") ?? "ru";
    setLang(current);
  }, []);

  async function save() {
    setSaving(true);
    localStorage.setItem("app_language", lang);
    toast.success("Язык сохранен");
    setSaving(false);
  }

  return (
    <ProfileSettingsLayout title="Язык" subtitle="Выбор языка интерфейса">
      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader>
          <CardTitle className="text-sm text-text inline-flex items-center gap-2"><Globe className="h-4 w-4" /> Язык интерфейса</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LANGUAGES.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLang(opt.code)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                lang === opt.code
                  ? "border-[rgb(var(--sky-rgb)/0.45)] bg-[rgb(var(--sky-rgb)/0.14)] text-text"
                  : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] text-text2"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </CardContent>
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </ProfileSettingsLayout>
  );
}
