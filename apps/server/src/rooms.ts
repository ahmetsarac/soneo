export type Participant = {
  id: string;
  nickname: string;
  joinedAt: number;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
};

export type ChatMessage = {
  id: string;
  kind: "user" | "system";
  participantId?: string;
  nickname?: string;
  text: string;
  sentAt: number;
};

export type Room = {
  code: string;
  createdAt: number;
  participants: Map<string, Participant>;
  messages: ChatMessage[];
};

export type RoomState = "open" | "closed" | "unknown";

type ErrorStatus = 400 | 404 | 409 | 410 | 500;

export class RoomError extends Error {
  constructor(
    public status: ErrorStatus,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const rooms = new Map<string, Room>();
const closedRooms = new Map<string, number>();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_NICKNAME = 20;
const MIN_NICKNAME = 2;
const MAX_PARTICIPANTS = 20;
const MAX_MESSAGES = 100;
const MAX_CHAT = 2000;
const NICK_RE = /^[\p{L}\p{N}_. -]+$/u;

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export function normalizeNickname(nickname: string) {
  const nick = nickname.trim().replace(/\s+/g, " ");

  if (nick.length < MIN_NICKNAME || nick.length > MAX_NICKNAME) {
    throw new RoomError(
      400,
      "INVALID_NICKNAME",
      `Nick ${MIN_NICKNAME}–${MAX_NICKNAME} karakter olmalı.`,
    );
  }

  if (!NICK_RE.test(nick)) {
    throw new RoomError(
      400,
      "INVALID_NICKNAME",
      "Nick harf, rakam, boşluk, nokta, _ ve - içerebilir.",
    );
  }

  return nick;
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes]
    .map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length])
    .join("");
}

function uniqueCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    if (!rooms.has(code) && !closedRooms.has(code)) return code;
  }
  throw new RoomError(500, "CODE_GEN_FAILED", "Oda kodu üretilemedi.");
}

function makeParticipant(nickname: string): Participant {
  return {
    id: crypto.randomUUID(),
    nickname,
    joinedAt: Date.now(),
    micOn: true,
    camOn: false,
    screenOn: false,
  };
}

function appendMessage(room: Room, message: ChatMessage) {
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
}

function systemMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    kind: "system",
    text,
    sentAt: Date.now(),
  };
}

export function serializeRoom(room: Room) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    participants: [...room.participants.values()],
  };
}

export function lookupRoom(code: string): RoomState {
  const normalized = normalizeCode(code);
  if (rooms.has(normalized)) return "open";
  if (closedRooms.has(normalized)) return "closed";
  return "unknown";
}

function assertOpen(code: string) {
  const state = lookupRoom(code);
  if (state === "closed") {
    throw new RoomError(410, "ROOM_CLOSED", "Bu oda kapatıldı.");
  }
  if (state === "unknown") {
    throw new RoomError(404, "ROOM_NOT_FOUND", "Böyle bir oda yok.");
  }
}

export function createRoom(nickname: string) {
  const nick = normalizeNickname(nickname);
  const room: Room = {
    code: uniqueCode(),
    createdAt: Date.now(),
    participants: new Map(),
    messages: [],
  };
  const participant = makeParticipant(nick);
  room.participants.set(participant.id, participant);
  rooms.set(room.code, room);
  return { room, participant };
}

export function joinRoom(code: string, nickname: string) {
  assertOpen(code);
  const room = rooms.get(normalizeCode(code))!;

  if (room.participants.size >= MAX_PARTICIPANTS) {
    throw new RoomError(409, "ROOM_FULL", "Oda dolu.");
  }

  const participant = makeParticipant(normalizeNickname(nickname));
  room.participants.set(participant.id, participant);
  const message = systemMessage(`${participant.nickname} katıldı`);
  appendMessage(room, message);
  return { room, participant, message };
}

export function getRoom(code: string) {
  assertOpen(code);
  return rooms.get(normalizeCode(code))!;
}

export function getRoomIfOpen(code: string) {
  return rooms.get(normalizeCode(code)) ?? null;
}

export function leaveRoom(code: string, participantId: string) {
  assertOpen(code);
  const room = rooms.get(normalizeCode(code))!;
  const leaving = room.participants.get(participantId);
  if (!leaving) return { room, message: null };
  room.participants.delete(participantId);

  if (room.participants.size === 0) {
    rooms.delete(room.code);
    closedRooms.set(room.code, Date.now());
    return { room: null, message: null };
  }

  const message = leaving
    ? systemMessage(`${leaving.nickname} ayrıldı`)
    : null;
  if (message) appendMessage(room, message);
  return { room, message };
}

export function postChat(code: string, participantId: string, text: string) {
  const room = getRoomIfOpen(code);
  const participant = room?.participants.get(participantId);
  if (!room || !participant) {
    throw new RoomError(404, "ROOM_NOT_FOUND", "Böyle bir oda yok.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new RoomError(400, "INVALID_CHAT", "Mesaj boş olamaz.");
  }
  if (trimmed.length > MAX_CHAT) {
    throw new RoomError(400, "INVALID_CHAT", `Mesaj en fazla ${MAX_CHAT} karakter.`);
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    kind: "user",
    participantId: participant.id,
    nickname: participant.nickname,
    text: trimmed,
    sentAt: Date.now(),
  };
  appendMessage(room, message);
  return { room, message };
}

export function setMediaState(
  code: string,
  participantId: string,
  state: { micOn?: boolean; camOn?: boolean; screenOn?: boolean },
) {
  const room = getRoomIfOpen(code);
  const participant = room?.participants.get(participantId);
  if (!room || !participant) {
    throw new RoomError(404, "ROOM_NOT_FOUND", "Böyle bir oda yok.");
  }

  if (typeof state.micOn === "boolean") participant.micOn = state.micOn;
  if (typeof state.camOn === "boolean") participant.camOn = state.camOn;
  if (typeof state.screenOn === "boolean") participant.screenOn = state.screenOn;
  return room;
}

export function resetStore() {
  rooms.clear();
  closedRooms.clear();
}
