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

/** Exact head positions (% of the picture) measured from each supplied table design. */
const SEATS: Record<number, [number, number][]> = {
  5: [[50,30],[85,42],[86,57],[12,58],[12,41]],
  6: [[49,28],[89,42],[88,54],[48,72],[9,54],[10,42]],
  7: [[50,25],[85,35],[87,49],[85,67],[13,66],[14,49],[14,37]],
  8: [[87,33],[87,44],[87,56],[86,66],[10,66],[11,55],[10,43],[12,32]],
  9: [[50,28],[86,36],[86,45],[86,54],[85,64],[13,65],[13,56],[13,46],[12,36]],
  10: [[50,28],[86,36],[86,45],[86,54],[85,64],[55,72],[13,65],[13,56],[13,46],[12,36]],
  11: [[49,31],[87,36],[87,45],[87,54],[87,63],[59,73],[37,73],[11,63],[11,54],[11,45],[11,35]],
  12: [[51,26],[83,34],[86,43],[85,52],[85,61],[84,70],[55,79],[14,70],[14,61],[13,52],[11,43],[13,33]],
  13: [[42,25],[60,27],[87,33],[88,42],[85,51],[88,60],[86,69],[54,79],[12,69],[9,60],[11,51],[14,43],[13,33]],
  14: [[51,26],[76,31],[86,39],[86,47],[84,56],[86,64],[79,72],[53,79],[19,72],[12,64],[10,56],[10,48],[12,40],[22,31]],
  15: [[52,26],[66,29],[79,35],[82,44],[82,52],[82,60],[78,68],[67,75],[52,79],[33,75],[20,68],[17,60],[17,52],[18,43],[22,34]],
};
/** Picture width/height ratio for each table design. */
const RATIO: Record<number, number> = { 6: 500 / 1075, 15: 500 / 1042 };

export function seatPositions(n: number): { x: number; y: number }[] {
  const t = SEATS[Math.min(15, Math.max(5, n))]!;
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = t[i % t.length]!;
    return { x, y };
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
  const pos = seatPositions(n === players.length ? n : players.length);
  const ratio = RATIO[n] ?? 500 / 1111;

  const latest: Record<string, ChatMessage> = {};
  for (const m of messages) {
    if (m.channel !== "GLOBAL" || !m.sender_id) continue;
    latest[m.sender_id] = m;
  }

  return (
    <div className="relative mx-auto h-full max-h-full max-w-full overflow-hidden bg-black" style={{ aspectRatio: String(ratio) }}>
      <img
        src={TABLES[n]}
        alt=""
        className={`absolute inset-0 h-full w-full object-fill ${
          variant === "night" ? "brightness-[0.55] saturate-[0.8]" : ""
        }`}
        loading="eager"
        decoding="async"
      />
      {players.slice(0, 15).map((p, i) => {
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
              <div className="absolute top-full left-0 z-10 mt-9 w-max max-w-[10rem] -translate-x-1/2 animate-in fade-in zoom-in-95 rounded-2xl bg-[#efe4cf] px-3 py-2 text-xs font-medium leading-snug text-[#111] shadow-lg">
                {msg.content ?? "..."}
                <span className="absolute left-1/2 bottom-full -translate-x-1/2 border-x-[7px] border-b-[7px] border-x-transparent border-b-[#efe4cf]" />
              </div>
            )}
            <button
              type="button"
              disabled={!selectable || !p.is_alive}
              onClick={() => onSelect?.(p)}
              style={{ transform: "translate(-50%, 1.1rem)" }}
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
