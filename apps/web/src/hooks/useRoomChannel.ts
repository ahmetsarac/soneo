"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@/lib/api";
import {
  roomSocketUrl,
  type ChatMessage,
  type ServerEvent,
} from "@/lib/realtime";

export function useRoomChannel(code: string, participantId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [gone, setGone] = useState<"closed" | "missing" | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef(new Set<(event: ServerEvent) => void>());

  const subscribe = useCallback((listener: (event: ServerEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const sendEvent = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  useEffect(() => {
    if (!participantId) return;

    let stopped = false;
    let retry = 0;
    let timer = 0;

    function connect() {
      const socket = new WebSocket(roomSocketUrl(code, participantId!));
      socketRef.current = socket;

      socket.onopen = () => {
        retry = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ServerEvent;
          if (payload.type === "snapshot") {
            setRoom(payload.room);
            setMessages(payload.messages);
          } else if (payload.type === "room") {
            setRoom(payload.room);
          } else if (payload.type === "chat") {
            setMessages((current) =>
              current.some((message) => message.id === payload.message.id)
                ? current
                : [...current, payload.message],
            );
          } else if (payload.type === "closed") {
            setGone(payload.reason === "ROOM_CLOSED" ? "closed" : "missing");
            stopped = true;
            socket.close();
          }

          for (const listener of listenersRef.current) listener(payload);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (stopped) return;
        retry += 1;
        timer = window.setTimeout(connect, Math.min(1000 * 2 ** retry, 8000));
      };
    }

    connect();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [code, participantId]);

  const sendChat = useCallback(
    (text: string) => sendEvent({ type: "chat", text }),
    [sendEvent],
  );

  const sendSignal = useCallback(
    (to: string, data: unknown) => sendEvent({ type: "signal", to, data }),
    [sendEvent],
  );

  const sendMedia = useCallback(
    (state: { micOn: boolean; camOn: boolean; screenOn: boolean }) =>
      sendEvent({ type: "media", ...state }),
    [sendEvent],
  );

  return {
    room,
    messages,
    connected,
    gone,
    subscribe,
    sendChat,
    sendSignal,
    sendMedia,
  };
}
