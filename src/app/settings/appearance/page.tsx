"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<"dark">("dark");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = "dark";
    setTheme(current);
  }, []);

  async function save() {
    setSaving(true);
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    toast.success("Тема сохранена");
    setSaving(false);
  }

  return (
    <ProfileSettingsLayout title="Оформление" subtitle="Светлая и тёмная тема">
      <Card className="border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)]">
        <CardHeader>
          <CardTitle className="text-sm text-text inline-flex items-center gap-2"><Palette className="h-4 w-4" /> Тема приложения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { value: "dark", label: "Тёмная (бренд)" },
            { value: "light", label: "Светлая (скоро)" , disabled: true},
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => !opt.disabled && setTheme("dark")}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                theme === opt.value
                  ? "border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--violet-rgb)/0.18)] text-text"
                  : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.8)] text-text2"
              } ${opt.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
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
