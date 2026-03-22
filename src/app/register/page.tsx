"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { RUSSIAN_CITIES } from "@/lib/cities";
import { RUSSIAN_UNIVERSITIES } from "@/lib/universities";

// ── Icons ──────────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type AuthStep = "main" | "phone" | "code";
type OnboardStep = "name" | "gender" | "city" | "birth_year" | "status" | "photo" | "done";
type Step = AuthStep | OnboardStep;

type Gender = "male" | "female" | "other" | "";
type EducationType = "school" | "university" | "adult" | "";

const ONBOARD_STEPS: OnboardStep[] = ["name", "gender", "city", "birth_year", "status", "photo"];
const ONBOARD_LABELS: Record<OnboardStep, string> = {
  name: "Имя", gender: "Пол", city: "Город", birth_year: "Год рождения",
  status: "Статус", photo: "Фото", done: "Готово",
};

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 26 }, (_, i) => 2010 - i); // 2010 → 1985

function isPhoneValid(phone: string) {
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

// ── Progress bar ───────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 28 : 8,
            backgroundColor: i < current ? "#52CC83" : i === current ? "#818cf8" : "rgba(255,255,255,0.12)",
          }}
          transition={{ duration: 0.3 }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ── Confetti ───────────────────────────────────────────────────────────────────
const CONFETTI = ["#52CC83", "#818cf8", "#FF6B6B", "#FFD93D", "#C77DFF", "#3b82f6"];
function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i / 24) * 360;
        return (
          <motion.div
            key={i}
            className="absolute h-2 w-2 rounded-sm"
            style={{ backgroundColor: CONFETTI[i % CONFETTI.length] }}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * (80 + Math.random() * 80),
              y: Math.sin((angle * Math.PI) / 180) * (80 + Math.random() * 80),
              rotate: Math.random() * 360,
              scale: 0,
            }}
            transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.025 }}
          />
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const e = searchParams.get("error");
    if (e === "google_unavailable") toast.error("Google Auth недоступен.");
    if (e === "google_failed") toast.error("Не удалось войти через Google.");
    if (e === "google_cancelled") toast.error("Вход отменён.");
  }, [searchParams]);

  // Auth state
  const [step, setStep] = useState<Step>("main");
  const [phone, setPhone] = useState("+");
  const [code, setCode] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [botLink, setBotLink] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sentDirectly, setSentDirectly] = useState(false);

  // Onboarding state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [educationType, setEducationType] = useState<EducationType>("");
  const [schoolGrade, setSchoolGrade] = useState<number | null>(null);
  const [universityName, setUniversityName] = useState("");
  const [uniQuery, setUniQuery] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOnboarding = ONBOARD_STEPS.includes(step as OnboardStep) || step === "done";
  const onboardIdx = ONBOARD_STEPS.indexOf(step as OnboardStep);

  // ── City autocomplete ────────────────────────────────────────────────────────
  const citySuggestions =
    cityQuery.length >= 2
      ? RUSSIAN_CITIES.filter((c) => c.toLowerCase().includes(cityQuery.toLowerCase())).slice(0, 5)
      : [];

  // ── University autocomplete ──────────────────────────────────────────────────
  const uniSuggestions =
    uniQuery.length >= 2
      ? RUSSIAN_UNIVERSITIES.filter((u) => u.toLowerCase().includes(uniQuery.toLowerCase())).slice(0, 5)
      : [];

  // ── Validation ───────────────────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (step) {
      case "name": return name.trim().length >= 2 && /^[a-z0-9_]{3,30}$/.test(username);
      case "gender": return gender !== "";
      case "city": return city.length >= 2;
      case "birth_year": return birthYear !== null;
      case "status":
        if (!educationType) return false;
        if (educationType === "school") return schoolGrade !== null;
        if (educationType === "university") return universityName.trim().length >= 2;
        return true;
      case "photo": return true; // can skip
      default: return false;
    }
  }

  // ── API calls ─────────────────────────────────────────────────────────────────
  async function sendCode() {
    if (!isPhoneValid(phone)) { toast.error("Неверный номер. Пример: +79990000000"); return; }
    setLoading(true);
    try {
      const res = await api<{ ok: boolean; botLink: string; sentDirectly: boolean }>("/api/auth/telegram-code/send", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setBotLink(res.botLink);
      setSentDirectly(res.sentDirectly ?? false);
      setCodeSent(true);
      setStep("code");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally { setLoading(false); }
  }

  async function verifyCode() {
    if (!/^\d{5,6}$/.test(code)) { toast.error("Введи 5 или 6 цифр из Telegram"); return; }
    setLoading(true);
    try {
      const res = await api<{ isNewUser: boolean; phone: string }>(
        "/api/auth/telegram-code/verify",
        { method: "POST", body: JSON.stringify({ phone, code }) },
      );
      setVerifiedPhone(res.phone);
      if (res.isNewUser) {
        setStep("name");
      } else {
        await api("/api/auth/telegram-code/login", { method: "POST", body: JSON.stringify({ phone: res.phone }) });
        toast.success("Добро пожаловать!");
        router.push("/feed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setLoading(false); }
  }

  async function uploadPhoto(file: File) {
    setPhotoLoading(true);
    try {
      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ url: string }>("/api/user/avatar", { method: "POST", body: fd });
      setPhotoUrl(res.url);
    } catch {
      toast.error("Не удалось загрузить фото");
    } finally { setPhotoLoading(false); }
  }

  async function completeAccount() {
    setLoading(true);
    try {
      await api<{ ok: boolean; userId: string }>("/api/auth/telegram-code/complete", {
        method: "POST",
        body: JSON.stringify({
          phone: verifiedPhone,
          username,
          name: name.trim(),
          gender,
          city,
          birth_year: birthYear,
          education_type: educationType || null,
          school_grade: educationType === "school" ? schoolGrade : null,
          university: educationType === "university" ? universityName.trim() : null,
          photo_url: photoUrl || null,
        }),
      });
      setShowConfetti(true);
      setStep("done");
      setTimeout(() => router.push("/feed"), 2500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally { setLoading(false); }
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  function nextStep() {
    const idx = ONBOARD_STEPS.indexOf(step as OnboardStep);
    if (idx >= 0 && idx < ONBOARD_STEPS.length - 1) {
      setStep(ONBOARD_STEPS[idx + 1]);
    } else if (idx === ONBOARD_STEPS.length - 1) {
      completeAccount();
    }
  }

  function prevStep() {
    const idx = ONBOARD_STEPS.indexOf(step as OnboardStep);
    if (idx <= 0) { setStep("code"); return; }
    setStep(ONBOARD_STEPS[idx - 1]);
  }

<<<<<<< HEAD
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
=======
  // ── Shared styles ─────────────────────────────────────────────────────────────
  const inputCls = "w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-muted/50 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20";
  const btnPrimary = "w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#7c3aed]/30 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50";
  const btnSecondary = "w-full rounded-xl border border-white/8 bg-white/5 py-3 text-sm text-muted transition-all hover:bg-white/10 hover:text-white/80";
  const choiceBtn = (active: boolean) =>
    `flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all ${
      active ? "border-[#818cf8]/60 bg-[#818cf8]/15 text-white" : "border-white/8 bg-white/5 text-muted hover:bg-white/10 hover:text-white"
    }`;

  // ══════════════════════════════════════════════════════════════════════════════
  // ONBOARDING LAYOUT
  // ══════════════════════════════════════════════════════════════════════════════
  if (isOnboarding) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[700px] w-[700px] animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-[#6d28d9]/20 blur-[160px]" />
          <div className="absolute -right-40 top-1/4 h-[600px] w-[600px] animate-[pulse_9s_ease-in-out_infinite_1.5s] rounded-full bg-[#2563eb]/15 blur-[140px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* DONE */}
          {step === "done" && (
            <div className="relative flex flex-col items-center justify-center py-12 text-center">
              {showConfetti && <ConfettiBurst />}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] text-5xl shadow-2xl shadow-[#7c3aed]/40"
              >
                🎉
              </motion.div>
              <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="font-display text-3xl font-black text-white">
                Аккаунт создан!
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-2 text-sm text-muted">
                Добро пожаловать в Meetap
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#818cf8]/30 bg-[#818cf8]/15 px-4 py-2 text-sm font-semibold text-[#818cf8]"
              >
                ⚡ +10 XP · Уровень 1
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-6 text-xs text-muted/50">
                Переходим в ленту...
              </motion.p>
>>>>>>> origin/develop-tema
            </div>
          )}

          {/* ONBOARD STEPS */}
          {step !== "done" && (
            <>
              {/* Header */}
              <div className="mb-6 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="Meetap" className="h-10 w-10 rounded-[14px] shadow-lg shadow-[#6d28d9]/40" />
                <ProgressBar current={onboardIdx} total={ONBOARD_STEPS.length} />
                <p className="text-xs text-muted">
                  Шаг {onboardIdx + 1} из {ONBOARD_STEPS.length} · {ONBOARD_LABELS[step as OnboardStep]}
                </p>
<<<<<<< HEAD

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
=======
>>>>>>> origin/develop-tema
              </div>

              {/* Card */}
              <div className="relative rounded-3xl border border-[#7c3aed]/20 bg-[#0c0b1e]/80 p-6 shadow-soft backdrop-blur-2xl">
                <AnimatePresence mode="wait">

                  {/* ── NAME + USERNAME ── */}
                  {step === "name" && (
                    <motion.div key="name" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Познакомимся!</h2>
                        <p className="mt-1 text-sm text-muted">Как тебя зовут и как тебя найти?</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-muted">Имя</label>
                          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Твоё имя" autoFocus className={inputCls} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-muted">Логин</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">@</span>
                            <input
                              value={username}
                              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                              placeholder="username"
                              maxLength={30}
                              autoCapitalize="none"
                              className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 py-3 pl-8 pr-4 text-sm text-white outline-none placeholder:text-muted/50 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
                            />
                          </div>
                          {username.length >= 3 && /^[a-z0-9_]{3,30}$/.test(username) && (
                            <p className="mt-1 text-xs text-[#52CC83]">✓ Отлично выглядит</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-[#818cf8]/20 bg-[#818cf8]/8 px-4 py-3">
                        <span className="text-lg">⚡</span>
                        <p className="text-xs text-muted"><span className="font-semibold text-[#818cf8]">+10 XP</span> за регистрацию — твой стартовый бонус!</p>
                      </div>
                    </motion.div>
                  )}

                  {/* ── GENDER ── */}
                  {step === "gender" && (
                    <motion.div key="gender" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Твой пол</h2>
                        <p className="mt-1 text-sm text-muted">Поможет найти людей рядом</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {([{ val: "male", label: "Мужской", emoji: "👨" }, { val: "female", label: "Женский", emoji: "👩" }, { val: "other", label: "Другой", emoji: "✨" }] as const).map(({ val, label, emoji }) => (
                          <button key={val} onClick={() => setGender(val)} className={choiceBtn(gender === val)}>
                            <span className="text-xl">{emoji}</span>{label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── CITY ── */}
                  {step === "city" && (
                    <motion.div key="city" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Твой город</h2>
                        <p className="mt-1 text-sm text-muted">Покажем события и людей рядом</p>
                      </div>
                      <div className="relative">
                        <input
                          value={cityQuery || city}
                          onChange={(e) => { setCityQuery(e.target.value); setCity(""); }}
                          placeholder="Начни вводить..."
                          autoFocus
                          className={inputCls}
                        />
                        <AnimatePresence>
                          {citySuggestions.length > 0 && !city && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#7c3aed]/20 bg-[#0c0b1e] shadow-xl"
                            >
                              {citySuggestions.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => { setCity(c); setCityQuery(c); }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#7c3aed]/15"
                                >
                                  {c}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"].map((c) => (
                          <button
                            key={c}
                            onClick={() => { setCity(c); setCityQuery(c); }}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${city === c ? "border-[#818cf8]/60 bg-[#818cf8]/15 text-white" : "border-white/10 bg-white/5 text-muted hover:text-white"}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── BIRTH YEAR ── */}
                  {step === "birth_year" && (
                    <motion.div key="birth_year" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Год рождения</h2>
                        <p className="mt-1 text-sm text-muted">Поможет найти людей одного возраста</p>
                      </div>
                      {birthYear && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center">
                          <div className="rounded-2xl border border-[#818cf8]/30 bg-[#818cf8]/10 px-6 py-3 text-center">
                            <span className="font-display text-4xl font-extrabold text-[#818cf8]">{birthYear}</span>
                            <p className="text-xs text-muted">Тебе {CURRENT_YEAR - birthYear} лет</p>
                          </div>
                        </motion.div>
                      )}
                      <div className="grid grid-cols-5 gap-2">
                        {BIRTH_YEARS.map((y) => (
                          <button
                            key={y}
                            onClick={() => setBirthYear(y)}
                            className={`rounded-xl py-2.5 text-sm font-medium transition-all ${birthYear === y ? "scale-105 bg-[#818cf8] text-white shadow-md shadow-[#818cf8]/30" : "bg-white/8 text-muted hover:bg-white/14 hover:text-white"}`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* ── STATUS ── */}
                  {step === "status" && (
                    <motion.div key="status" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Где учишься?</h2>
                        <p className="mt-1 text-sm text-muted">Помогает найти людей из твоей среды</p>
                      </div>
                      <div className="space-y-2.5">
                        {([{ val: "school", label: "Школьник", emoji: "🎒" }, { val: "university", label: "Студент", emoji: "🎓" }, { val: "adult", label: "Уже работаю", emoji: "💼" }] as const).map(({ val, label, emoji }) => (
                          <button key={val} onClick={() => setEducationType(val)} className={choiceBtn(educationType === val)}>
                            <span className="text-xl">{emoji}</span>{label}
                          </button>
                        ))}
                      </div>
                      <AnimatePresence>
                        {educationType === "school" && (
                          <motion.div key="grade" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            <label className="mb-2 block text-xs font-medium text-muted">Класс</label>
                            <div className="grid grid-cols-4 gap-2">
                              {[8, 9, 10, 11].map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setSchoolGrade(g)}
                                  className={`rounded-xl py-2.5 text-sm font-semibold transition-all ${schoolGrade === g ? "bg-[#818cf8] text-white" : "bg-white/8 text-muted hover:bg-white/14 hover:text-white"}`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                        {educationType === "university" && (
                          <motion.div key="uni" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative">
                            <input
                              value={uniQuery || universityName}
                              onChange={(e) => { setUniQuery(e.target.value); setUniversityName(""); }}
                              placeholder="Название вуза..."
                              autoFocus
                              className={inputCls}
                            />
                            <AnimatePresence>
                              {uniSuggestions.length > 0 && !universityName && (
                                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#7c3aed]/20 bg-[#0c0b1e] shadow-xl">
                                  {uniSuggestions.map((u) => (
                                    <button key={u} onClick={() => { setUniversityName(u); setUniQuery(u); }} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-[#7c3aed]/15">
                                      {u}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ── PHOTO ── */}
                  {step === "photo" && (
                    <motion.div key="photo" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.28 }} className="space-y-4">
                      <div>
                        <h2 className="font-display text-2xl font-extrabold text-white">Фото профиля</h2>
                        <p className="mt-1 text-sm text-muted">Можно пропустить и добавить позже</p>
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="relative flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#7c3aed]/40 bg-white/5 transition-all hover:border-[#7c3aed]/70 hover:bg-white/8"
                        >
                          {photoPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photoPreview} alt="preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-3xl">📷</span>
                              <span className="text-xs text-muted">Загрузить</span>
                            </div>
                          )}
                          {photoLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white" />
                            </div>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
                        />
                        {photoPreview && (
                          <button onClick={() => { setPhotoPreview(""); setPhotoUrl(""); }} className="text-xs text-muted hover:text-white">
                            Удалить фото
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Navigation buttons */}
              <div className="mt-4 space-y-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={nextStep}
                  disabled={loading || photoLoading || !canProceed()}
                  className={btnPrimary}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                      Создаём аккаунт...
                    </span>
                  ) : step === "photo" ? "Завершить регистрацию →" : "Продолжить →"}
                </motion.button>

                {step === "photo" && (
                  <button onClick={nextStep} disabled={loading || photoLoading} className={btnSecondary}>
                    {photoLoading ? "Загружаем фото..." : "Пропустить, добавлю позже"}
                  </button>
                )}

                {onboardIdx > 0 && (
                  <button onClick={prevStep} disabled={loading} className={btnSecondary}>
                    ← Назад
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </main>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // AUTH LAYOUT (main / phone / code)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[700px] w-[700px] animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-[#6d28d9]/22 blur-[160px]" />
        <div className="absolute -right-40 top-1/4 h-[600px] w-[600px] animate-[pulse_9s_ease-in-out_infinite_1.5s] rounded-full bg-[#2563eb]/18 blur-[140px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-7 text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 180 }}>
            <div className="relative mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Meetap" className="h-full w-full rounded-[24px] shadow-2xl shadow-[#6d28d9]/50" />
            </div>
          </motion.div>
          <h1 className="font-display text-[32px] font-black tracking-tight text-white">Meetap</h1>
          <p className="mt-1 text-sm text-muted">Знакомства, которые случаются офлайн</p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="overflow-hidden rounded-3xl border border-[#7c3aed]/20 bg-[#0c0b1e]/80 p-6 shadow-soft backdrop-blur-2xl"
        >
          <AnimatePresence mode="wait">
            {/* main */}
            {step === "main" && (
              <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="mb-5">
                  <h2 className="font-display text-xl font-bold text-white">Регистрация</h2>
                  <p className="mt-0.5 text-sm text-muted">Выбери способ создания аккаунта</p>
                </div>
                <motion.a href="/api/auth/google/start" whileTap={{ scale: 0.97 }} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/95 py-3.5 text-sm font-semibold text-[#1a1a1a] shadow-lg shadow-black/30 transition-all hover:bg-white active:scale-[0.98]">
                  <GoogleIcon />Продолжить через Google
                </motion.a>
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/8 py-2 text-xs font-medium text-[#818cf8]">+10 XP за регистрацию · Уровень 1</div>
                <div className="flex items-center gap-3 py-0.5"><div className="h-px flex-1 bg-white/8" /><span className="text-xs text-muted/60">или</span><div className="h-px flex-1 bg-white/8" /></div>
                <button onClick={() => setStep("phone")} className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[#7c3aed]/25 bg-[#7c3aed]/8 py-3 text-sm font-medium text-[#818cf8] transition-all hover:bg-[#7c3aed]/15 hover:text-white">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.94 8.19-1.97 9.27c-.14.65-.53.81-1.07.5l-2.97-2.19-1.43 1.38c-.16.16-.29.29-.6.29l.21-3.02 5.51-4.98c.24-.21-.05-.33-.37-.12L7.5 14.08l-2.91-.91c-.63-.2-.64-.63.13-.93l11.34-4.37c.53-.19.99.13.88.32z" /></svg>
                  Зарегистрироваться через Telegram
                </button>
                <p className="pt-0.5 text-center text-xs text-muted">Уже есть аккаунт?{" "}<Link href="/login" className="font-semibold text-[#818cf8] underline underline-offset-2 hover:text-white">Войти</Link></p>
              </motion.div>
            )}

            {/* phone */}
            {step === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-3">
                <button onClick={() => setStep("main")} className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-white">← Назад</button>
                <h2 className="font-display text-xl font-bold text-white">Введи номер</h2>
                <p className="text-sm text-muted">Telegram пришлёт код в раздел <span className="font-medium text-[#818cf8]">Verification Codes</span></p>
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
                <button onClick={sendCode} disabled={loading} className={btnPrimary}>{loading ? "Отправляем..." : codeSent ? "Отправить снова" : "Получить код"}</button>
                {codeSent && (
                  <button onClick={() => { setStep("code"); }} disabled={loading} className={btnSecondary}>
                    У меня уже есть код →
                  </button>
                )}
              </motion.div>
            )}

            {/* code */}
            {step === "code" && (
              <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-3">
                <button onClick={() => setStep("phone")} className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-white">← Назад</button>
                <h2 className="font-display text-xl font-bold text-white">Введи код из Telegram</h2>
                {sentDirectly ? (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    Код отправлен в Telegram — проверь сообщения от бота.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-[#818cf8]/20 bg-[#818cf8]/8 p-3 text-sm text-muted">
                      Нажми кнопку ниже и отправь боту <span className="font-semibold text-[#818cf8]">Start</span> — он пришлёт 6-значный код.
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
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} autoFocus onKeyDown={(e) => e.key === "Enter" && verifyCode()} className="w-full rounded-xl border border-[#7c3aed]/25 bg-white/5 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.6em] text-white outline-none placeholder:tracking-normal placeholder:text-muted/40 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20" />
                <button onClick={verifyCode} disabled={loading || code.length < 6} className={btnPrimary}>{loading ? "Проверяем..." : "Продолжить"}</button>
                <button onClick={sendCode} disabled={loading} className={btnSecondary}>Запросить код повторно</button>
                <button onClick={() => { setStep("phone"); setCode(""); setBotLink(""); setSentDirectly(false); }} className={btnSecondary}>Изменить номер</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 text-center text-xs text-muted/50">
          Регистрируясь, ты принимаешь условия использования Meetap
        </motion.p>
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
