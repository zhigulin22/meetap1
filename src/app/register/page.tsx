"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

type Step = "phone" | "wait_verification" | "code" | "name";

function isPhoneLikelyValid(phone: string) {
  const cleaned = phone.replace(/[\s()-]/g, "");
  return /^\+?[1-9]\d{9,14}$/.test(cleaned);
}

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [existingUser, setExistingUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const step: Step = useMemo(() => {
    if (!token) return "phone";
    if (!verified) return "wait_verification";
    if (existingUser) return "code";
    return name.trim().length > 0 ? "name" : "code";
  }, [token, verified, existingUser, name]);

  useEffect(() => {
    if (!token || verified) return;

    const t = setInterval(async () => {
      try {
        const res = await api<{ status: string; existingUser?: boolean }>(`/api/auth/check-verification?token=${token}`);
        if (res.status === "verified") {
          setVerified(true);
          setExistingUser(Boolean(res.existingUser));
          toast.success(
            res.existingUser
              ? "Телефон подтвержден. Введи код из Telegram для входа"
              : "Телефон подтвержден. Введи код из Telegram",
          );
        }
      } catch {
        // ignore polling errors
      }
    }, 2500);

    return () => clearInterval(t);
  }, [token, verified]);

  async function startVerification() {
    if (!isPhoneLikelyValid(phone)) {
      toast.error("Неверный формат номера. Пример: +79990000000");
      return;
    }

    try {
      setLoading(true);
      const res = await api<{ token: string; telegramDeepLink: string }>(
        "/api/auth/start-verification",
        {
          method: "POST",
          body: JSON.stringify({ phone }),
        },
      );
      setToken(res.token);
      setDeepLink(res.telegramDeepLink);
      toast.success("Открой Telegram и подтверди номер");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(withName = false) {
    if (!token || !verified) {
      toast.error("Сначала подтверди телефон в Telegram");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      toast.error("Введи 6-значный код из Telegram");
      return;
    }

    if (withName && name.trim().length < 2) {
      toast.error("Введите корректное имя");
      return;
    }

    try {
      setLoading(true);
      const res = await api<{ userId?: string; needsName?: boolean; mode?: string }>(
        "/api/auth/complete-registration",
        {
          method: "POST",
          body: JSON.stringify({ token, code, name: withName ? name.trim() : undefined }),
        },
      );

      if (res.needsName) {
        toast.message("Похоже это новый аккаунт. Укажи имя для завершения регистрации");
        return;
      }

      toast.success(res.mode === "login" ? "Вход выполнен" : "Регистрация завершена");
      router.push("/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  function resetPhoneStep() {
    setToken(null);
    setDeepLink(null);
    setVerified(false);
    setExistingUser(false);
    setCode("");
    setName("");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md p-4">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="space-y-4 p-5">
            <h1 className="text-2xl font-semibold">Вход / Регистрация</h1>
            <p className="text-sm text-muted">
              Номер → Telegram → Код из Telegram → Имя (только для новых).
            </p>

            {step === "phone" ? (
              <div className="space-y-3">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+79990000000"
                />
                <Button disabled={loading} onClick={startVerification} className="w-full">
                  Подтвердить в Telegram
                </Button>
              </div>
            ) : null}

            {step === "wait_verification" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Номер сохранен: <span className="text-text">{phone}</span>
                </p>
                {deepLink ? (
                  <a href={deepLink} target="_blank" className="block text-sm text-action underline">
                    Открыть Telegram-бота
                  </a>
                ) : null}
                <p className="text-xs text-muted">Ожидаем подтверждение в Telegram...</p>
                <Button variant="secondary" onClick={resetPhoneStep} className="w-full">
                  Изменить номер
                </Button>
              </div>
            ) : null}

            {step === "code" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  В Telegram пришёл 6-значный код. Введи его для {existingUser ? "входа" : "продолжения"}.
                </p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                <Button disabled={loading} onClick={() => submitCode(false)} className="w-full">
                  Подтвердить код
                </Button>
              </div>
            ) : null}

            {step === "name" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Новый аккаунт. Введи имя для завершения регистрации.</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Твое имя" />
                <Button disabled={loading || name.trim().length < 2} onClick={() => submitCode(true)} className="w-full">
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
