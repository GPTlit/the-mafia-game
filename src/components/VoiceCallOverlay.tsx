import { useEffect, useState } from "react";
import type { Player } from "@/lib/game";
import { useI18n } from "@/lib/i18n";

interface VoiceCallOverlayProps {
  inCall: boolean;
  muted: boolean;
  peerCount: number;
  players: Player[];
  meId: string;
  onToggleMute: () => void;
  onLeave: () => void;
  onCloseOverlay: () => void;
}

export function VoiceCallOverlay({
  inCall,
  muted,
  peerCount,
  players,
  meId,
  onToggleMute,
  onLeave,
  onCloseOverlay,
}: VoiceCallOverlayProps) {
  const { lang } = useI18n();
  const [speakerActive, setSpeakerActive] = useState(true);
  const [pulseScale, setPulseScale] = useState(1);

  // Simulated audio activity pulse
  useEffect(() => {
    if (!inCall || muted) return;
    const interval = setInterval(() => {
      setPulseScale(1 + Math.random() * 0.15);
    }, 200);
    return () => clearInterval(interval);
  }, [inCall, muted]);

  if (!inCall) return null;

  const mePlayer = players.find((p) => p.user_id === meId);
  const otherPeers = players.filter((p) => p.user_id !== meId && p.is_alive).slice(0, 3); // show active peer slots

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0e1017]/95 px-6 py-8 backdrop-blur-2xl animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-primary">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {lang === "ar"
                ? "مكالمة صوتية جماعية"
                : lang === "fr"
                  ? "Appel Vocal de Groupe"
                  : "Group Voice Call"}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold">
                {lang === "ar"
                  ? `مباشر · ${peerCount + 1}`
                  : lang === "fr"
                    ? `En direct · ${peerCount + 1}`
                    : `Live · ${peerCount + 1}`}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onCloseOverlay}
          aria-label="Minimize"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Center Speaking Orb */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="relative flex items-center justify-center">
          {/* Animated concentric ripples */}
          <div
            className="absolute h-36 w-36 rounded-full border border-emerald-500/20 transition-transform duration-200"
            style={{ transform: `scale(${pulseScale * 1.3})` }}
          />
          <div
            className="absolute h-28 w-28 rounded-full border border-emerald-500/40 bg-emerald-500/10 transition-transform duration-150"
            style={{ transform: `scale(${pulseScale * 1.15})` }}
          />

          {/* Core Orb with soundwaves */}
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#161922] border-2 border-emerald-400/80 shadow-[0_0_30px_rgba(52,211,153,0.3)] transition-transform duration-100"
            style={{ transform: `scale(${pulseScale})` }}
          >
            {/* Audio Waves graphic */}
            <div className="flex items-center gap-1">
              {[16, 26, 36, 22, 14].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-amber-400"
                  style={{
                    height: `${muted ? 8 : (h * pulseScale).toFixed(0)}px`,
                    transition: "height 0.15s ease",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm font-bold text-white tracking-wide">
          {mePlayer?.username || "You"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {muted
            ? lang === "ar"
              ? "الميكروفون مكتوم"
              : lang === "fr"
                ? "Micro coupé"
                : "Microphone Muted"
            : lang === "ar"
              ? "أنت تتحدث الآن"
              : lang === "fr"
                ? "Vous parlez"
                : "Speaking now"}
        </p>

        {/* Peers mini row */}
        <div className="mt-8 flex items-center justify-center gap-5">
          {otherPeers.map((p, idx) => (
            <div key={p.user_id} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <img
                  src={p.avatar_url ?? ""}
                  alt={p.username}
                  className="h-12 w-12 rounded-full border border-white/10 bg-secondary object-cover"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 border border-white/20 text-[9px] text-emerald-400">
                  {idx === 2 ? "🔇" : "🎙️"}
                </span>
              </div>
              <span className="w-14 truncate text-center text-[10px] font-medium text-muted-foreground">
                {p.username}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Call Action Controls */}
      <div className="mx-auto flex w-full max-w-xs items-center justify-around rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            muted
              ? "bg-white/10 text-muted-foreground hover:bg-white/20"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          {muted ? (
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          )}
        </button>

        {/* End Call Button */}
        <button
          onClick={() => {
            onLeave();
            onCloseOverlay();
          }}
          aria-label="End Call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-[135deg]" fill="currentColor">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-2.2 2.2a15.053 15.053 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 3.99c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.61c0-.55-.45-1-.99-1z" />
          </svg>
        </button>

        {/* Speaker / Audio Toggle */}
        <button
          onClick={() => setSpeakerActive((s) => !s)}
          aria-label="Speaker"
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
            speakerActive
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-white/10 text-muted-foreground hover:bg-white/20"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
