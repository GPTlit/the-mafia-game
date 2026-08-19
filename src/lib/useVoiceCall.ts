import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Signal =
  | { kind: "hello"; from: string }
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "bye"; from: string };

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] }],
};

/**
 * Live group voice call: a small WebRTC mesh signalled over the realtime channel.
 * Everyone who joins hears everyone else; mute stops your mic being sent.
 */
export function useVoiceCall(roomId: string | null, selfId: string | null) {
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stream = useRef<MediaStream | null>(null);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const conns = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map());

  const send = (payload: Signal) => {
    void channel.current?.send({ type: "broadcast", event: "signal", payload });
  };

  const dropPeer = useCallback((id: string) => {
    conns.current.get(id)?.close();
    conns.current.delete(id);
    const el = audios.current.get(id);
    if (el) {
      el.srcObject = null;
      el.remove();
      audios.current.delete(id);
    }
    setPeers((p) => p.filter((x) => x !== id));
  }, []);

  const peerFor = useCallback(
    (id: string) => {
      const existing = conns.current.get(id);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE);
      stream.current?.getTracks().forEach((tr) => pc.addTrack(tr, stream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate && selfId)
          send({ kind: "ice", from: selfId, to: id, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        let el = audios.current.get(id);
        if (!el) {
          el = document.createElement("audio");
          el.autoplay = true;
          el.style.display = "none";
          document.body.appendChild(el);
          audios.current.set(id, el);
        }
        el.srcObject = e.streams[0] ?? null;
        void el.play().catch(() => {});
        setPeers((p) => (p.includes(id) ? p : [...p, id]));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") dropPeer(id);
      };
      conns.current.set(id, pc);
      return pc;
    },
    [selfId, dropPeer],
  );

  const leave = useCallback(() => {
    if (selfId) send({ kind: "bye", from: selfId });
    conns.current.forEach((pc) => pc.close());
    conns.current.clear();
    audios.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audios.current.clear();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (channel.current) {
      void supabase.removeChannel(channel.current);
      channel.current = null;
    }
    setPeers([]);
    setInCall(false);
    setMuted(false);
  }, [selfId]);

  const join = useCallback(async () => {
    if (!roomId || !selfId || inCall) return;
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError("mic");
      return;
    }

    const ch = supabase.channel(`voice-${roomId}`, { config: { broadcast: { self: false } } });
    channel.current = ch;

    ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const msg = payload as Signal;
      if (!msg || msg.from === selfId) return;
      try {
        if (msg.kind === "hello") {
          const pc = peerFor(msg.from);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ kind: "offer", from: selfId, to: msg.from, sdp: offer });
        } else if (msg.kind === "offer" && msg.to === selfId) {
          const pc = peerFor(msg.from);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ kind: "answer", from: selfId, to: msg.from, sdp: answer });
        } else if (msg.kind === "answer" && msg.to === selfId) {
          const pc = conns.current.get(msg.from);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } else if (msg.kind === "ice" && msg.to === selfId) {
          const pc = conns.current.get(msg.from);
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.kind === "bye") {
          dropPeer(msg.from);
        }
      } catch {
        /* transient negotiation errors are safe to ignore */
      }
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") send({ kind: "hello", from: selfId });
    });

    setInCall(true);
  }, [roomId, selfId, inCall, peerFor, dropPeer]);

  const toggleMute = useCallback(() => {
    const tracks = stream.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  useEffect(() => () => leave(), [leave]);

  return { inCall, muted, peerCount: peers.length, error, join, leave, toggleMute };
}
