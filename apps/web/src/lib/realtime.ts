import { API_URL, type Room } from "./api";

export type ChatMessage = {
  id: string;
  kind: "user" | "system";
  participantId?: string;
  nickname?: string;
  text: string;
  sentAt: number;
};

export type ServerEvent =
  | { type: "snapshot"; room: Room; messages: ChatMessage[] }
  | { type: "room"; room: Room }
  | { type: "chat"; message: ChatMessage }
  | { type: "signal"; from: string; data: unknown }
  | { type: "closed"; reason: "ROOM_CLOSED" | "ROOM_NOT_FOUND" };

export function roomSocketUrl(code: string, participantId: string) {
  const protocol = API_URL.startsWith("https") ? "wss" : "ws";
  const host = API_URL.replace(/^https?:\/\//, "");
  return `${protocol}://${host}/rooms/${encodeURIComponent(code)}/ws?participantId=${encodeURIComponent(participantId)}`;
}
