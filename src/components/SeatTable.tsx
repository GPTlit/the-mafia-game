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

export function SeatTable({
  players,
  meId,
  messages,
  selectable,
  selectedId,
  speakerId,
  voteCounts = {},
  onSelect,
}: {
  players: Player[];
  meId: string;
  messages: ChatMessage[];
  selectable?: boolean;
  selectedId?: string | null;
  speakerId?: string | null;
  voteCounts?: Record<string, number>;
  onSelect?: (p: Player) => void;
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
    <div className="relative mx-auto aspect-[9/14] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card">
      <img
        src={TABLES[n]}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[50%_58%] scale-[1.15]"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-background/10" />
      {players.map((p, i) => {
        const pt = pos[i]!;
        const msg = latest[p.user_id];
        const fresh = msg && now - new Date(msg.created_at).getTime() < BUBBLE_MS;
        const isMe = p.user_id === meId;
        const sel = selectedId === p.user_id;
        return (
          <div
            key={p.user_id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
          >
            {fresh && (
              <div className="absolute bottom-full left-1/2 mb-1 w-max max-w-[9rem] -translate-x-1/2 animate-in fade-in zoom-in-95 rounded-2xl bg-paper px-2.5 py-1.5 text-[11px] font-medium leading-snug text-paper-foreground shadow-lg">
                {msg.content ?? "..."}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-paper" />
              </div>
            )}
            <button
              type="button"
              disabled={!selectable || !p.is_alive}
              onClick={() => onSelect?.(p)}
              className={`flex flex-col items-center gap-0.5 rounded-full transition ${
                p.is_alive ? "" : "opacity-40 grayscale"
              } ${selectable && p.is_alive ? "cursor-pointer hover:scale-105" : ""}`}
            >
              <span
                className={`block h-9 w-9 overflow-hidden rounded-full border-2 bg-secondary ${
                  sel
                    ? "border-primary ring-2 ring-primary/60"
                    : speakerId === p.user_id
                      ? "border-accent ring-2 ring-accent/60"
                      : isMe
                        ? "border-foreground/70"
                        : "border-border"
                }`}
              >
                {p.avatar_url && (
                  <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="max-w-[5.5rem] truncate rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                {p.username}
                {voteCounts[p.user_id] ? ` · ${voteCounts[p.user_id]}` : ""}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
