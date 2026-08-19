import cardWolf from "@/assets/card-wolf.png";
import cardDetective from "@/assets/card-detective.png";
import cardDoctor from "@/assets/card-doctor.png";
import cardCivilian from "@/assets/card-civilian.png";
import { useI18n, type TFunc } from "@/lib/i18n";

export type RoleKey = "WOLF" | "DETECTIVE" | "DOCTOR" | "CIVILIAN";

export type RoleMeta = {
  key: RoleKey;
  art: string;
  unit: string;
  faction: string;
  tone: string;
  face: "dark" | "light";
};

export const ROLES: Record<RoleKey, RoleMeta> = {
  WOLF: {
    key: "WOLF",
    art: cardWolf,
    unit: "UNIT / 3 / 5",
    faction: "FACTION: RED / PACK",
    tone: "var(--wolf)",
    face: "dark",
  },
  DETECTIVE: {
    key: "DETECTIVE",
    art: cardDetective,
    unit: "UNIT / 4 / 3",
    faction: "FACTION: WHITE / INVESTIGATIVE BUREAU",
    tone: "var(--detective)",
    face: "light",
  },
  DOCTOR: {
    key: "DOCTOR",
    art: cardDoctor,
    unit: "UNIT / 2 / 4",
    faction: "FACTION: WHITE / MEDICAL CORPS",
    tone: "var(--medic)",
    face: "light",
  },
  CIVILIAN: {
    key: "CIVILIAN",
    art: cardCivilian,
    unit: "UNIT / 1 / 6",
    faction: "FACTION: WHITE / SETTLER",
    tone: "var(--civilian)",
    face: "light",
  },
};

export function roleLabel(t: TFunc, role: RoleKey) {
  return t(`role.${role}.label`);
}

export function WolfSigil({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      className={className}
      style={style}
    >
      <path d="M12 8 L22 34 L50 22 L78 34 L88 8 L84 46 L50 82 L16 46 Z" />
      <path d="M50 40 L62 52 L50 66 L38 52 Z" />
    </svg>
  );
}

export function GameCard({
  role,
  className = "",
  compact = false,
}: {
  role: RoleKey;
  className?: string;
  compact?: boolean;
}) {
  const meta = ROLES[role];
  const { t } = useI18n();
  return (
    <figure
      className={`relative overflow-hidden rounded-2xl shadow-[var(--shadow-card)] ${className}`}
      style={{ aspectRatio: "10 / 17", border: `2px solid ${meta.tone}` }}
    >
      <img
        src={meta.art}
        alt={`${t(`role.${role}.label`)} — ${t(`role.${role}.title`)}`}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {!compact && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-background/80 px-2 py-1.5 text-center backdrop-blur-sm">
          <p
            className="display text-[11px] font-bold tracking-[0.25em]"
            style={{ color: meta.tone }}
          >
            {t(`role.${role}.label`)}
          </p>
          <p className="display text-[9px] tracking-widest text-muted-foreground uppercase">
            {t(`role.${role}.title`)}
          </p>
        </figcaption>
      )}
    </figure>
  );
}
