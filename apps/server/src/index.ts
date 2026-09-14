import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 4000;
const wss = new WebSocketServer({ noServer: true });

serve(
  {
    fetch: app.fetch,
    port,
    websocket: { server: wss },
  },
  (info) => {
    console.log(`soneo server http://localhost:${info.port}`);
  },
);
