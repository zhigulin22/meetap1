"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PinPadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  error?: boolean;
  label?: string;
  sublabel?: string;
}

export function PinPad({ value, onChange, maxLength = 6, error = false, label, sublabel }: PinPadProps) {
  function press(digit: string) {
    if (value.length < maxLength) onChange(value + digit);
  }

  function del() {
    onChange(value.slice(0, -1));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Label */}
      {label && (
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{label}</p>
          {sublabel && <p className="mt-1 text-sm text-muted">{sublabel}</p>}
        </div>
      )}

      {/* Dots */}
      <motion.div
        animate={error ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              backgroundColor: i < value.length ? "#818cf8" : "rgba(255,255,255,0.15)",
              scale: i === value.length - 1 && value.length > 0 ? [1, 1.3, 1] : 1,
            }}
            transition={{ duration: 0.15 }}
            className="h-3.5 w-3.5 rounded-full"
          />
        ))}
      </motion.div>

      {/* Keypad */}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {keys.map((k, i) => {
          if (k === "") return <div key={i} />;
          const isDelete = k === "⌫";
          return (
            <motion.button
              key={k}
              whileTap={{ scale: 0.88 }}
              onClick={isDelete ? del : () => press(k)}
              disabled={isDelete ? value.length === 0 : value.length >= maxLength}
              className={`flex h-[60px] items-center justify-center rounded-2xl text-xl font-semibold transition-colors disabled:opacity-30 ${
                isDelete
                  ? "bg-white/5 text-muted hover:bg-white/10"
                  : "bg-white/8 text-white hover:bg-white/14 active:bg-[#818cf8]/30"
              }`}
            >
              {k}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
