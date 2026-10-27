import { ROLES, type RoleKey } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import type { Player } from "@/lib/game";

/** Name-only roster. No avatars or profile pictures anywhere. */
export function PlayerGrid({
  players,
  meId,
  selectable = false,
  selectedId = null,
  selectionColor = "#ef4444",
  voteCounts = {},
  onSelect,
  showReady = false,
  speakerId = null,
  compact = false,
}: {
  players: Player[];
  meId: string;
  selectable?: boolean;
  selectedId?: string | null;
  selectionColor?: string;
  voteCounts?: Record<string, number>;
  onSelect?: (id: string) => void;
  showReady?: boolean;
  speakerId?: string | null;
  compact?: boolean;
}) {
  const { lang, t } = useI18n();

  const sub = (p: Player) => {
    const role = p.role as RoleKey | null;
    if (role)
      return (
        <span className="text-[9px] font-bold uppercase" style={{ color: ROLES[role]?.tone }}>
          {t(`role.${role}.label`)}
        </span>
      );
    if (p.is_bot) return <span className="text-[9px] text-[#8c857a] uppercase">BOT</span>;
    if (showReady)
      return (
        <span className={`text-[9px] ${p.is_ready ? "text-emerald-400" : "text-[#8c857a]"}`}>
          {p.is_ready ? t("state.ready") : t("state.waiting")}
        </span>
      );
    return null;
  };

  return (
    <ul
      className={
        compact ? "flex min-w-max items-center gap-2 overflow-x-auto px-1 py-1" : "grid grid-cols-3 gap-2.5 sm:grid-cols-4"
      }
    >
      {players.map((p) => {
        const disabled = !selectable || !p.is_alive;
        const isSelected = selectedId === p.user_id;
        const isMe = p.user_id === meId;
        const votes = voteCounts[p.user_id];
        return (
          <li key={p.user_id} className="shrink-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(p.user_id)}
              className={`flex w-full flex-col items-center rounded-xl border border-[#3a3836] bg-[#1c1c1d] px-3 py-2 text-[#efe4cf] transition ${
                !p.is_alive ? "line-through opacity-40" : ""
              }`}
              style={isSelected ? { borderColor: selectionColor, boxShadow: `0 0 14px ${selectionColor}55` } : undefined}
            >
              <span className={`text-xs font-semibold ${speakerId === p.user_id ? "text-emerald-400" : ""}`}>
                {isMe ? `${p.username} (${lang === "ar" ? "أنت" : "You"})` : p.username}
                {votes ? ` · ${votes}` : ""}
              </span>
              {sub(p)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
