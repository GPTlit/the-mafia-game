import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/game";

const SPEEDS = [1, 1.5, 2] as const;

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** WhatsApp-style voice note player with 1x / 1.5x / 2x playback. */
export function VoiceNote({ path, mine = false }: { path: string; mine?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    void api.voiceUrl(path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = (SPEEDS[speedIdx] ?? 1);
  }, [speedIdx, url]);

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const bars = 28;

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      el.playbackRate = (SPEEDS[speedIdx] ?? 1);
      void el.play();
    } else {
      el.pause();
    }
  }

  return (
    <div className="flex w-56 max-w-full items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground"
        } disabled:opacity-50`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <rect x="7" y="5" width="4" height="14" rx="1" />
            <rect x="13" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-[2px]">
          {Array.from({ length: bars }).map((_, i) => {
            const done = (i / bars) * 100 <= pct;
            const h = 25 + ((i * 37) % 60);
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-[2px] rounded-full ${
                  done
                    ? mine
                      ? "bg-primary-foreground"
                      : "bg-primary"
                    : mine
                      ? "bg-primary-foreground/35"
                      : "bg-muted-foreground/35"
                }`}
              />
            );
          })}
        </div>
        <p className={`mt-0.5 text-[10px] tabular-nums ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {fmt(playing || time > 0 ? time : duration)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}
        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
          mine ? "border-primary-foreground/40 text-primary-foreground" : "border-border text-muted-foreground"
        }`}
      >
        {(SPEEDS[speedIdx] ?? 1)}x
      </button>

      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}
