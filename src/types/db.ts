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
          password_hash: string | null;
          personality_profile: Json | null;
          personality_updated_at: string | null;
          role: string;
          is_blocked: boolean;
          blocked_reason: string | null;
          blocked_until: string | null;
          created_at: string;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          type: "daily_duo" | "reel";
          caption: string | null;
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
    };
  };
};
