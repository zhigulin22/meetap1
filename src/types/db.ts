export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string;
          name: string;
          telegram_verified: boolean;
          telegram_user_id: string | null;
          last_post_at: string | null;
          xp: number;
          level: number;
          university: string | null;
          work: string | null;
          hobbies: string[] | null;
          interests: string[] | null;
          facts: string[] | null;
          avatar_url: string | null;
          bio: string | null;
          country: string | null;
          preferences: Json;
          privacy_settings: Json;
          notification_settings: Json;
          profile_completed: boolean;
          role: string;
          is_blocked: boolean;
          blocked_reason: string | null;
          blocked_until: string | null;
          shadow_banned: boolean;
          deleted_at: string | null;
          password_hash: string | null;
          personality_profile: Json | null;
          personality_updated_at: string | null;
          created_at: string;
        };
      };
      user_privacy_settings: {
        Row: {
          user_id: string;
          show_phone: boolean;
          show_facts: boolean;
          show_badges: boolean;
          show_last_active: boolean;
          show_event_history: boolean;
          show_city: boolean;
          show_work: boolean;
          show_university: boolean;
          who_can_message: string;
          updated_at: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          type: "daily_duo" | "reel";
          caption: string | null;
          risk_score: number;
          moderation_status: string;
          removed_at: string | null;
          removed_reason: string | null;
          created_at: string;
        };
      };
      photos: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          kind: "front" | "back" | "cover";
          url: string;
          created_at: string;
        };
      };
      reactions: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          reaction_type: "like" | "connect" | "star";
          created_at: string;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          content: string;
          risk_score: number;
          moderation_status: string;
          removed_at: string | null;
          created_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          outcomes: string[];
          cover_url: string | null;
          event_date: string;
          price: number;
          city: string;
          risk_score: number;
          moderation_status: string;
          removed_at: string | null;
          created_at: string;
        };
      };
      event_members: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          created_at: string;
        };
      };
      event_endorsements: {
        Row: {
          id: string;
          event_id: string;
          from_user_id: string;
          to_user_id: string;
          created_at: string;
        };
      };
      connections: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          status: "pending" | "accepted" | "rejected";
          created_at: string;
        };
      };
      messages: {
        Row: {
          id: string;
          event_id: string | null;
          from_user_id: string;
          to_user_id: string | null;
          content: string;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          device_label: string;
          user_agent: string | null;
          ip: string | null;
          created_at: string;
          last_active_at: string;
          revoked_at: string | null;
        };
      };
      telegram_verifications: {
        Row: {
          id: string;
          phone: string;
          token: string;
          status: "pending" | "verified" | "expired";
          telegram_user_id: string | null;
          verified_phone: string | null;
          expires_at: string;
          created_at: string;
        };
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          path: string | null;
          properties: Json;
          created_at: string;
        };
      };
      user_flags: {
        Row: {
          id: string;
          user_id: string;
          source: string;
          severity: string;
          reason: string;
          evidence: string | null;
          status: string;
          created_at: string;
          resolved_at: string | null;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_user_id: string | null;
          target_user_id: string | null;
          content_type: string;
          content_id: string | null;
          reason: string;
          details: string | null;
          status: string;
          ai_summary: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      moderation_actions: {
        Row: {
          id: string;
          admin_user_id: string | null;
          target_user_id: string | null;
          action: string;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
      };
      content_flags: {
        Row: {
          id: string;
          content_type: string;
          content_id: string;
          user_id: string | null;
          source: string;
          reason: string;
          risk_score: number;
          status: string;
          ai_explanation: string | null;
          metadata: Json;
          created_at: string;
          resolved_at: string | null;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          description: string | null;
          enabled: boolean;
          rollout: number;
          scope: string;
          payload: Json;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      remote_configs: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      experiments: {
        Row: {
          id: string;
          key: string;
          variants: Json;
          rollout_percent: number;
          start_at: string | null;
          end_at: string | null;
          primary_metric: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          type: string;
          metric: string;
          threshold: number;
          window: string;
          status: string;
          last_triggered_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      badges: {
        Row: {
          id: string;
          key: string;
          title: string;
          description: string;
          category: string;
          is_seasonal: boolean;
          season_key: string | null;
          icon: string | null;
          rules: Json;
          is_active: boolean;
          created_at: string;
        };
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_id: string;
          earned_at: string;
          is_featured: boolean;
        };
      };
    };
  };
};
