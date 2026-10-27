import { useEffect, useState } from "react";
import type { ChatMessage, Player } from "@/lib/game";
import t5 from "@/assets/table-5.jpg.asset.json";
import t6 from "@/assets/table-6.jpg.asset.json";
import t7 from "@/assets/table-7.jpg.asset.json";
import t8 from "@/assets/table-8.jpg.asset.json";
import t9 from "@/assets/table-9.jpg.asset.json";
import t10 from "@/assets/table-10.jpg.asset.json";
import t11 from "@/assets/table-11.jpg.asset.json";
import t12 from "@/assets/table-12.jpg.asset.json";
import t13 from "@/assets/table-13.jpg.asset.json";
import t14 from "@/assets/table-14.jpg.asset.json";
import t15 from "@/assets/table-15.jpg.asset.json";

const TABLES: Record<number, string> = {
  5: t5.url, 6: t6.url, 7: t7.url, 8: t8.url, 9: t9.url, 10: t10.url,
  11: t11.url, 12: t12.url, 13: t13.url, 14: t14.url, 15: t15.url,
};

/** Seats around an ellipse, starting at the top, clockwise. Values are % of the box. */
export function seatPositions(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: 50 + 40 * Math.cos(a), y: 50 + 38 * Math.sin(a) };
  });
}

const BUBBLE_MS = 8000;

/** Name sits beside the seat, one step along the table edge (no avatar, no badge). */
function nameOffset(i: number, n: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const dx = -Math.sin(a) * 3.4;
  const dy = Math.cos(a) * 1.6;
  return `translate(calc(-50% + ${dx.toFixed(2)}rem), calc(-50% + ${dy.toFixed(2)}rem))`;
}

export function SeatTable({
  players,
  meId,
  messages,
  selectable,
  selectedId,
  speakerId,
  voteCounts = {},
  onSelect,
  variant = "day",
}: {
  players: Player[];
  meId: string;
  messages: ChatMessage[];
  selectable?: boolean;
  selectedId?: string | null;
  speakerId?: string | null;
  voteCounts?: Record<string, number>;
  onSelect?: (p: Player) => void;
  variant?: "day" | "night";
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const n = Math.min(15, Math.max(5, players.length));
  const pos = seatPositions(players.length);

  const latest: Record<string, ChatMessage> = {};
  for (const m of messages) {
    if (m.channel !== "GLOBAL" || !m.sender_id) continue;
    latest[m.sender_id] = m;
  }

  return (
    <div className="relative mx-auto aspect-[9/14] w-full overflow-hidden bg-black">
      <img
        src={TABLES[n]}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover object-[50%_58%] ${
          variant === "night" ? "brightness-[0.55] saturate-[0.8]" : ""
        }`}
        loading="eager"
        decoding="async"
      />
      {players.map((p, i) => {
        const pt = pos[i]!;
        const msg = latest[p.user_id];
        const fresh = msg && now - new Date(msg.created_at).getTime() < BUBBLE_MS;
        const isMe = p.user_id === meId;
        const sel = selectedId === p.user_id;
        const speaking = speakerId === p.user_id;
        return (
          <div
            key={p.user_id}
            className="absolute"
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
          >
            {variant === "night" && speaking && (
              <span className="pointer-events-none absolute left-0 top-0 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f0e2c4]/25 blur-2xl" />
            )}
            {fresh && (
              <div className="absolute bottom-full left-0 mb-3 w-max max-w-[10rem] -translate-x-1/2 animate-in fade-in zoom-in-95 rounded-2xl bg-[#efe4cf] px-3 py-2 text-xs font-medium leading-snug text-[#111] shadow-lg">
                {msg.content ?? "..."}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-[#efe4cf]" />
              </div>
            )}
            <button
              type="button"
              disabled={!selectable || !p.is_alive}
              onClick={() => onSelect?.(p)}
              style={{ transform: nameOffset(i, players.length) }}
              className={`absolute left-0 top-0 whitespace-nowrap text-[13px] font-semibold text-[#efe4cf] [text-shadow:0_1px_6px_#000,0_0_3px_#000] transition ${
                p.is_alive ? "" : "line-through opacity-50"
              } ${sel ? "text-[#ff9aa0] underline underline-offset-4" : ""} ${
                selectable && p.is_alive ? "cursor-pointer" : ""
              }`}
            >
              {isMe ? `${p.username} •` : p.username}
              {voteCounts[p.user_id] ? ` · ${voteCounts[p.user_id]}` : ""}
            </button>
          </div>
        );
      })}
    </div>
  );
}
