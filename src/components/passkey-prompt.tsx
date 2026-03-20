"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { startRegistration } from "@simplewebauthn/browser";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface PasskeyPromptProps {
  userId: string;
  onDone: () => void;
}

export function PasskeyPrompt({ userId, onDone }: PasskeyPromptProps) {
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);

  async function enroll() {
    setLoading(true);
    try {
      const options = await api<object>("/api/auth/passkey/register-options");
      const reg = await startRegistration({ optionsJSON: options as any });
      await api("/api/auth/passkey/register-verify", {
        method: "POST",
        body: JSON.stringify(reg),
      });
      localStorage.setItem("passkey_user_id", userId);
      toast.success("Face ID включён! 🔐 Теперь можно входить одним касанием.");
      setVisible(false);
      setTimeout(onDone, 350);
    } catch (e) {
      if (e instanceof Error && e.name === "NotAllowedError") {
        // User dismissed — treat as skip
        skip();
        return;
      }
      toast.error(e instanceof Error ? e.message : "Не удалось включить Face ID");
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    setVisible(false);
    setTimeout(onDone, 350);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-6 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0d1a12] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#52CC83]/15 text-2xl">
                🔐
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">Включи быстрый вход</h3>
                <p className="text-xs text-white/55">Вместо Telegram каждый раз</p>
              </div>
            </div>

            <p className="mb-5 text-sm text-white/70">
              Face ID или отпечаток пальца — войдёшь в один тап, даже если сессия истекла.
            </p>

            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={enroll}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#52CC83] py-4 text-sm font-semibold text-[#051810] shadow-lg shadow-[#52CC83]/30 disabled:opacity-60"
              >
                {loading ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="inline-block h-4 w-4 rounded-full border-2 border-[#051810]/30 border-t-[#051810]"
                  />
                ) : (
                  "🔐"
                )}
                Включить Face ID
              </motion.button>

              <button
                onClick={skip}
                disabled={loading}
                className="w-full rounded-2xl py-3 text-sm text-white/45 transition-colors hover:text-white/70 disabled:opacity-40"
              >
                Пропустить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
