"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function CreateEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(initialState);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
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

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const createRes = await api<{ id: string }>("/api/events/create", {
        method: "POST",
        body: JSON.stringify({
          title: state.title.trim(),
          category: state.category.trim(),
          city: state.city.trim(),
          venue_name: state.venue.trim(),
          venue_address: state.venue.trim(),
          starts_at: toIso(state.date, state.start_time),
          ends_at: state.end_time ? toIso(state.date, state.end_time) : null,
          short_description: state.short_description.trim(),
          full_description: state.full_description.trim(),
          is_free: !state.is_paid,
          price_text: state.price_text.trim(),
          organizer_name: state.organizer_name.trim(),
          organizer_telegram: state.organizer_telegram.trim(),
        }),
      });

      if (coverFile) {
        const fd = new FormData();
        fd.append("file", coverFile);
        fd.append("makePrimary", "true");
        const uploadRes = await fetch(`/api/events/${createRes.id}/media`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!uploadRes.ok) {
          const payload = await uploadRes.json().catch(() => ({}));
          throw new Error(payload?.error || "Не удалось загрузить обложку");
        }
      }

      const submissionRes = await api<{ submission_id: string }>("/api/event-submissions", {
        method: "POST",
        body: JSON.stringify({
          title: state.title.trim(),
          category: state.category.trim(),
          short_description: state.short_description.trim(),
          full_description: state.full_description.trim(),
          city: state.city.trim(),
          address: state.venue.trim(),
          starts_at: toIso(state.date, state.start_time),
          ends_at: state.end_time ? toIso(state.date, state.end_time) : null,
          cover_urls: [],
          mode: state.format === "organize" ? "organize" : state.format === "looking" ? "looking_company" : "collect_group",
          is_paid: state.is_paid,
          price: null,
          payment_url: state.payment_url.trim() || null,
          payment_note: state.price_text.trim() || null,
          telegram_contact: state.organizer_telegram.trim(),
          participant_limit: null,
          looking_for_count: null,
          moderator_comment: null,
          trust_confirmed: true,
          organizer_name: state.organizer_name.trim(),
          event_id: createRes.id,
        }),
      });

      setSuccessId(submissionRes.submission_id);
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
              {coverPreview ? (
                <img src={coverPreview} alt="preview" className="h-40 w-full rounded-2xl object-cover" />
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
            <Button variant="secondary" onClick={() => localStorage.setItem(DRAFT_KEY, JSON.stringify(state))}>
              Сохранить черновик
            </Button>
            {step < 5 ? (
              <Button onClick={() => canGoNext && setStep((s) => (s + 1) as Step)} disabled={!canGoNext}>
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

