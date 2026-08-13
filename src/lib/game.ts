import { supabase } from "@/integrations/supabase/client";
import type { RoleKey } from "./roles";

export type Phase =
  | "ROLE_DISTRIBUTION"
  | "NIGHT_WOLVES"
  | "NIGHT_DETECTIVE"
  | "NIGHT_DOCTOR"
  | "NIGHT_RESULT"
  | "DAY_DISCUSSION"
  | "DAY_CONCLUSION"
  | "DAY_VOTING";

export type Player = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_ready: boolean;
  is_alive: boolean;
  card_seen: boolean;
  is_host: boolean;
  is_bot: boolean;
  wants_vote: boolean;
  role: RoleKey | null;
};

export type RoomState = {
  room: {
    id: string;
    room_code: string;
    host_id: string;
    status: "LOBBY" | "IN_PROGRESS" | "FINISHED";
    current_phase: Phase | null;
    round_number: number;
    phase_ends_at: string | null;
    speaker_index: number;
    winner: string | null;
  };
  speaker_id: string | null;
  living_count: number;
  wants_vote_count: number;
  me: {
    user_id: string;
    role: RoleKey | null;
    is_alive: boolean;
    is_ready: boolean;
    card_seen: boolean;
    self_heal_used: boolean;
    wants_vote: boolean;
    is_host: boolean;
  };
  night: {
    wolf_target: string | null;
    detective_target: string | null;
    doctor_target: string | null;
  } | null;
  votes: { voter_id: string; target_id: string }[];
  players: Player[];
};

export type ChatMessage = {
  id: string;
  sender_id: string | null;
  channel: "GLOBAL" | "WOLF_PRIVATE" | "DETECTIVE_PRIVATE";
  content: string | null;
  audio_url: string | null;
  created_at: string;
};

function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const api = {
  async getState(roomId: string) {
    return unwrap(await supabase.rpc("get_room_state", { p_room_id: roomId })) as unknown as RoomState;
  },
  async roomIdByCode(code: string) {
    return unwrap(await supabase.rpc("room_id_by_code", { p_code: code })) as string | null;
  },
  async createRoom() {
    return unwrap(await supabase.rpc("create_room")) as string;
  },
  async joinRoom(code: string) {
    return unwrap(await supabase.rpc("join_room", { p_code: code })) as string;
  },
  async setReady(roomId: string, ready: boolean) {
    unwrap(await supabase.rpc("set_ready", { p_room_id: roomId, p_ready: ready }));
  },
  async startGame(roomId: string) {
    unwrap(await supabase.rpc("start_game", { p_room_id: roomId }));
  },
  async confirmCard(roomId: string) {
    unwrap(await supabase.rpc("confirm_card", { p_room_id: roomId }));
  },
  async wolfVote(roomId: string, target: string) {
    unwrap(await supabase.rpc("wolf_vote", { p_room_id: roomId, p_target: target }));
  },
  async detectiveCheck(roomId: string, target: string) {
    return unwrap(await supabase.rpc("detective_check", { p_room_id: roomId, p_target: target })) as boolean;
  },
  async doctorHeal(roomId: string, target: string) {
    unwrap(await supabase.rpc("doctor_heal", { p_room_id: roomId, p_target: target }));
  },
  async castVote(roomId: string, target: string) {
    unwrap(await supabase.rpc("cast_vote", { p_room_id: roomId, p_target: target }));
  },
  async passTurn(roomId: string) {
    unwrap(await supabase.rpc("pass_turn", { p_room_id: roomId }));
  },
  async addBots(roomId: string, count: number) {
    unwrap(await supabase.rpc("add_bots", { p_room_id: roomId, p_count: count }));
  },
  async removeBots(roomId: string, count: number) {
    unwrap(await supabase.rpc("remove_bots", { p_room_id: roomId, p_count: count }));
  },
  async readyToVote(roomId: string, ready: boolean) {
    unwrap(await supabase.rpc("ready_to_vote", { p_room_id: roomId, p_ready: ready }));
  },
  async runBots(roomId: string) {
    await supabase.rpc("run_bots", { p_room_id: roomId });
  },
  async tick(roomId: string) {
    await supabase.rpc("tick_room", { p_room_id: roomId });
  },
  async messages(roomId: string) {
    const res = await supabase
      .from("messages")
      .select("id, sender_id, channel, content, audio_url, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(500);
    return unwrap(res) as ChatMessage[];
  },
  async sendMessage(roomId: string, channel: ChatMessage["channel"], content: string) {
    const { data: auth } = await supabase.auth.getUser();
    unwrap(
      await supabase
        .from("messages")
        .insert({ room_id: roomId, sender_id: auth.user?.id ?? "", channel, content }),
    );
  },
  async sendVoiceNote(roomId: string, channel: ChatMessage["channel"], blob: Blob) {
    const { data: auth } = await supabase.auth.getUser();
    const path = `${roomId}/${crypto.randomUUID()}.webm`;
    const up = await supabase.storage.from("voice-notes").upload(path, blob, {
      contentType: blob.type || "audio/webm",
    });
    if (up.error) throw new Error(up.error.message);
    unwrap(
      await supabase
        .from("messages")
        .insert({ room_id: roomId, sender_id: auth.user?.id ?? "", channel, audio_url: path }),
    );
  },
  async voiceUrl(path: string) {
    const res = await supabase.storage.from("voice-notes").createSignedUrl(path, 3600);
    return res.data?.signedUrl ?? null;
  },
};

export const AVATARS = [
  "wolfie",
  "raven",
  "ember",
  "ghost",
  "hunter",
  "silas",
  "mira",
  "juno",
  "kai",
  "nova",
  "rook",
  "vera",
].map((seed) => `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${seed}&backgroundColor=1f1f22`);

export function phaseKey(phase: Phase | null, status: string) {
  if (status === "LOBBY") return "phase.LOBBY";
  if (status === "FINISHED") return "phase.FINISHED";
  return phase ? `phase.${phase}` : "phase.LOBBY";
}
