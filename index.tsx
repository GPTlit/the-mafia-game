import { Bell, CirclePlus, Dog, Search, Settings, User, X } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { AuthPanel } from "@/components/AuthPanel";
import { ProfileModal } from "@/components/ProfileModal";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { api } from "@/lib/game";
import { fetchProfileStats, type ProfileStats } from "@/lib/profile";
import type { RoleKey } from "@/lib/roles";
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

  const ar = lang === "ar";
  const roleCards: { k: RoleKey; Icon: typeof User }[] = [
    { k: "WOLF", Icon: Dog },
    { k: "DETECTIVE", Icon: Search },
    { k: "DOCTOR", Icon: CirclePlus },
    { k: "CIVILIAN", Icon: User },
  ];
  const panel = "rounded-[22px] bg-[#1c1c1d] shadow-[0_2px_10px_#0008]";

  return (
    <main
      dir="ltr"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-[#0b0b0c] px-3 pb-4 pt-3 text-[#efe4cf] select-none"
      style={{
        backgroundImage:
          "repeating-linear-gradient(115deg, transparent 0 46px, #6a1f2622 46px 47px), repeating-linear-gradient(62deg, transparent 0 71px, #6a1f2618 71px 72px)",
      }}
    >
      {/* Top bar: gear + bell on the left, MAFIA on the right */}
      <header className={`flex h-[68px] items-center justify-between px-5 ${panel}`}>
        <div className="flex items-center gap-5 text-[#8c857a]">
          <button onClick={() => setShowSettings(true)} aria-label="Settings">
            <Settings className="h-6 w-6" strokeWidth={1.4} />
          </button>
          <button
            onClick={() => (session ? setShowProfile(true) : setShowAuthModal(true))}
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" strokeWidth={1.4} />
          </button>
        </div>
        <span className="font-serif text-[34px] tracking-wide">MAFIA</span>
      </header>

      {/* Hero: moon card left, title right */}
      <section className="mt-7 flex items-center gap-3.5">
        <img
          src="/cards/hero-moon.jpg"
          alt=""
          className="aspect-[515/790] w-[47%] rounded-xl border border-[#5a2a30] bg-[#4a1f26] object-cover shadow-[0_6px_20px_#000a]"
          fetchPriority="high"
        />
        <div className="flex-1 text-center" dir={ar ? "rtl" : "ltr"}>
          <h1 dir="ltr" className="font-serif text-[52px] font-medium leading-none">
            MAFIA
          </h1>
          <p className="mt-2.5 text-[30px] font-semibold leading-tight">
            {ar ? "لا تثق بأحد" : "Trust No One"}
          </p>
          <p className="mt-3.5 text-xl text-[#7a3a3d]">
            {ar ? "تكلّم · ثق · انجُ" : "Talk · Trust · Survive"}
          </p>
        </div>
      </section>

      {/* Role tiles: icon + label only */}
      <section className="mt-8 grid grid-cols-4 gap-2.5">
        {roleCards.map(({ k, Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex aspect-[0.7] flex-col items-center justify-center gap-3.5 rounded-2xl border border-[#3a3836] bg-[#1c1c1d] text-[15px] shadow-[inset_0_0_0_4px_#1c1c1d,inset_0_0_0_5px_#2b2927]"
          >
            <Icon className="h-9 w-9 text-[#8c857a]" strokeWidth={1.3} />
            <span dir={ar ? "rtl" : "ltr"}>{t(`role.${k}.label`)}</span>
          </button>
        ))}
      </section>

      <div className="min-h-6 flex-1" />

      <button
        onClick={() => void create()}
        disabled={busy}
        className="h-[68px] w-full rounded-[18px] bg-[#efe4cf] text-2xl font-medium text-[#111] transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? t("common.wait") : ar ? "العب الآن" : "Play Now"}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Link
          to="/offline"
          className="flex h-14 items-center justify-center rounded-[18px] border border-[#3a3836] bg-[#1c1c1d] text-[17px]"
        >
          {ar ? "تدريب فردي" : "Solo Practice"}
        </Link>
        <button
          onClick={() => setActiveTab(activeTab === "join" ? "lobby" : "join")}
          className="h-14 rounded-[18px] border border-[#3a3836] bg-[#1c1c1d] text-[17px]"
        >
          {ar ? "انضمام برمز" : "Join Code"}
        </button>
      </div>

      {activeTab === "join" && (
        <div className="mt-3 flex w-full gap-2 animate-in fade-in">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={ar ? "رمز الغرفة" : "ROOM CODE"}
            maxLength={5}
            className="flex-1 rounded-[14px] border border-[#3a3836] bg-[#1c1c1d] px-3 py-3 text-center text-sm font-bold tracking-[0.25em] outline-none focus:border-[#8a2a2d]"
          />
          <button
            onClick={() => void join()}
            disabled={busy || code.trim().length < 4}
            className="rounded-[14px] bg-[#6b2f37] px-5 text-sm font-bold disabled:opacity-40"
          >
            {ar ? "انضم" : "Join"}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}

      {/* Modals & Drawers */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm">
            <button
              onClick={() => setShowAuthModal(false)}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground"
            >
            <X className="h-4 w-4" />
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
