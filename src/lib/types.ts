import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ChannelType = Database["public"]["Enums"]["channel_type"];
export type PresenceStatus = Database["public"]["Enums"]["presence_status"];

export type Organisation = Database["public"]["Tables"]["organisations"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Reaction = Database["public"]["Tables"]["message_reactions"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type OrgMember = Database["public"]["Tables"]["organisation_members"]["Row"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];
