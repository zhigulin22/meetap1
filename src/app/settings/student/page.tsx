"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export default function StudentVerificationPage() {
  const queryClient = useQueryClient();
  const [university, setUniversity] = useState("");
  const [studentIdNumber, setStudentIdNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const verificationQuery = useQuery({
    queryKey: ["student-verification"],
    queryFn: () => api<{ verification: any }>("/api/profile/student-verification"),
  });

  const verification = verificationQuery.data?.verification;
  const status = verification?.status ?? "none";
  const createdAt = verification?.created_at ? new Date(verification.created_at) : null;
  const needsRefresh = createdAt ? Date.now() - createdAt.getTime() > 1000 * 60 * 60 * 24 * 60 : false;

  async function submit() {
    if (!file) {
      toast.error("Добавь фото студенческого билета");
      return;
    }
    const fd = new FormData();
    fd.append("student_id", file);
    fd.append("university", university);
    fd.append("student_id_number", studentIdNumber);

    try {
      setLoading(true);
      const res = await fetch("/api/profile/student-verification", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Не удалось отправить заявку");
      }
      toast.success("Заявка отправлена на проверку");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["student-verification"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--violet-rgb)/0.22)] text-[rgb(var(--violet-rgb))]">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Верификация студента</h1>
                <p className="text-sm text-text2">Подтверди вуз для доверия и приоритетных рекомендаций.</p>
              </div>
            </div>

            {status === "approved" ? (
              <div className="rounded-2xl border border-[rgb(var(--success-rgb)/0.4)] bg-[rgb(var(--success-rgb)/0.12)] p-3 text-sm text-text">
                🎓 Верификация подтверждена{verification?.university ? ` · ${verification.university}` : ""}
                {needsRefresh ? <div className="mt-2 text-xs text-text2">Пора обновить документы (раз в 2 месяца).</div> : null}
              </div>
            ) : status === "pending" ? (
              <div className="rounded-2xl border border-[rgb(var(--warning-rgb)/0.4)] bg-[rgb(var(--warning-rgb)/0.12)] p-3 text-sm text-text">
                ⏳ Заявка на проверке модератором
              </div>
            ) : status === "rejected" ? (
              <div className="rounded-2xl border border-[rgb(var(--danger-rgb)/0.4)] bg-[rgb(var(--danger-rgb)/0.12)] p-3 text-sm text-text">
                ❌ Заявка отклонена. Можно отправить новую.
              </div>
            ) : null}
          </CardContent>
        </Card>

        {(status !== "approved" || needsRefresh) && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Университет" value={university} onChange={(e) => setUniversity(e.target.value)} />
                <Input placeholder="Номер студенческого (опционально)" value={studentIdNumber} onChange={(e) => setStudentIdNumber(e.target.value)} />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.9)] p-3 text-sm text-text2">
                <span className="flex-1">Загрузить фото студенческого билета (jpeg/png/webp)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <Button onClick={submit} disabled={loading} className="h-12">
                {loading ? "Отправляем..." : "Отправить на проверку"}
              </Button>

              <p className="text-xs text-text3">После отправки заявку проверит модератор в Telegram‑боте.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
