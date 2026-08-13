import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { AuthPanel } from "@/components/AuthPanel";
import { api } from "@/lib/game";
import { GameCard, ROLES, WolfSigil, type RoleKey } from "@/lib/roles";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wolf Night — Social Deduction Game for 6-15 Players" },
      {
        name: "description",
        content:
          "Play Wolf Night with friends: wolves hunt at night, the detective investigates, the doctor heals, and the town votes by day.",
      },
      { property: "og:title", content: "Wolf Night — Social Deduction Game" },
      {
        property: "og:description",
        content: "Create a room, invite 6-15 players, and survive the night.",
      },
    ],
  }),
  component: Index,
  ssr: false,
});

function Index() {
  const { t } = useI18n();
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void supabase
      .from("profiles")
      .select("username")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [session]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const roomCode = await api.createRoom();
      void navigate({ to: "/room/$code", params: { code: roomCode } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await api.joinRoom(code.trim().toUpperCase());
      void navigate({ to: "/room/$code", params: { code: code.trim().toUpperCase() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto mb-4 flex max-w-sm justify-end">
          <LanguageSwitcher />
        </div>
        <AuthPanel />
        <section className="mx-auto mt-10 max-w-sm">
          <p className="display text-center text-[11px] tracking-widest text-muted-foreground uppercase">
            {t("home.fourCards")}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(Object.keys(ROLES) as RoleKey[]).map((r) => (
              <GameCard key={r} role={r} compact />
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-sm px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WolfSigil className="h-7 w-9 text-primary" />
          <h1 className="display text-2xl font-bold uppercase">Wolf Night</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={() => void supabase.auth.signOut()}
            className="text-xs text-muted-foreground underline"
          >
            {t("nav.signOut")}
          </button>
        </div>
      </header>

      <p className="mt-4 text-sm text-muted-foreground">
        {t("home.welcome", { name: username ? `, ${username}` : "" })}
      </p>

      <div className="panel mt-6 p-5">
        <h2 className="display text-sm font-bold tracking-widest uppercase">{t("home.host")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("home.hostHint")}
        </p>
        <button
          onClick={() => void create()}
          disabled={busy}
          className="display mt-4 w-full rounded-md bg-primary px-4 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-50"
        >
          {t("home.create")}
        </button>
      </div>

      <div className="panel mt-4 p-5">
        <h2 className="display text-sm font-bold tracking-widest uppercase">{t("home.join")}</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("home.code")}
            maxLength={5}
            className="display flex-1 rounded-md border border-input bg-secondary px-3 py-2.5 tracking-[0.3em] outline-none focus:border-primary"
          />
          <button
            onClick={() => void join()}
            disabled={busy || code.trim().length < 4}
            className="display rounded-md border border-primary px-4 text-xs font-bold tracking-widest text-primary uppercase disabled:opacity-40"
          >
            Join
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <section className="mt-8">
        <p className="display text-[11px] tracking-widest text-muted-foreground uppercase">
          The four cards
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(Object.keys(ROLES) as RoleKey[]).map((r) => (
            <GameCard key={r} role={r} compact />
          ))}
        </div>
      </section>
    </main>
  );
}
