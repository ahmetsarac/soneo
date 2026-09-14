import type { WSContext } from "hono/ws";
import {
  getRoomIfOpen,
  leaveRoom,
  lookupRoom,
  postChat,
  serializeRoom,
  setMediaState,
  type ChatMessage,
  type Room,
} from "./rooms.js";

type Socket = WSContext;

type ClientMessage = {
  type?: string;
  text?: string;
  to?: string;
  data?: unknown;
  micOn?: boolean;
  camOn?: boolean;
  screenOn?: boolean;
};

export type ServerEvent =
  | {
      type: "snapshot";
      room: ReturnType<typeof serializeRoom>;
      messages: ChatMessage[];
    }
  | { type: "room"; room: ReturnType<typeof serializeRoom> }
  | { type: "chat"; message: ChatMessage }
  | { type: "signal"; from: string; data: unknown }
  | { type: "closed"; reason: "ROOM_CLOSED" | "ROOM_NOT_FOUND" };

export const DISCONNECT_GRACE_MS = 2500;

const sockets = new Map<string, Map<string, Socket>>();
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function disconnectKey(code: string, participantId: string) {
  return `${code}:${participantId}`;
}

function clearDisconnectTimer(code: string, participantId: string) {
  const key = disconnectKey(code, participantId);
  const timer = disconnectTimers.get(key);
  if (!timer) return;
  clearTimeout(timer);
  disconnectTimers.delete(key);
}

function liveSerialize(room: Room) {
  const live = sockets.get(room.code);
  const serialized = serializeRoom(room);
  return {
    ...serialized,
    participants: serialized.participants.filter((person) => live?.has(person.id)),
  };
}

function send(socket: Socket, event: ServerEvent) {
  try {
    socket.send(JSON.stringify(event));
  } catch {
    // ignore broken sockets
  }
}

function roomSockets(code: string) {
  let map = sockets.get(code);
  if (!map) {
    map = new Map();
    sockets.set(code, map);
  }
  return map;
}

export function broadcast(code: string, event: ServerEvent) {
  const map = sockets.get(code);
  if (!map) return;
  for (const socket of map.values()) send(socket, event);
}

export function closeRoomSockets(
  code: string,
  reason: "ROOM_CLOSED" | "ROOM_NOT_FOUND" = "ROOM_CLOSED",
) {
  const map = sockets.get(code);
  if (!map) return;
  for (const socket of map.values()) {
    send(socket, { type: "closed", reason });
    try {
      socket.close();
    } catch {
      // ignore
    }
  }
  sockets.delete(code);
}

export function notifyRoom(code: string, message?: ChatMessage | null) {
  const room = getRoomIfOpen(code);
  if (!room) {
    closeRoomSockets(code, "ROOM_CLOSED");
    return;
  }
  broadcast(code, { type: "room", room: liveSerialize(room) });
  if (message) broadcast(code, { type: "chat", message });
}

function dropDisconnected(code: string, participantId: string) {
  clearDisconnectTimer(code, participantId);
  disconnectTimers.set(
    disconnectKey(code, participantId),
    setTimeout(() => {
      disconnectTimers.delete(disconnectKey(code, participantId));
      if (sockets.get(code)?.has(participantId)) return;
      try {
        const { message } = leaveRoom(code, participantId);
        notifyRoom(code, message);
      } catch {
        // room already gone
      }
    }, DISCONNECT_GRACE_MS),
  );
}

export function attachSocket(code: string, participantId: string, socket: Socket) {
  const room = getRoomIfOpen(code);
  const participant = room?.participants.get(participantId);
  if (!room || !participant) {
    const reason = lookupRoom(code) === "closed" ? "ROOM_CLOSED" : "ROOM_NOT_FOUND";
    send(socket, { type: "closed", reason });
    socket.close();
    return false;
  }

  clearDisconnectTimer(code, participantId);

  const map = roomSockets(code);
  const previous = map.get(participantId);
  map.set(participantId, socket);
  if (previous && previous !== socket) {
    try {
      previous.close();
    } catch {
      // ignore
    }
  }
  send(socket, {
    type: "snapshot",
    room: liveSerialize(room),
    messages: room.messages,
  });
  notifyRoom(code);
  return true;
}

export function detachSocket(code: string, participantId: string, socket: Socket) {
  const map = sockets.get(code);
  if (map?.get(participantId) !== socket) return;

  map.delete(participantId);
  if (map.size === 0) sockets.delete(code);
  notifyRoom(code);
  dropDisconnected(code, participantId);
}

export function routeSignal(
  code: string,
  from: string,
  to: string,
  data: unknown,
) {
  if (!to || to === from) return false;
  const target = sockets.get(code)?.get(to);
  if (!target) return false;
  send(target, { type: "signal", from, data });
  return true;
}

export function handleClientMessage(
  code: string,
  participantId: string,
  raw: string,
) {
  let parsed: ClientMessage;
  try {
    parsed = JSON.parse(raw) as ClientMessage;
  } catch {
    return;
  }

  if (parsed.type === "chat") {
    const { message } = postChat(code, participantId, String(parsed.text ?? ""));
    broadcast(code, { type: "chat", message });
    return;
  }

  if (parsed.type === "signal") {
    routeSignal(code, participantId, String(parsed.to ?? ""), parsed.data);
    return;
  }

  if (parsed.type === "media") {
    setMediaState(code, participantId, {
      micOn: typeof parsed.micOn === "boolean" ? parsed.micOn : undefined,
      camOn: typeof parsed.camOn === "boolean" ? parsed.camOn : undefined,
      screenOn: typeof parsed.screenOn === "boolean" ? parsed.screenOn : undefined,
    });
    notifyRoom(code);
  }
}

export function resetRealtime() {
  for (const timer of disconnectTimers.values()) clearTimeout(timer);
  disconnectTimers.clear();
  sockets.clear();
}
