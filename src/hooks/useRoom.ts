import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api, type ChatMessage, type RoomState } from "@/lib/game";

export function useRoom(roomId: string | null) {
  const [state, setState] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (!roomId || loading.current) return;
    loading.current = true;
    try {
      const [s, m] = await Promise.all([api.getState(roomId), api.messages(roomId)]);
      setState(s);
      setMessages(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room");
    } finally {
      loading.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // realtime: any game table change re-reads the sanitized state
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`room-${roomId}`);
    for (const table of ["rooms", "room_players", "messages", "votes"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void refresh();
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  // bot engine: any watcher nudges the server so bots act
  useEffect(() => {
    if (!roomId) return;
    if (state?.room.status !== "IN_PROGRESS") return;
    if (!state.players.some((p) => p.is_bot && p.is_alive)) return;
    const id = setInterval(() => {
      void api.runBots(roomId);
    }, 2500);
    return () => clearInterval(id);
  }, [roomId, state?.room.status, state?.room.current_phase, state?.players]);

  // timer engine: whoever is watching nudges the server when a phase expires
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => {
      const endsAt = state?.room.phase_ends_at;
      if (state?.room.status !== "IN_PROGRESS" || !endsAt) return;
      if (new Date(endsAt).getTime() <= Date.now()) {
        void api.tick(roomId).then(refresh);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [roomId, state?.room.phase_ends_at, state?.room.status, refresh]);

  return { state, messages, error, refresh };
}

export function useCountdown(endsAt: string | null | undefined) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}