import { useEffect, useRef, useState } from "react";
import { api, type ChatMessage, type Player } from "@/lib/game";

function VoiceNote({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void api.voiceUrl(path).then(setUrl);
  }, [path]);
  if (!url) return <span className="text-xs text-muted-foreground">loading voice note…</span>;
  return <audio controls src={url} className="h-8 w-52 max-w-full" />;
}

function Recorder({ onDone }: { onDone: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

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
      className={`display shrink-0 rounded-md border px-3 py-2 text-[11px] font-bold tracking-widest uppercase ${
        recording ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {recording ? "Stop" : "Rec"}
    </button>
  );
}

export function Chat({
  roomId,
  channel,
  messages,
  players,
  canWrite,
  anonymous = false,
  allowVoice = false,
  placeholder = "Say something…",
  onSent,
}: {
  roomId: string;
  channel: ChatMessage["channel"];
  messages: ChatMessage[];
  players: Player[];
  canWrite: boolean;
  anonymous?: boolean;
  allowVoice?: boolean;
  placeholder?: string;
  onSent?: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = messages.filter((m) => m.channel === channel);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  const nameOf = (id: string | null) => {
    if (!id) return "OPERATOR";
    if (anonymous) return "WOLF";
    return players.find((p) => p.user_id === id)?.username ?? "PLAYER";
  };

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.sendMessage(roomId, channel, text.trim());
      setText("");
      onSent?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {list.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No messages yet.</p>
        )}
        {list.map((m) => {
          const system = m.sender_id === null;
          return (
            <div
              key={m.id}
              className={`rounded-md px-3 py-2 text-sm ${
                system ? "border border-primary/40 bg-primary/10" : "bg-secondary"
              }`}
            >
              <p className="display text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {nameOf(m.sender_id)}
              </p>
              {m.content && <p className="mt-0.5 break-words">{m.content}</p>}
              {m.audio_url && (
                <div className="mt-1">
                  <VoiceNote path={m.audio_url} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canWrite ? (
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {allowVoice && (
            <Recorder
              onDone={(blob) => {
                void api.sendVoiceNote(roomId, channel, blob).then(() => onSent?.());
              }}
            />
          )}
          <button
            onClick={() => void send()}
            className="display shrink-0 rounded-md bg-primary px-3 py-2 text-[11px] font-bold tracking-widest text-primary-foreground uppercase"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          You are watching in spectator mode.
        </p>
      )}
    </div>
  );
}