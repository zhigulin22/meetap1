"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Paperclip, RefreshCw, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

type CaptureStep = "front" | "back";
type Phase = "capture_front" | "capture_back" | "edit";

type FilterPreset = {
  id: string;
  label: string;
  css: string;
};

const FILTERS: FilterPreset[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "soft", label: "Soft", css: "contrast(1.04) saturate(1.08) brightness(1.04)" },
  { id: "film", label: "Film", css: "contrast(1.12) saturate(0.92) sepia(0.12)" },
  { id: "cool", label: "Cool", css: "contrast(1.08) saturate(1.02) hue-rotate(8deg)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.08)" },
];

function fileFromBlob(blob: Blob, name: string) {
  return new File([blob], name, { type: "image/jpeg" });
}

async function applyFilterToFile(file: File, cssFilter: string, namePrefix: string) {
  if (cssFilter === "none") return file;

  const src = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = src;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image decode failed"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 720;
    canvas.height = img.naturalHeight || 1280;
    const ctx = canvas.getContext("2d");

    if (!ctx) return file;

    ctx.filter = cssFilter;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );

    if (!blob) return file;
    return fileFromBlob(blob, `${namePrefix}-${Date.now()}.jpg`);
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function DailyDuoDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captureStep, setCaptureStep] = useState<CaptureStep>("front");
  const [phase, setPhase] = useState<Phase>("capture_front");
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("none");
  const [loading, setLoading] = useState(false);

  const frontPreview = useMemo(() => (front ? URL.createObjectURL(front) : null), [front]);
  const backPreview = useMemo(() => (back ? URL.createObjectURL(back) : null), [back]);
  const activeFilter = FILTERS.find((f) => f.id === selectedFilter) ?? FILTERS[0];

  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [frontPreview, backPreview]);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    setPhase("capture_front");
    setCaptureStep("front");
    setFacing("user");
    setFront(null);
    setBack(null);
    setCaption("");
    setSelectedFilter("none");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (phase === "edit") {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Камера недоступна");
        return;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
      } catch {
        toast.error("Нет доступа к камере. Используй скрепку для галереи.");
      }
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [open, phase, facing]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );

    if (!blob) return;

    if (captureStep === "front") {
      setFront(fileFromBlob(blob, `front-${Date.now()}.jpg`));
      setCaptureStep("back");
      setPhase("capture_back");
      setFacing("environment");
      return;
    }

    setBack(fileFromBlob(blob, `back-${Date.now()}.jpg`));
    setPhase("edit");
  }

  function onGalleryPick(file?: File) {
    if (!file) return;
    if (captureStep === "front") {
      setFront(file);
      setCaptureStep("back");
      setPhase("capture_back");
      setFacing("environment");
      return;
    }

    setBack(file);
    setPhase("edit");
  }

  function resetTo(step: CaptureStep) {
    if (step === "front") {
      setFront(null);
      setBack(null);
      setCaptureStep("front");
      setPhase("capture_front");
      setFacing("user");
      return;
    }

    setBack(null);
    setCaptureStep("back");
    setPhase("capture_back");
    setFacing("environment");
  }

  async function publish() {
    if (!front || !back) {
      toast.error("Нужны 2 фото");
      return;
    }

    setLoading(true);
    try {
      const frontOut = await applyFilterToFile(front, activeFilter.css, "front");
      const backOut = await applyFilterToFile(back, activeFilter.css, "back");

      const fd = new FormData();
      fd.append("front", frontOut);
      fd.append("back", backOut);
      fd.append("caption", caption);

      await api<{ success: boolean }>("/api/feed/posts/create-daily-duo", {
        method: "POST",
        body: fd,
      });

      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка публикации");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#03070f] text-white">
      {phase !== "edit" ? (
        <>
          <div className="relative h-full w-full overflow-hidden">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="absolute left-0 right-0 top-5 flex items-center justify-between px-4">
              <button onClick={() => onOpenChange(false)} className="rounded-full bg-black/45 px-3 py-1 text-sm">Закрыть</button>
              <div className="rounded-full bg-black/45 px-3 py-1 text-xs">
                {phase === "capture_front" ? "Сделай первый кадр" : "Сделай второй кадр"}
              </div>
              <button
                onClick={() => setFacing((x) => (x === "user" ? "environment" : "user"))}
                className="grid h-10 w-10 place-items-center rounded-full bg-black/45"
                aria-label="Сменить камеру"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute bottom-5 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              <div className="mx-auto flex max-w-sm items-center justify-between rounded-3xl border border-white/20 bg-black/40 px-4 py-3 backdrop-blur-xl">
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-white/10"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <button
                  onClick={capturePhoto}
                  className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/75 bg-[#52CC83] text-[#051810] shadow-[0_16px_40px_rgba(82,204,131,0.45)]"
                >
                  <Camera className="h-8 w-8" />
                </button>

                <button
                  onClick={() => resetTo("front")}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/35 bg-white/10"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onGalleryPick(e.target.files?.[0] ?? undefined)}
          />
        </>
      ) : (
        <div className="mx-auto h-full w-full max-w-md overflow-y-auto px-4 pb-28 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => resetTo("front")} className="rounded-full border border-white/20 px-3 py-1 text-sm">
              Переснять
            </button>
            <p className="text-sm text-white/90">DUO Editor</p>
            <button onClick={() => onOpenChange(false)} className="rounded-full border border-white/20 px-3 py-1 text-sm">
              Закрыть
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/30">
                {frontPreview ? (
                  <Image src={frontPreview} alt="front" width={600} height={900} className="h-60 w-full object-cover" style={{ filter: activeFilter.css }} unoptimized />
                ) : null}
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-black/30">
                {backPreview ? (
                  <Image src={backPreview} alt="back" width={600} height={900} className="h-60 w-full object-cover" style={{ filter: activeFilter.css }} unoptimized />
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm text-white/90">
                <WandSparkles className="h-4 w-4" /> Фильтры
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      f.id === selectedFilter
                        ? "border-[#52CC83]/75 bg-[#52CC83]/20 text-[#bdf5d0]"
                        : "border-white/20 bg-white/5 text-white/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              placeholder="Расскажи коротко, что за момент, можешь отметить человека через @"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-white/55"
            />
          </div>

          <div className="fixed inset-x-0 bottom-0 z-[65] mx-auto w-full max-w-md border-t border-white/15 bg-[#040812]/95 p-3 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => resetTo("back")} className="border-white/25 bg-white/10 text-white">
                Переснять 2-й кадр
              </Button>
              <Button onClick={publish} disabled={loading || !front || !back}>
                {loading ? "Публикуем..." : "Опубликовать"}
                {!loading ? <Check className="ml-1 h-4 w-4" /> : null}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
