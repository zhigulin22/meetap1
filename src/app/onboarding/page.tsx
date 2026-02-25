"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

/* ─── XP confetti burst (pure CSS-driven, no deps) ─────────────────────────── */
const CONFETTI_COLORS = ["#52CC83", "#4e75ff", "#FF6B6B", "#FFD93D", "#C77DFF"];

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * 360;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return (
          <motion.div
            key={i}
            className="absolute h-2 w-2 rounded-sm"
            style={{ backgroundColor: color }}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * (60 + Math.random() * 60),
              y: Math.sin((angle * Math.PI) / 180) * (60 + Math.random() * 60),
              rotate: Math.random() * 360,
              scale: 0,
            }}
            transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.02 }}
          />
        );
      })}
    </div>
  );
}

/* ─── Avatar preview ────────────────────────────────────────────────────────── */
function AvatarPreview({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-action/40 shadow-lg shadow-action/20">
      {src && (
        <img
          src={src}
          alt={name}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          referrerPolicy="no-referrer"
        />
      )}
      {(!src || !loaded) && (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#52CC83]/30 to-[#4e75ff]/30 text-xl font-bold text-text">
          {initials || "?"}
        </div>
      )}
    </div>
  );
}

/* ─── Progress dots ─────────────────────────────────────────────────────────── */
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 24 : 8,
            backgroundColor: i <= current ? "#52CC83" : "rgba(255,255,255,0.2)",
          }}
          transition={{ duration: 0.3 }}
          className="h-2 rounded-full"
        />
      ))}
    </div>
  );
}

/* ─── Age wheel ─────────────────────────────────────────────────────────────── */
const AGE_RANGES = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 45, 50, 55, 60, 65, 70];

function AgeSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {AGE_RANGES.map((age) => (
        <button
          key={age}
          onClick={() => onChange(age)}
          className={`rounded-xl py-2.5 text-sm font-medium transition-all duration-150 ${
            value === age
              ? "bg-action text-white shadow-md shadow-action/30 scale-105"
              : "bg-white/8 text-muted hover:bg-white/14 hover:text-text"
          }`}
        >
          {age}
        </button>
      ))}
    </div>
  );
}

/* ─── Username input with validation ─────────────────────────────────────────── */
function UsernameInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="username"
          maxLength={30}
          autoCapitalize="none"
          autoCorrect="off"
          className={`w-full rounded-xl border bg-white/5 py-3.5 pl-8 pr-4 text-sm outline-none transition-all placeholder:text-muted/50 focus:ring-2 focus:ring-action/20 ${
            error ? "border-red-400/60 focus:border-red-400" : "border-border focus:border-action"
          }`}
        />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400"
        >
          {error}
        </motion.p>
      )}
      {value && !error && value.length >= 3 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-action"
        >
          ✓ Отлично выглядит
        </motion.p>
      )}
    </div>
  );
}

/* ─── XP Badge ──────────────────────────────────────────────────────────────── */
function XPBadge({ xp }: { xp: number }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
      className="inline-flex items-center gap-1.5 rounded-full border border-action/30 bg-action/15 px-3 py-1 text-sm font-semibold text-action"
    >
      <span>⚡</span>
      +{xp} XP
    </motion.div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────────── */
function OnboardingContent() {
  const router = useRouter();
  const params = useSearchParams();

  const googleName = params.get("name") ?? "";
  const email = params.get("email") ?? "";
  const avatarUrl = params.get("avatar") ?? "";
  const supabaseUid = params.get("supabase_uid") ?? "";

  const [step, setStep] = useState(0);
  const [name, setName] = useState(googleName);
  const [age, setAge] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const totalSteps = 3;

  useEffect(() => {
    if (!email || !supabaseUid) {
      router.replace("/register");
    }
  }, [email, supabaseUid, router]);

  function validateUsername(v: string) {
    if (v.length > 0 && v.length < 3) return "Минимум 3 символа";
    if (v.length > 30) return "Максимум 30 символов";
    if (v && !/^[a-z0-9_]+$/.test(v)) return "Только буквы a-z, цифры и _";
    return "";
  }

  function handleUsernameChange(v: string) {
    setUsername(v);
    setUsernameError(validateUsername(v));
  }

  function canProceed() {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return age !== null;
    if (step === 2) return !usernameError;
    return false;
  }

  async function finish(skipUsername = false) {
    if (!email || !supabaseUid) return;
    try {
      setLoading(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);

      await api("/api/auth/google/onboarding", {
        method: "POST",
        body: JSON.stringify({
          supabase_uid: supabaseUid,
          email,
          name: name.trim(),
          age: age ?? undefined,
          username: skipUsername || !username ? null : username,
          avatar_url: avatarUrl || null,
        }),
      });

      toast.success("Добро пожаловать в Meetap! 🎉");
      router.push("/feed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      if (msg.includes("username уже занят")) {
        setUsernameError("Этот username уже занят");
      } else {
        toast.error(msg);
      }
      setShowConfetti(false);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step < totalSteps - 1) setStep((s) => s + 1);
    else finish();
  }

  const STEP_LABELS = ["Имя", "Возраст", "Username"];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#52CC83]/15 blur-[120px]" />
        <div className="absolute -right-40 top-1/2 h-[400px] w-[400px] rounded-full bg-[#4e75ff]/15 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Top: avatar + progress */}
        <div className="mb-6 flex flex-col items-center gap-4">
          <div className="relative">
            <AvatarPreview src={avatarUrl} name={name || googleName} />
            {showConfetti && <ConfettiBurst />}
          </div>
          <ProgressDots total={totalSteps} current={step} />
          <p className="text-xs text-muted">
            Шаг {step + 1} из {totalSteps} · {STEP_LABELS[step]}
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-3xl border border-white/12 bg-surface/80 p-6 shadow-soft backdrop-blur-2xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display text-2xl font-extrabold">Привет! 👋</h2>
                  <p className="mt-1 text-sm text-muted">Как тебя зовут? Можешь изменить имя из Google.</p>
                </div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Твоё имя"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-white/5 px-4 py-3.5 text-base outline-none placeholder:text-muted/50 focus:border-action focus:ring-2 focus:ring-action/20"
                />
                <div className="flex items-center gap-2 rounded-2xl border border-action/20 bg-action/8 px-4 py-3">
                  <span className="text-lg">⚡</span>
                  <div>
                    <p className="text-xs font-semibold text-action">+10 XP за регистрацию</p>
                    <p className="text-xs text-muted">Твой стартовый бонус уже ждёт!</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-age"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display text-2xl font-extrabold">Сколько тебе лет?</h2>
                  <p className="mt-1 text-sm text-muted">Это поможет нам подобрать людей рядом с тобой.</p>
                </div>
                {age && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center justify-center"
                  >
                    <div className="rounded-2xl border border-action/30 bg-action/10 px-6 py-3 text-center">
                      <span className="font-display text-4xl font-extrabold text-action">{age}</span>
                      <p className="text-xs text-muted">лет</p>
                    </div>
                  </motion.div>
                )}
                <AgeSelector value={age} onChange={setAge} />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-username"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display text-2xl font-extrabold">Придумай username</h2>
                  <p className="mt-1 text-sm text-muted">По нему тебя смогут найти другие пользователи.</p>
                </div>
                <UsernameInput
                  value={username}
                  onChange={handleUsernameChange}
                  error={usernameError}
                />
                <div className="flex items-center gap-2 rounded-2xl border border-[#4e75ff]/20 bg-[#4e75ff]/8 px-4 py-3">
                  <span className="text-lg">✨</span>
                  <p className="text-xs text-muted">
                    Можешь пропустить и добавить username позже в профиле
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Buttons */}
        <div className="mt-4 space-y-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={next}
            disabled={loading || !canProceed()}
            className="w-full rounded-2xl bg-action py-4 text-sm font-semibold text-white shadow-xl shadow-action/30 transition-all hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                />
                Создаём аккаунт...
              </span>
            ) : step === totalSteps - 1 ? (
              "🚀 Начать!"
            ) : (
              "Продолжить →"
            )}
          </motion.button>

          {/* Skip for username step */}
          {step === totalSteps - 1 && (
            <button
              onClick={() => finish(true)}
              disabled={loading}
              className="w-full rounded-2xl py-3 text-sm text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              Пропустить, добавлю потом
            </button>
          )}

          {/* Back */}
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
              className="w-full rounded-2xl py-3 text-xs text-muted transition-colors hover:text-text"
            >
              ← Назад
            </button>
          )}
        </div>

        {/* XP preview on last step */}
        {step === totalSteps - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex justify-center"
          >
            <XPBadge xp={10} />
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
