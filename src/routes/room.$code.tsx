import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useCountdown, useRoom } from "@/hooks/useRoom";
import { api, phaseKey, type Player } from "@/lib/game";
import { LanguageSwitcher, useI18n, type TFunc } from "@/lib/i18n";
import { GameCard, ROLES, WolfSigil, type RoleKey } from "@/lib/roles";
import { PlayerGrid } from "@/components/PlayerGrid";
import { Chat } from "@/components/Chat";
import { ThemeToggle } from "@/lib/theme";
import { useVoiceCall } from "@/lib/useVoiceCall";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "Wolf Night Room — Play a Round" },
      {
        name: "description",
        content: "Your Wolf Night table: roles, night actions, day defense and voting in real time.",
      },
      { property: "og:title", content: "Wolf Night Room" },
      { property: "og:description", content: "Join the table and survive the night." },
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive">{joinError}</p>
        <Link to="/" className="text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!roomId) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Entering room…</main>;
  }

  return <Room roomId={roomId} code={code} />;
}

function Room({ roomId, code }: { roomId: string; code: string }) {
  const { t } = useI18n();
  const { state, messages, error, refresh } = useRoom(roomId);
  const secondsLeft = useCountdown(state?.room.phase_ends_at);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [tab, setTab] = useState<"GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE">("GLOBAL");
  const call = useVoiceCall(roomId, state?.me.user_id ?? null);

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

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-destructive">{error}</p>
        <Link to="/" className="text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!state) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Loading table…</main>;
  }

  const { room, me, players, votes, night, speaker_id } = state;
  const myRole = me.role as RoleKey | null;
  const living = players.filter((p) => p.is_alive);
  const phase = room.current_phase;
  const voteCounts: Record<string, number> = {};
  for (const v of votes) voteCounts[v.target_id] = (voteCounts[v.target_id] ?? 0) + 1;
  const myVote = votes.find((v) => v.voter_id === me.user_id)?.target_id ?? null;
  const isSpeaker = speaker_id === me.user_id;

  const showRoleModal =
    room.status === "IN_PROGRESS" && phase === "ROLE_DISTRIBUTION" && myRole && (cardOpen || !me.card_seen);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WolfSigil className="h-6 w-8 text-primary" />
          <div>
            <p className="display text-lg leading-none font-bold uppercase">{t("room.title", { code })}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("room.meta", { players: players.length, alive: living.length })}
              {room.round_number > 0 ? t("room.round", { n: room.round_number }) : ""}
            </p>
          </div>
        </div>
        <div className="text-end">
          <div className="flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <p className="display text-xs tracking-widest text-primary uppercase">
            {t(phaseKey(phase, room.status))}
          </p>
          {room.phase_ends_at && room.status === "IN_PROGRESS" && phase !== "DAY_CONCLUSION" && (
            <p className="display text-2xl leading-none font-bold">{secondsLeft}s</p>
          )}
        </div>
      </header>

      {room.status === "LOBBY" && (
        <section className="panel mt-5 p-4">
          <h2 className="display text-sm font-bold tracking-widest uppercase">{t("lobby.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("lobby.share", { code })}</p>
          <div className="mt-4">
            <PlayerGrid players={players} meId={me.user_id} showReady />
          </div>
          <button
            onClick={() => void run(() => api.setReady(roomId, !me.is_ready))}
            className={`display mt-4 w-full rounded-md px-4 py-3 text-sm font-bold tracking-widest uppercase ${
              me.is_ready
                ? "border border-border text-muted-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {me.is_ready ? t("lobby.cancelReady") : t("lobby.ready")}
          </button>
          {me.is_host && (
            <button
              onClick={() => void run(() => api.startGame(roomId))}
              disabled={players.length < 6 || players.some((p) => !p.is_ready)}
              className="display mt-2 w-full rounded-md border border-primary px-4 py-3 text-sm font-bold tracking-widest text-primary uppercase disabled:opacity-40"
            >
              {t("lobby.start")}
            </button>
          )}
          {me.is_host && (
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="display text-[11px] font-bold tracking-widest uppercase">
                {t("lobby.bots", { n: players.filter((p) => p.is_bot).length })}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{t("lobby.botsHint")}</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => void run(() => api.addBots(roomId, 1))}
                  disabled={players.length >= 15}
                  className="display flex-1 rounded-md border border-primary px-3 py-2 text-[11px] font-bold tracking-widest text-primary uppercase disabled:opacity-40"
                >
                  {t("lobby.addBot")}
                </button>
                <button
                  onClick={() => void run(() => api.removeBots(roomId, 1))}
                  disabled={!players.some((p) => p.is_bot)}
                  className="display flex-1 rounded-md border border-border px-3 py-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase disabled:opacity-40"
                >
                  {t("lobby.removeBot")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {room.status === "FINISHED" && (
        <section className="panel mt-5 p-4 text-center">
          <h2 className="display text-2xl font-bold uppercase">
            {room.winner === "WOLVES" ? t("room.wolvesWin") : t("room.townWin")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("room.revealed")}</p>
          <div className="mt-4">
            <PlayerGrid players={players} meId={me.user_id} />
          </div>
          <Link to="/" className="display mt-4 inline-block text-xs tracking-widest underline uppercase">
            {t("room.back")}
          </Link>
        </section>
      )}

      {room.status === "IN_PROGRESS" && (
        <>
          {phase === "ROLE_DISTRIBUTION" && (
            <section className="panel mt-4 p-3 text-center">
              <p className="text-sm text-muted-foreground">
                {t("room.waitingCards", {
                  n: players.filter((p) => p.card_seen).length,
                  total: players.length,
                })}
              </p>
              {me.card_seen && (
                <button
                  onClick={() => setCardOpen(true)}
                  className="display mt-3 text-xs tracking-widest text-primary underline uppercase"
                >
                  {t("room.showAgain")}
                </button>
              )}
            </section>
          )}

          <section className="mt-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{instructions(t, phase, myRole, me, isSpeaker)}</p>
              {myRole && (
                <button
                  onClick={() => setCardOpen(true)}
                  className="display shrink-0 ps-2 text-[10px] tracking-widest uppercase"
                  style={{ color: ROLES[myRole].tone }}
                >
                  {t("room.youAre", { role: t(`role.${myRole}.label`) })}
                </button>
              )}
            </div>
            <div className="mt-2">
              <PlayerGrid
                compact
                players={players}
                meId={me.user_id}
                speakerId={phase === "DAY_DISCUSSION" ? speaker_id : null}
                voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
              />
            </div>
          </section>

          <section className="panel mt-3 flex min-h-[24rem] flex-1 flex-col p-3">
            <div className="flex items-center gap-1">
              {(
                [
                  ["GLOBAL", t("chat.village")],
                  ...(myRole === "WOLF" ? [["WOLF_PRIVATE", t("chat.pack")] as const] : []),
                  ...(myRole === "DETECTIVE" ? [["DETECTIVE_PRIVATE", t("chat.operator")] as const] : []),
                ] as [typeof tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`display rounded-full px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase ${
                    tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="ms-auto flex items-center gap-1">
                {call.inCall && (
                  <button
                    onClick={call.toggleMute}
                    className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                      call.muted ? "border-border text-muted-foreground" : "border-primary text-primary"
                    }`}
                  >
                    {call.muted ? t("call.unmute") : t("call.mute")}
                  </button>
                )}
                <button
                  onClick={() => (call.inCall ? call.leave() : void call.join())}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    call.inCall
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {call.inCall ? t("call.live", { n: call.peerCount + 1 }) : t("call.join")}
                </button>
              </div>
            </div>
            {call.error === "mic" && (
              <p className="mt-1 text-[10px] text-destructive">{t("call.micDenied")}</p>
            )}
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <Chat
                roomId={roomId}
                channel={tab}
                messages={messages}
                players={players}
                meId={me.user_id}
                anonymous={tab === "WOLF_PRIVATE"}
                canWrite={me.is_alive}
                placeholder={tab === "WOLF_PRIVATE" ? t("chat.packPlaceholder") : t("chat.placeholder")}
                onSent={refresh}
                actionSlot={
                  <ActionSlot
                    t={t}
                    phase={phase}
                    players={players}
                    meId={me.user_id}
                    selectable={selectablePhase(phase, myRole, me.is_alive)}
                    selectedId={selectedTarget(phase, night, myVote)}
                    voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
                    onSelect={(id) => void run(() => performAction(roomId, phase, id))}
                    extra={
                      <>
                        {phase === "DAY_DISCUSSION" && isSpeaker && me.is_alive && (
                          <button
                            onClick={() => void run(() => api.passTurn(roomId))}
                            className="display w-full rounded-full border border-primary px-4 py-2 text-[11px] font-bold tracking-widest text-primary uppercase"
                          >
                            {t("room.pass")}
                          </button>
                        )}
                        {phase === "DAY_CONCLUSION" && me.is_alive && (
                          <>
                            <button
                              onClick={() => void run(() => api.readyToVote(roomId, !me.wants_vote))}
                              className={`display w-full rounded-full px-4 py-2 text-[11px] font-bold tracking-widest uppercase ${
                                me.wants_vote
                                  ? "border border-border text-muted-foreground"
                                  : "bg-primary text-primary-foreground"
                              }`}
                            >
                              {me.wants_vote ? t("room.cancelReadyVote") : t("room.readyVote")}
                            </button>
                            <p className="mt-1 text-center text-[10px] text-muted-foreground">
                              {t("room.readyVoteCount", {
                                n: state.wants_vote_count,
                                total: state.living_count,
                              })}
                            </p>
                          </>
                        )}
                      </>
                    }
                  />
                }
              />
            </div>
          </section>
        </>
      )}

      {actionError && <p className="mt-3 text-center text-sm text-destructive">{actionError}</p>}

      <footer className="mt-6 flex justify-between text-[11px] text-muted-foreground">
        <Link to="/">{t("nav.home")}</Link>
        <button onClick={() => void supabase.auth.signOut()}>{t("nav.signOut")}</button>
      </footer>

      {showRoleModal && myRole && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 py-8">
          <p className="display text-xs tracking-widest text-muted-foreground uppercase">
            {t("room.myCard")}
          </p>
          <div className="mt-3 w-56">
            <GameCard role={myRole} />
          </div>
          <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
            {t(`role.${myRole}.blurb`)}
          </p>
          <button
            onClick={() => {
              setCardOpen(false);
              if (!me.card_seen) void run(() => api.confirmCard(roomId));
            }}
            className="display mt-5 rounded-md bg-primary px-6 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase"
          >
            {me.card_seen ? t("room.close") : t("room.seenCard")}
          </button>
        </div>
      )}
    </main>
  );
}

function selectablePhase(
  phase: ReturnType<typeof String> | null,
  role: RoleKey | null,
  alive: boolean,
) {
  if (!alive) return false;
  if (phase === "NIGHT_WOLVES") return role === "WOLF";
  if (phase === "NIGHT_DETECTIVE") return role === "DETECTIVE";
  if (phase === "NIGHT_DOCTOR") return role === "DOCTOR";
  if (phase === "DAY_VOTING") return true;
  return false;
}

function selectedTarget(
  phase: string | null,
  night: { wolf_target: string | null; detective_target: string | null; doctor_target: string | null } | null,
  myVote: string | null,
) {
  if (phase === "NIGHT_WOLVES") return night?.wolf_target ?? null;
  if (phase === "NIGHT_DETECTIVE") return night?.detective_target ?? null;
  if (phase === "NIGHT_DOCTOR") return night?.doctor_target ?? null;
  if (phase === "DAY_VOTING") return myVote;
  return null;
}

async function performAction(roomId: string, phase: string | null, target: string) {
  if (phase === "NIGHT_WOLVES") return api.wolfVote(roomId, target);
  if (phase === "NIGHT_DETECTIVE") return api.detectiveCheck(roomId, target);
  if (phase === "NIGHT_DOCTOR") return api.doctorHeal(roomId, target);
  if (phase === "DAY_VOTING") return api.castVote(roomId, target);
}

function canWrite(
  channel: "GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE",
  phase: string | null,
  isSpeaker: boolean,
) {
  if (channel === "WOLF_PRIVATE") return phase === "NIGHT_WOLVES";
  if (channel === "DETECTIVE_PRIVATE") return true;
  if (phase === "DAY_DISCUSSION") return isSpeaker;
  if (phase === "DAY_CONCLUSION") return true;
  return phase === "DAY_VOTING";
}

function instructions(
  t: TFunc,
  phase: string | null,
  role: RoleKey | null,
  me: { is_alive: boolean; self_heal_used: boolean },
  isSpeaker: boolean,
) {
  if (!me.is_alive) return t("instr.dead");
  switch (phase) {
    case "NIGHT_WOLVES":
      return role === "WOLF" ? t("instr.wolf") : t("instr.sleepWolves");
    case "NIGHT_DETECTIVE":
      return role === "DETECTIVE" ? t("instr.detective") : t("instr.sleepDetective");
    case "NIGHT_DOCTOR":
      return role === "DOCTOR"
        ? me.self_heal_used
          ? t("instr.doctorUsed")
          : t("instr.doctor")
        : t("instr.sleepDoctor");
    case "NIGHT_RESULT":
      return t("instr.result");
    case "DAY_DISCUSSION":
      return isSpeaker ? t("instr.speaker") : t("instr.listen");
    case "DAY_CONCLUSION":
      return t("instr.conclusion");
    case "DAY_VOTING":
      return t("instr.voting");
    default:
      return "";
  }
}

export type { Player };
