"use client";

import { useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api-client";

type CreateEventSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => Promise<void> | void;
};

type FormState = {
  title: string;
  category: string;
  short_description: string;
  full_description: string;
  city: string;
  address: string;
  date: string;
  start_time: string;
  end_time: string;
  cover_urls: string;
  mode: "organize" | "looking_company" | "collect_group";
  is_paid: boolean;
  price: string;
  payment_url: string;
  payment_note: string;
  telegram_contact: string;
  participant_limit: string;
  looking_for_count: string;
  moderator_comment: string;
  trust_confirmed: boolean;
};

const initialState: FormState = {
  title: "",
  category: "Комьюнити",
  short_description: "",
  full_description: "",
  city: "",
  address: "",
  date: "",
  start_time: "",
  end_time: "",
  cover_urls: "",
  mode: "organize",
  is_paid: false,
  price: "",
  payment_url: "",
  payment_note: "",
  telegram_contact: "",
  participant_limit: "",
  looking_for_count: "",
  moderator_comment: "",
  trust_confirmed: false,
};

function toIso(date: string, time: string) {
  const safeTime = time || "00:00";
  return new Date(`${date}T${safeTime}:00`).toISOString();
}

function parseUrls(raw: string) {
  return raw
    .split(/\n|,/) 
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseError(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось отправить заявку";
}

export function CreateEventSheet({ open, onOpenChange, onCreated }: CreateEventSheetProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!form.title.trim() || !form.category.trim()) return false;
    if (!form.short_description.trim() || !form.full_description.trim()) return false;
    if (!form.city.trim() || !form.address.trim()) return false;
    if (!form.date || !form.start_time) return false;
    if (!parseUrls(form.cover_urls).length) return false;
    if (!form.telegram_contact.trim()) return false;
    if (!form.trust_confirmed) return false;
    if (form.is_paid && !form.price.trim() && !form.payment_url.trim() && !form.payment_note.trim()) return false;
    return true;
  }, [form]);

  async function submit() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const startsAt = toIso(form.date, form.start_time);
      const endsAt = form.end_time ? toIso(form.date, form.end_time) : null;

      const payload = {
        title: form.title.trim(),
        category: form.category.trim(),
        short_description: form.short_description.trim(),
        full_description: form.full_description.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        starts_at: startsAt,
        ends_at: endsAt,
        cover_urls: parseUrls(form.cover_urls),
        mode: form.mode,
        is_paid: form.is_paid,
        price: form.price ? Number(form.price) : null,
        payment_url: form.payment_url.trim() || null,
        payment_note: form.payment_note.trim() || null,
        telegram_contact: form.telegram_contact.trim(),
        participant_limit: form.participant_limit ? Number(form.participant_limit) : null,
        looking_for_count: form.looking_for_count ? Number(form.looking_for_count) : null,
        moderator_comment: form.moderator_comment.trim() || null,
        trust_confirmed: form.trust_confirmed,
      };

      const res = await api<{ submission_id: string; moderation_status: string; bot: { ok: boolean; reason?: string } }>(
        "/api/events/submissions",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setSuccess(
        res.bot?.ok
          ? "Заявка отправлена на модерацию в Telegram. После одобрения появится в Комьюнити."
          : "Заявка сохранена. Модератор проверит её в очереди.",
      );
      setForm(initialState);
      await onCreated();
    } catch (e) {
      setError(parseError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Добавить комьюнити-событие</DialogTitle>
      </DialogHeader>

      <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
        <section className="rounded-2xl border border-[#2a4f8a] bg-[linear-gradient(120deg,rgba(9,17,39,0.92),rgba(19,11,44,0.9))] p-3 text-[13px] text-white/85">
          <p className="font-medium text-white">Заявка проходит модерацию в Telegram-боте</p>
          <p className="mt-1 text-white/70">Заполни подробности, чтобы карточка события сразу выглядела качественно и прошла быстрее.</p>
        </section>

        <section className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[rgb(13,19,38)] p-3 md:grid-cols-2">
          <Input placeholder="Название события*" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Категория* (концерт, спорт, квест...)" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <Input placeholder="Город*" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <Input placeholder="Адрес / место*" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-[rgb(13,19,38)] p-3">
          <Textarea
            rows={2}
            placeholder="Краткое описание* (для карточки)"
            value={form.short_description}
            onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
          />
          <Textarea
            rows={4}
            placeholder="Полное описание*"
            value={form.full_description}
            onChange={(e) => setForm((f) => ({ ...f, full_description: e.target.value }))}
          />
          <Textarea
            rows={3}
            placeholder="Обложки* (URL, по одной в строке или через запятую)"
            value={form.cover_urls}
            onChange={(e) => setForm((f) => ({ ...f, cover_urls: e.target.value }))}
          />
        </section>

        <section className="grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-[rgb(13,19,38)] p-3 md:grid-cols-2">
          <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            <span className="mb-1 block text-xs text-white/60">Формат*</span>
            <select
              className="w-full bg-transparent text-sm text-white outline-none"
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as FormState["mode"] }))}
            >
              <option value="organize" className="bg-[#0A1024]">Организую событие</option>
              <option value="looking_company" className="bg-[#0A1024]">Ищу компанию</option>
              <option value="collect_group" className="bg-[#0A1024]">Собираю группу</option>
            </select>
          </label>

          <Input
            placeholder="Telegram контакт* (@username или https://t.me/...)"
            value={form.telegram_contact}
            onChange={(e) => setForm((f) => ({ ...f, telegram_contact: e.target.value }))}
          />

          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.is_paid}
              onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.checked }))}
            />
            Платное событие
          </label>

          <Input placeholder="Цена (если платное)" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />

          <Input
            placeholder="Ссылка на оплату (QTickets и т.п.)"
            value={form.payment_url}
            onChange={(e) => setForm((f) => ({ ...f, payment_url: e.target.value }))}
          />

          <Input
            placeholder="Лимит участников (опционально)"
            value={form.participant_limit}
            onChange={(e) => setForm((f) => ({ ...f, participant_limit: e.target.value }))}
          />

          <Input
            placeholder="Сколько человек ищу (опционально)"
            value={form.looking_for_count}
            onChange={(e) => setForm((f) => ({ ...f, looking_for_count: e.target.value }))}
          />

          <Input
            placeholder="Комментарий к оплате"
            value={form.payment_note}
            onChange={(e) => setForm((f) => ({ ...f, payment_note: e.target.value }))}
          />
        </section>

        <section className="space-y-2 rounded-2xl border border-white/10 bg-[rgb(13,19,38)] p-3">
          <Textarea
            rows={2}
            placeholder="Комментарий для модератора (опционально)"
            value={form.moderator_comment}
            onChange={(e) => setForm((f) => ({ ...f, moderator_comment: e.target.value }))}
          />

          <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={form.trust_confirmed}
              onChange={(e) => setForm((f) => ({ ...f, trust_confirmed: e.target.checked }))}
            />
            Подтверждаю, что событие реальное, не мошенническое и содержит актуальные контакты.
          </label>
        </section>

        {error ? <div className="rounded-xl border border-[#ff3b5c]/45 bg-[#ff3b5c]/12 p-2 text-sm text-[#ff9fb0]">{error}</div> : null}
        {success ? <div className="rounded-xl border border-[#00D2A8]/45 bg-[#00D2A8]/12 p-2 text-sm text-[#8bf5df]">{success}</div> : null}

        <div className="sticky bottom-0 z-10 flex gap-2 rounded-t-2xl border-t border-white/10 bg-[rgba(10,16,36,0.95)] p-2 backdrop-blur">
          <Button variant="secondary" className="h-11 flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
            Отмена
          </Button>
          <Button className="h-11 flex-[1.6] text-base font-semibold" disabled={!canSubmit || loading} onClick={submit}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
            {loading ? "Отправляем..." : "Отправить на модерацию"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
