"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

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

function LogoIcon() {
  return (
    <div className="relative mx-auto mb-4 flex h-[64px] w-[64px] items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="Meetap" className="h-full w-full rounded-[20px] shadow-2xl shadow-[#6d28d9]/50" />
    </div>
  );
}

type Tab = "password" | "telegram";
type TgStep = "phone" | "code";

function isPhoneLikelyValid(phone: string) {
  return /^\+?[1-9]\d{9,14}$/.test(phone.replace(/[\s()-]/g, ""));
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  const d = local.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `+7 (${d}`;
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 8) return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

function parsePhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1, 11) : digits.slice(0, 10);
  return local.length > 0 ? `+7${local}` : "+7";
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("telegram");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [phone, setPhone] = useState("+");
  const [code, setCode] = useState("");
  const [tgStep, setTgStep] = useState<TgStep>("phone");
  const [tgLoading, setTgLoading] = useState(false);
  const [botLink, setBotLink] = useState("");
  const [sentDirectly, setSentDirectly] = useState(false);

  async function loginWithPassword() {
    if (!login.trim() || password.length < 8) {
      toast.error("Заполни логин и пароль");
      return;
    }
    setPwLoading(true);
    try {
      await api("/api/auth/login-password", {
        method: "POST",
        body: JSON.stringify({ login, password }),
      });
      router.push("/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setPwLoading(false);
    }
  }

  async function sendCode() {
    if (!isPhoneLikelyValid(phone)) {
      toast.error("Неверный номер. Пример: +79990000000");
      return;
    }
    setTgLoading(true);
    try {
      const res = await api<{ botLink: string; sentDirectly: boolean }>("/api/auth/telegram-code/send", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setBotLink(res.botLink ?? "");
      setSentDirectly(res.sentDirectly ?? false);
      setTgStep("code");
      if (res.sentDirectly) {
        toast.success("Код отправлен в Telegram");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setTgLoading(false);
    }
  }

  async function verifyAndLogin() {
    if (!/^\d{5,6}$/.test(code)) {
      toast.error("Введи 5 или 6 цифр из Telegram");
      return;
    }
    setTgLoading(true);
    try {
      const res = await api<{ isNewUser: boolean }>(
        "/api/auth/telegram-code/verify",
        { method: "POST", body: JSON.stringify({ phone, code }) },
      );
      if (res.isNewUser) {
        toast.error("Аккаунт не найден — сначала зарегистрируйся");
        router.push("/register");
        return;
      }
      await api("/api/auth/telegram-code/login", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      toast.success("Добро пожаловать!");
      router.push("/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTgLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-[#6d28d9]/20 blur-[160px]" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] animate-[pulse_9s_ease-in-out_infinite_1.5s] rounded-full bg-[#2563eb]/18 blur-[140px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_11s_ease-in-out_infinite_3s] rounded-full bg-[#4f46e5]/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo + title */}
        <div className="mb-7 text-center">
          <LogoIcon />
          <h1 className="font-display text-[28px] font-black tracking-tight text-white">Войти в Meetap</h1>
          <p className="mt-1 text-sm text-muted">Выбери удобный способ</p>
        </div>

        {/* Google */}
        <motion.a
          href="/api/auth/google/start"
          whileTap={{ scale: 0.97 }}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/95 py-3.5 text-sm font-semibold text-[#1a1a1a] shadow-lg shadow-black/30 transition-all hover:bg-white active:scale-[0.98]"
        >
          <GoogleIcon size={20} />
          Войти через Google
        </motion.a>

        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-xs text-muted/60">или</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-3xl border border-[#7c3aed]/20 bg-[#0c0b1e]/80 shadow-soft backdrop-blur-2xl">
          {/* Tabs */}
          <div className="flex border-b border-white/8">
            {(["telegram", "password"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative flex-1 py-3.5 text-sm font-medium transition-all ${
                  tab === t ? "text-white" : "text-muted hover:text-white/70"
                }`}
              >
                {tab === t && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#7c3aed] to-[#3b82f6]"
                  />
                )}
                {t === "password" ? "Логин + пароль" : "Telegram"}
              </button>
            ))}
          </div>

          <div className="p-6">
            <AnimatePresence mode="wait">
              {tab === "password" ? (
                <motion.div key="password" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }} className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">Логин или номер телефона</label>
                    <input
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="username или +79990000000"
                      className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-muted/50 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">Пароль</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Твой пароль"
                      onKeyDown={(e) => e.key === "Enter" && loginWithPassword()}
                      className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-muted/50 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
                    />
                  </div>
                  <button
                    onClick={loginWithPassword}
                    disabled={pwLoading}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  >
                    {pwLoading ? "Входим..." : "Войти"}
                  </button>
                </motion.div>
              ) : (
                <AnimatePresence mode="wait">
                  {tgStep === "phone" ? (
                    <motion.div key="tg-phone" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
                      <p className="text-sm text-muted">
                        Введи номер — Telegram пришлёт код в{" "}
                        <span className="font-medium text-[#818cf8]">Verification Codes</span>
                      </p>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                          <svg className="h-5 w-5 text-[#818cf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z" />
                          </svg>
                        </div>
                        <input
                          value={formatPhoneDisplay(phone)}
                          onChange={(e) => setPhone(parsePhoneInput(e.target.value))}
                          placeholder="+7 (000) 000-00-00"
                          inputMode="tel"
                          autoComplete="tel"
                          onKeyDown={(e) => e.key === "Enter" && sendCode()}
                          className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-muted/50 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
                        />
                      </div>
                      <button
                        onClick={sendCode}
                        disabled={tgLoading}
                        className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      >
                        {tgLoading ? "Отправляем..." : "Получить код"}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="tg-code" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
                      {sentDirectly ? (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                          Код отправлен в Telegram — проверь сообщения от бота.
                        </div>
                      ) : (
                        <>
                          <div className="rounded-xl border border-[#818cf8]/20 bg-[#818cf8]/8 p-3 text-sm text-muted">
                            Нажми кнопку ниже и отправь боту <span className="font-semibold text-[#818cf8]">Start</span> — он пришлёт код.
                          </div>
                          {botLink && (
                            <a
                              href={botLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#229ED9] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#229ED9]/30 transition-all hover:opacity-90 active:scale-[0.98]"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.94 8.19-1.97 9.27c-.14.65-.53.81-1.07.5l-2.97-2.19-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.02 5.51-4.98c.24-.21-.05-.33-.37-.12L7.5 14.08l-2.91-.91c-.63-.2-.64-.63.13-.93l11.34-4.37c.53-.19.99.13.88.32z" /></svg>
                              Открыть бота и получить код
                            </a>
                          )}
                        </>
                      )}
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && verifyAndLogin()}
                        className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.6em] text-white outline-none placeholder:tracking-normal placeholder:text-muted/40 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
                      />
                      <button
                        onClick={verifyAndLogin}
                        disabled={tgLoading || code.length < 5}
                        className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      >
                        {tgLoading ? "Проверяем..." : "Войти"}
                      </button>
                      <button onClick={sendCode} disabled={tgLoading} className="w-full rounded-xl border border-white/8 bg-white/5 py-3 text-sm text-muted transition-all hover:bg-white/10 hover:text-white/80">
                        Запросить код повторно
                      </button>
                      <button onClick={() => { setTgStep("phone"); setCode(""); setSentDirectly(false); setBotLink(""); }} className="w-full rounded-xl border border-white/8 bg-white/5 py-3 text-sm text-muted transition-all hover:bg-white/10 hover:text-white/80">
                        Изменить номер
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-semibold text-[#818cf8] underline underline-offset-2 hover:text-white">
            Зарегистрироваться
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
