import { X } from "lucide-react";
import type { Player } from "@/lib/game";
import { useI18n } from "@/lib/i18n";
import type { RoleKey } from "@/lib/roles";

interface ActionDrawerProps {
  phase: string | null;
  role: RoleKey | null;
  target: Player | null;
  players: Player[];
  voteCounts?: Record<string, number>;
  onSelectTarget: (player: Player) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ActionDrawer({
  phase,
  role,
  target,
  players,
  voteCounts = {},
  onSelectTarget,
  onConfirm,
  onCancel,
  busy = false,
}: ActionDrawerProps) {
  const { lang, t } = useI18n();

  if (!target) return null;

  const isWolfPhase = phase === "NIGHT_WOLVES";
  const isDoctorPhase = phase === "NIGHT_DOCTOR";
  const isDetectivePhase = phase === "NIGHT_DETECTIVE";
  const isVotingPhase = phase === "DAY_VOTING";

  // Action styling config
  let themeColor = "#ef4444"; // red/wolf
  let themeBg = "rgba(239, 68, 68, 0.15)";
  let actionIcon = "";
  let actionTitle = lang === "ar" ? "الذئاب" : lang === "fr" ? "Les Loups" : "Wolves";
  let actionPrompt =
    lang === "ar" ? "اختر الضحية" : lang === "fr" ? "Choisis une victime" : "Choose a victim";
  let confirmLabel =
    lang === "ar"
      ? `تأكيد القتل: ${target.username}`
      : lang === "fr"
        ? `Éliminer ${target.username}`
        : `Kill ${target.username}`;

  if (isDoctorPhase) {
    themeColor = "#10b981"; // emerald/green
    themeBg = "rgba(16, 185, 129, 0.15)";
    actionIcon = "";
    actionTitle = lang === "ar" ? "الطبيب" : lang === "fr" ? "Le Médecin" : "Doctor";
    actionPrompt =
      lang === "ar"
        ? "اختر من تعالجه هذه الليلة"
        : lang === "fr"
          ? "Choisis qui soigner"
          : "Choose who to protect";
    confirmLabel =
      lang === "ar"
        ? `علاج ${target.username}`
        : lang === "fr"
          ? `Soigner ${target.username}`
          : `Protect ${target.username}`;
  } else if (isDetectivePhase) {
    themeColor = "#3b82f6"; // blue/cyan
    themeBg = "rgba(59, 130, 246, 0.15)";
    actionIcon = "";
    actionTitle = lang === "ar" ? "المحقق" : lang === "fr" ? "Le Détective" : "Detective";
    actionPrompt =
      lang === "ar"
        ? "اختر مشتبهاً للتحقيق"
        : lang === "fr"
          ? "Inspecter un suspect"
          : "Investigate suspect";
    confirmLabel =
      lang === "ar"
        ? `التحقيق مع ${target.username}`
        : lang === "fr"
          ? `Inspecter ${target.username}`
          : `Investigate ${target.username}`;
  } else if (isVotingPhase) {
    themeColor = "#8b5cf6"; // violet
    themeBg = "rgba(139, 92, 246, 0.15)";
    actionIcon = "";
    actionTitle = lang === "ar" ? "التصويت العام" : lang === "fr" ? "Vote du Village" : "Town Vote";
    actionPrompt =
      lang === "ar"
        ? "اختر من تقصيه القرية"
        : lang === "fr"
          ? "Voter pour éliminer"
          : "Cast vote to eliminate";
    confirmLabel =
      lang === "ar"
        ? `التصويت لطرد ${target.username}`
        : lang === "fr"
          ? `Voter contre ${target.username}`
          : `Vote to Lynch ${target.username}`;
  }

  const livingPlayers = players.filter((p) => p.is_alive);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 pointer-events-none animate-in slide-in-from-bottom duration-300">
      <div className="pointer-events-auto w-full max-w-lg rounded-3xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-base shadow-inner"
              style={{ backgroundColor: themeBg, color: themeColor }}
            >
              {actionIcon}
            </div>
            <div>
              <p
                className="text-xs font-bold tracking-wide uppercase"
                style={{ color: themeColor }}
              >
                {actionTitle}
              </p>
              <p className="text-[11px] text-muted-foreground">{actionPrompt}</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            aria-label="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Horizontal quick targets row */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {livingPlayers.map((p) => {
            const isSelected = p.user_id === target.user_id;
            const count = voteCounts[p.user_id];
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => onSelectTarget(p)}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 transition-all ${
                  isSelected ? "scale-105 bg-foreground/10 ring-2" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  borderColor: isSelected ? themeColor : "transparent",
                  ["--tw-ring-color" as string]: themeColor,
                }}
              >
                <div className="relative">
                  <img
                    src={p.avatar_url ?? ""}
                    alt={p.username}
                    className="h-11 w-11 rounded-full border border-border bg-secondary object-cover"
                  />
                  {count ? (
                    <span
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-foreground shadow"
                      style={{ backgroundColor: themeColor }}
                    >
                      {count}
                    </span>
                  ) : null}
                  {isSelected && (
                    <span
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: themeColor }}
                    />
                  )}
                </div>
                <span className="w-12 truncate text-center text-[10px] font-semibold text-foreground">
                  {p.username}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Confirm Button */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-foreground/5"
          >
            {lang === "ar" ? "رجوع" : lang === "fr" ? "Retour" : "Back"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold tracking-wider uppercase text-foreground shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            {busy ? t("common.wait") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
