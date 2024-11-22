import fs from 'fs';
import express from 'express';
import { WebSocket } from 'ws';
import config from './config.js';
import http from 'http';
import https from 'https';

const { protocol, ip, port, ssl } = config.server;
const RELAY_URLS = config.relays;

const app = express();
app.use(express.json());

const NOTES_FILE = "./notes.json";

const loadNotes = () => {
  try {
    const data = fs.readFileSync(NOTES_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading notes file:", e);
    return [];
  }
};

const saveNotes = (notes) => {
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (e) {
    console.error("Error writing to notes file:", e);
  }
};

const validateEventFormat = (event) => {
  const requiredFields = ["id", "pubkey", "created_at", "kind", "tags", "content", "sig"];
  for (const field of requiredFields) {
    if (!event[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

const broadcastToRelays = async (event) => {
  const parsedEvent = JSON.parse(event);

  const eventPayload = {
    id: parsedEvent.id,
    pubkey: parsedEvent.pubkey,
    created_at: parsedEvent.created_at,
    kind: parsedEvent.kind,
    tags: parsedEvent.tags,
    content: parsedEvent.content,
    sig: parsedEvent.sig,
  };

  for (const relayUrl of RELAY_URLS) {
    try {
      const ws = new WebSocket(relayUrl);

      ws.on('open', () => {
        const message = JSON.stringify(["EVENT", eventPayload]);
        ws.send(message);
        console.log(`Event broadcasted to relay: ${relayUrl}`);
        ws.close();
      });

      ws.on('error', (err) => {
        console.error(`Error connecting to relay ${relayUrl}:`, err);
      });
    } catch (e) {
      console.error(`Failed to broadcast to relay ${relayUrl}:`, e);
    }
  }
};

app.post("/api/notes", (req, res) => {
  try {
    const { broadcast_id, planned_date, event } = req.body;

    if (!broadcast_id || !planned_date || !event) {
      return res.status(400).send("Missing required fields.");
    }

    const parsedEvent = JSON.parse(event);
    validateEventFormat(parsedEvent);

    const notes = loadNotes();
    notes.push({ broadcast_id, planned_date, event });
    saveNotes(notes);

    console.log(`Received note: ${broadcast_id} scheduled for ${planned_date}`);
    res.status(200).send("Note saved successfully.");
  } catch (e) {
    console.error("Error saving note:", e.message);
    res.status(500).send(`Error saving note: ${e.message}`);
  }
});

setInterval(() => {
  const notes = loadNotes();
  const now = new Date();

  const remainingNotes = notes.filter((note) => {
    const plannedDate = new Date(note.planned_date);

    if (plannedDate <= now) {
      broadcastToRelays(note.event);
      return false;
    }
    return true;
  });

  if (remainingNotes.length !== notes.length) {
    saveNotes(remainingNotes);
    console.log(`Broadcasted ${notes.length - remainingNotes.length} notes.`);
  }
}, 30000);

let server;

if (protocol === "https") {
  try {
    const sslOptions = {
      key: fs.readFileSync(ssl.key),
      cert: fs.readFileSync(ssl.cert),
    };
    server = https.createServer(sslOptions, app);
    server.listen(port, ip, () => {
      console.log(`HTTPS Server running at https://${ip}:${port}`);
    });
  } catch (e) {
    console.error("Failed to start HTTPS server:", e);
    process.exit(1);
  }
} else {
  server = http.createServer(app);
  server.listen(port, ip, () => {
    console.log(`HTTP Server running at http://${ip}:${port}`);
  });
}
