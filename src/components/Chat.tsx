import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type ChatMessage, type Player } from "@/lib/game";
import { useI18n } from "@/lib/i18n";
import { VoiceNote } from "@/components/VoiceNote";

function RecorderAndSwipeUp({
  onDone,
  onSwipeUpTriggerCall,
}: {
  onDone: (blob: Blob) => void;
  onSwipeUpTriggerCall: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef<number | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.current.length > 0) {
          onDone(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
        }
      };
      mr.start();
      rec.current = mr;
      setSecs(0);
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  function stopRecording() {
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
    setDragOffset(0);
    startY.current = null;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
    void startRecording();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const currentY = e.touches[0]?.clientY ?? startY.current;
    const diff = startY.current - currentY; // positive when swiping up
    if (diff > 0) {
      setDragOffset(Math.min(diff, 120));
      // Threshold reached -> trigger voice call elevation
      if (diff > 90) {
        if (rec.current) {
          rec.current.stop();
          rec.current = null;
          setRecording(false);
        }
        setDragOffset(0);
        startY.current = null;
        onSwipeUpTriggerCall();
      }
    }
  };

  const handleTouchEnd = () => {
    stopRecording();
  };

  return (
    <div className="relative flex items-center">
      {/* Floating glowing pill when dragging up */}
      {recording && dragOffset > 15 && (
        <div
          className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 shadow-lg shadow-emerald-500/40 text-[10px] font-bold text-black"
          style={{ transform: `translate(-50%, -${dragOffset * 0.7}px)` }}
        >
          <span>📞</span>
          <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping" />
        </div>
      )}

      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (recording) stopRecording();
          else void startRecording();
        }}
        aria-label="Voice Note or Swipe Up"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
          recording
            ? "bg-red-500 text-foreground scale-110 shadow-lg shadow-red-500/30"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15 active:scale-95"
        }`}
      >
        {recording ? (
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold tabular-nums">{secs}s</span>
          </div>
        ) : (
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
        )}
      </button>
    </div>
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
  onOpenVoiceCall,
  feedOverride,
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
  onOpenVoiceCall?: () => void;
  feedOverride?: ReactNode;
}) {
  const { lang, t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = messages.filter((m) => m.channel === channel);
  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [list.length]);

  const nameOf = (id: string | null) => {
    if (!id) return lang === "ar" ? "الراوي" : "OPERATOR";
    if (anonymous) return lang === "ar" ? "ذئب مجهول" : "WOLF";
    return players.find((p) => p.user_id === id)?.username ?? "PLAYER";
  };

  const avatarOf = (id: string | null) => {
    if (!id || anonymous) return "/logo.png";
    return players.find((p) => p.user_id === id)?.avatar_url ?? "/logo.png";
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {feedOverride ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{feedOverride}</div>
      ) : (
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      >
        <div className="flex min-h-full flex-col justify-end gap-2.5">
          {list.length === 0 && (
            <div className="my-auto py-8 text-center text-xs text-muted-foreground">
              <span className="text-2xl">💬</span>
              <p className="mt-2">{t("chat.empty")}</p>
            </div>
          )}

          {list.map((m) => {
            const isSystem = m.sender_id === null;
            const isMine = !isSystem && !anonymous && m.sender_id === meId;
            const senderName = nameOf(m.sender_id);
            const senderAvatar = avatarOf(m.sender_id);
            const timeLabel = formatTime(m.created_at);

            if (isSystem) {
              return (
                <div key={m.id} className="mx-auto my-1 max-w-[90%] text-center">
                  <span className="inline-block rounded-full bg-foreground/10 px-3.5 py-1 text-[11px] font-semibold text-foreground/90 shadow-sm backdrop-blur-md">
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {!isMine && (
                  <img
                    src={senderAvatar}
                    alt={senderName}
                    className="h-7 w-7 rounded-full border border-border bg-secondary object-cover shrink-0"
                  />
                )}

                <div
                  className={`relative max-w-[82%] rounded-2xl px-3.5 py-2 text-xs shadow-md ${
                    isMine
                      ? "rounded-br-none bg-primary text-primary-foreground"
                      : "rounded-bl-none bg-card text-foreground border border-border"
                  }`}
                >
                  {!isMine && (
                    <div className="mb-0.5 flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-bold text-red-400">{senderName}</span>
                      {timeLabel && (
                        <span className="text-[9px] text-muted-foreground">{timeLabel}</span>
                      )}
                    </div>
                  )}

                  {m.content && <p className="break-words leading-relaxed">{m.content}</p>}

                  {m.audio_url && (
                    <div className="mt-1">
                      <VoiceNote path={m.audio_url} mine={isMine} />
                    </div>
                  )}

                  {isMine && timeLabel && (
                    <div className="mt-0.5 text-right text-[9px] opacity-70">{timeLabel}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {actionSlot}

      {/* Pinned Bottom WhatsApp-Style Composer */}
      {canWrite ? (
        <div className="mt-auto shrink-0 border-t border-border bg-card/90 px-3 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenVoiceCall?.()}
              aria-label="Call icon"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            >
              📞
            </button>

            <div className="relative flex-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void send()}
                placeholder={placeholder ?? (lang === "ar" ? "اكتب رسالة…" : "Type a message…")}
                className="w-full rounded-full border border-border bg-foreground/5 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
              />
            </div>

            {text.trim() ? (
              <button
                onClick={() => void send()}
                aria-label={t("chat.send")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="currentColor">
                  <path d="M3 20.5 21 12 3 3.5l3.5 7.2L15 12l-8.5 1.3L3 20.5Z" />
                </svg>
              </button>
            ) : allowVoice ? (
              <RecorderAndSwipeUp
                onDone={(blob) => {
                  stick.current = true;
                  void api.sendVoiceNote(roomId, channel, blob).then(() => onSent?.());
                }}
                onSwipeUpTriggerCall={() => onOpenVoiceCall?.()}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-border bg-card/60 py-2.5 text-center text-xs text-muted-foreground">
          {t("chat.spectator")}
        </div>
      )}
    </div>
  );
}
