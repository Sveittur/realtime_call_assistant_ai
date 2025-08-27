import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { setupRealtimeProxy } from "./realtimeClient";


const app = express();
const server = http.createServer(app);

// WS server on same port
const wss = new WebSocketServer({ server });
setupRealtimeProxy(wss);

app.get("/", (_, res) => res.send("Realtime GPT server running"));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
