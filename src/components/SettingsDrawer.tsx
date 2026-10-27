import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { ROLES, type RoleKey } from "@/lib/roles";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const { lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();

  if (!isOpen) return null;

  const rolesList: {
    key: RoleKey;
    title: string;
    subtitle: string;
    desc: string[];
    color: string;
  }[] = [
    {
      key: "WOLF",
      title: lang === "ar" ? "الذئب" : lang === "fr" ? "LOUP" : "WOLF",
      subtitle:
        lang === "ar" ? "المفترس الألفا" : lang === "fr" ? "Prédateur Alpha" : "Alpha Predator",
      desc: [
        lang === "ar"
          ? "تصويت على الضحية ليلاً"
          : lang === "fr"
            ? "Vote sur une victime (nuit)"
            : "Vote on a victim (night)",
        lang === "ar"
          ? "قناة سرية خاصة بالقطيع"
          : lang === "fr"
            ? "Canal privé de la meute"
            : "Private pack channel",
      ],
      color: "#ef4444",
    },
    {
      key: "DETECTIVE",
      title: lang === "ar" ? "المحقق" : lang === "fr" ? "DÉTECTIVE" : "DETECTIVE",
      subtitle:
        lang === "ar" ? "متعقب الظلال" : lang === "fr" ? "Limier de l'Ombre" : "Shadow Sleuth",
      desc: [
        lang === "ar"
          ? "فحص مشتبه به واحد ليلاً"
          : lang === "fr"
            ? "Inspecte un suspect (nuit)"
            : "Inspect one suspect (night)",
        lang === "ar"
          ? "معرفة هويته سرّاً"
          : lang === "fr"
            ? "Reçoit le verdict (loup ou innocent)"
            : "Get feedback (wolf or innocent)",
      ],
      color: "#3b82f6",
    },
    {
      key: "DOCTOR",
      title: lang === "ar" ? "الطبيب" : lang === "fr" ? "MÉDECIN" : "DOCTOR",
      subtitle:
        lang === "ar" ? "الأيادي الشافية" : lang === "fr" ? "Mains Guérisseuses" : "Healing Hands",
      desc: [
        lang === "ar"
          ? "حماية لاعب واحد كل ليلة"
          : lang === "fr"
            ? "Protège un joueur (nuit)"
            : "Protect one player (night)",
        lang === "ar"
          ? "علاج نفسك مرة واحدة فقط باللعبة"
          : lang === "fr"
            ? "Auto-soin une seule fois"
            : "Self-heal once per game",
      ],
      color: "#10b981",
    },
    {
      key: "CIVILIAN",
      title: lang === "ar" ? "المدني" : lang === "fr" ? "CIVIL" : "CIVILIAN",
      subtitle:
        lang === "ar" ? "حارس القرية" : lang === "fr" ? "Gardien des Récoltes" : "Harvest Keeper",
      desc: [
        lang === "ar"
          ? "المناقشة، استجواب المشتبهين، والتصويت"
          : lang === "fr"
            ? "Discuter, débattre, voter (jour)"
            : "Discuss, cross-examine, vote (day)",
      ],
      color: "#eab308",
    },
  ];

  const handleDirection = (dir: "ltr" | "rtl") => {
    document.documentElement.dir = dir;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 text-foreground shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            {lang === "ar"
              ? "الإعدادات والأدوار"
              : lang === "fr"
                ? "Paramètres & Rôles"
                : "Settings & Roles"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* The Roles Section */}
        <div className="mt-4">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {lang === "ar" ? "الأدوار" : lang === "fr" ? "Les Rôles" : "The Roles"}
          </h3>
          <div className="mt-2.5 space-y-2.5">
            {rolesList.map((r) => (
              <div
                key={r.key}
                className="flex items-start gap-3 rounded-2xl border p-3 bg-foreground/[0.02]"
                style={{ borderColor: `${r.color}30` }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                  style={{ backgroundColor: `${r.color}20`, color: r.color }}
                >
                  {r.key === "WOLF"
                    ? "🐺"
                    : r.key === "DETECTIVE"
                      ? "🕵️"
                      : r.key === "DOCTOR"
                        ? "➕"
                        : "👤"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-bold tracking-wide" style={{ color: r.color }}>
                      {r.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{r.subtitle}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-foreground/80">
                    {r.desc.map((d, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Language Selection */}
        <div className="mt-5 rounded-2xl border border-border bg-foreground/[0.02] p-3.5">
          <h4 className="text-xs font-bold text-muted-foreground">
            {lang === "ar" ? "اللغة" : lang === "fr" ? "Langue" : "Language"}
          </h4>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { id: "en" as Lang, label: "English", flag: "🇺🇸" },
              { id: "fr" as Lang, label: "Français", flag: "🇫🇷" },
              { id: "ar" as Lang, label: "العربية", flag: "🇸🇦" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                  lang === item.id
                    ? "border-primary bg-primary/20 text-foreground"
                    : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Selection */}
        <div className="mt-3 rounded-2xl border border-border bg-foreground/[0.02] p-3.5">
          <h4 className="text-xs font-bold text-muted-foreground">
            {lang === "ar" ? "المظهر" : lang === "fr" ? "Thème" : "Theme"}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => theme === "dark" && toggle()}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition ${
                theme === "light"
                  ? "border-primary bg-primary/20 text-foreground"
                  : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              <span>☀️</span>
              <span>{lang === "ar" ? "فاتح" : lang === "fr" ? "Clair" : "Light"}</span>
            </button>
            <button
              type="button"
              onClick={() => theme === "light" && toggle()}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition ${
                theme === "dark"
                  ? "border-primary bg-primary/20 text-foreground"
                  : "border-border bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              <span>🌙</span>
              <span>{lang === "ar" ? "داكن" : lang === "fr" ? "Sombre" : "Dark"}</span>
            </button>
          </div>
        </div>

        {/* Layout Direction */}
        <div className="mt-3 rounded-2xl border border-border bg-foreground/[0.02] p-3.5">
          <h4 className="text-xs font-bold text-muted-foreground">
            {lang === "ar"
              ? "اتجاه الواجهة"
              : lang === "fr"
                ? "Sens de lecture"
                : "Layout Direction"}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDirection("ltr")}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-foreground/[0.02] py-2 text-xs font-semibold text-muted-foreground hover:bg-foreground/5"
            >
              <span>LTR (Left-to-Right)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDirection("rtl")}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-foreground/[0.02] py-2 text-xs font-semibold text-muted-foreground hover:bg-foreground/5"
            >
              <span>RTL (Right-to-Left)</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-xs font-bold tracking-wider uppercase text-foreground shadow-lg transition active:scale-95"
        >
          {lang === "ar" ? "تم" : lang === "fr" ? "Fermer" : "Done"}
        </button>
      </div>
    </div>
  );
}
