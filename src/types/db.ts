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
    };
  };
};
