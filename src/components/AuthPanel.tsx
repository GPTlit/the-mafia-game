import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AVATARS } from "@/lib/game";
import { WolfSigil } from "@/lib/roles";

const emailFor = (username: string) => `${username.trim().toLowerCase()}@wolfgame.local`;

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const clean = username.trim().replace(/\s+/g, "_");
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
        throw new Error("Username: 3-20 letters, numbers or underscores");
      }
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: emailFor(clean),
          password,
        });
        if (err) throw err;
        if (data.user) {
          const { error: pErr } = await supabase.from("profiles").insert({
            id: data.user.id,
            username: clean,
            phone_number: phone.trim() || null,
            avatar_url: AVATARS[avatar] ?? AVATARS[0]!,
          });
          if (pErr) throw new Error(pErr.message);
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: emailFor(clean),
          password,
        });
        if (err) throw new Error("Wrong username or password");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel mx-auto w-full max-w-sm p-6">
      <div className="flex flex-col items-center">
        <WolfSigil className="h-10 w-12 text-primary" />
        <h1 className="display mt-2 text-3xl font-bold uppercase">Wolf Night</h1>
        <p className="text-sm text-muted-foreground">Social deduction, 6 to 15 players</p>
      </div>

      <div className="mt-6 flex rounded-md border border-border p-1">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`display flex-1 rounded px-3 py-1.5 text-xs font-bold tracking-widest uppercase ${
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full rounded-md border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {mode === "signup" && (
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            inputMode="tel"
            className="w-full rounded-md border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        )}
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="w-full rounded-md border border-input bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {mode === "signup" && (
        <div className="mt-5">
          <p className="display text-[11px] tracking-widest text-muted-foreground uppercase">
            Choose your avatar
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {AVATARS.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setAvatar(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 ${
                  avatar === i ? "border-primary" : "border-border opacity-60"
                }`}
              >
                <img src={src} alt={`Avatar ${i + 1}`} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="display mt-5 w-full rounded-md bg-primary px-4 py-3 text-sm font-bold tracking-widest text-primary-foreground uppercase disabled:opacity-50"
      >
        {busy ? "Please wait…" : mode === "signup" ? "Enter the village" : "Sign in"}
      </button>
    </form>
  );
}
