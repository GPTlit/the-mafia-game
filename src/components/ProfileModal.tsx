import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  fetchMatchHistory,
  fetchProfileStats,
  getNextTier,
  getRankTier,
  RANK_TIERS,
  type MatchHistoryItem,
  type ProfileStats,
} from "@/lib/profile";
import { ROLES, type RoleKey } from "@/lib/roles";

export function ProfileModal({
  userId,
  username,
  avatarUrl,
  onClose,
}: {
  userId: string;
  username: string;
  avatarUrl: string;
  onClose: () => void;
}) {
  const { lang } = useI18n();
  const [activeTab, setActiveTab] = useState<"stats" | "history">("stats");
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    void fetchProfileStats(userId, username, avatarUrl).then(setStats);
    void fetchMatchHistory(userId).then(setHistory);
  }, [userId, username, avatarUrl]);

  if (!stats) return null;

  const currentTier = getRankTier(stats.points);
  const nextTier = getNextTier(stats.points);

  const tierTitle =
    lang === "ar" ? currentTier.titleAr : lang === "fr" ? currentTier.titleFr : currentTier.titleEn;

  const nextTierTitle = nextTier
    ? lang === "ar"
      ? nextTier.titleAr
      : lang === "fr"
        ? nextTier.titleFr
        : nextTier.titleEn
    : null;

  const winRate =
    stats.matchesPlayed > 0 ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) : 0;

  const tierProgress = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((stats.points - currentTier.minPoints) /
              (nextTier.minPoints - currentTier.minPoints)) *
              100,
          ),
        ),
      )
    : 100;

  const pointsToNext = nextTier ? Math.max(0, nextTier.minPoints - stats.points) : 0;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-[#141620] text-foreground shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              {lang === "ar"
                ? "الهيكل التنظيمي للمافيا"
                : lang === "fr"
                  ? "Hiérarchie du Syndicat"
                  : "The Syndicate Hierarchy"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex shrink-0 border-b border-white/5 bg-white/[0.02] p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === "stats"
                ? "bg-white/10 text-white shadow"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {lang === "ar" ? "📊 الرتبة والإحصائيات" : "📊 Hierarchy & Stats"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === "history"
                ? "bg-white/10 text-white shadow"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {lang === "ar" ? "📜 سجل المباريات" : "📜 Match History"}
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-none space-y-4">
          {activeTab === "stats" ? (
            <>
              {/* Profile Card Header */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div
                    className="absolute -inset-1.5 rounded-full blur-md"
                    style={{ backgroundColor: currentTier.color, opacity: 0.45 }}
                  />
                  <img
                    src={stats.avatar_url || avatarUrl}
                    alt={stats.username}
                    className="relative h-20 w-20 rounded-full border-2 border-white/20 bg-secondary object-cover"
                  />
                  <span
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#141620] text-sm shadow-md"
                    style={{ backgroundColor: currentTier.color }}
                  >
                    {currentTier.badge}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-white tracking-tight">
                  {stats.username}
                </h3>

                <div
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    backgroundColor: currentTier.bgGlow,
                    color: currentTier.color,
                    border: `1px solid ${currentTier.color}40`,
                  }}
                >
                  <span>{currentTier.badge}</span>
                  <span>{tierTitle}</span>
                  <span className="text-[10px] opacity-75">(Rank {currentTier.level})</span>
                </div>
              </div>

              {/* Points & Next Tier Progress */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">
                    {lang === "ar"
                      ? "نقاط الهيبة (XP)"
                      : lang === "fr"
                        ? "Points de Réputation (XP)"
                        : "Reputation Points (XP)"}
                  </span>
                  <span
                    className="text-sm font-extrabold tabular-nums"
                    style={{ color: currentTier.color }}
                  >
                    {stats.points.toLocaleString()} XP
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{
                      width: `${tierProgress}%`,
                      backgroundColor: currentTier.color,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{tierTitle}</span>
                  {nextTierTitle ? (
                    <span className="font-semibold text-white/90">
                      {lang === "ar"
                        ? `باقي ${pointsToNext} نقطة للترقية لـ ${nextTierTitle}`
                        : `${pointsToNext} XP to ${nextTierTitle}`}
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold">
                      {lang === "ar" ? "أعلى رتبة في المافيا!" : "Maximum Rank Achieved!"}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Stats Counters */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {lang === "ar" ? "نسبة الفوز" : "Win Rate"}
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-400 tabular-nums">
                    {winRate}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {lang === "ar" ? "المباريات" : "Matches"}
                  </p>
                  <p className="mt-1 text-xl font-black text-white tabular-nums">
                    {stats.matchesPlayed}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {lang === "ar" ? "فوز الذئاب" : "Wolf Wins"}
                  </p>
                  <p className="mt-1 text-xl font-black text-red-400 tabular-nums">
                    {stats.wolfWins}
                  </p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "انتصارات القرية (المدنيين)" : "Town Victories"}
                  </span>
                  <span className="font-bold text-white tabular-nums">{stats.townWins}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "إنقاذات الطبيب الناجحة" : "Doctor Saves"}
                  </span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    {stats.doctorSaves}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {lang === "ar" ? "كشف الذئاب بواسطة المحقق" : "Detective Discoveries"}
                  </span>
                  <span className="font-bold text-sky-400 tabular-nums">
                    {stats.detectiveDiscoveries}
                  </span>
                </div>
              </div>

              {/* Full Hierarchy Ranks Ladder */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                  {lang === "ar" ? "درجات الرتب في السنديكات" : "Syndicate Tier Ladder"}
                </p>
                <div className="space-y-1.5">
                  {RANK_TIERS.map((tier) => {
                    const isCurrent = currentTier.key === tier.key;
                    const tierName =
                      lang === "ar" ? tier.titleAr : lang === "fr" ? tier.titleFr : tier.titleEn;
                    return (
                      <div
                        key={tier.key}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                          isCurrent
                            ? "border border-white/20 bg-white/10 font-bold"
                            : "opacity-60 bg-white/[0.01]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{tier.badge}</span>
                          <span style={{ color: tier.color }}>{tierName}</span>
                          {isCurrent && (
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] text-white">
                              {lang === "ar" ? "رتبتك الحالية" : "Current"}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {tier.minPoints.toLocaleString()}
                          {tier.maxPoints < 999999 ? `–${tier.maxPoints} pts` : "+ pts"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* Match History Tab */
            <div className="space-y-2.5">
              {history.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <span className="text-2xl">📜</span>
                  <p className="mt-2">
                    {lang === "ar" ? "لا توجد مباريات مسجلة بعد." : "No matches recorded yet."}
                  </p>
                </div>
              ) : (
                history.map((m) => {
                  const role = m.role as RoleKey | null;
                  const roleMeta = role ? ROLES[role] : null;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                          style={{
                            backgroundColor: m.won
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                            color: m.won ? "#10b981" : "#ef4444",
                          }}
                        >
                          {m.won ? "🏆" : "💀"}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-bold uppercase text-[11px]"
                              style={{ color: roleMeta?.tone ?? "#fff" }}
                            >
                              {role ?? "CIVILIAN"}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                m.won
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {m.won
                                ? lang === "ar"
                                  ? "فوز"
                                  : "WIN"
                                : lang === "ar"
                                  ? "خسارة"
                                  : "LOSS"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {m.survived
                              ? lang === "ar"
                                ? "نجا حتى النهاية"
                                : "Survived"
                              : lang === "ar"
                                ? "تم إقصاؤه"
                                : "Eliminated"}{" "}
                            · {formatDate(m.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-sm text-emerald-400 tabular-nums">
                          +{m.points_earned} XP
                        </span>
                        {m.rank_after && (
                          <p className="text-[9px] text-muted-foreground">{m.rank_after}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="shrink-0 border-t border-white/10 bg-[#141620] p-4 text-center">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-white py-3 text-xs font-black tracking-widest uppercase text-black shadow-lg transition active:scale-95"
          >
            {lang === "ar" ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
