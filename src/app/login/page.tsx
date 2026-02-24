"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    try {
      setLoading(true);
      await api("/api/auth/login-password", {
        method: "POST",
        body: JSON.stringify({ phone, password }),
      });
      router.push("/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <Card>
          <CardContent className="space-y-4 p-5">
            <h1 className="text-2xl font-semibold">Войти по номеру и паролю</h1>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79990000000" />
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" />
            <Button className="w-full" onClick={submit} disabled={loading || password.length < 8}>
              {loading ? "Входим..." : "Войти"}
            </Button>
            <Link href="/register" className="block text-center text-sm text-action underline">
              Нет пароля? Войти через Telegram
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
