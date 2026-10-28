import { useState } from "react";
import { Headphones, Mic, MicOff, PhoneOff, Shield } from "lucide-react";
import type { Player } from "@/lib/game";
import { useI18n } from "@/lib/i18n";
import { SeatTable } from "@/components/SeatTable";

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

/** Night / voice-chat screen: full-bleed table photo, names beside people, no avatars. */
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
  const ar = lang === "ar";
  const [speakerActive, setSpeakerActive] = useState(true);
  const [shield, setShield] = useState(false);

  if (!inCall) return null;

  const me = players.find((p) => p.user_id === meId);
  const speakingId = !muted ? meId : null;
  const btn = "grid h-[76px] place-items-center rounded-[22px] bg-[#1c1c1d] transition active:scale-95";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#0b0b0c] px-3 pb-4 pt-3 text-[#efe4cf] animate-in fade-in duration-200">
      <div className="mx-auto flex w-full max-w-lg flex-col">
        <div className="rounded-[22px] bg-[#1c1c1d] py-3 text-center">
          <h3 className="text-2xl font-medium">
            {ar ? "الليل - المافيا تستيقظ" : "Night - The Mafia wakes"} ☽
          </h3>
          <p dir="ltr" className="mt-2 text-base text-[#b9b2a6]">
            Night Phase • Voice Chat • {Math.max(peerCount + 1, 1)} Players
          </p>
        </div>

        <div className="relative -mx-3 mt-2">
          <SeatTable
            variant="night"
            players={players}
            meId={meId}
            messages={[]}
            speakerId={speakingId}
          />
          {me && !muted && (
            <div className="absolute left-1/2 top-[27%] -translate-x-1/2 rounded-xl bg-[#1a1517]/80 px-4 py-2 text-center">
              <b className="text-lg font-semibold">
                {me.username} • {ar ? "يتحدث" : "speaking"}
                <i className="ms-2 inline-block h-2 w-2 rounded-full bg-[#3ddc6a]" />
              </b>
            </div>
          )}
        </div>

        <div dir="ltr" className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(players.length, 1), 4)}, minmax(0, 1fr))` }}>
          {players.slice(0, 8).map((p) => {
            const off = p.user_id === meId ? muted : true;
            return (
              <div key={p.user_id} className="flex flex-col items-center gap-2">
                {off ? <MicOff className="h-9 w-9 text-[#8c857a]" strokeWidth={1.4} /> : <Mic className="h-9 w-9 text-[#3ddc6a]" strokeWidth={1.4} />}
                <span className="max-w-full truncate rounded-full bg-[#1b1b1c] px-3 py-1 text-sm text-[#b9b2a6]">
                  {p.user_id === meId ? `${p.username} •` : p.username}
                </span>
              </div>
            );
          })}
        </div>

        <div dir="ltr" className="mt-4 grid grid-cols-4 gap-2.5">
          <button onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"} className={btn}>
            {muted ? <MicOff className="h-8 w-8" strokeWidth={1.6} /> : <Mic className="h-8 w-8" strokeWidth={1.6} />}
          </button>
          <button
            onClick={() => setSpeakerActive((s) => !s)}
            aria-label="Speaker"
            className={`${btn} ${speakerActive ? "" : "opacity-50"}`}
          >
            <Headphones className="h-8 w-8" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => setShield((s) => !s)}
            aria-label="Shield"
            className={`${btn} ${shield ? "ring-1 ring-[#efe4cf]" : ""}`}
          >
            <Shield className="h-8 w-8" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => {
              onLeave();
              onCloseOverlay();
            }}
            aria-label="End Call"
            className="grid h-[76px] place-items-center rounded-[22px] bg-[#5a2223] transition active:scale-95"
          >
            <PhoneOff className="h-8 w-8 text-[#e0343a]" strokeWidth={1.8} />
          </button>
        </div>

        <p className="mt-4 text-center text-lg">
          {ar ? "الجميع في صمت • المافيا تختار هدفها الآن" : "Everyone is silent • The Mafia choose their target"}
        </p>
      </div>
    </div>
  );
}
