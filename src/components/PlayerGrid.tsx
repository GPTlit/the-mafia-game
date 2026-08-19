import { ROLES, type RoleKey } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import type { Player } from "@/lib/game";

export function PlayerGrid({
  players,
  meId,
  selectable = false,
  selectedId = null,
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
  voteCounts?: Record<string, number>;
  onSelect?: (id: string) => void;
  showReady?: boolean;
  speakerId?: string | null;
  compact?: boolean;
}) {
  const { t } = useI18n();

  if (compact) {
    return (
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {players.map((p) => {
          const role = p.role as RoleKey | null;
          const disabled = !selectable || !p.is_alive;
          return (
            <li key={p.user_id} className="shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect?.(p.user_id)}
                className={`w-16 rounded-xl border px-1 py-1.5 text-center transition-colors ${
                  selectedId === p.user_id
                    ? "border-primary bg-primary/15"
                    : "border-border bg-card"
                } ${p.is_alive ? "" : "opacity-40"} ${disabled ? "cursor-default" : "hover:border-primary"}`}
              >
                <div className="relative mx-auto h-9 w-9">
                  <img
                    src={p.avatar_url ?? ""}
                    alt={p.username}
                    className="h-9 w-9 rounded-full border border-border bg-secondary object-cover"
                  />
                  {speakerId === p.user_id && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1 text-[8px] font-bold text-accent-foreground">
                      {t("state.mic")}
                    </span>
                  )}
                  {voteCounts[p.user_id] ? (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {voteCounts[p.user_id]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[10px] font-semibold">
                  {p.user_id === meId ? t("state.you").trim().replace(/[()]/g, "") : p.username}
                </p>
                {role && (
                  <p
                    className="truncate text-[8px] tracking-wide"
                    style={{ color: ROLES[role].tone }}
                  >
                    {t(`role.${role}.label`)}
                  </p>
                )}
                {showReady && p.is_alive && (
                  <p
                    className={`text-[8px] tracking-wide ${
                      p.is_ready ? "text-civilian" : "text-muted-foreground"
                    }`}
                  >
                    {p.is_ready ? t("state.ready") : t("state.waiting")}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {players.map((p) => {
        const role = p.role as RoleKey | null;
        const disabled = !selectable || !p.is_alive;
        return (
          <li key={p.user_id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(p.user_id)}
              className={`w-full rounded-lg border p-2 text-center transition-colors ${
                selectedId === p.user_id ? "border-primary bg-primary/15" : "border-border bg-card"
              } ${p.is_alive ? "" : "opacity-45"} ${disabled ? "cursor-default" : "hover:border-primary"}`}
            >
              <div className="relative mx-auto h-12 w-12">
                <img
                  src={p.avatar_url ?? ""}
                  alt={p.username}
                  className="h-12 w-12 rounded-full border border-border bg-secondary object-cover"
                />
                {speakerId === p.user_id && (
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                    {t("state.mic")}
                  </span>
                )}
                {voteCounts[p.user_id] ? (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {voteCounts[p.user_id]}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs font-semibold">
                {p.username}
                {p.user_id === meId ? t("state.you") : ""}
              </p>
              {role && (
                <p
                  className="display text-[9px] tracking-widest"
                  style={{ color: ROLES[role].tone }}
                >
                  {t(`role.${role}.label`)}
                </p>
              )}
              {!p.is_alive && (
                <p className="display text-[9px] tracking-widest text-muted-foreground">DEAD</p>
              )}
              {showReady && p.is_alive && (
                <p
                  className={`display text-[9px] tracking-widest ${
                    p.is_ready ? "text-civilian" : "text-muted-foreground"
                  }`}
                >
                  {p.is_ready ? t("state.ready") : t("state.waiting")}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
