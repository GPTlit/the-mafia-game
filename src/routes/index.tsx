import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { AuthPanel } from "@/components/AuthPanel";
import { ProfileModal } from "@/components/ProfileModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { api, AVATARS } from "@/lib/game";
import { fetchProfileStats, getRankTier, type ProfileStats } from "@/lib/profile";
import { ROLES, type RoleKey } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "THE MAFIA — Trust No One" },
      {
        name: "description",
        content:
          "Multiplayer social deduction game: wolves hunt at night, the detective investigates, the doctor heals, and the town votes by day. Talk · Trust · Survive.",
      },
      { property: "og:title", content: "THE MAFIA — Trust No One" },
      {
        property: "og:description",
        content: "Create a room, invite 6-15 players, and survive the night.",
      },
      { property: "og:image", content: "/logo.png" },
    ],
  }),
  component: Index,
  ssr: false,
});

function Index() {
  const { lang, t } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"lobby" | "modes" | "join">("lobby");

  useEffect(() => {
    if (!session) return;
    void fetchProfileStats(session.user.id).then(setProfileStats);
  }, [session]);

  async function create() {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const roomCode = await api.createRoom();
      void navigate({ to: "/room/$code", params: { code: roomCode } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
      setBusy(false);
    }
  }

  async function join() {
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.joinRoom(code.trim().toUpperCase());
      void navigate({ to: "/room/$code", params: { code: code.trim().toUpperCase() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
      setBusy(false);
    }
  }

  const rankTier = profileStats ? getRankTier(profileStats.points) : null;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-between px-4 py-5 select-none">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="THE MAFIA"
            className="h-10 w-10 rounded-2xl border border-red-500/30 object-cover shadow-lg shadow-red-950/40"
          />
          <div>
            <span className="wordmark text-lg font-black tracking-wider text-foreground">MAFIA</span>
            <p className="text-[9px] font-bold tracking-[0.2em] text-red-500 uppercase">
              {lang === "ar" ? "لا تثق بأحد" : "TRUST NO ONE"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session && profileStats ? (
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-foreground/5 py-1 ps-1.5 pe-3 text-xs font-semibold text-foreground shadow hover:bg-foreground/10 transition"
            >
              <img
                src={profileStats.avatar_url || AVATARS[0]!}
                alt="Profile"
                className="h-6 w-6 rounded-full border border-border object-cover"
              />
              <span className="text-[11px] font-bold" style={{ color: rankTier?.color }}>
                {profileStats.points}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/20 transition"
            >
              {lang === "ar" ? "تسجيل الدخول" : "Sign In"}
            </button>
          )}

          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition"
          >
            
          </button>
        </div>
      </header>

      {/* Hero Visual Section matching the prototype collage */}
      <section className="flex flex-col items-center text-center my-auto py-4">
        <img
          src="/logo.png"
          alt="THE MAFIA"
          className="mb-4 h-40 w-40 object-contain drop-shadow-2xl sm:h-48 sm:w-48"
          fetchPriority="high"
        />

        <h1 className="wordmark text-4xl sm:text-5xl font-black tracking-wider text-foreground">
          MAFIA
        </h1>
        <p className="mt-1 text-xs font-bold tracking-[0.25em] text-red-500 uppercase">
          {lang === "ar" ? "لا تثق بأحد" : "TRUST NO ONE"}
        </p>

        {/* Real role cards */}
        <div className="mt-6 grid w-full max-w-xs grid-cols-4 gap-2">
          {(["CIVILIAN", "DOCTOR", "DETECTIVE", "WOLF"] as RoleKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setShowSettings(true)}
              className="group overflow-hidden rounded-xl border border-border bg-card shadow-md transition-transform hover:-translate-y-0.5"
            >
              <img
                src={ROLES[k].art}
                alt={t(`role.${k}.label`)}
                className="aspect-[5/7] w-full object-cover"
                loading="eager"
                decoding="async"
              />
              <span className="block py-1 text-[10px] font-semibold tracking-wide text-foreground">
                {t(`role.${k}.label`)}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-xs font-medium text-muted-foreground tracking-wide">
          {lang === "ar" ? "تكلّم · ثِق · انجُ" : "Talk · Trust · Survive"}
        </p>

        {/* Big Play CTA */}
        <div className="mt-6 w-full max-w-xs space-y-2.5">
          <button
            onClick={() => {
              if (!session) setShowAuthModal(true);
              else void create();
            }}
            disabled={busy}
            className="w-full rounded-2xl bg-white py-3.5 text-sm font-black tracking-widest uppercase text-black shadow-xl shadow-white/10 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {busy ? t("common.wait") : lang === "ar" ? "العب الآن" : "Play Now"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab(activeTab === "join" ? "lobby" : "join")}
              className="flex-1 rounded-xl border border-border bg-foreground/5 py-2.5 text-xs font-bold text-foreground hover:bg-foreground/10 transition"
            >
              {lang === "ar" ? "انضمام برمز" : "Join Code"}
            </button>
            <Link
              to="/offline"
              className="flex-1 rounded-xl border border-border bg-foreground/5 py-2.5 text-xs font-bold text-center text-foreground hover:bg-foreground/10 transition"
            >
              {lang === "ar" ? "تدريب فردي" : "Solo Practice"}
            </Link>
          </div>
        </div>

        {/* Join drawer/input if clicked */}
        {activeTab === "join" && (
          <div className="mt-4 flex w-full max-w-xs gap-2 animate-in fade-in">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={lang === "ar" ? "رمز الغرفة" : "ROOM CODE"}
              maxLength={5}
              className="flex-1 rounded-xl border border-border bg-foreground/5 px-3 py-2 text-center text-sm font-bold tracking-[0.25em] text-foreground outline-none focus:border-red-500"
            />
            <button
              onClick={() => void join()}
              disabled={busy || code.trim().length < 4}
              className="rounded-xl bg-red-600 px-4 text-xs font-bold uppercase text-foreground disabled:opacity-40"
            >
              {lang === "ar" ? "انضم" : "Join"}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      {/* Modes & Role Rules Bottom Sheet Card */}
      <section className="mt-auto rounded-3xl border border-border bg-black/40 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {lang === "ar" ? "أنماط اللعب والأدوار" : "Game Modes & Roles"}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="text-[11px] font-semibold text-red-400 underline"
          >
            {lang === "ar" ? "عرض التفاصيل" : "View Details"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-border bg-foreground/[0.02] p-2">
            <p className="text-[11px] font-bold text-foreground">4–5</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">1 Wolf · 1 Det · 1 Doc</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/[0.02] p-2">
            <p className="text-[11px] font-bold text-foreground">6–8</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">2 Wolves · 1 Det · 1 Doc</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/[0.02] p-2">
            <p className="text-[11px] font-bold text-foreground">9+</p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">3 Wolves · Remainder Civ</p>
          </div>
        </div>
      </section>

      {/* Modals & Drawers */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm">
            <button
              onClick={() => setShowAuthModal(false)}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground"
            >
              
            </button>
            <AuthPanel />
          </div>
        </div>
      )}

      {showProfile && session && profileStats && (
        <ProfileModal
          userId={session.user.id}
          username={profileStats.username}
          avatarUrl={profileStats.avatar_url}
          onClose={() => setShowProfile(false)}
        />
      )}

      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </main>
  );
}
