"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api-client";

/* ─── Google icon ──────────────────────────────────────────────────────────── */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

type TgStep = "phone" | "code" | "name";

function isPhoneLikelyValid(phone: string) {
  return /^\+?[1-9]\d{9,14}$/.test(phone.replace(/[\s()-]/g, ""));
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [phone, setPhone] = useState("+");
  const [token, setToken] = useState<string | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTelegram, setShowTelegram] = useState(false);

  const tgStep: TgStep = useMemo(() => {
    if (!token) return "phone";
    if (needsName) return "name";
    return "code";
  }, [token, needsName]);

  useEffect(() => {
    if (!token || verified) return;
    const timer = setInterval(async () => {
      try {
        const res = await api<{ status: string }>(`/api/auth/check-verification?token=${token}`);
        if (res.status === "verified") setVerified(true);
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [token, verified]);

  useEffect(() => {
    if (errorParam === "google_unavailable") toast.error("Google Auth недоступен. Попробуй позже.");
    if (errorParam === "google_failed") toast.error("Не удалось войти через Google.");
    if (errorParam === "google_cancelled") toast.error("Вход отменён.");
  }, [errorParam]);

  async function startVerification() {
    if (!isPhoneLikelyValid(phone)) { toast.error("Неверный номер. Пример: +79990000000"); return; }
    try {
      setLoading(true);
      const res = await api<{ token: string; telegramDeepLink: string; immediate?: boolean }>(
        "/api/auth/start-verification",
        { method: "POST", body: JSON.stringify({ phone }) },
      );
      setToken(res.token);
      setTelegramDeepLink(res.telegramDeepLink);
      setVerified(Boolean(res.immediate));
      toast.success("Открой Telegram и нажми Start у бота");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(withName: boolean) {
    if (!token) return;
    if (!/^\d{6}$/.test(code)) { toast.error("Код — 6 цифр"); return; }
    if (withName && name.trim().length < 2) { toast.error("Имя от 2 символов"); return; }
    try {
      setLoading(true);
      const res = await api<{ needsName?: boolean; mode?: string }>(
        "/api/auth/complete-registration",
        { method: "POST", body: JSON.stringify({ token, code, name: withName ? name.trim() : undefined }) },
      );
      if (res.needsName) { setNeedsName(true); toast.message("Новый аккаунт. Добавь имя"); return; }
      toast.success("Вход выполнен!");
      router.push("/feed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      toast.error(msg.includes("Phone is not verified") ? "Сначала нажми Start в Telegram-боте" : msg);
    } finally {
      setLoading(false);
    }
  }

  function resetTg() {
    setToken(null); setTelegramDeepLink(null); setVerified(false);
    setCode(""); setName(""); setNeedsName(false);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#52CC83]/18 blur-[130px]" />
        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-[#4e75ff]/18 blur-[110px]" />
        <div className="absolute bottom-0 left-1/2 h-[320px] w-[520px] -translate-x-1/2 rounded-full bg-[#52CC83]/10 blur-[90px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: "spring", stiffness: 200 }}
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#52CC83] to-[#2ea85a] shadow-xl shadow-[#52CC83]/35"
          >
            <span className="font-display text-2xl font-extrabold text-white">M</span>
          </motion.div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Meetap</h1>
          <p className="mt-1.5 text-sm text-muted">Знакомства, которые случаются в реальной жизни</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/12 bg-surface/80 p-6 shadow-soft backdrop-blur-2xl">
          <AnimatePresence mode="wait">
            {!showTelegram ? (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="mb-4">
                  <h2 className="font-display text-xl font-bold">Добро пожаловать</h2>
                  <p className="mt-0.5 text-sm text-muted">Войди или создай аккаунт за несколько секунд</p>
                </div>

                {/* Google button */}
                <a
                  href="/api/auth/google/start"
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 py-3.5 text-sm font-semibold text-text shadow-sm transition-all duration-150 hover:bg-white/18 hover:shadow-md active:scale-[0.98]"
                >
                  <GoogleIcon size={20} />
                  Продолжить через Google
                </a>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-xs text-muted/70">или</span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* Telegram button */}
                <button
                  onClick={() => setShowTelegram(true)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-medium text-muted transition-all duration-150 hover:bg-white/10 hover:text-text"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[#2AABEE]">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.94 8.19-1.97 9.27c-.14.65-.53.81-1.07.5l-2.97-2.19-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.02 5.51-4.98c.24-.21-.05-.33-.37-.12L7.5 14.08l-2.91-.91c-.63-.2-.64-.63.13-.93l11.34-4.37c.53-.19.99.13.88.32z" />
                  </svg>
                  Войти через Telegram
                </button>

                <p className="pt-1 text-center text-xs text-muted">
                  Уже есть пароль?{" "}
                  <Link href="/login" className="text-action underline underline-offset-2">
                    Войти
                  </Link>
                </p>
              </motion.div>
            ) : (
              /* ── Telegram flow ─────────────────────────────────────────── */
              <motion.div
                key={tgStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.28 }}
                className="space-y-3"
              >
                <button
                  onClick={() => { resetTg(); setShowTelegram(false); }}
                  className="mb-1 flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
                >
                  ← Назад
                </button>

                {tgStep === "phone" && (
                  <>
                    <h2 className="font-display text-xl font-bold">Введи номер</h2>
                    <p className="text-sm text-muted">Вышлем код в Telegram-бот</p>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+79990000000"
                      className="w-full rounded-xl border border-border bg-white/5 px-4 py-3 text-sm outline-none ring-0 placeholder:text-muted/60 focus:border-action focus:ring-2 focus:ring-action/20"
                    />
                    <button
                      onClick={startVerification}
                      disabled={loading}
                      className="w-full rounded-2xl bg-action py-3.5 text-sm font-semibold text-white shadow-lg shadow-action/25 transition-all hover:bg-action/90 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? "Отправляем..." : "Получить код"}
                    </button>
                  </>
                )}

                {tgStep === "code" && (
                  <>
                    <h2 className="font-display text-xl font-bold">Введи код</h2>
                    <p className="text-sm text-muted">
                      {verified ? "Код отправлен — введи его ниже." : "Открой Telegram-бота и нажми Start."}
                    </p>
                    {telegramDeepLink && (
                      <a href={telegramDeepLink} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#2AABEE]/30 bg-[#2AABEE]/10 px-3 py-2 text-sm text-[#2AABEE] hover:bg-[#2AABEE]/20">
                        Открыть Telegram-бота →
                      </a>
                    )}
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full rounded-xl border border-border bg-white/5 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.6em] outline-none placeholder:tracking-normal placeholder:text-muted/40 focus:border-action focus:ring-2 focus:ring-action/20"
                    />
                    <button
                      onClick={() => submitCode(false)}
                      disabled={loading || code.length !== 6}
                      className="w-full rounded-2xl bg-action py-3.5 text-sm font-semibold text-white shadow-lg shadow-action/25 transition-all hover:bg-action/90 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? "Проверяем..." : "Продолжить"}
                    </button>
                    <button onClick={resetTg} className="w-full rounded-2xl bg-white/5 py-3 text-sm text-muted hover:bg-white/10">
                      Изменить номер
                    </button>
                  </>
                )}

                {tgStep === "name" && (
                  <>
                    <h2 className="font-display text-xl font-bold">Как тебя зовут?</h2>
                    <p className="text-sm text-muted">Новый аккаунт — добавь имя</p>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Твоё имя"
                      autoFocus
                      className="w-full rounded-xl border border-border bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted/60 focus:border-action focus:ring-2 focus:ring-action/20"
                    />
                    <button
                      onClick={() => submitCode(true)}
                      disabled={loading || name.trim().length < 2}
                      className="w-full rounded-2xl bg-action py-3.5 text-sm font-semibold text-white shadow-lg shadow-action/25 transition-all hover:bg-action/90 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? "Создаём..." : "Завершить регистрацию"}
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-5 text-center text-xs text-muted/60">
          Регистрируясь, ты принимаешь условия использования Meetap
        </p>
      </motion.div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
