"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function SplashPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasSession) {
          router.replace("/pin");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#03070f]">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="h-12 w-12 rounded-3xl bg-[#818cf8]/20"
        />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#03070f] px-4">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-[#7c3aed] blur-[160px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-32 -right-48 h-[500px] w-[500px] rounded-full bg-[#3b82f6] blur-[140px]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.6, type: "spring", stiffness: 160 }}
          className="flex flex-col items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt="Meetap"
            className="h-24 w-24 rounded-[32px] shadow-2xl shadow-[#7c3aed]/50"
          />
          <h1 className="font-display text-5xl font-black tracking-tight text-white">Meetap</h1>
          <p className="text-base text-white/50">Знакомься вживую 🔥</p>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.5, type: "spring", stiffness: 180 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => router.push("/register")}
          className="relative rounded-3xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-12 py-5 text-xl font-extrabold text-white shadow-2xl shadow-[#7c3aed]/40 transition-all hover:shadow-[#7c3aed]/60"
        >
          <span className="mr-2">👋</span>
          Привет
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-[#818cf8]/40"
          />
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-white/25"
        >
          Уже есть аккаунт?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-white/40 underline underline-offset-2 hover:text-white/60"
          >
            Войти
          </button>
        </motion.p>
      </motion.div>
    </main>
  );
}
