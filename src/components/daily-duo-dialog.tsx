"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Paperclip, RefreshCw, RotateCcw } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";

type CaptureStep = "front" | "back";

function fileFromBlob(blob: Blob, name: string) {
  return new File([blob], name, { type: "image/jpeg" });
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [captureStep, setCaptureStep] = useState<CaptureStep>("front");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const frontPreview = useMemo(() => (front ? URL.createObjectURL(front) : null), [front]);
  const backPreview = useMemo(() => (back ? URL.createObjectURL(back) : null), [back]);

  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [frontPreview, backPreview]);

  async function startCamera(nextFacing: "user" | "environment") {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraReady(false);
      return;
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => null);
      }
      setCameraReady(true);
    } catch {
      setCameraReady(false);
      toast.error("Нет доступа к камере. Используй скрепку для загрузки из галереи.");
    }
  }

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    startCamera(facing);

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  async function capture() {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      toast.error("Камера не готова");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Ошибка камеры");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );

    if (!blob) {
      toast.error("Не удалось сделать фото");
      return;
    }

    if (captureStep === "front") {
      setFront(fileFromBlob(blob, `front-${Date.now()}.jpg`));
      setCaptureStep("back");
      setFacing("environment");
      await startCamera("environment");
    } else {
      setBack(fileFromBlob(blob, `back-${Date.now()}.jpg`));
    }
  }

  async function submit() {
    if (!front || !back) {
      toast.error("Нужно 2 фото: front и back");
      return;
    }

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("front", front);
      fd.append("back", back);
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

  function pickFromGallery() {
    fileInputRef.current?.click();
  }

  function onGallerySelected(file?: File) {
    if (!file) return;
    if (captureStep === "front") {
      setFront(file);
      setCaptureStep("back");
      setFacing("environment");
      startCamera("environment");
    } else {
      setBack(file);
    }
  }

  function retake(which: CaptureStep) {
    if (which === "front") {
      setFront(null);
      setCaptureStep("front");
      setFacing("user");
      startCamera("user");
      return;
    }
    setBack(null);
    setCaptureStep("back");
    setFacing("environment");
    startCamera("environment");
  }

  async function switchCamera() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    await startCamera(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>DUO Camera</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/40">
          <video ref={videoRef} playsInline muted className="h-[46vh] w-full object-cover" />
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            Шаг: {captureStep === "front" ? "1/2 Front" : "2/2 Back"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-black/15 p-2">
            <p className="mb-1 text-xs text-muted">Front</p>
            {frontPreview ? (
              <Image src={frontPreview} alt="front" width={300} height={400} className="h-24 w-full rounded-lg object-cover" unoptimized />
            ) : (
              <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">Нет фото</div>
            )}
            {front ? (
              <button className="mt-1 text-xs text-action" onClick={() => retake("front")}>Переснять</button>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-black/15 p-2">
            <p className="mb-1 text-xs text-muted">Back</p>
            {backPreview ? (
              <Image src={backPreview} alt="back" width={300} height={400} className="h-24 w-full rounded-lg object-cover" unoptimized />
            ) : (
              <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted">Нет фото</div>
            )}
            {back ? (
              <button className="mt-1 text-xs text-action" onClick={() => retake("back")}>Переснять</button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
          <button
            onClick={pickFromGallery}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10"
            aria-label="Загрузить из галереи"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <button
            onClick={capture}
            className="grid h-16 w-16 place-items-center rounded-full border-4 border-white/70 bg-[#52cc83] text-[#062114] shadow-[0_14px_36px_rgba(82,204,131,0.45)]"
            aria-label="Сделать фото"
          >
            <Camera className="h-7 w-7" />
          </button>

          <button
            onClick={switchCamera}
            className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10"
            aria-label="Сменить камеру"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onGallerySelected(e.target.files?.[0] ?? undefined)}
        />

        <Textarea placeholder="Короткая подпись" value={caption} onChange={(e) => setCaption(e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => { setFront(null); setBack(null); setCaptureStep("front"); setFacing("user"); startCamera("user"); }}>
            <RotateCcw className="mr-1 h-4 w-4" />
            Сбросить
          </Button>
          <Button onClick={submit} disabled={loading || !front || !back}>
            {loading ? "Публикуем..." : "Опубликовать DUO"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
