"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { startAuthentication } from "@simplewebauthn/browser";
import { api } from "@/lib/api-client";
import { PinPad } from "@/components/pin-pad";

export default function PinPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [tryingFaceId, setTryingFaceId] = useState(false);

  // Countdown timer when locked
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const diff = lockedUntil.getTime() - Date.now();
      if (diff <= 0) {
        setLockedUntil(null);
        setCountdown("");
        clearInterval(id);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    }, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Auto-try Face ID on mount
  useEffect(() => {
    const uid = localStorage.getItem("passkey_user_id");
    if (!uid) return;
    setTryingFaceId(true);
    (async () => {
      try {
        const opts = await api<object>("/api/auth/passkey/login-options", {
          method: "POST",
          body: JSON.stringify({ userId: uid }),
        });
        const auth = await startAuthentication({ optionsJSON: opts as any });
        await api("/api/auth/passkey/login-verify", {
          method: "POST",
          body: JSON.stringify({ userId: uid, response: auth }),
        });
        router.replace("/feed");
      } catch (e: any) {
        // NotAllowedError = user dismissed, fall through to PIN pad
        if (e?.name !== "NotAllowedError") {
          setErrorMsg("Face ID не сработал. Введи PIN.");
        }
      } finally {
        setTryingFaceId(false);
      }
    })();
  }, [router]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (pin.length === 6 && !loading && !lockedUntil) {
      submitPin(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function submitPin(value: string) {
    setLoading(true);
    try {
      await api("/api/auth/pin/verify", {
        method: "POST",
        body: JSON.stringify({ pin: value }),
      });
      router.replace("/feed");
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      // Check if locked (429)
      if (msg.toLowerCase().includes("заблок") || msg.toLowerCase().includes("попытк")) {
        // Try to parse lockedUntil from response — best effort
        setLockedUntil(new Date(Date.now() + 10 * 60 * 1000));
        setErrorMsg("Слишком много попыток. Подожди 10 минут.");
      } else {
        setError(true);
        setErrorMsg(msg || "Неверный PIN");
        setTimeout(() => { setError(false); setPin(""); }, 700);
      }
    } finally {
      setLoading(false);
      if (!error) setPin("");
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem("passkey_user_id");
    router.replace("/");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#03070f] px-4">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-[#7c3aed]/18 blur-[160px]" />
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] animate-[pulse_10s_ease-in-out_infinite_2s] rounded-full bg-[#3b82f6]/14 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Meetap" className="mx-auto mb-4 h-16 w-16 rounded-[22px] shadow-2xl shadow-[#7c3aed]/40" />
          <h1 className="font-display text-2xl font-black text-white">Добро пожаловать</h1>
          <p className="mt-1 text-sm text-muted">Введи PIN для входа</p>
        </div>

        <AnimatePresence mode="wait">
          {tryingFaceId ? (
            <motion.div key="faceid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-8">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-5xl">🔐</motion.div>
              <p className="text-sm text-muted">Пробуем Face ID...</p>
            </motion.div>
          ) : lockedUntil ? (
            <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-red-500/20 bg-red-500/8 p-6 text-center">
              <div className="mb-3 text-4xl">🔒</div>
              <p className="font-semibold text-white">Слишком много попыток</p>
              <p className="mt-1 text-sm text-muted">Повтори через</p>
              <p className="mt-2 font-mono text-3xl font-bold text-red-400">{countdown}</p>
              <button onClick={logout} className="mt-5 text-sm text-muted underline underline-offset-2 hover:text-white">
                Выйти и войти заново
              </button>
            </motion.div>
          ) : (
            <motion.div key="pinpad" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <PinPad
                value={pin}
                onChange={(v) => { if (!loading) setPin(v); }}
                error={error}
              />
              <AnimatePresence>
                {errorMsg && !lockedUntil && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center text-sm text-red-400">
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex justify-center gap-4">
          <button onClick={logout} className="text-xs text-muted/50 hover:text-muted">
            Выйти
          </button>
        </div>
      </motion.div>
    </main>
  );
}
