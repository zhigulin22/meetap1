"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ApiClientError, api } from "@/lib/api-client";

const DRAFT_KEY = "event_wizard_draft_v2";

type Step = 1 | 2 | 3 | 4 | 5;

type WizardState = {
  title: string;
  category: string;
  format: "organize" | "looking" | "group";
  city: string;
  venue: string;
  date: string;
  start_time: string;
  end_time: string;
  short_description: string;
  full_description: string;
  organizer_name: string;
  organizer_telegram: string;
  is_paid: boolean;
  price_text: string;
  payment_url: string;
};

const initialState: WizardState = {
  title: "",
  category: "concerts",
  format: "organize",
  city: "",
  venue: "",
  date: "",
  start_time: "",
  end_time: "",
  short_description: "",
  full_description: "",
  organizer_name: "",
  organizer_telegram: "",
  is_paid: false,
  price_text: "",
  payment_url: "",
};

function toIso(date: string, time: string) {
  const safe = time || "00:00";
  return new Date(`${date}T${safe}:00`).toISOString();
}

function parseError(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось отправить заявку";
}

function missingFields(state: WizardState) {
  const missing: string[] = [];
  if (!state.title.trim()) missing.push("Название");
  if (!state.category.trim()) missing.push("Категория");
  if (!state.city.trim()) missing.push("Город");
  if (!state.venue.trim()) missing.push("Место");
  if (!state.date) missing.push("Дата");
  if (!state.start_time) missing.push("Время начала");
  if (state.short_description.trim().length < 10) missing.push("Короткое описание");
  if (state.full_description.trim().length < 20) missing.push("Полное описание");
  if (!state.organizer_name.trim()) missing.push("Имя организатора");
  if (!state.organizer_telegram.trim()) missing.push("Telegram организатора");
  if (state.is_paid && !state.price_text.trim() && !state.payment_url.trim()) missing.push("Оплата/цена");
  return missing;
}

function CreateEventPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(initialState);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    const draftParam = searchParams.get("draftId");
    if (draftParam) {
      setDraftId(draftParam);
      api<{ event: any }>(`/api/events/${draftParam}`)
        .then((res) => {
          const ev = res.event ?? {};
          setState((prev) => ({
            ...prev,
            title: ev.title ?? "",
            category: ev.category ?? "concerts",
            format: ev.social_mode === "looking_company" ? "looking" : ev.social_mode === "collect_group" ? "group" : "organize",
            city: ev.city ?? "",
            venue: ev.venue_name ?? ev.venue_address ?? "",
            date: ev.starts_at ? String(ev.starts_at).slice(0, 10) : "",
            start_time: ev.starts_at ? String(ev.starts_at).slice(11, 16) : "",
            end_time: ev.ends_at ? String(ev.ends_at).slice(11, 16) : "",
            short_description: ev.short_description ?? "",
            full_description: ev.full_description ?? "",
            organizer_name: ev.organizer_name ?? "",
            organizer_telegram: ev.organizer_telegram ?? "",
            is_paid: Boolean(ev.is_paid),
            price_text: ev.price_note ?? ev.price_text ?? "",
            payment_url: ev.payment_url ?? "",
          }));
          if (ev.cover_url) setExistingCoverUrl(ev.cover_url);
          if ((ev.status && ev.status !== "draft") || (ev.moderation_status && ev.moderation_status !== "pending")) {
            setError("Это событие уже отправлено или опубликовано. Доступно только чтение.");
          }
        })
        .catch(() => null);
      return;
    }

    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as WizardState;
      setState({ ...initialState, ...parsed });
    } catch {
      setState(initialState);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [state]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const progress = useMemo(() => (step / 5) * 100, [step]);

  const requiredBase = state.title.trim() && state.category.trim() && state.format && state.city.trim();
  const requiredWhenWhere = state.date && state.start_time && state.venue.trim();
  const requiredDescription = state.short_description.trim().length >= 10 && state.full_description.trim().length >= 20;
  const requiredContacts = state.organizer_name.trim() && state.organizer_telegram.trim();

  const draftReady = requiredBase && requiredWhenWhere;

  const canGoNext =
    (step === 1 && requiredBase) ||
    (step === 2 && requiredWhenWhere) ||
    (step === 3 && requiredDescription) ||
    (step === 4 && requiredContacts);

  const canSubmit =
    requiredBase &&
    requiredWhenWhere &&
    requiredDescription &&
    requiredContacts &&
    (!state.is_paid || !!state.price_text.trim() || !!state.payment_url.trim());

  async function saveDraft(redirect = true) {
    if (!draftReady) {
      setError("Заполни шаги 1–2, чтобы сохранить черновик");
      return null;
    }
    setLoading(true);
    setError(null);

    try {
      const draftRes = await api<{ id: string }>("/api/events/draft", {
        method: "POST",
        body: JSON.stringify({
          event_id: draftId ?? undefined,
          title: state.title.trim(),
          category: state.category.trim(),
          city: state.city.trim(),
          venue_name: state.venue.trim(),
          venue_address: state.venue.trim(),
          starts_at: toIso(state.date, state.start_time),
          ends_at: state.end_time ? toIso(state.date, state.end_time) : null,
          short_description: state.short_description.trim() || "Черновик: описание будет добавлено позже",
          full_description: state.full_description.trim() || state.short_description.trim() || "Черновик: описание будет добавлено позже",
          is_free: !state.is_paid,
          price_text: state.price_text.trim(),
          organizer_name: state.organizer_name.trim(),
          organizer_telegram: state.organizer_telegram.trim(),
          social_mode: state.format === "looking" ? "looking_company" : state.format === "group" ? "collect_group" : "organize",
        }),
      });

      setDraftId(draftRes.id);

      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        fd.append("makePrimary", "true");
        const uploadRes = await fetch(`/api/events/${draftRes.id}/media`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!uploadRes.ok) {
          const payload = await uploadRes.json().catch(() => ({}));
          throw new Error(payload?.error || "Не удалось загрузить обложку");
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      toast.success("Черновик сохранён");
      if (redirect) router.push(`/events/${draftRes.id}`);
      return draftRes.id;
    } catch (e) {
      setError(parseError(e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!canSubmit) {
      const missing = missingFields(state);
      setError(missing.length ? `Заполни поля: ${missing.join(", ")}` : "Заполни все обязательные поля перед отправкой");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const eventId = (await saveDraft(false)) ?? draftId;
      if (!eventId) return;

      const submissionRes = await api<{ submission_id: string }>(`/api/events/${eventId}/submit`, {
        method: "POST",
      });

      setSuccessId(submissionRes.submission_id ?? eventId);
      localStorage.removeItem(DRAFT_KEY);
      setCoverFile(null);
    } catch (e) {
      setError(parseError(e));
    } finally {
      setLoading(false);
    }
  }

  if (successId) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[rgb(var(--teal-rgb))]" />
          <h1 className="mt-3 text-2xl font-semibold">Заявка отправлена</h1>
          <p className="mt-2 text-sm text-text2">Модератор проверит событие и опубликует в разделе “Идём вместе”.</p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push("/events")}>Вернуться к событиям</Button>
            <Button variant="secondary" onClick={() => router.push("/events/submissions")}>Мои заявки</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Добавить событие</h1>
          <p className="text-xs text-muted">Пошагово соберём карточку и загрузим фото</p>
        </div>

        <div className="mb-4 rounded-full bg-[rgb(var(--surface-2-rgb)/0.9)]">
          <div className="h-2 rounded-full bg-[linear-gradient(90deg,rgb(var(--sky-rgb)),rgb(var(--violet-rgb)))]" style={{ width: `${progress}%` }} />
        </div>

        {error ? (
          <div className="mb-3 rounded-xl border border-[rgb(var(--danger-rgb)/0.24)] bg-[rgb(var(--danger-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--danger-rgb))]">
            {error}
          </div>
        ) : null}

        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">1. Основное</h2>
              <Input placeholder="Название события" value={state.title} onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-sm text-text2">
                  <span className="mb-1 block text-xs text-text3">Категория</span>
                  <select
                    className="w-full bg-transparent text-sm text-text outline-none"
                    value={state.category}
                    onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}
                  >
                    <option value="concerts">Концерты</option>
                    <option value="sports">Спорт</option>
                    <option value="arts">Искусство</option>
                    <option value="quests">Квесты</option>
                    <option value="other">Другое</option>
                  </select>
                </label>
                <label className="rounded-xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-sm text-text2">
                  <span className="mb-1 block text-xs text-text3">Формат</span>
                  <select
                    className="w-full bg-transparent text-sm text-text outline-none"
                    value={state.format}
                    onChange={(e) => setState((s) => ({ ...s, format: e.target.value as WizardState["format"] }))}
                  >
                    <option value="organize">Организую событие</option>
                    <option value="looking">Ищу компанию</option>
                    <option value="group">Собираю группу</option>
                  </select>
                </label>
              </div>
              <Input placeholder="Город" value={state.city} onChange={(e) => setState((s) => ({ ...s, city: e.target.value }))} />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">2. Когда и где</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Input type="date" value={state.date} onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="time" value={state.start_time} onChange={(e) => setState((s) => ({ ...s, start_time: e.target.value }))} />
                  <Input type="time" value={state.end_time} onChange={(e) => setState((s) => ({ ...s, end_time: e.target.value }))} />
                </div>
              </div>
              <Input placeholder="Адрес / место" value={state.venue} onChange={(e) => setState((s) => ({ ...s, venue: e.target.value }))} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">3. Описание и медиа</h2>
              <Textarea
                rows={2}
                placeholder="Короткое описание (до 160 символов)"
                value={state.short_description}
                onChange={(e) => setState((s) => ({ ...s, short_description: e.target.value }))}
              />
              <Textarea
                rows={4}
                placeholder="Полное описание"
                value={state.full_description}
                onChange={(e) => setState((s) => ({ ...s, full_description: e.target.value }))}
              />
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] p-3 text-sm text-text2">
                <ImagePlus className="h-5 w-5 text-[rgb(var(--sky-rgb))]" />
                <span className="flex-1">Загрузить обложку (jpeg/png/webp)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {coverPreview || existingCoverUrl ? (
                <img src={coverPreview ?? existingCoverUrl ?? ""} alt="preview" className="h-40 w-full rounded-2xl object-cover" />
              ) : (
                <p className="text-xs text-text3">Можно продолжить без фотографии, но с фото событие выглядит лучше.</p>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">4. Контакты и оплата</h2>
              <Input placeholder="Имя организатора" value={state.organizer_name} onChange={(e) => setState((s) => ({ ...s, organizer_name: e.target.value }))} />
              <Input placeholder="Telegram (@username или t.me/...)" value={state.organizer_telegram} onChange={(e) => setState((s) => ({ ...s, organizer_telegram: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-text2">
                <input type="checkbox" checked={state.is_paid} onChange={(e) => setState((s) => ({ ...s, is_paid: e.target.checked }))} />
                Платное событие
              </label>
              {state.is_paid ? (
                <div className="grid gap-2">
                  <Input placeholder="Цена / условия" value={state.price_text} onChange={(e) => setState((s) => ({ ...s, price_text: e.target.value }))} />
                  <Input placeholder="Ссылка на оплату" value={state.payment_url} onChange={(e) => setState((s) => ({ ...s, payment_url: e.target.value }))} />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">5. Проверка</h2>
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] p-4 text-sm text-text2">
                <p className="font-semibold text-text">{state.title || "Без названия"}</p>
                <p className="mt-1">{state.category} · {state.city}</p>
                <p className="mt-2 text-xs text-text3">{state.short_description || "Описание не заполнено"}</p>
              </div>
              <p className="text-xs text-text3">После отправки событие попадёт на модерацию.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" onClick={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Назад
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => saveDraft(true)} disabled={loading || !draftReady}>
              {loading ? "Сохраняем..." : "Сохранить черновик"}
            </Button>
            {step < 5 ? (
              <Button onClick={() => canGoNext && setStep((s) => (s + 1) as Step)} disabled={!canGoNext || loading}>
                Далее <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canSubmit || loading}>
                {loading ? "Отправляем..." : "Отправить на модерацию"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold">Добавить событие</h1>
              <p className="text-xs text-muted">Загружаем форму...</p>
            </div>
            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-5">
              <div className="h-40 animate-pulse rounded-2xl bg-[rgb(var(--surface-3-rgb)/0.5)]" />
            </div>
          </div>
        </PageShell>
      }
    >
      <CreateEventPageInner />
    </Suspense>
  );
}
