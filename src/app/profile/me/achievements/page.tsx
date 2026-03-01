"use client";

import { ProfileSettingsLayout } from "@/components/profile-settings-layout";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfileAchievementsPage() {
  return (
    <ProfileSettingsLayout title="Достижения" subtitle="Раздел в разработке">
      <Card>
        <CardContent className="p-4 text-sm text-muted">
          Центр достижений будет добавлен отдельным релизом: бейджи, сезонные награды и закрепленный статус в публичном профиле.
        </CardContent>
      </Card>
    </ProfileSettingsLayout>
  );
}
