"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import Link from "next/link";

type Step = "phone" | "code" | "name";

function isPhoneLikelyValid(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, "");
  return /^\+?[1-9]\d{9,14}$/.test(cleaned);
}

export default function RegisterPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("+");
  const [token, setToken] = useState<string | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [loading, setLoading] = useState(false);

  const step: Step = useMemo(() => {
    if (!token) return "phone";
    if (needsName) return "name";
    return "code";
  }, [token, needsName]);

  useEffect(() => {
    if (!token || verified) return;

    const timer = setInterval(async () => {
      try {
        const res = await api<{ status: string }>(`/api/auth/check-verification?token=${token}`);
        if (res.status === "verified") {
          setVerified(true);
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [token, verified]);

  async function startVerification() {
    if (!isPhoneLikelyValid(phone)) {
      toast.error("Неверный номер. Пример: +79990000000");
      return;
    }

    try {
      setLoading(true);
      const res = await api<{ token: string; telegramDeepLink: string; immediate?: boolean }>(
        "/api/auth/start-verification",
        {
          method: "POST",
          body: JSON.stringify({ phone }),
        },
      );

      setToken(res.token);
      setTelegramDeepLink(res.telegramDeepLink);
      setVerified(Boolean(res.immediate));
      toast.success(res.immediate ? "Код уже отправлен в Telegram" : "Открой Telegram и нажми Start у бота");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(withName: boolean) {
    if (!token) {
      toast.error("Сначала введи номер");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      toast.error("Код должен состоять из 6 цифр");
      return;
    }

    if (withName && name.trim().length < 2) {
      toast.error("Введите имя от 2 символов");
      return;
    }

    try {
      setLoading(true);
      const res = await api<{ needsName?: boolean; mode?: "login" | "register" }>(
        "/api/auth/complete-registration",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            code,
            name: withName ? name.trim() : undefined,
          }),
        },
      );

      if (res.needsName) {
        setNeedsName(true);
        toast.message("Это новый аккаунт. Добавь имя");
        return;
      }

      toast.success(res.mode === "login" ? "Вход выполнен" : "Регистрация завершена");
      router.push("/feed");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка";
      if (message.includes("Phone is not verified")) {
        toast.error("Код ещё не активен. Нажми Start в Telegram боте");
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setToken(null);
    setTelegramDeepLink(null);
    setVerified(false);
    setCode("");
    setName("");
    setNeedsName(false);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="overflow-hidden border-borderStrong bg-surface/90 backdrop-blur-2xl">
          <div className="h-24 bg-[radial-gradient(circle_at_15%_15%,rgb(var(--mint-rgb) / 0.35),transparent_45%),radial-gradient(circle_at_85%_15%,rgb(var(--blue-rgb) / 0.35),transparent_40%)]" />
          <CardContent className="space-y-4 p-5">
            <div>
              <h1 className="text-2xl font-semibold">Вход в Meetap</h1>
              <p className="text-sm text-muted">Как в Telegram: номер, код из бота, затем имя для нового аккаунта.</p>
              <Link href="/login" className="mt-1 block text-sm text-action underline">
                Войти по номеру и паролю
              </Link>
            </div>

            {step === "phone" ? (
              <div className="space-y-3">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79990000000" />
                <Button onClick={startVerification} disabled={loading} className="w-full">
                  Получить код в Telegram
                </Button>
              </div>
            ) : null}

            {step === "code" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  {verified
                    ? "Код отправлен. Введи его ниже."
                    : "Открой Telegram-бота и нажми Start. После этого придёт код."}
                </p>

                {telegramDeepLink ? (
                  <a
                    href={telegramDeepLink}
                    target="_blank"
                    className="inline-flex rounded-lg border border-border bg-surface2/56 px-3 py-2 text-sm text-action hover:bg-surface2/72"
                  >
                    Открыть Telegram-бота
                  </a>
                ) : null}

                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                <Button onClick={() => submitCode(false)} disabled={loading} className="w-full">
                  Продолжить
                </Button>
                <Button variant="secondary" onClick={reset} className="w-full">
                  Изменить номер
                </Button>
              </div>
            ) : null}

            {step === "name" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Новый профиль: укажи имя, чтобы завершить регистрацию.</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоё имя" />
                <Button onClick={() => submitCode(true)} disabled={loading || name.trim().length < 2} className="w-full">
                  Завершить регистрацию
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
