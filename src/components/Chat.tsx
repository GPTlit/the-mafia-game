import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type ChatMessage, type Player } from "@/lib/game";
import { useI18n } from "@/lib/i18n";
import { VoiceNote } from "@/components/VoiceNote";

function Recorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onDone(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      rec.current = mr;
      setSecs(0);
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  function stop() {
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={() => (recording ? stop() : void start())}
      aria-label="Record a voice message"
      className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 transition-colors ${
        recording
          ? "bg-destructive text-destructive-foreground"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {recording ? (
        <>
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
          <span className="text-xs font-semibold tabular-nums">
            0:{String(secs).padStart(2, "0")}
          </span>
        </>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}

export function Chat({
  roomId,
  channel,
  messages,
  players,
  meId,
  canWrite,
  anonymous = false,
  allowVoice = true,
  placeholder,
  actionSlot,
  onSent,
}: {
  roomId: string;
  channel: ChatMessage["channel"];
  messages: ChatMessage[];
  players: Player[];
  meId: string;
  canWrite: boolean;
  anonymous?: boolean;
  allowVoice?: boolean;
  placeholder?: string;
  actionSlot?: ReactNode;
  onSent?: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = messages.filter((m) => m.channel === channel);
  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  const nameOf = (id: string | null) => {
    if (!id) return t("chat.operatorName");
    if (anonymous) return t("chat.wolfName");
    return players.find((p) => p.user_id === id)?.username ?? "PLAYER";
  };

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.sendMessage(roomId, channel, text.trim());
      setText("");
      stick.current = true;
      onSent?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-1"
      >
        <div className="flex min-h-full flex-col justify-end gap-1.5 py-2">
          {list.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">{t("chat.empty")}</p>
          )}
          {list.map((m) => {
            const system = m.sender_id === null;
            const mine = !system && !anonymous && m.sender_id === meId;
            if (system) {
              return (
                <p
                  key={m.id}
                  className="mx-auto max-w-[85%] rounded-full bg-secondary px-3 py-1.5 text-center text-[11px] text-muted-foreground"
                >
                  {m.content}
                </p>
              );
            }
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-secondary text-secondary-foreground"
                  }`}
                >
                  {!mine && (
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {nameOf(m.sender_id)}
                    </p>
                  )}
                  {m.content && <p className="break-words">{m.content}</p>}
                  {m.audio_url && (
                    <div className="mt-1">
                      <VoiceNote path={m.audio_url} mine={mine} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {actionSlot}

      {canWrite ? (
        <div className="mt-2 flex items-end gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder={placeholder ?? t("chat.placeholder")}
            className="h-10 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-primary"
          />
          {allowVoice && (
            <Recorder
              onDone={(blob) => {
                stick.current = true;
                void api.sendVoiceNote(roomId, channel, blob).then(() => onSent?.());
              }}
            />
          )}
          <button
            onClick={() => void send()}
            aria-label={t("chat.send")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:-scale-x-100" fill="currentColor">
              <path d="M3 20.5 21 12 3 3.5l3.5 7.2L15 12l-8.5 1.3L3 20.5Z" />
            </svg>
          </button>
        </div>
      ) : (
        <p className="mt-2 text-center text-xs text-muted-foreground">{t("chat.spectator")}</p>
      )}
    </div>
  );
}
