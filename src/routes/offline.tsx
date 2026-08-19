import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/lib/theme";
import { LanguageSwitcher, useI18n, type TFunc } from "@/lib/i18n";
import { GameCard, ROLES, WolfSigil, type RoleKey } from "@/lib/roles";
import { PlayerGrid } from "@/components/PlayerGrid";
import { phaseKey, type Player } from "@/lib/game";
import {
  castVote,
  confirmCard,
  createOfflineGame,
  me as myself,
  passTurn,
  readyToVote,
  sendOfflineMessage,
  setNightTarget,
  speakerId as speakerOf,
  stepOffline,
  type OfflineMessage,
  type OfflineState,
} from "@/lib/offline";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "Wolf Night Offline — Play Solo Against Thinking Bots" },
      {
        name: "description",
        content:
          "No table, no problem: play Wolf Night offline against bots that reason, investigate, heal and vote on their own.",
      },
      { property: "og:title", content: "Wolf Night — Offline vs Bots" },
      {
        property: "og:description",
        content: "Solo social deduction against bots with their own minds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OfflinePage,
  ssr: false,
});

function renderMsg(t: TFunc, m: OfflineMessage) {
  if (m.text) return m.text;
  if (!m.key) return "";
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(m.vars ?? {})) {
    vars[k] = typeof v === "string" && v.startsWith("@") ? t(v.slice(1)) : v;
  }
  return t(m.key, vars);
}

function OfflinePage() {
  const { t } = useI18n();
  const [size, setSize] = useState(8);
  const [state, setState] = useState<OfflineState | null>(null);
  const [cardOpen, setCardOpen] = useState(true);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<OfflineMessage["channel"]>("GLOBAL");
  const [now, setNow] = useState(Date.now());
  const ref = useRef<OfflineState | null>(null);
  ref.current = state;

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (ref.current && ref.current.status === "IN_PROGRESS") {
        setState(stepOffline(ref.current));
      }
    }, 700);
    return () => clearInterval(id);
  }, []);

  if (!state) {
    return (
      <main className="mx-auto min-h-screen max-w-sm px-4 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WolfSigil className="h-7 w-9 text-primary" />
            <h1 className="display text-xl font-bold uppercase">{t("offline.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <p className="mt-4 text-sm text-muted-foreground">{t("offline.hint")}</p>
        <div className="panel mt-6 p-5">
          <label className="display text-xs font-bold tracking-widest uppercase" htmlFor="size">
            {t("offline.players")}
          </label>
          <div className="mt-3 flex items-center gap-3">
            <input
              id="size"
              type="range"
              min={6}
              max={15}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="flex-1 accent-[var(--primary)]"
            />
            <span className="display w-8 text-center text-2xl font-bold">{size}</span>
          </div>
          <button
            onClick={() => {
              setState(createOfflineGame(size, "YOU"));
              setCardOpen(true);
            }}
            className="display mt-5 w-full rounded-md bg-primary px-4 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase"
          >
            {t("offline.start")}
          </button>
        </div>
        <div className="mt-8 grid grid-cols-4 gap-2">
          {(Object.keys(ROLES) as RoleKey[]).map((r) => (
            <GameCard key={r} role={r} compact />
          ))}
        </div>
        <Link to="/" className="mt-8 block text-center text-xs text-muted-foreground underline">
          {t("nav.home")}
        </Link>
      </main>
    );
  }

  const meP = myself(state);
  const speaker = speakerOf(state);
  const isSpeaker = speaker === meP.id;
  const alive = state.players.filter((p) => p.alive);
  const finished = state.status === "FINISHED";
  const secondsLeft = state.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;
  const wantsVoteCount = alive.filter((p) => p.wantsVote).length;

  const players: Player[] = state.players.map((p) => ({
    user_id: p.id,
    username: p.name,
    avatar_url: p.avatar,
    is_ready: true,
    is_alive: p.alive,
    card_seen: p.seen,
    is_host: false,
    is_bot: p.isBot,
    wants_vote: p.wantsVote,
    role:
      p.id === meP.id || !p.alive || finished || (meP.role === "WOLF" && p.role === "WOLF")
        ? p.role
        : null,
  }));

  const voteCounts: Record<string, number> = {};
  for (const target of Object.values(state.votes))
    voteCounts[target] = (voteCounts[target] ?? 0) + 1;

  const selectable =
    meP.alive &&
    ((state.phase === "NIGHT_WOLVES" && meP.role === "WOLF") ||
      (state.phase === "NIGHT_DETECTIVE" && meP.role === "DETECTIVE") ||
      (state.phase === "NIGHT_DOCTOR" && meP.role === "DOCTOR") ||
      state.phase === "DAY_VOTING");

  const selectedId =
    state.phase === "NIGHT_WOLVES"
      ? state.night.wolf
      : state.phase === "NIGHT_DETECTIVE"
        ? state.night.detective
        : state.phase === "NIGHT_DOCTOR"
          ? state.night.doctor
          : state.phase === "DAY_VOTING"
            ? (state.votes[meP.id] ?? null)
            : null;

  const canWrite =
    meP.alive &&
    ((tab === "GLOBAL" &&
      (state.phase === "DAY_CONCLUSION" || (state.phase === "DAY_DISCUSSION" && isSpeaker))) ||
      (tab === "WOLF_PRIVATE" && state.phase === "NIGHT_WOLVES"));

  const list = state.messages.filter((m) => m.channel === tab);

  const showCard = !finished && (cardOpen || !meP.seen);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-5">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <WolfSigil className="h-6 w-8 text-primary" />
          <div>
            <p className="display text-lg leading-none font-bold uppercase">{t("offline.badge")}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("room.meta", { players: state.players.length, alive: alive.length })}
              {t("room.round", { n: state.round })}
            </p>
          </div>
        </div>
        <div className="text-end">
          <div className="flex items-center justify-end gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <p className="display mt-1 text-[10px] tracking-widest text-primary uppercase">
            {t(phaseKey(state.phase, state.status))}
          </p>
          {state.endsAt && !finished && state.phase !== "DAY_CONCLUSION" && (
            <p className="display text-2xl leading-none font-bold">{secondsLeft}s</p>
          )}
        </div>
      </header>

      {finished && (
        <section className="panel mt-5 p-4 text-center">
          <h2 className="display text-2xl font-bold uppercase">
            {state.winner === "WOLVES" ? t("room.wolvesWin") : t("room.townWin")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("room.revealed")}</p>
          <button
            onClick={() => setState(null)}
            className="display mt-4 rounded-md bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-primary-foreground uppercase"
          >
            {t("offline.restart")}
          </button>
        </section>
      )}

      <section className="panel mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="display text-sm font-bold tracking-widest uppercase">{t("room.table")}</h2>
          <button
            onClick={() => setCardOpen(true)}
            className="display text-[10px] tracking-widest uppercase"
            style={{ color: ROLES[meP.role].tone }}
          >
            {t("room.youAre", { role: t(`role.${meP.role}.label`) })}
          </button>
        </div>
        <div className="mt-3">
          <PlayerGrid
            players={players}
            meId={meP.id}
            speakerId={state.phase === "DAY_DISCUSSION" ? speaker : null}
            voteCounts={state.phase === "DAY_VOTING" ? voteCounts : {}}
            selectable={selectable}
            selectedId={selectedId}
            onSelect={(id) => {
              if (!ref.current) return;
              const s = ref.current;
              if (s.phase === "DAY_VOTING") castVote(s, id);
              else setNightTarget(s, id);
              setState({ ...s });
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {instruction(t, state.phase, meP.role, meP.alive, meP.selfHealUsed, isSpeaker)}
        </p>

        {state.phase === "DAY_DISCUSSION" && isSpeaker && meP.alive && (
          <button
            onClick={() => {
              if (!ref.current) return;
              passTurn(ref.current);
              setState({ ...ref.current });
            }}
            className="display mt-3 w-full rounded-md border border-primary px-4 py-2.5 text-xs font-bold tracking-widest text-primary uppercase"
          >
            {t("room.pass")}
          </button>
        )}

        {state.phase === "DAY_CONCLUSION" && meP.alive && (
          <>
            <button
              onClick={() => {
                if (!ref.current) return;
                readyToVote(ref.current, !meP.wantsVote);
                setState({ ...ref.current });
              }}
              className={`display mt-3 w-full rounded-md px-4 py-2.5 text-xs font-bold tracking-widest uppercase ${
                meP.wantsVote
                  ? "border border-border text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {meP.wantsVote ? t("room.cancelReadyVote") : t("room.readyVote")}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {t("room.readyVoteCount", { n: wantsVoteCount, total: alive.length })}
            </p>
          </>
        )}
      </section>

      <section className="panel mt-4 flex min-h-[20rem] flex-1 flex-col p-4">
        <div className="flex gap-1">
          {(
            [
              ["GLOBAL", t("chat.village")],
              ...(meP.role === "WOLF" ? [["WOLF_PRIVATE", t("chat.pack")] as const] : []),
              ...(meP.role === "DETECTIVE"
                ? [["DETECTIVE_PRIVATE", t("chat.operator")] as const]
                : []),
            ] as [OfflineMessage["channel"], string][]
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

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {list.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("chat.empty")}</p>
          )}
          {list.map((m) => {
            const system = m.sender_id === null;
            const author = system
              ? t("chat.operatorName")
              : tab === "WOLF_PRIVATE"
                ? t("chat.wolfName")
                : (state.players.find((p) => p.id === m.sender_id)?.name ?? "PLAYER");
            return (
              <div
                key={m.id}
                className={`rounded-md px-3 py-2 text-sm ${
                  system ? "border border-primary/40 bg-primary/10" : "bg-secondary"
                }`}
              >
                <p className="display text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  {author}
                </p>
                <p className="mt-0.5 break-words">{renderMsg(t, m)}</p>
              </div>
            );
          })}
        </div>

        {canWrite ? (
          <div className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !text.trim() || !ref.current) return;
                sendOfflineMessage(ref.current, tab, text.trim());
                setText("");
                setState({ ...ref.current });
              }}
              placeholder={
                tab === "WOLF_PRIVATE" ? t("chat.packPlaceholder") : t("chat.placeholder")
              }
              className="min-w-0 flex-1 rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (!text.trim() || !ref.current) return;
                sendOfflineMessage(ref.current, tab, text.trim());
                setText("");
                setState({ ...ref.current });
              }}
              className="display shrink-0 rounded-md bg-primary px-3 py-2 text-[11px] font-bold tracking-widest text-primary-foreground uppercase"
            >
              {t("chat.send")}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {meP.alive ? t("instr.listen") : t("chat.spectator")}
          </p>
        )}
      </section>

      <Link to="/" className="mt-5 text-center text-[11px] text-muted-foreground underline">
        {t("nav.home")}
      </Link>

      {showCard && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 py-8">
          <p className="display text-xs tracking-widest text-muted-foreground uppercase">
            {t("room.myCard")}
          </p>
          <div className="mt-3 w-56">
            <GameCard role={meP.role} />
          </div>
          <p className="mt-4 max-w-xs text-center text-sm text-muted-foreground">
            {t(`role.${meP.role}.blurb`)}
          </p>
          <button
            onClick={() => {
              setCardOpen(false);
              if (!meP.seen && ref.current) {
                confirmCard(ref.current);
                setState({ ...ref.current });
              }
            }}
            className="display mt-5 rounded-md bg-primary px-6 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase"
          >
            {meP.seen ? t("room.close") : t("room.seenCard")}
          </button>
        </div>
      )}
    </main>
  );
}

function instruction(
  t: TFunc,
  phase: OfflineState["phase"],
  role: RoleKey,
  alive: boolean,
  selfHealUsed: boolean,
  isSpeaker: boolean,
) {
  if (!alive) return t("instr.dead");
  switch (phase) {
    case "NIGHT_WOLVES":
      return role === "WOLF" ? t("instr.wolf") : t("instr.sleepWolves");
    case "NIGHT_DETECTIVE":
      return role === "DETECTIVE" ? t("instr.detective") : t("instr.sleepDetective");
    case "NIGHT_DOCTOR":
      return role === "DOCTOR"
        ? selfHealUsed
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
