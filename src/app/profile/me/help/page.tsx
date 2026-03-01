"use client";

import Link from "next/link";
import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfileHelpPage() {
  return (
    <ProfileSettingsLayout title="Помощь / О приложении" subtitle="Как пользоваться профилем и настройками">
      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">Как пользоваться профилем</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>1. Заполни фото, био, 2-3 факта и интересы.</p>
          <p>2. Укажи работу/ВУЗ — это повышает точность матчей.</p>
          <p>3. Настрой приватность: что видят другие и кто может писать.</p>
          <p>4. Проверь публичный preview и скорректируй видимость.</p>
          <p>5. Пройди психотест — это улучшит рекомендации и подсказки первого шага.</p>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardHeader><CardTitle className="text-sm">О приложении</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-muted">
          <p>Meetap — платформа для офлайн-знакомств и нетворкинга.</p>
          <p>Поддержка: support@meetap.app</p>
          <p>Версия: MVP beta</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/profile/me/psych-test" className="block"><Button variant="secondary" className="w-full">Психотест</Button></Link>
        <Link href="/feed" className="block"><Button variant="secondary" className="w-full">В ленту</Button></Link>
      </div>
    </ProfileSettingsLayout>
  );
}
