import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useCountdown, useRoom } from "@/hooks/useRoom";
import { api, phaseLabel, type Player } from "@/lib/game";
import { GameCard, ROLES, WolfSigil, type RoleKey } from "@/lib/roles";
import { PlayerGrid } from "@/components/PlayerGrid";
import { Chat } from "@/components/Chat";

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
  const { state, messages, error, refresh } = useRoom(roomId);
  const secondsLeft = useCountdown(state?.room.phase_ends_at);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [tab, setTab] = useState<"GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE">("GLOBAL");

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
            <p className="display text-lg leading-none font-bold uppercase">Room {code}</p>
            <p className="text-[11px] text-muted-foreground">
              {players.length} players · {living.length} alive
              {room.round_number > 0 ? ` · round ${room.round_number}` : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="display text-xs tracking-widest text-primary uppercase">
            {phaseLabel(phase, room.status)}
          </p>
          {room.phase_ends_at && room.status === "IN_PROGRESS" && (
            <p className="display text-2xl leading-none font-bold">{secondsLeft}s</p>
          )}
        </div>
      </header>

      {room.status === "LOBBY" && (
        <section className="panel mt-5 p-4">
          <h2 className="display text-sm font-bold tracking-widest uppercase">Lobby</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Share code <span className="display tracking-[0.3em] text-foreground">{code}</span>. Needs
            6-15 ready players.
          </p>
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
            {me.is_ready ? "Cancel ready" : "I'm ready"}
          </button>
          {me.is_host && (
            <button
              onClick={() => void run(() => api.startGame(roomId))}
              disabled={players.length < 6 || players.some((p) => !p.is_ready)}
              className="display mt-2 w-full rounded-md border border-primary px-4 py-3 text-sm font-bold tracking-widest text-primary uppercase disabled:opacity-40"
            >
              Start game
            </button>
          )}
        </section>
      )}

      {room.status === "FINISHED" && (
        <section className="panel mt-5 p-4 text-center">
          <h2 className="display text-2xl font-bold uppercase">
            {room.winner === "WOLVES" ? "The wolves win" : "The town wins"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">All cards are revealed below.</p>
          <div className="mt-4">
            <PlayerGrid players={players} meId={me.user_id} />
          </div>
          <Link to="/" className="display mt-4 inline-block text-xs tracking-widest underline uppercase">
            Back home
          </Link>
        </section>
      )}

      {room.status === "IN_PROGRESS" && (
        <>
          {phase === "ROLE_DISTRIBUTION" && (
            <section className="panel mt-5 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Waiting for everyone to confirm their card (
                {players.filter((p) => p.card_seen).length}/{players.length}).
              </p>
              {me.card_seen && (
                <button
                  onClick={() => setCardOpen(true)}
                  className="display mt-3 text-xs tracking-widest text-primary underline uppercase"
                >
                  Show my card again
                </button>
              )}
            </section>
          )}

          <section className="panel mt-5 p-4">
            <div className="flex items-center justify-between">
              <h2 className="display text-sm font-bold tracking-widest uppercase">The table</h2>
              {myRole && (
                <button
                  onClick={() => setCardOpen(true)}
                  className="display text-[10px] tracking-widest uppercase"
                  style={{ color: ROLES[myRole].tone }}
                >
                  You are {ROLES[myRole].label}
                </button>
              )}
            </div>
            <div className="mt-3">
              <PlayerGrid
                players={players}
                meId={me.user_id}
                speakerId={phase === "DAY_DISCUSSION" ? speaker_id : null}
                voteCounts={phase === "DAY_VOTING" ? voteCounts : {}}
                selectable={selectablePhase(phase, myRole, me.is_alive)}
                selectedId={selectedTarget(phase, night, myVote)}
                onSelect={(id) => void run(() => performAction(roomId, phase, id))}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{instructions(phase, myRole, me, isSpeaker)}</p>
            {phase === "DAY_DISCUSSION" && isSpeaker && me.is_alive && (
              <button
                onClick={() => void run(() => api.passTurn(roomId))}
                className="display mt-3 w-full rounded-md border border-primary px-4 py-2.5 text-xs font-bold tracking-widest text-primary uppercase"
              >
                Pass my turn
              </button>
            )}
          </section>

          <section className="panel mt-4 flex min-h-[22rem] flex-1 flex-col p-4">
            <div className="flex gap-1">
              {(
                [
                  ["GLOBAL", "Village"],
                  ...(myRole === "WOLF" ? [["WOLF_PRIVATE", "Pack"] as const] : []),
                  ...(myRole === "DETECTIVE" ? [["DETECTIVE_PRIVATE", "Operator"] as const] : []),
                ] as [typeof tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`display rounded-md px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase ${
                    tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <Chat
                roomId={roomId}
                channel={tab}
                messages={messages}
                players={players}
                anonymous={tab === "WOLF_PRIVATE"}
                canWrite={me.is_alive && canWrite(tab, phase, isSpeaker)}
                allowVoice={tab === "GLOBAL" && phase === "DAY_DISCUSSION" && isSpeaker}
                placeholder={tab === "WOLF_PRIVATE" ? "Anonymous pack chat…" : "Say something…"}
                onSent={refresh}
              />
            </div>
          </section>
        </>
      )}

      {actionError && <p className="mt-3 text-center text-sm text-destructive">{actionError}</p>}

      <footer className="mt-6 flex justify-between text-[11px] text-muted-foreground">
        <Link to="/">Home</Link>
        <button onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </footer>

      {showRoleModal && myRole && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 py-8">
          <p className="display text-xs tracking-widest text-muted-foreground uppercase">
            Your secret card
          </p>
          <div className="mt-3 w-56">
            <GameCard role={myRole} />
          </div>
          <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
            {ROLES[myRole].blurb}
          </p>
          <button
            onClick={() => {
              setCardOpen(false);
              if (!me.card_seen) void run(() => api.confirmCard(roomId));
            }}
            className="display mt-5 rounded-md bg-primary px-6 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase"
          >
            {me.card_seen ? "Close" : "I've seen my card"}
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
  return phase === "DAY_VOTING";
}

function instructions(
  phase: string | null,
  role: RoleKey | null,
  me: { is_alive: boolean; self_heal_used: boolean },
  isSpeaker: boolean,
) {
  if (!me.is_alive) return "You are dead. You can watch and read, but not speak or vote.";
  switch (phase) {
    case "NIGHT_WOLVES":
      return role === "WOLF"
        ? "Pick your target — the pack chat is anonymous. The last locked pick counts."
        : "The village sleeps. The wolves are choosing.";
    case "NIGHT_DETECTIVE":
      return role === "DETECTIVE"
        ? "Pick one player. The operator answers Yes or No privately."
        : "The village sleeps. The detective is investigating.";
    case "NIGHT_DOCTOR":
      return role === "DOCTOR"
        ? me.self_heal_used
          ? "Heal any living player. Your self-heal is already used."
          : "Heal any living player — you may pick yourself once per game."
        : "The village sleeps. The doctor is choosing.";
    case "NIGHT_RESULT":
      return "The operator is announcing the night.";
    case "DAY_DISCUSSION":
      return isSpeaker
        ? "It's your minute: type, record a voice note, or pass."
        : "Listen. You'll get your own minute to accuse or defend.";
    case "DAY_VOTING":
      return "Tap a player to vote. You can change your vote until time runs out.";
    default:
      return "";
  }
}

export type { Player };