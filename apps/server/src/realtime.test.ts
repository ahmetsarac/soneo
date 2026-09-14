import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WSContext } from "hono/ws";
import {
  attachSocket,
  detachSocket,
  DISCONNECT_GRACE_MS,
  handleClientMessage,
  resetRealtime,
  routeSignal,
} from "./realtime.js";
import { createRoom, getRoom, joinRoom, resetStore } from "./rooms.js";

function mockSocket() {
  const events: unknown[] = [];
  const socket = {
    events,
    send(data: string) {
      events.push(JSON.parse(data));
    },
    close() {
      events.push({ type: "__close" });
    },
  };
  return socket as typeof socket & WSContext;
}

describe("realtime signaling", () => {
  beforeEach(() => {
    resetStore();
    resetRealtime();
  });

  afterEach(() => {
    resetStore();
    resetRealtime();
  });

  it("sends a snapshot when a participant connects", () => {
    const { room, participant } = createRoom("kara");
    const socket = mockSocket();
    attachSocket(room.code, participant.id, socket);
    expect(socket.events[0]).toMatchObject({
      type: "snapshot",
      room: { code: room.code },
    });
  });

  it("broadcasts chat to everyone in the room", () => {
    const created = createRoom("kara");
    const joined = joinRoom(created.room.code, "mavi");
    const a = mockSocket();
    const b = mockSocket();
    attachSocket(created.room.code, created.participant.id, a);
    attachSocket(created.room.code, joined.participant.id, b);
    a.events.length = 0;
    b.events.length = 0;

    handleClientMessage(
      created.room.code,
      created.participant.id,
      JSON.stringify({ type: "chat", text: "selam" }),
    );

    expect(a.events).toContainEqual(
      expect.objectContaining({
        type: "chat",
        message: expect.objectContaining({ text: "selam" }),
      }),
    );
    expect(b.events).toContainEqual(
      expect.objectContaining({
        type: "chat",
        message: expect.objectContaining({ text: "selam" }),
      }),
    );
  });

  it("forwards WebRTC signals only to the target peer", () => {
    const created = createRoom("kara");
    const joined = joinRoom(created.room.code, "mavi");
    const a = mockSocket();
    const b = mockSocket();
    attachSocket(created.room.code, created.participant.id, a);
    attachSocket(created.room.code, joined.participant.id, b);
    a.events.length = 0;
    b.events.length = 0;

    const payload = { description: { type: "offer", sdp: "fake" } };
    const routed = routeSignal(
      created.room.code,
      created.participant.id,
      joined.participant.id,
      payload,
    );

    expect(routed).toBe(true);
    expect(b.events).toEqual([
      {
        type: "signal",
        from: created.participant.id,
        data: payload,
      },
    ]);
    expect(a.events).toEqual([]);
  });

  it("drops signals to missing or self peers", () => {
    const { room, participant } = createRoom("kara");
    const socket = mockSocket();
    attachSocket(room.code, participant.id, socket);
    socket.events.length = 0;

    expect(routeSignal(room.code, participant.id, participant.id, {})).toBe(false);
    expect(routeSignal(room.code, participant.id, "missing", {})).toBe(false);
    expect(socket.events).toEqual([]);
  });

  it("broadcasts media state changes", () => {
    const { room, participant } = createRoom("kara");
    const socket = mockSocket();
    attachSocket(room.code, participant.id, socket);
    socket.events.length = 0;

    handleClientMessage(
      room.code,
      participant.id,
      JSON.stringify({ type: "media", micOn: false, camOn: true, screenOn: true }),
    );

    expect(socket.events[0]).toMatchObject({
      type: "room",
      room: {
        participants: [
          expect.objectContaining({ micOn: false, camOn: true, screenOn: true }),
        ],
      },
    });
  });

  it("hides a participant as soon as their socket drops", () => {
    vi.useFakeTimers();
    try {
      const created = createRoom("kara");
      const joined = joinRoom(created.room.code, "mavi");
      const a = mockSocket();
      const b = mockSocket();
      attachSocket(created.room.code, created.participant.id, a);
      attachSocket(created.room.code, joined.participant.id, b);
      a.events.length = 0;

      detachSocket(created.room.code, joined.participant.id, b);

      expect(a.events).toContainEqual(
        expect.objectContaining({
          type: "room",
          room: {
            code: created.room.code,
            createdAt: created.room.createdAt,
            participants: [
              expect.objectContaining({ id: created.participant.id }),
            ],
          },
        }),
      );
      expect(getRoom(created.room.code).participants.has(joined.participant.id)).toBe(
        true,
      );

      vi.advanceTimersByTime(DISCONNECT_GRACE_MS);

      expect(getRoom(created.room.code).participants.has(joined.participant.id)).toBe(
        false,
      );
      expect(a.events).toContainEqual(
        expect.objectContaining({
          type: "chat",
          message: expect.objectContaining({ text: expect.stringContaining("mavi") }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a participant if they reconnect before the leave grace", () => {
    vi.useFakeTimers();
    try {
      const created = createRoom("kara");
      const joined = joinRoom(created.room.code, "mavi");
      const a = mockSocket();
      const first = mockSocket();
      attachSocket(created.room.code, created.participant.id, a);
      attachSocket(created.room.code, joined.participant.id, first);
      detachSocket(created.room.code, joined.participant.id, first);

      const again = mockSocket();
      attachSocket(created.room.code, joined.participant.id, again);
      a.events.length = 0;
      vi.advanceTimersByTime(DISCONNECT_GRACE_MS);

      expect(getRoom(created.room.code).participants.has(joined.participant.id)).toBe(
        true,
      );
      expect(a.events.some((event) => (event as { type?: string }).type === "chat")).toBe(
        false,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not leave when a replaced socket closes", () => {
    vi.useFakeTimers();
    try {
      const created = createRoom("kara");
      const first = mockSocket();
      const second = mockSocket();
      attachSocket(created.room.code, created.participant.id, first);
      attachSocket(created.room.code, created.participant.id, second);
      detachSocket(created.room.code, created.participant.id, first);
      vi.advanceTimersByTime(DISCONNECT_GRACE_MS);
      expect(getRoom(created.room.code).participants.has(created.participant.id)).toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
