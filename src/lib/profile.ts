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
    points: 240, // default starts at Enforcer
    rank_tier: "ENFORCER",
    matchesPlayed: 4,
    matchesWon: 3,
    wolfWins: 1,
    townWins: 2,
    doctorSaves: 1,
    detectiveDiscoveries: 1,
  };

  try {
    const rawLocal = localStorage.getItem(STORAGE_PREFIX + userId);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      Object.assign(fallback, parsed);
    }
  } catch {
    // Ignore storage parse error
  }

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
  const defaultHistory: MatchHistoryItem[] = [
    {
      id: "demo-1",
      role: "WOLF",
      won: true,
      survived: true,
      points_earned: 100,
      rank_before: "INFORMANT",
      rank_after: "ENFORCER",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: "demo-2",
      role: "DOCTOR",
      won: true,
      survived: true,
      points_earned: 85,
      rank_before: "ENFORCER",
      rank_after: "ENFORCER",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: "demo-3",
      role: "DETECTIVE",
      won: false,
      survived: false,
      points_earned: 25,
      rank_before: "ENFORCER",
      rank_after: "ENFORCER",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
  ];

  try {
    const rawLocal = localStorage.getItem(HISTORY_STORAGE_PREFIX + userId);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore
  }

  try {
    const { data, error } = await supabase
      .from("match_history")
      .select("id, role, won, survived, points_earned, rank_before, rank_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data && data.length > 0) {
      const items: MatchHistoryItem[] = data.map((d) => ({
        id: d.id,
        role: (d.role as RoleKey) ?? null,
        won: d.won,
        survived: d.survived,
        points_earned: d.points_earned,
        rank_before: d.rank_before,
        rank_after: d.rank_after,
        created_at: d.created_at,
      }));
      localStorage.setItem(HISTORY_STORAGE_PREFIX + userId, JSON.stringify(items));
      return items;
    }
  } catch {
    // Fall back to default history
  }

  localStorage.setItem(HISTORY_STORAGE_PREFIX + userId, JSON.stringify(defaultHistory));
  return defaultHistory;
}

export function awardPointsForMatch(
  stats: ProfileStats,
  outcome: {
    roomId?: string;
    won: boolean;
    role: RoleKey | null;
    survived: boolean;
    doctorSaved?: boolean;
    detectiveFoundWolf?: boolean;
  },
): { updated: ProfileStats; gained: number; reasons: string[] } {
  let pts = 0;
  const reasons: string[] = [];

  if (outcome.won) {
    pts += 50;
    reasons.push("+50 Victory");
    if (outcome.role === "WOLF") {
      pts += 30;
      reasons.push("+30 Wolf Pack Domination");
    }
  }

  if (outcome.survived) {
    pts += 20;
    reasons.push("+20 Survived Until End");
  }

  if (outcome.doctorSaved) {
    pts += 15;
    reasons.push("+15 Timely Doctor Save");
  }

  if (outcome.detectiveFoundWolf) {
    pts += 15;
    reasons.push("+15 Detective Wolf Discovery");
  }

  if (pts === 0) {
    pts = 10;
    reasons.push("+10 Match Participation");
  }

  const newPoints = stats.points + pts;
  const newTier = getRankTier(newPoints);

  const updated: ProfileStats = {
    ...stats,
    points: newPoints,
    rank_tier: newTier.key,
    matchesPlayed: stats.matchesPlayed + 1,
    matchesWon: stats.matchesWon + (outcome.won ? 1 : 0),
    wolfWins: stats.wolfWins + (outcome.won && outcome.role === "WOLF" ? 1 : 0),
    townWins: stats.townWins + (outcome.won && outcome.role !== "WOLF" ? 1 : 0),
    doctorSaves: stats.doctorSaves + (outcome.doctorSaved ? 1 : 0),
    detectiveDiscoveries: stats.detectiveDiscoveries + (outcome.detectiveFoundWolf ? 1 : 0),
  };

  saveProfileStats(updated);

  // Append to match history
  const historyItem: MatchHistoryItem = {
    id: crypto.randomUUID(),
    role: outcome.role,
    won: outcome.won,
    survived: outcome.survived,
    points_earned: pts,
    rank_before: stats.rank_tier,
    rank_after: newTier.key,
    created_at: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_PREFIX + stats.id);
    const existing: MatchHistoryItem[] = raw ? JSON.parse(raw) : [];
    const merged = [historyItem, ...existing].slice(0, 30);
    localStorage.setItem(HISTORY_STORAGE_PREFIX + stats.id, JSON.stringify(merged));
  } catch {
    // Ignore
  }

  // Persist to Supabase if connection is available
  void supabase.rpc("award_match_points", {
    p_user_id: stats.id,
    p_room_id: outcome.roomId || "00000000-0000-0000-0000-000000000000",
    p_won: outcome.won,
    p_role: outcome.role ?? "CIVILIAN",
    p_survived: outcome.survived,
    p_doctor_saved: outcome.doctorSaved ?? false,
    p_detective_found: outcome.detectiveFoundWolf ?? false,
  });

  return { updated, gained: pts, reasons };
}
