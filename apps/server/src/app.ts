import { upgradeWebSocket } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import {
  attachSocket,
  detachSocket,
  handleClientMessage,
  notifyRoom,
} from "./realtime.js";
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  RoomError,
  serializeRoom,
} from "./rooms.js";
import { parseCorsOrigins } from "./origins.js";

const app = new Hono();

const corsMiddleware = cors({
  origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

app.use(async (c, next) => {
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return next();
  }
  return corsMiddleware(c, next);
});

app.use(async (c, next) => {
  if (c.req.header("upgrade")?.toLowerCase() === "websocket") {
    return next();
  }
  return logger()(c, next);
});

app.onError((err, c) => {
  if (err instanceof RoomError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: "HTTP", message: err.message } },
      err.status,
    );
  }

  console.error(err);
  return c.json(
    { error: { code: "INTERNAL", message: "Bir şeyler ters gitti." } },
    500,
  );
});

app.get("/", (c) => c.json({ ok: true, name: "soneo" }));

app.post("/rooms", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { room, participant } = createRoom(String(body.nickname ?? ""));
  return c.json({ room: serializeRoom(room), participant }, 201);
});

app.post("/rooms/:code/join", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { room, participant, message } = joinRoom(
    c.req.param("code"),
    String(body.nickname ?? ""),
  );
  notifyRoom(room.code, message);
  return c.json({ room: serializeRoom(room), participant });
});

app.get("/rooms/:code", (c) => {
  const room = getRoom(c.req.param("code"));
  return c.json({ room: serializeRoom(room) });
});

app.post("/rooms/:code/leave", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const participantId = String(body.participantId ?? "");
  if (!participantId) {
    throw new RoomError(400, "INVALID_PARTICIPANT", "participantId gerekli.");
  }

  const code = c.req.param("code");
  const { room, message } = leaveRoom(code, participantId);
  notifyRoom(code, message);
  return c.json({ room: room ? serializeRoom(room) : null });
});

app.get(
  "/rooms/:code/ws",
  upgradeWebSocket((c) => {
    const code = c.req.param("code") ?? "";
    const participantId = c.req.query("participantId") ?? "";

    return {
      onOpen(_event, socket) {
        attachSocket(code, participantId, socket);
      },
      onMessage(event) {
        if (typeof event.data !== "string") return;
        try {
          handleClientMessage(code, participantId, event.data);
        } catch (err) {
          if (err instanceof RoomError && err.status === 400) return;
          console.error(err);
        }
      },
      onClose(_event, socket) {
        detachSocket(code, participantId, socket);
      },
    };
  }),
);

export { app };
