import cardWolf from "@/assets/card-wolf.png";
import cardDetective from "@/assets/card-detective.png";
import cardDoctor from "@/assets/card-doctor.png";
import cardCivilian from "@/assets/card-civilian.png";
import { useI18n, type TFunc } from "@/lib/i18n";
import logoAsset from "@/assets/mafia-logo.png.asset.json";

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

/** THE MAFIA brand mark (crimson fedora emblem). */
export function WolfSigil({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={logoAsset.url}
      alt="THE MAFIA"
      className={`rounded-lg object-cover ${className ?? ""}`}
      style={{ aspectRatio: "1 / 1", width: "auto", ...style }}
    />
  );
}

export const MafiaLogo = WolfSigil;

function RoleIcon({ role, className }: { role: RoleKey; className?: string }) {
  if (role === "WOLF")
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor">
        <path d="M14 6l8 14 6-4 4 6 4-6 6 4 8-14 2 22-6 10 4 6-10 4-4 12-8-6-8 6-4-12-10-4 4-6-6-10z" />
      </svg>
    );
  if (role === "DETECTIVE")
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor">
        <path d="M18 22c2-10 6-14 14-14s12 4 14 14l10 3c0 3-10 6-24 6S8 28 8 25z" />
        <path d="M20 34h24c0 8-5 14-12 14s-12-6-12-14zM14 58c2-6 8-10 18-10s16 4 18 10z" />
      </svg>
    );
  if (role === "DOCTOR")
    return (
      <svg viewBox="0 0 64 64" className={className} fill="currentColor">
        <path d="M24 8h16v16h16v16H40v16H24V40H8V24h16z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor">
      <circle cx="32" cy="20" r="12" />
      <path d="M10 58c0-12 10-20 22-20s22 8 22 20z" />
    </svg>
  );
}

const TONE_CLASS: Record<RoleKey, string> = {
  WOLF: "text-wolf",
  DETECTIVE: "text-detective",
  DOCTOR: "text-medic",
  CIVILIAN: "text-civilian",
};

/** Colored role tile matching the landing-page design. */
export function RoleTile({ role, size = "md" }: { role: RoleKey; size?: "sm" | "md" }) {
  const { t } = useI18n();
  return (
    <div
      className={`role-tile flex flex-col items-center justify-center gap-1.5 ${TONE_CLASS[role]} ${
        size === "sm" ? "h-14 w-14" : "aspect-[4/5] w-full py-3"
      }`}
    >
      <RoleIcon role={role} className={size === "sm" ? "h-7 w-7" : "h-10 w-10"} />
      {size === "md" && (
        <span className="text-[10px] font-bold tracking-wide">{t(`role.${role}.label`)}</span>
      )}
    </div>
  );
}

/** Role info row ("The Roles" panel in the design). */
export function RoleRow({ role }: { role: RoleKey }) {
  const { t } = useI18n();
  return (
    <div className={`role-tile flex items-center gap-3 p-3 ${TONE_CLASS[role]}`}>
      <RoleTile role={role} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-extrabold">{t(`role.${role}.label`)}</p>
        <p className="text-xs opacity-90">{t(`role.${role}.title`)}</p>
        <p className="mt-0.5 text-[11px] text-foreground/80">{t(`role.${role}.blurb`)}</p>
      </div>
    </div>
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
