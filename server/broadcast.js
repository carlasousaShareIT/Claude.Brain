// broadcast.js — SSE clients and webhook firing

// SSE clients for live pulse
export const sseClients = [];

export const broadcastEvent = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch {}
  }
};

// Fire webhooks matching an event — fire-and-forget
export const fireWebhooks = (brain, event, section, value) => {
  const ts = new Date().toISOString();
  for (const wh of (brain.webhooks || [])) {
    if (wh.events && wh.events.includes(event)) {
      fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, section, value, ts }),
      }).catch(() => {});
    }
  }
};

// SSE heartbeat — keep connections alive
export const startHeartbeat = () => {
  setInterval(() => {
    for (const client of sseClients) {
      try { client.write(": heartbeat\n\n"); } catch {}
    }
  }, 30000);
};
