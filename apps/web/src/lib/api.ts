export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Participant = {
  id: string;
  nickname: string;
  joinedAt: number;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
};

export type Room = {
  code: string;
  createdAt: number;
  participants: Participant[];
};

export type Session = {
  roomCode: string;
  participantId: string;
  nickname: string;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? "HTTP",
      body.error?.message ?? "İstek başarısız.",
    );
  }

  return body;
}

export function createRoom(nickname: string) {
  return request<{ room: Room; participant: Participant }>("/rooms", {
    method: "POST",
    body: JSON.stringify({ nickname }),
  });
}

export function joinRoom(code: string, nickname: string) {
  return request<{ room: Room; participant: Participant }>(
    `/rooms/${encodeURIComponent(code)}/join`,
    {
      method: "POST",
      body: JSON.stringify({ nickname }),
    },
  );
}

export function getRoom(code: string) {
  return request<{ room: Room }>(`/rooms/${encodeURIComponent(code)}`);
}

export function leaveRoom(code: string, participantId: string) {
  return request<{ room: Room | null }>(
    `/rooms/${encodeURIComponent(code)}/leave`,
    {
      method: "POST",
      body: JSON.stringify({ participantId }),
    },
  );
}

export function roomGoneKind(err: unknown): "closed" | "missing" | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 410 || err.code === "ROOM_CLOSED") return "closed";
  if (err.status === 404 || err.code === "ROOM_NOT_FOUND") return "missing";
  return null;
}
