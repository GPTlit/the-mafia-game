import { ArrowLeft, Settings, X, Lock, User } from "lucide-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useCountdown, useRoom } from "@/hooks/useRoom";
import { api, phaseKey, type Player } from "@/lib/game";
import { useI18n, type TFunc } from "@/lib/i18n";
import { GameCard, ROLES, type RoleKey } from "@/lib/roles";
import { PlayerGrid } from "@/components/PlayerGrid";
import { SeatTable } from "@/components/SeatTable";
import { useChatStyle } from "@/lib/chatStyle";
import { Chat } from "@/components/Chat";
import { ActionDrawer } from "@/components/ActionDrawer";
import { VoiceCallOverlay } from "@/components/VoiceCallOverlay";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ProfileModal } from "@/components/ProfileModal";
import { useVoiceCall } from "@/lib/useVoiceCall";
import { isNarratorMuted, setNarratorMuted, speakPhase } from "@/lib/narrator";
import { claimMatchReward, fetchProfileStats, type ProfileStats } from "@/lib/profile";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "THE MAFIA Room — Play a Round" },
      {
        name: "description",
        content: "Your Mafia table: roles, night actions, day defense and voting in real time.",
      },
      { property: "og:title", content: "THE MAFIA Room" },
      { property: "og:description", content: "Join the table and survive the night." },
      { property: "og:image", content: "/logo.png" },
    ],
  }),
  component: RoomPage,
  ssr: false,
});

function RoomPage() {
  const { code } = Route.useParams();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/" });
      return;
    }
    api
      .joinRoom(code)
      .then(setRoomId)
      .catch(async (e: unknown) => {
        const id = await api.roomIdByCode(code).catch(() => null);
        if (id) setRoomId(id);
        else setJoinError(e instanceof Error ? e.message : "Could not open room");
      });
  }, [code, session, loading, navigate]);

  if (joinError) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive font-semibold">{joinError}</p>
        <Link to="/" className="text-sm underline text-foreground">
          Back home
        </Link>
      </main>
    );
  }

  if (!roomId) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span>Entering room…</span>
        </div>
      </main>
    );
  }

  return <Room roomId={roomId} code={code} />;
}

function Room({ roomId, code }: { roomId: string; code: string }) {
  const { lang, t } = useI18n();
  const { session } = useSession();
  const navigate = useNavigate();

  const { state, messages, error, refresh } = useRoom(roomId);
  const secondsLeft = useCountdown(state?.room.phase_ends_at);
  const chatStyle = useChatStyle();

  const [actionError, setActionError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [tab, setTab] = useState<"GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE">("GLOBAL");
  const [copied, setCopied] = useState(false);

  // Pillar 2: Two-Step Target Action Flow
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<Player | null>(null);

  // Pillar 4: Voice Call
  const call = useVoiceCall(roomId, state?.me.user_id ?? null);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);

  // Pillar 5: Narrator
  const [narratorMuted, setMutedState] = useState(isNarratorMuted());

  // Pillar 1: Profile & Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [matchAwarded, setMatchAwarded] = useState(false);


  useEffect(() => {
    if (session) {
      void fetchProfileStats(session.user.id).then(setProfileStats);
    }
  }, [session]);

  const toggleNarrator = () => {
    const next = !narratorMuted;
    setMutedState(next);
    setNarratorMuted(next);
  };

  // Voice Narrator announcements
  useEffect(() => {
    if (!state?.room) return;
    const p = state.room.current_phase;
    if (state.room.status === "IN_PROGRESS" && p) {
      speakPhase(p, lang);
    } else if (state.room.status === "FINISHED") {
      if (state.room.winner === "WOLVES") speakPhase("WOLVES_WIN", lang);
      else speakPhase("TOWN_WIN", lang);
    }
  }, [state?.room.current_phase, state?.room.status, state?.room.winner, lang]);

  // Pillar 1: Award points upon match finish
  useEffect(() => {
    if (state?.room.status === "FINISHED" && !matchAwarded && profileStats && state.me) {
      const rid = state.room.id as string;
      void claimMatchReward(rid).then(() =>
        fetchProfileStats(state.me!.user_id).then(setProfileStats),
      );
      setMatchAwarded(true);
    }
  }, [state?.room.status, matchAwarded, profileStats, state?.me]);

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    }
  };

  useEffect(() => {
    if (state?.room.current_phase === "ROLE_DISTRIBUTION") setCardOpen(true);
  }, [state?.room.current_phase]);

  // Host start countdown (3, 2, 1) broadcast to everyone in the room
  const [startCount, setStartCount] = useState<number | null>(null);
  const meReady = state?.me.is_ready;
  const meReadyRef = useRef(meReady);
  meReadyRef.current = meReady;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    const ch = supabase.channel(`start-countdown:${roomId}`);
    ch.on("broadcast", { event: "countdown" }, () => {
      if (!meReadyRef.current) void api.setReady(roomId, true).catch(() => {});
      setStartCount(3);
    }).subscribe();
    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomId]);
  useEffect(() => {
    if (startCount === null) return;
    if (startCount === 0) {
      setStartCount(null);
      return;
    }
    const id = setTimeout(() => setStartCount((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [startCount]);
  const hostStart = async () => {
    if (!meReadyRef.current) await api.setReady(roomId, true).catch(() => {});
    await channelRef.current?.send({ type: "broadcast", event: "countdown", payload: {} });
    setStartCount(3);
    setTimeout(() => void run(() => api.startGame(roomId)), 3200);
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive font-semibold">{error}</p>
        <Link to="/" className="text-sm underline text-foreground">
          Back home
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          <span>{lang === "ar" ? "جارٍ إعداد الطاولة…" : "Setting up the table…"}</span>
        </div>
      </main>
    );
  }

  const { room, me, players, votes, night, speaker_id } = state;
  const myRole = me.role as RoleKey | null;
  const living = players.filter((p) => p.is_alive);
  const phase = room.current_phase;
  const voteCounts: Record<string, number> = {};
  for (const v of votes) voteCounts[v.target_id] = (voteCounts[v.target_id] ?? 0) + 1;
  const isSpeaker = speaker_id === me.user_id;

  const showRoleModal =
    room.status === "IN_PROGRESS" &&
    phase === "ROLE_DISTRIBUTION" &&
    myRole &&
    (cardOpen || !me.card_seen);

  // Check if current phase is actionable for me
  const isActionPhase =
    (phase === "NIGHT_WOLVES" && myRole === "WOLF" && me.is_alive) ||
    (phase === "NIGHT_DETECTIVE" && myRole === "DETECTIVE" && me.is_alive) ||
    (phase === "NIGHT_DOCTOR" && myRole === "DOCTOR" && me.is_alive) ||
    (phase === "DAY_VOTING" && me.is_alive);

  const actionThemeColor =
    phase === "NIGHT_WOLVES"
      ? "#ef4444"
      : phase === "NIGHT_DOCTOR"
        ? "#10b981"
        : phase === "NIGHT_DETECTIVE"
          ? "#3b82f6"
          : "#8b5cf6";

  const handlePlayerTap = (id: string) => {
    if (!isActionPhase) return;
    const targetP = players.find((p) => p.user_id === id && p.is_alive);
    if (!targetP) return;

    if (selectedTargetPlayer?.user_id === id) {
      // Tap again to dismiss
      setSelectedTargetPlayer(null);
    } else {
      setSelectedTargetPlayer(targetP);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedTargetPlayer) return;
    const targetId = selectedTargetPlayer.user_id;
    setSelectedTargetPlayer(null);

    await run(async () => {
      if (phase === "NIGHT_WOLVES") await api.wolfVote(roomId, targetId);
      else if (phase === "NIGHT_DETECTIVE") await api.detectiveCheck(roomId, targetId);
      else if (phase === "NIGHT_DOCTOR") await api.doctorHeal(roomId, targetId);
      else if (phase === "DAY_VOTING") await api.castVote(roomId, targetId);
    });
  };

  return (
    <main className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[#0b0b0c] text-[#efe4cf] select-none">
      {/* Pillar 3: Pinned Header */}
      <header className="m-2 mb-0 shrink-0 flex items-center justify-between rounded-[22px] bg-[#1c1c1d] px-4 py-3 text-[#efe4cf] shadow-[0_2px_10px_#0008]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => void navigate({ to: "/" })}
            aria-label="Back"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-foreground">#{code}</span>
              <button
                onClick={copyCode}
                title="Copy Room Code"
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                {copied ? "" : ""}
              </button>
            </div>
            {room.status === "IN_PROGRESS" && (
              <span className="text-[10px] font-bold text-red-500 tracking-wide uppercase">
                {t(phaseKey(phase, room.status))}
              </span>
            )}
          </div>
        </div>

        {/* Right header icons */}
        <div className="flex items-center gap-2">
          {/* Phase Countdown Timer */}
          {room.phase_ends_at && room.status === "IN_PROGRESS" && phase !== "DAY_CONCLUSION" && (
            <div className="flex items-center gap-1 rounded-full bg-foreground/5 border border-border px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground">
              <span>⏱</span>
              <span>{secondsLeft}s</span>
            </div>
          )}

          {/* Voice Narrator Toggle (Pillar 5) */}
          <button
            onClick={toggleNarrator}
            title={narratorMuted ? "Unmute Narrator" : "Mute Narrator"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs transition ${
              narratorMuted
                ? "border-border bg-foreground/5 text-muted-foreground"
                : "border-primary/40 bg-primary/20 text-foreground"
            }`}
          >
            {narratorMuted ? "" : ""}
          </button>

          {/* WhatsApp-Style Group Voice Call Button (Pillar 4) */}
          <button
            onClick={() => {
              if (!call.inCall) void call.join();
              setShowVoiceOverlay(true);
            }}
            title="Group Voice Call"
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition shadow ${
              call.inCall
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400 animate-pulse"
                : "border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            }`}
          >
            
            <span className="text-[10px]">
              {call.inCall ? `Live · ${call.peerCount + 1}` : "Call"}
            </span>
          </button>

          {/* Profile chip */}
          {profileStats && (
            <button
              onClick={() => setShowProfile(true)}
              title="Syndicate Hierarchy"
              className="flex items-center gap-1 rounded-full border border-border bg-foreground/5 py-0.5 ps-1 pe-2 text-[11px] font-bold text-foreground hover:bg-foreground/10 transition"
            >
              <span className="text-[10px] tabular-nums text-amber-400">{profileStats.points}</span>
            </button>
          )}

          {/* Settings Cog */}
          <button
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Compact Horizontal Table Strip (Pillar 3 & Pillar 2) */}
      {room.status !== "LOBBY" && !(room.status === "IN_PROGRESS" && chatStyle === "bubbles") && (
      <section className="shrink-0 border-b border-border bg-card/90 px-2 py-1.5">
        <PlayerGrid
          compact
          players={players}
          meId={me.user_id}
          selectable={isActionPhase}
          selectedId={selectedTargetPlayer?.user_id ?? null}
          selectionColor={actionThemeColor}
          speakerId={phase === "DAY_DISCUSSION" ? speaker_id : null}
          voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
          showReady={room.status === "LOBBY"}
          onSelect={handlePlayerTap}
        />
      </section>
      )}

      {/* Main View Area */}
      {room.status === "LOBBY" && (
        <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="mt-3 text-center text-[26px] font-medium">
            <span className="me-2 inline-block h-2 w-2 rounded-full bg-[#efe4cf]" />
            {lang === "ar" ? "انتظار اللاعبين" : "Waiting for players"}
          </p>

          {/* Full-bleed table photo, a plain name beside each person */}
          <div className="flex h-[58dvh] shrink-0 justify-center">
            <SeatTable players={players} meId={me.user_id} messages={messages} />
          </div>

          <div dir="ltr" className="mx-auto mt-2 grid w-full max-w-[22rem] grid-cols-2 gap-x-7 gap-y-4 px-4">
            {players.map((p) => (
              <div
                key={p.user_id}
                dir={lang === "ar" ? "rtl" : "ltr"}
                className={`flex h-28 flex-col items-center justify-center gap-3.5 rounded-2xl border bg-[#1c1c1d] text-[17px] shadow-[inset_0_0_0_4px_#1c1c1d,inset_0_0_0_5px_#2b2927] ${
                  p.user_id === me.user_id ? "border-[#8c857a]" : "border-[#3a3836]"
                }`}
              >
                <User className="h-10 w-10 text-[#8c857a]" strokeWidth={1.3} />
                <span className="max-w-full truncate px-2">
                  {p.username}
                  {p.user_id === me.user_id ? (lang === "ar" ? " · أنت" : " · You") : ""}
                  {p.is_ready ? " ✓" : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex-1" />

          <div className="m-2 space-y-2 rounded-[30px] bg-[#141415] p-3">
            {me.is_host && (
              <div className="flex items-center justify-between px-2 text-xs text-[#b9b2a6]">
                <span>
                  {lang === "ar" ? "إضافة روبوتات" : "AI bots"} · {players.length}/15
                </span>
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => void run(() => api.addBots(roomId, 1))}
                    disabled={players.length >= 15}
                    className="h-8 w-8 rounded-xl bg-[#1c1c1d] font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => void run(() => api.removeBots(roomId, 1))}
                    disabled={!players.some((p) => p.is_bot)}
                    className="h-8 w-8 rounded-xl bg-[#1c1c1d] font-bold disabled:opacity-40"
                  >
                    -
                  </button>
                </span>
              </div>
            )}
            <button
              onClick={() => void run(() => api.setReady(roomId, !me.is_ready))}
              className={`h-14 w-full rounded-[18px] text-lg ${
                me.is_ready
                  ? "border border-[#3a3836] bg-[#1c1c1d] text-[#b9b2a6]"
                  : "bg-[#6b2f37] text-[#efe4cf]"
              }`}
            >
              {me.is_ready ? t("lobby.cancelReady") : t("lobby.ready")}
            </button>
            {me.is_host && (
              <button
                onClick={() => void run(() => api.startGame(roomId))}
                disabled={players.length < 6 || players.some((p) => !p.is_ready)}
                className="h-[68px] w-full rounded-[18px] bg-[#efe4cf] text-2xl font-medium text-[#111] disabled:opacity-40"
              >
                {lang === "ar" ? "بدء اللعبة" : t("lobby.start")}
              </button>
            )}
            <button
              onClick={copyCode}
              className="w-full pb-1 text-center text-xs text-[#8c857a]"
            >
              {lang === "ar" ? "رمز الغرفة" : "Room code"}: <b className="tracking-[0.25em] text-[#efe4cf]">{code}</b>
              {copied ? (lang === "ar" ? " · نُسخ" : " · Copied") : ""}
            </button>
          </div>
        </section>
      )}

      {/* Finished Game Screen */}
      {room.status === "FINISHED" && (
        <section className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center">
          <div className="relative">
            <span className="text-6xl">{room.winner === "WOLVES" ? "" : ""}</span>
          </div>

          <h2 className="mt-3 text-3xl font-black uppercase tracking-wider text-foreground">
            {room.winner === "WOLVES" ? t("room.wolvesWin") : t("room.townWin")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("room.revealed")}</p>

          <div className="mt-6 w-full max-w-sm">
            <PlayerGrid players={players} meId={me.user_id} />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setShowProfile(true)}
              className="rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-foreground/10"
            >
               {lang === "ar" ? "سجل الرتبة والنقاط" : "Syndicate Hierarchy"}
            </button>
            <Link
              to="/"
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-lg uppercase"
            >
              {t("room.back")}
            </Link>
          </div>
        </section>
      )}

      {/* In-Progress In-Game Screen: Strict WhatsApp Viewport */}
      {room.status === "IN_PROGRESS" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Chat Channel Switcher Tabs */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTab("GLOBAL")}
                className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                  tab === "GLOBAL"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "ar" ? "الدردشة العامة" : "Global Chat"}
              </button>

              {myRole === "WOLF" && (
                <button
                  onClick={() => setTab("WOLF_PRIVATE")}
                  className={`flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-bold transition ${
                    tab === "WOLF_PRIVATE"
                      ? "bg-red-600 text-foreground shadow"
                      : "text-red-400 hover:text-red-300"
                  }`}
                >
                  <span>{lang === "ar" ? "قناة الذئاب" : "Wolf Pack"}</span>
            <Lock className="h-3 w-3" />
          </button>
              )}

              {myRole === "DETECTIVE" && (
                <button
                  onClick={() => setTab("DETECTIVE_PRIVATE")}
                  className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                    tab === "DETECTIVE_PRIVATE"
                      ? "bg-blue-600 text-foreground shadow"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  {lang === "ar" ? "سجل التحقيق" : "Detective Log"}
                </button>
              )}
            </div>

            {/* My Secret Role reminder badge */}
            {myRole && (
              <button
                onClick={() => setCardOpen(true)}
                className="flex items-center gap-1 rounded-full border border-border bg-foreground/5 px-2.5 py-0.5 text-[11px] font-bold"
                style={{ color: ROLES[myRole].tone }}
              >
                <span>
                  {myRole === "WOLF"
                    ? ""
                    : myRole === "DETECTIVE"
                      ? ""
                      : myRole === "DOCTOR"
                        ? ""
                        : ""}
                </span>
                <span>{t(`role.${myRole}.label`)}</span>
              </button>
            )}
          </div>

          {/* Chat Component taking up flex viewport */}
          <Chat
            roomId={roomId}
            channel={tab}
            messages={messages}
            players={players}
            meId={me.user_id}
            anonymous={tab === "WOLF_PRIVATE"}
            canWrite={me.is_alive}
            onSent={refresh}
            feedOverride={
              chatStyle === "bubbles" && tab === "GLOBAL" ? (
                <div className="flex h-full flex-col overflow-hidden">
                  {phase === "DAY_VOTING" && (
                    <div className="flex flex-col items-center pt-3">
                      <p className="text-[26px] font-medium">
                        {lang === "ar" ? "التصويت - من تثق به؟" : "Voting - who do you trust?"}
                      </p>
                      <span className="mt-2 rounded-full bg-[#6b2f37] px-5 py-1.5 text-base">
                        {lang === "ar" ? `الجولة ${room.round_number} · ${secondsLeft}s` : `Round ${room.round_number} · ${secondsLeft}s`}
                      </span>
                    </div>
                  )}
                  <div className="flex min-h-0 flex-1 justify-center">
                  <SeatTable
                    players={players}
                    meId={me.user_id}
                    messages={messages}
                    selectable={isActionPhase}
                    selectedId={selectedTargetPlayer?.user_id ?? null}
                    speakerId={phase === "DAY_DISCUSSION" ? speaker_id : null}
                    voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
                    onSelect={(p) => handlePlayerTap(p.user_id)}
                  />
                  </div>
                </div>
              ) : undefined
            }
            onOpenVoiceCall={() => {
              if (!call.inCall) void call.join();
              setShowVoiceOverlay(true);
            }}
            actionSlot={
              <div className="shrink-0 px-2 py-1">
                {phase === "DAY_VOTING" && me.is_alive && (
                  <div className="space-y-2 pb-1">
                    <p className="rounded-2xl bg-[#1c1c1d] py-3 text-center text-sm">
                      {lang === "ar" ? "اختر لاعبًا للتصويت بالإقصاء · سرّي ونهائي" : "Pick a player to eliminate · secret and final"}
                    </p>
                    <div dir="ltr" className="grid grid-cols-[1fr_2fr] gap-3.5">
                      <button
                        onClick={() => setSelectedTargetPlayer(null)}
                        className="h-[62px] rounded-2xl border border-[#6b2f37] text-xl"
                      >
                        {lang === "ar" ? "تخطي" : "Skip"}
                      </button>
                      <button
                        onClick={() => void handleConfirmAction()}
                        disabled={!selectedTargetPlayer}
                        className="h-[62px] rounded-2xl bg-[#6b2f37] text-xl disabled:opacity-50"
                      >
                        {lang === "ar" ? "تصويت" : "Vote"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Day Turn Passing */}
                {phase === "DAY_DISCUSSION" && isSpeaker && me.is_alive && (
                  <button
                    onClick={() => void run(() => api.passTurn(roomId))}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-accent px-4 py-2.5 text-xs font-semibold tracking-wide text-accent-foreground shadow-md transition hover:opacity-90 active:scale-[0.99]"
                  >
                    <span>{t("room.pass")}</span>
                    <span className="rounded-full bg-background/25 px-2 py-0.5 tabular-nums">
                      {secondsLeft}s
                    </span>
                  </button>
                )}

                {/* Day Conclusion Ready To Vote Majority */}
                {phase === "DAY_CONCLUSION" && me.is_alive && (
                  <div className="space-y-1">
                    <button
                      onClick={() => void run(() => api.readyToVote(roomId, !me.wants_vote))}
                      className={`w-full rounded-2xl py-2.5 text-xs font-bold uppercase transition ${
                        me.wants_vote
                          ? "border border-border bg-foreground/5 text-muted-foreground"
                          : "bg-primary text-primary-foreground shadow-md"
                      }`}
                    >
                      {me.wants_vote ? t("room.cancelReadyVote") : t("room.readyVote")}
                    </button>
                    <p className="text-center text-[10px] text-muted-foreground">
                      {t("room.readyVoteCount", {
                        n: state.wants_vote_count,
                        total: state.living_count,
                      })}
                    </p>
                  </div>
                )}
              </div>
            }
          />
        </div>
      )}

      {/* Pillar 2: Sliding Action Drawer (Wolf Kill, Doctor Heal, Detective Inspect, Day Vote) */}
      <ActionDrawer
        phase={phase}
        role={myRole}
        target={phase === "DAY_VOTING" ? null : selectedTargetPlayer}
        players={players}
        voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
        onSelectTarget={(p) => setSelectedTargetPlayer(p)}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setSelectedTargetPlayer(null)}
      />

      {/* Pillar 4: Voice Call Fullscreen Overlay */}
      {showVoiceOverlay && (
        <VoiceCallOverlay
          inCall={call.inCall}
          muted={call.muted}
          peerCount={call.peerCount}
          players={players}
          meId={me.user_id}
          onToggleMute={call.toggleMute}
          onLeave={call.leave}
          onCloseOverlay={() => setShowVoiceOverlay(false)}
        />
      )}

      {/* Secret Card Modal */}
      {showRoleModal && myRole && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 px-6 py-8 backdrop-blur-md animate-in fade-in">
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            {t("room.myCard")}
          </p>
          <div className="mt-3 w-56 shadow-2xl">
            <GameCard role={myRole} />
          </div>
          <p className="mt-4 max-w-xs text-center text-xs text-muted-foreground leading-relaxed">
            {t(`role.${myRole}.blurb`)}
          </p>
          <button
            onClick={() => {
              setCardOpen(false);
              if (!me.card_seen) void run(() => api.confirmCard(roomId));
            }}
            className="mt-6 rounded-2xl bg-white px-8 py-3 text-xs font-black tracking-widest uppercase text-black shadow-xl"
          >
            {me.card_seen ? t("room.close") : t("room.seenCard")}
          </button>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && session && profileStats && (
        <ProfileModal
          userId={session.user.id}
          username={profileStats.username}
          avatarUrl={profileStats.avatar_url}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Settings & Roles Drawer */}
      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {actionError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-foreground shadow-xl">
          {actionError}
        </div>
      )}
    </main>
  );
}

export type { Player };
