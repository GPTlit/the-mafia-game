import { ROLES, type RoleKey } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import type { Player } from "@/lib/game";

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

  if (compact) {
    return (
      <div className="w-full overflow-x-auto py-1 scrollbar-none">
        <ul className="flex items-center gap-2.5 px-1 min-w-max">
          {players.map((p) => {
            const role = p.role as RoleKey | null;
            const disabled = !selectable || !p.is_alive;
            const isSelected = selectedId === p.user_id;
            const isMe = p.user_id === meId;
            const isSpeaker = speakerId === p.user_id;
            const votes = voteCounts[p.user_id];

            return (
              <li key={p.user_id} className="shrink-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect?.(p.user_id)}
                  className={`flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all ${
                    isSelected ? "scale-105 bg-foreground/10 ring-2" : "hover:bg-foreground/5 active:scale-95"
                  } ${!p.is_alive ? "opacity-40 grayscale" : ""}`}
                  style={{
                    ["--tw-ring-color" as string]: isSelected ? selectionColor : "transparent",
                    boxShadow: isSelected ? `0 0 16px ${selectionColor}40` : "none",
                  }}
                >
                  <div className="relative">
                    {/* Ring highlight when speaking or selected */}
                    {isSpeaker && (
                      <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-pulse" />
                    )}
                    <img
                      src={p.avatar_url ?? ""}
                      alt={p.username}
                      className="h-11 w-11 rounded-full border border-border bg-secondary object-cover"
                    />

                    {/* Status badges */}
                    {!p.is_alive && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-foreground shadow">
                        
                      </span>
                    )}

                    {p.is_host && p.is_alive && (
                      <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black shadow">
                        
                      </span>
                    )}

                    {isSpeaker && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-black shadow animate-bounce">
                        
                      </span>
                    )}

                    {votes ? (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-foreground shadow">
                        {votes}
                      </span>
                    ) : null}

                    {/* Ready status dot in lobby */}
                    {showReady && p.is_alive && (
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                          p.is_ready ? "bg-emerald-400" : "bg-neutral-500"
                        }`}
                      />
                    )}
                  </div>

                  {/* Name label */}
                  <span className="w-14 truncate text-center text-[10px] font-bold text-foreground">
                    {isMe ? (lang === "ar" ? "أنت" : "You") : p.username}
                  </span>

                  {/* Subtitle / role / bot */}
                  {role ? (
                    <span
                      className="text-[8px] font-bold tracking-tight uppercase"
                      style={{ color: ROLES[role]?.tone }}
                    >
                      {t(`role.${role}.label`)}
                    </span>
                  ) : p.is_bot ? (
                    <span className="text-[8px] font-semibold text-muted-foreground uppercase">
                      BOT
                    </span>
                  ) : showReady ? (
                    <span
                      className={`text-[8px] font-semibold uppercase ${
                        p.is_ready ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {p.is_ready ? t("state.ready") : t("state.waiting")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Grid display for Lobby / Finished screens
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {players.map((p) => {
        const role = p.role as RoleKey | null;
        const disabled = !selectable || !p.is_alive;
        const isSelected = selectedId === p.user_id;
        const isMe = p.user_id === meId;

        return (
          <li key={p.user_id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(p.user_id)}
              className={`w-full flex flex-col items-center rounded-2xl border p-2.5 transition-all ${
                isSelected
                  ? "border-primary bg-primary/20 ring-2 ring-primary"
                  : "border-border bg-white/[0.03] hover:border-border"
              } ${!p.is_alive ? "opacity-40 grayscale" : ""}`}
            >
              <div className="relative">
                <img
                  src={p.avatar_url ?? ""}
                  alt={p.username}
                  className="h-12 w-12 rounded-full border border-border bg-secondary object-cover"
                />
                {!p.is_alive && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-foreground">
                    
                  </span>
                )}
                {p.is_host && (
                  <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black shadow">
                    
                  </span>
                )}
                {showReady && p.is_alive && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                      p.is_ready ? "bg-emerald-400" : "bg-neutral-500"
                    }`}
                  />
                )}
              </div>

              <p className="mt-1.5 w-full truncate text-center text-xs font-bold text-foreground">
                {isMe ? `${p.username} (${lang === "ar" ? "أنت" : "You"})` : p.username}
              </p>

              {role && (
                <p
                  className="mt-0.5 text-[9px] font-bold tracking-wide uppercase"
                  style={{ color: ROLES[role]?.tone }}
                >
                  {t(`role.${role}.label`)}
                </p>
              )}

              {p.is_bot && !role && (
                <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                  AI BOT
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
