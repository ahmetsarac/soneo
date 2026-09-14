import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  lookupRoom,
  postChat,
  resetStore,
  RoomError,
  serializeRoom,
  setMediaState,
} from "./rooms.js";

describe("rooms", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("creates a room with the host inside", () => {
    const { room, participant } = createRoom("kara");
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(participant.nickname).toBe("kara");
    expect(participant.micOn).toBe(true);
    expect(participant.camOn).toBe(false);
    expect(participant.screenOn).toBe(false);
    expect(serializeRoom(room).participants).toHaveLength(1);
  });

  it("rejects short nicknames", () => {
    expect(() => createRoom("x")).toThrow(RoomError);
    try {
      createRoom("x");
    } catch (err) {
      expect(err).toMatchObject({ status: 400, code: "INVALID_NICKNAME" });
    }
  });

  it("joins an existing room and records a system message", () => {
    const { room } = createRoom("kara");
    const joined = joinRoom(room.code, "mavi");
    expect(joined.participant.nickname).toBe("mavi");
    expect(joined.room.participants.size).toBe(2);
    expect(joined.message.kind).toBe("system");
    expect(joined.message.text).toContain("mavi");
  });

  it("closes the room when the last person leaves", () => {
    const { room, participant } = createRoom("kara");
    const code = room.code;
    const result = leaveRoom(code, participant.id);
    expect(result.room).toBeNull();
    expect(lookupRoom(code)).toBe("closed");
    expect(() => getRoom(code)).toThrowError(RoomError);
    try {
      getRoom(code);
    } catch (err) {
      expect(err).toMatchObject({ status: 410, code: "ROOM_CLOSED" });
    }
  });

  it("keeps the room open and announces leave when others remain", () => {
    const created = createRoom("kara");
    const joined = joinRoom(created.room.code, "mavi");
    const result = leaveRoom(created.room.code, created.participant.id);
    expect(result.room?.participants.size).toBe(1);
    expect(result.message?.text).toContain("kara");
    expect(lookupRoom(created.room.code)).toBe("open");
    expect(joined.room.participants.has(joined.participant.id)).toBe(true);
  });

  it("ignores leaving a participant who is already gone", () => {
    const created = createRoom("kara");
    joinRoom(created.room.code, "mavi");
    leaveRoom(created.room.code, created.participant.id);
    const again = leaveRoom(created.room.code, created.participant.id);
    expect(again.room?.participants.size).toBe(1);
    expect(again.message).toBeNull();
  });

  it("treats unknown codes as missing, not closed", () => {
    expect(lookupRoom("ZZZZZZ")).toBe("unknown");
    try {
      joinRoom("ZZZZZZ", "yeni");
    } catch (err) {
      expect(err).toMatchObject({ status: 404, code: "ROOM_NOT_FOUND" });
    }
  });

  it("rejects joining a closed room", () => {
    const { room, participant } = createRoom("kara");
    leaveRoom(room.code, participant.id);
    try {
      joinRoom(room.code, "yeni");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toMatchObject({ status: 410, code: "ROOM_CLOSED" });
    }
  });

  it("stores chat messages for people in the room", () => {
    const { room, participant } = createRoom("kara");
    const { message } = postChat(room.code, participant.id, "  selam  ");
    expect(message.kind).toBe("user");
    expect(message.text).toBe("selam");
    expect(room.messages).toHaveLength(1);
  });

  it("rejects empty chat", () => {
    const { room, participant } = createRoom("kara");
    expect(() => postChat(room.code, participant.id, "   ")).toThrow(RoomError);
  });

  it("updates mic, cam and screen flags", () => {
    const { room, participant } = createRoom("kara");
    setMediaState(room.code, participant.id, {
      micOn: false,
      camOn: true,
      screenOn: true,
    });
    const updated = room.participants.get(participant.id);
    expect(updated?.micOn).toBe(false);
    expect(updated?.camOn).toBe(true);
    expect(updated?.screenOn).toBe(true);
  });
});
