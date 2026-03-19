"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

const DRAFT_KEY = "meetap_event_submission_draft_v1";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
};

type FormState = {
  title: string;
  category: string;
  city: string;
  venue: string;
  date: string;
  time: string;
  description: string;
  price: string;
  cover_url: string;
  telegram: string;
};

const defaultForm: FormState = {
  title: "",
  category: "concerts",
  city: "Москва",
  venue: "",
  date: "",
  time: "",
  description: "",
  price: "",
  cover_url: "",
  telegram: "",
};

export function CreateEventDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as Partial<FormState>;
        setForm({ ...defaultForm, ...parsed });
      } catch {
        setForm(defaultForm);
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, open]);

  const canSubmit = useMemo(() => {
    return Boolean(form.title && form.category && form.city && form.date && form.time && form.description && form.telegram);
  }, [form]);

  async function submit() {
    setError(null);
    if (!canSubmit) {
      setError("Заполни все обязательные поля");
      return;
    }

    const dateTime = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(dateTime.getTime())) {
      setError("Проверь дату и время");
      return;
    }

    try {
      setSaving(true);
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          city: form.city,
          venue: form.venue,
          event_date: dateTime.toISOString(),
          description: form.description,
          price: form.price ? Number(form.price) : 0,
          cover_url: form.cover_url || null,
          telegram: form.telegram,
        }),
      });
      localStorage.removeItem(DRAFT_KEY);
      setForm(defaultForm);
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить событие");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      mobileFullscreen
      contentClassName="p-0"
    >
      <div className="flex h-full flex-col">
        <DialogHeader className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <DialogTitle>Добавить событие</DialogTitle>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">Название *</label>
              <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Например: стендап вечер" />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted">Категория *</label>
                <select
                  className="w-full rounded-2xl border border-border bg-black/10 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                >
                  <option value="concerts">Концерты</option>
                  <option value="sports">Спорт</option>
                  <option value="arts">Искусство</option>
                  <option value="community">Комьюнити</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Город *</label>
                <Input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} placeholder="Москва" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Место</label>
              <Input value={form.venue} onChange={(e) => setForm((s) => ({ ...s, venue: e.target.value }))} placeholder="Адрес или площадка" />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted">Дата *</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Время *</label>
                <Input type="time" value={form.time} onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Описание *</label>
              <Textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} placeholder="Что будет, формат, зачем идти" />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted">Цена</label>
                <Input type="number" value={form.price} onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Обложка (URL)</label>
                <Input value={form.cover_url} onChange={(e) => setForm((s) => ({ ...s, cover_url: e.target.value }))} placeholder="https://" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Telegram контакт *</label>
              <Input value={form.telegram} onChange={(e) => setForm((s) => ({ ...s, telegram: e.target.value }))} placeholder="@username" />
            </div>

            {error ? <p className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-border bg-surface px-4 py-3">
          <div className="flex gap-2">
            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button className="w-full" onClick={submit} disabled={!canSubmit || saving}>
              {saving ? "Отправляем..." : "Отправить"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
