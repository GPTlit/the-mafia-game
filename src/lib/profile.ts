import { supabase } from "@/integrations/supabase/client";
import type { RoleKey } from "./roles";

export type RankTierKey = "INFORMANT" | "ENFORCER" | "CAPOREGIME" | "UNDERBOSS" | "GODFATHER";

export interface RankTier {
  key: RankTierKey;
  level: number;
  minPoints: number;
  maxPoints: number;
  titleEn: string;
  titleAr: string;
  titleFr: string;
  badge: string;
  color: string;
  bgGlow: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    key: "INFORMANT",
    level: 1,
    minPoints: 0,
    maxPoints: 199,
    titleEn: "Informant",
    titleAr: "مخبر",
    titleFr: "Informateur",
    badge: "🔎",
    color: "#60a5fa",
    bgGlow: "rgba(96, 165, 250, 0.2)",
  },
  {
    key: "ENFORCER",
    level: 2,
    minPoints: 200,
    maxPoints: 499,
    titleEn: "Enforcer",
    titleAr: "منفّذ",
    titleFr: "Homme de main",
    badge: "⚔️",
    color: "#34d399",
    bgGlow: "rgba(52, 211, 153, 0.2)",
  },
  {
    key: "CAPOREGIME",
    level: 3,
    minPoints: 500,
    maxPoints: 999,
    titleEn: "Caporegime",
    titleAr: "كابو",
    titleFr: "Capo",
    badge: "🛡️",
    color: "#f59e0b",
    bgGlow: "rgba(245, 158, 11, 0.2)",
  },
  {
    key: "UNDERBOSS",
    level: 4,
    minPoints: 1000,
    maxPoints: 1999,
    titleEn: "Underboss",
    titleAr: "مساعد الزعيم",
    titleFr: "Sous-chef",
    badge: "💎",
    color: "#ec4899",
    bgGlow: "rgba(236, 72, 153, 0.2)",
  },
  {
    key: "GODFATHER",
    level: 5,
    minPoints: 2000,
    maxPoints: 999999,
    titleEn: "The Godfather",
    titleAr: "العرّاب",
    titleFr: "Le Parrain",
    badge: "👑",
    color: "#ef4444",
    bgGlow: "rgba(239, 68, 68, 0.25)",
  },
];

export interface ProfileStats {
  id: string;
  username: string;
  avatar_url: string;
  points: number;
  rank_tier: string;
  matchesPlayed: number;
  matchesWon: number;
  wolfWins: number;
  townWins: number;
  doctorSaves: number;
  detectiveDiscoveries: number;
}

export interface MatchHistoryItem {
  id: string;
  role: RoleKey | null;
  won: boolean;
  survived: boolean;
  points_earned: number;
  rank_before?: string | null;
  rank_after?: string | null;
  created_at: string;
}

export function getRankTier(points: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    const tier = RANK_TIERS[i]!;
    if (points >= tier.minPoints) return tier;
  }
  return RANK_TIERS[0]!;
}

export function getNextTier(points: number): RankTier | null {
  const current = getRankTier(points);
  const next = RANK_TIERS.find((t) => t.level === current.level + 1);
  return next ?? null;
}

const STORAGE_PREFIX = "mafia_profile_stats_";
const HISTORY_STORAGE_PREFIX = "mafia_match_history_";

export async function fetchProfileStats(
  userId: string,
  defaultUsername = "Player",
  defaultAvatar = "",
): Promise<ProfileStats> {
  const fallback: ProfileStats = {
    id: userId,
    username: defaultUsername,
    avatar_url: defaultAvatar,
    points: 0,
    rank_tier: "INFORMANT",
    matchesPlayed: 0,
    matchesWon: 0,
    wolfWins: 0,
    townWins: 0,
    doctorSaves: 0,
    detectiveDiscoveries: 0,
  };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "username, avatar_url, points, rank_tier, matches_played, matches_won, wolf_wins, town_wins, doctor_saves, detective_discoveries",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      if (data.username) fallback.username = data.username;
      if (data.avatar_url) fallback.avatar_url = data.avatar_url;
      if (typeof data.points === "number") fallback.points = data.points;
      if (data.rank_tier) fallback.rank_tier = data.rank_tier;
      if (typeof data.matches_played === "number") fallback.matchesPlayed = data.matches_played;
      if (typeof data.matches_won === "number") fallback.matchesWon = data.matches_won;
      if (typeof data.wolf_wins === "number") fallback.wolfWins = data.wolf_wins;
      if (typeof data.town_wins === "number") fallback.townWins = data.town_wins;
      if (typeof data.doctor_saves === "number") fallback.doctorSaves = data.doctor_saves;
      if (typeof data.detective_discoveries === "number") {
        fallback.detectiveDiscoveries = data.detective_discoveries;
      }
    }
  } catch {
    // Database fallback to local stats
  }

  saveProfileStats(fallback);
  return fallback;
}

export function saveProfileStats(stats: ProfileStats) {
  try {
    localStorage.setItem(STORAGE_PREFIX + stats.id, JSON.stringify(stats));
  } catch {
    // Ignore
  }
}

export async function fetchMatchHistory(userId: string): Promise<MatchHistoryItem[]> {
  const { data, error } = await supabase
    .from("match_history")
    .select("id, role, won, survived, points_earned, rank_before, rank_after, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map((d) => ({ ...d, role: (d.role as RoleKey) ?? null }));
}

/** Asks the server to score a finished online match. Results are computed from the room itself. */
export async function claimMatchReward(roomId: string): Promise<number> {
  const { data, error } = await supabase.rpc("claim_match_reward", { p_room_id: roomId });
  if (error) return 0;
  return data ?? 0;
}
