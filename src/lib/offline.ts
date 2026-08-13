import type { RoleKey } from "./roles";
import type { Phase } from "./game";

export type OfflineMessage = {
  id: string;
  sender_id: string | null;
  key?: string;
  vars?: Record<string, string | number>;
  text?: string;
  channel: "GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE";
};

export type OfflinePlayer = {
  id: string;
  name: string;
  avatar: string;
  role: RoleKey;
  alive: boolean;
  isBot: boolean;
  seen: boolean;
  wantsVote: boolean;
  selfHealUsed: boolean;
  /** bot mind: ids it believes are wolves, and ids it trusts */
  knownWolves: string[];
  cleared: string[];
  suspicion: Record<string, number>;
};

export type OfflineState = {
  players: OfflinePlayer[];
  meId: string;
  status: "IN_PROGRESS" | "FINISHED";
  phase: Phase;
  round: number;
  endsAt: number | null;
  speakerIndex: number;
  messages: OfflineMessage[];
  votes: Record<string, string>;
  night: { wolf: string | null; detective: string | null; doctor: string | null };
  winner: "WOLVES" | "TOWN" | null;
  spoken: string[];
};

const ROLE_TABLE: Record<number, [number, number, number]> = {
  6: [1, 1, 1],
  7: [1, 1, 1],
  8: [2, 1, 1],
  9: [2, 1, 1],
  10: [3, 1, 1],
  11: [3, 2, 1],
  12: [3, 2, 1],
  13: [4, 2, 1],
  14: [4, 2, 2],
  15: [5, 2, 2],
};

const BOT_NAMES = [
  "NOVA", "RIGEL", "ORION", "ZETA", "VEGA", "ATLAS",
  "LYRA", "CASSI", "DRACO", "MIRA", "PAVO", "JUNO", "ARES", "ECHO",
];

const uid = () => Math.random().toString(36).slice(2, 10);
const avatarOf = (seed: string, bot: boolean) =>
  `https://api.dicebear.com/9.x/${bot ? "bottts-neutral" : "notionists-neutral"}/svg?seed=${seed}&backgroundColor=1f1f22`;
const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);
const pick = <T,>(a: T[]): T | undefined => a[Math.floor(Math.random() * a.length)];

function say(s: OfflineState, sender: string | null, key: string, vars?: Record<string, string | number>) {
  s.messages.push({ id: uid(), sender_id: sender, key, ...(vars ? { vars } : {}), channel: "GLOBAL" });
}

export function createOfflineGame(total: number, myName: string): OfflineState {
  const size = Math.min(15, Math.max(6, total));
  const [wolves, doctors, detectives] = ROLE_TABLE[size]!;
  const meId = uid();
  const names = shuffle(BOT_NAMES).slice(0, size - 1);
  const players: OfflinePlayer[] = [
    {
      id: meId,
      name: myName || "YOU",
      avatar: avatarOf(myName || "you", false),
      role: "CIVILIAN",
      alive: true,
      isBot: false,
      seen: false,
      wantsVote: false,
      selfHealUsed: false,
      knownWolves: [],
      cleared: [],
      suspicion: {},
    },
    ...names.map((n) => ({
      id: uid(),
      name: `BOT ${n}`,
      avatar: avatarOf(n, true),
      role: "CIVILIAN" as RoleKey,
      alive: true,
      isBot: true,
      seen: true,
      wantsVote: false,
      selfHealUsed: false,
      knownWolves: [] as string[],
      cleared: [] as string[],
      suspicion: {} as Record<string, number>,
    })),
  ];

  const order = shuffle(players.map((p) => p.id));
  const roleOf: Record<string, RoleKey> = {};
  order.forEach((id, i) => {
    roleOf[id] =
      i < wolves
        ? "WOLF"
        : i < wolves + doctors
          ? "DOCTOR"
          : i < wolves + doctors + detectives
            ? "DETECTIVE"
            : "CIVILIAN";
  });
  for (const p of players) p.role = roleOf[p.id]!;
  // wolves know each other
  const wolfIds = players.filter((p) => p.role === "WOLF").map((p) => p.id);
  for (const p of players) if (p.role === "WOLF") p.knownWolves = wolfIds.filter((i) => i !== p.id);

  const s: OfflineState = {
    players: shuffle(players),
    meId,
    status: "IN_PROGRESS",
    phase: "ROLE_DISTRIBUTION",
    round: 1,
    endsAt: null,
    speakerIndex: 0,
    messages: [],
    votes: {},
    night: { wolf: null, detective: null, doctor: null },
    winner: null,
    spoken: [],
  };
  say(s, null, "op.dealt");
  return s;
}

const living = (s: OfflineState) => s.players.filter((p) => p.alive);
const byId = (s: OfflineState, id: string) => s.players.find((p) => p.id === id);
export const me = (s: OfflineState) => byId(s, s.meId)!;
export const speakerId = (s: OfflineState) => living(s)[s.speakerIndex]?.id ?? null;

function beginNight(s: OfflineState, round: number) {
  s.round = round;
  s.phase = "NIGHT_WOLVES";
  s.endsAt = Date.now() + 30_000;
  s.night = { wolf: null, detective: null, doctor: null };
  s.votes = {};
  s.spoken = [];
  for (const p of s.players) p.wantsVote = false;
  say(s, null, "op.night", { n: round });
}

export function confirmCard(s: OfflineState) {
  me(s).seen = true;
  if (s.phase === "ROLE_DISTRIBUTION") beginNight(s, s.round);
}

function checkWin(s: OfflineState): "WOLVES" | "TOWN" | null {
  const alive = living(s);
  const wolves = alive.filter((p) => p.role === "WOLF").length;
  const town = alive.length - wolves;
  if (wolves === 0) return "TOWN";
  if (wolves >= town) return "WOLVES";
  return null;
}

function finishOrNext(s: OfflineState) {
  const w = checkWin(s);
  if (w) {
    s.status = "FINISHED";
    s.winner = w;
    s.endsAt = null;
    say(s, null, w === "WOLVES" ? "op.wolvesWin" : "op.townWin");
  } else {
    beginNight(s, s.round + 1);
  }
}

function resolveNight(s: OfflineState) {
  const target = s.night.wolf ? byId(s, s.night.wolf) : null;
  if (!target) {
    say(s, null, "op.noKill");
  } else {
    const saved = s.night.doctor === target.id;
    say(s, null, "op.killed", { name: target.name.toUpperCase(), saved: "" });
    s.messages[s.messages.length - 1]!.vars = {
      name: target.name.toUpperCase(),
      saved: saved ? "@op.saved" : "@op.notSaved",
    };
    if (!saved) target.alive = false;
  }
  s.phase = "NIGHT_RESULT";
  s.endsAt = Date.now() + 8_000;
}

function resolveVotes(s: OfflineState) {
  const counts: Record<string, number> = {};
  for (const t of Object.values(s.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    say(s, null, "op.noVotes");
  } else if (entries.length > 1 && entries[0]![1] === entries[1]![1]) {
    say(s, null, "op.tie");
  } else {
    const victim = byId(s, entries[0]![0])!;
    victim.alive = false;
    say(s, null, "op.eliminated", { name: victim.name.toUpperCase() });
    // bot minds learn from the reveal
    for (const b of s.players) {
      if (!b.isBot) continue;
      if (victim.role === "WOLF") b.knownWolves = b.knownWolves.filter((i) => i !== victim.id);
      else b.cleared.push(victim.id);
    }
  }
  finishOrNext(s);
}

function openVoting(s: OfflineState) {
  s.phase = "DAY_VOTING";
  s.endsAt = Date.now() + 60_000;
  say(s, null, "op.votingOpen");
}

export function readyToVote(s: OfflineState, ready: boolean) {
  if (s.phase !== "DAY_CONCLUSION" && s.phase !== "DAY_DISCUSSION") return;
  me(s).wantsVote = ready;
  maybeOpenVoting(s);
}

function maybeOpenVoting(s: OfflineState) {
  const alive = living(s);
  if (alive.filter((p) => p.wantsVote).length * 2 > alive.length) openVoting(s);
}

export function setNightTarget(s: OfflineState, targetId: string): string | null {
  const meP = me(s);
  if (!meP.alive) return null;
  if (s.phase === "NIGHT_WOLVES" && meP.role === "WOLF") {
    s.night.wolf = targetId;
    return null;
  }
  if (s.phase === "NIGHT_DETECTIVE" && meP.role === "DETECTIVE" && !s.night.detective) {
    s.night.detective = targetId;
    const target = byId(s, targetId)!;
    s.messages.push({
      id: uid(),
      sender_id: meP.id,
      key: "op.isWolf",
      vars: { name: target.name },
      channel: "DETECTIVE_PRIVATE",
    });
    s.messages.push({
      id: uid(),
      sender_id: null,
      key: target.role === "WOLF" ? "op.yes" : "op.no",
      channel: "DETECTIVE_PRIVATE",
    });
    return target.role === "WOLF" ? "WOLF" : "NOT_WOLF";
  }
  if (s.phase === "NIGHT_DOCTOR" && meP.role === "DOCTOR") {
    if (targetId === meP.id) {
      if (meP.selfHealUsed) return null;
      meP.selfHealUsed = true;
    }
    s.night.doctor = targetId;
  }
  return null;
}

export function castVote(s: OfflineState, targetId: string) {
  if (s.phase !== "DAY_VOTING" || !me(s).alive) return;
  s.votes[s.meId] = targetId;
  for (const b of s.players) {
    if (b.isBot && b.alive) b.suspicion[targetId] = (b.suspicion[targetId] ?? 0) + 0.5;
  }
}

export function sendOfflineMessage(
  s: OfflineState,
  channel: OfflineMessage["channel"],
  text: string,
) {
  s.messages.push({ id: uid(), sender_id: s.meId, text, channel });
  // bots react to who talks a lot
  for (const b of s.players) {
    if (b.isBot && b.alive && Math.random() < 0.3) {
      b.suspicion[s.meId] = (b.suspicion[s.meId] ?? 0) + 0.2;
    }
  }
}

export function passTurn(s: OfflineState) {
  if (s.phase === "DAY_DISCUSSION" && speakerId(s) === s.meId) s.endsAt = Date.now() - 1;
}

/* ---------------- bot minds ---------------- */

function botTarget(s: OfflineState, bot: OfflinePlayer): string | undefined {
  const alive = living(s).filter((p) => p.id !== bot.id);
  if (bot.role === "WOLF") {
    const prey = alive.filter((p) => p.role !== "WOLF");
    // wolves prefer power roles they suspect, otherwise the loudest human
    const known = prey.filter((p) => bot.suspicion[p.id]);
    return (pick(known) ?? pick(prey))?.id;
  }
  const suspects = alive.filter((p) => bot.knownWolves.includes(p.id));
  if (suspects.length) return pick(suspects)!.id;
  const ranked = alive
    .filter((p) => !bot.cleared.includes(p.id))
    .sort((a, b) => (bot.suspicion[b.id] ?? 0) - (bot.suspicion[a.id] ?? 0));
  return (ranked[0] ?? pick(alive))?.id;
}

function botsAct(s: OfflineState) {
  const alive = living(s);
  if (s.phase === "NIGHT_WOLVES") {
    const wolfBots = alive.filter((p) => p.isBot && p.role === "WOLF");
    const humanWolfAlive = alive.some((p) => !p.isBot && p.role === "WOLF");
    if (wolfBots.length && !s.night.wolf && !humanWolfAlive) {
      s.night.wolf = botTarget(s, pick(wolfBots)!) ?? null;
      s.endsAt = Math.min(s.endsAt ?? Infinity, Date.now() + 1500);
    }
    return;
  }
  if (s.phase === "NIGHT_DETECTIVE") {
    const det = alive.find((p) => p.isBot && p.role === "DETECTIVE");
    const humanDet = alive.some((p) => !p.isBot && p.role === "DETECTIVE");
    if (det && !s.night.detective && !humanDet) {
      const t = botTarget(s, det);
      s.night.detective = t ?? null;
      if (t) {
        const target = byId(s, t)!;
        if (target.role === "WOLF") det.knownWolves.push(t);
        else det.cleared.push(t);
      }
      s.endsAt = Math.min(s.endsAt ?? Infinity, Date.now() + 1500);
    }
    return;
  }
  if (s.phase === "NIGHT_DOCTOR") {
    const doc = alive.find((p) => p.isBot && p.role === "DOCTOR");
    const humanDoc = alive.some((p) => !p.isBot && p.role === "DOCTOR");
    if (doc && !s.night.doctor && !humanDoc) {
      const safe = alive.filter((p) => p.id !== doc.id || !doc.selfHealUsed);
      const t = pick(safe.filter((p) => !doc.knownWolves.includes(p.id))) ?? pick(safe);
      if (t) {
        if (t.id === doc.id) doc.selfHealUsed = true;
        s.night.doctor = t.id;
      }
      s.endsAt = Math.min(s.endsAt ?? Infinity, Date.now() + 1500);
    }
    return;
  }
  if (s.phase === "DAY_DISCUSSION") {
    const sp = speakerId(s);
    const bot = sp ? byId(s, sp) : null;
    if (bot?.isBot && !s.spoken.includes(bot.id)) {
      s.spoken.push(bot.id);
      const suspect = botTarget(s, bot);
      const line = `bot.line${1 + Math.floor(Math.random() * 6)}`;
      s.messages.push({ id: uid(), sender_id: bot.id, key: line, channel: "GLOBAL" });
      if (suspect) bot.suspicion[suspect] = (bot.suspicion[suspect] ?? 0) + 0.3;
      s.endsAt = Date.now() + 2500;
    }
    return;
  }
  if (s.phase === "DAY_CONCLUSION") {
    let changed = false;
    for (const b of alive) {
      if (b.isBot && !b.wantsVote && Math.random() < 0.5) {
        b.wantsVote = true;
        changed = true;
      }
    }
    if (changed) maybeOpenVoting(s);
    return;
  }
  if (s.phase === "DAY_VOTING") {
    for (const b of alive) {
      if (!b.isBot || s.votes[b.id]) continue;
      const t = botTarget(s, b);
      if (t) s.votes[b.id] = t;
    }
    if (alive.every((p) => s.votes[p.id])) s.endsAt = Math.min(s.endsAt ?? Infinity, Date.now() + 1500);
    return;
  }
}

/** Advance the local game. Call on an interval. */
export function stepOffline(s: OfflineState): OfflineState {
  if (s.status !== "IN_PROGRESS") return s;
  botsAct(s);

  if (s.endsAt !== null && s.endsAt <= Date.now()) {
    switch (s.phase) {
      case "NIGHT_WOLVES": {
        if (living(s).some((p) => p.role === "DETECTIVE")) {
          s.phase = "NIGHT_DETECTIVE";
          s.endsAt = Date.now() + 30_000;
        } else if (living(s).some((p) => p.role === "DOCTOR")) {
          s.phase = "NIGHT_DOCTOR";
          s.endsAt = Date.now() + 30_000;
        } else resolveNight(s);
        break;
      }
      case "NIGHT_DETECTIVE": {
        if (living(s).some((p) => p.role === "DOCTOR")) {
          s.phase = "NIGHT_DOCTOR";
          s.endsAt = Date.now() + 30_000;
        } else resolveNight(s);
        break;
      }
      case "NIGHT_DOCTOR":
        resolveNight(s);
        break;
      case "NIGHT_RESULT": {
        if (checkWin(s)) finishOrNext(s);
        else {
          s.phase = "DAY_DISCUSSION";
          s.speakerIndex = 0;
          s.spoken = [];
          for (const p of s.players) p.wantsVote = false;
          s.endsAt = Date.now() + 60_000;
          say(s, null, "op.day", { n: s.round });
        }
        break;
      }
      case "DAY_DISCUSSION": {
        if (s.speakerIndex + 1 >= living(s).length) {
          s.phase = "DAY_CONCLUSION";
          s.endsAt = Date.now() + 300_000;
          say(s, null, "op.conclusion");
        } else {
          s.speakerIndex += 1;
          s.endsAt = Date.now() + 60_000;
        }
        break;
      }
      case "DAY_CONCLUSION":
        openVoting(s);
        break;
      case "DAY_VOTING":
        resolveVotes(s);
        break;
      default:
        break;
    }
  }
  return { ...s };
}
