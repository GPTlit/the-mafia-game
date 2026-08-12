export type RoleKey = "WOLF" | "DETECTIVE" | "DOCTOR" | "CIVILIAN";

export type RoleMeta = {
  key: RoleKey;
  label: string;
  title: string;
  unit: string;
  faction: string;
  tone: string;
  ring: string;
  text: string;
  face: "dark" | "light";
  blurb: string;
};

export const ROLES: Record<RoleKey, RoleMeta> = {
  WOLF: {
    key: "WOLF",
    label: "WOLF",
    title: "Alpha Predator",
    unit: "UNIT / 3 / 5",
    faction: "FACTION: RED / PACK",
    tone: "var(--wolf)",
    ring: "border-wolf",
    text: "text-wolf",
    face: "dark",
    blurb: "Hunt at night with your pack. Blend in by day.",
  },
  DETECTIVE: {
    key: "DETECTIVE",
    label: "DETECTIVE",
    title: "Shadow Sleuth",
    unit: "UNIT / 4 / 3",
    faction: "FACTION: WHITE / INVESTIGATIVE BUREAU",
    tone: "var(--detective)",
    ring: "border-detective",
    text: "text-detective",
    face: "light",
    blurb: "Each night, ask the operator if one player is a wolf.",
  },
  DOCTOR: {
    key: "DOCTOR",
    label: "MEDIC",
    title: "Healing Hands",
    unit: "UNIT / 2 / 4",
    faction: "FACTION: WHITE / MEDICAL CORPS",
    tone: "var(--medic)",
    ring: "border-medic",
    text: "text-medic",
    face: "light",
    blurb: "Heal one player each night. Yourself only once per game.",
  },
  CIVILIAN: {
    key: "CIVILIAN",
    label: "CIVILIAN",
    title: "Harvest Keeper",
    unit: "UNIT / 1 / 6",
    faction: "FACTION: WHITE / SETTLER",
    tone: "var(--civilian)",
    ring: "border-civilian",
    text: "text-civilian",
    face: "light",
    blurb: "No powers. Read the room, argue well, vote wisely.",
  },
};

export function WolfSigil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 90" fill="none" stroke="currentColor" strokeWidth="4" className={className}>
      <path d="M12 8 L22 34 L50 22 L78 34 L88 8 L84 46 L50 82 L16 46 Z" />
      <path d="M50 40 L62 52 L50 66 L38 52 Z" />
    </svg>
  );
}

function RoleArt({ role }: { role: RoleKey }) {
  const c = ROLES[role].tone;
  if (role === "WOLF") {
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" style={{ color: c }} fill="currentColor">
        <path d="M100 22 L128 52 L150 30 L156 74 L176 110 L142 118 L156 148 L118 142 L100 178 L82 142 L44 148 L58 118 L24 110 L44 74 L50 30 L72 52 Z" />
        <path d="M100 62 L114 84 L100 106 L86 84 Z" fill="#111" />
        <path d="M70 96 L88 104 L70 112 Z M130 96 L112 104 L130 112 Z" fill="#111" />
        <path d="M100 122 L112 134 L100 152 L88 134 Z" fill="#111" />
      </svg>
    );
  }
  if (role === "DETECTIVE") {
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" style={{ color: c }} fill="currentColor">
        <path d="M62 44 h72 l10 12 h-92 z" />
        <circle cx="98" cy="70" r="20" />
        <path d="M70 92 h58 l16 88 h-90 z" />
        <circle cx="150" cy="96" r="20" fill="none" stroke="currentColor" strokeWidth="7" />
        <path d="M136 112 L118 132" stroke="currentColor" strokeWidth="8" />
      </svg>
    );
  }
  if (role === "DOCTOR") {
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" style={{ color: c }} fill="currentColor">
        <circle cx="100" cy="52" r="22" />
        <circle cx="100" cy="34" r="9" fill="none" stroke="currentColor" strokeWidth="6" />
        <path d="M66 80 h68 l14 100 h-96 z" />
        <path d="M92 104 h16 v14 h14 v16 h-14 v14 h-16 v-14 h-14 v-16 h14 z" fill="#f3f2ee" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" style={{ color: c }} fill="currentColor">
      <path d="M74 40 h44 l6 14 h-56 z" />
      <circle cx="98" cy="72" r="20" />
      <path d="M70 94 h58 l10 44 -26 34 h-50 l14 -40 z" />
      <path d="M40 168 q14 -34 30 -40 M56 168 q10 -30 22 -38" stroke="currentColor" strokeWidth="8" fill="none" />
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
  const dark = meta.face === "dark";
  return (
    <div
      className={`carbon rounded-2xl p-[6px] shadow-[var(--shadow-card)] ${className}`}
      style={{ aspectRatio: "10 / 17" }}
    >
      <div
        className="flex h-full w-full flex-col items-center rounded-xl px-3 py-4"
        style={{
          border: `3px solid ${meta.tone}`,
          background: dark ? "oklch(0.14 0.005 285)" : "oklch(0.95 0.005 90)",
          color: dark ? "oklch(0.95 0 0)" : "oklch(0.2 0.01 285)",
        }}
      >
        <WolfSigil className="h-6 w-8" style={{ color: meta.tone } as never} />
        <p
          className="display mt-1 text-[11px] font-bold tracking-[0.25em]"
          style={{ color: meta.tone }}
        >
          {meta.label}
        </p>
        <div className={`my-2 flex-1 ${compact ? "px-2" : "px-4"}`}>
          <RoleArt role={role} />
        </div>
        <h3
          className="display text-center leading-none font-bold uppercase"
          style={{ color: meta.tone, fontSize: compact ? "0.95rem" : "1.5rem" }}
        >
          {meta.title}
        </h3>
        <p className="display mt-2 text-[9px] tracking-widest opacity-80">{meta.unit}</p>
        <p className="display text-[9px] tracking-widest opacity-80">{meta.faction}</p>
      </div>
    </div>
  );
}