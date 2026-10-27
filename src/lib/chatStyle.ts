import { useEffect, useState } from "react";

export type ChatStyle = "bubbles" | "side";
const KEY = "mafia_chat_style";
const EVT = "mafia-chat-style";

export function getChatStyle(): ChatStyle {
  try {
    return localStorage.getItem(KEY) === "side" ? "side" : "bubbles";
  } catch {
    return "bubbles";
  }
}

export function setChatStyle(s: ChatStyle) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useChatStyle(): ChatStyle {
  const [s, setS] = useState<ChatStyle>("bubbles");
  useEffect(() => {
    setS(getChatStyle());
    const on = () => setS(getChatStyle());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return s;
}
