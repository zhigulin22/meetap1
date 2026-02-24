import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardContent className="space-y-5 p-6">
          <p className="text-xs uppercase tracking-widest text-action">Meetap</p>
          <h1 className="text-3xl font-bold leading-tight">Соцсеть для офлайн-знакомств через контент и события</h1>
          <p className="text-sm text-muted">Reels + Daily Duo, реальные мероприятия, умные подсказки для первого сообщения.</p>
          <Link href="/register"><Button className="w-full">Начать регистрацию</Button></Link>
          <Link href="/login"><Button variant="secondary" className="w-full">Войти</Button></Link>
        </CardContent>
      </Card>
    </main>
  );
}
