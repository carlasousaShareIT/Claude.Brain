// routes/sse.js — Server-Sent Events endpoint

import { Router } from "express";
import { sseClients } from "../broadcast.js";

const router = Router();

// GET /memory/stream — SSE endpoint for live pulse
router.get("/memory/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);
  console.log(`[brain] SSE client connected (${sseClients.length} total)`);

  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
    console.log(`[brain] SSE client disconnected (${sseClients.length} total)`);
  });
});

export default router;
