import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Encryption
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Database setup
const db = new Database("bot.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    fb_user_id TEXT UNIQUE,
    fb_access_token TEXT,
    plan TEXT DEFAULT 'Starter',
    message_count INTEGER DEFAULT 0,
    last_reset DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    fb_page_id TEXT UNIQUE,
    name TEXT,
    access_token TEXT,
    is_active BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    name TEXT,
    is_active BOOLEAN DEFAULT 0,
    nodes TEXT,
    edges TEXT,
    FOREIGN KEY (page_id) REFERENCES pages(id)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    fb_user_id TEXT,
    state TEXT,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id)
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    keyword TEXT,
    match_type TEXT,
    flow_id TEXT,
    FOREIGN KEY (page_id) REFERENCES pages(id)
  );

  CREATE TABLE IF NOT EXISTS user_tags (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    fb_user_id TEXT,
    tag TEXT,
    UNIQUE(page_id, fb_user_id, tag)
  );

  CREATE TABLE IF NOT EXISTS user_variables (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    fb_user_id TEXT,
    key TEXT,
    value TEXT,
    UNIQUE(page_id, fb_user_id, key)
  );
`);

app.use(cors());

// Webhook parser with signature verification
app.use('/webhook', express.json({
  verify: (req: any, res: any, buf: any) => {
    const signature = req.headers["x-hub-signature-256"];
    if (!signature && req.method === 'POST') {
      console.warn("Missing signature");
    } else if (signature) {
      const expectedHash = crypto
        .createHmac("sha256", process.env.META_CLIENT_SECRET || "")
        .update(buf)
        .digest("hex");
      if (signature.split("=")[1] !== expectedHash) {
        throw new Error("Invalid signature");
      }
    }
  }
}));

app.use(express.json());

// --- AUTH ROUTES ---
app.get("/api/auth/facebook/url", (req, res) => {
  const redirectUri = `${process.env.APP_URL}/api/auth/facebook/callback`;
  const clientId = process.env.META_CLIENT_ID;
  const scopes = "pages_show_list,pages_messaging,pages_manage_metadata";
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
  res.json({ url });
});

app.get("/api/auth/facebook/callback", async (req, res) => {
  const { code } = req.query;
  const redirectUri = `${process.env.APP_URL}/api/auth/facebook/callback`;
  const clientId = process.env.META_CLIENT_ID;
  const clientSecret = process.env.META_CLIENT_SECRET;

  try {
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);
    
    const shortLivedToken = tokenData.access_token;
    const longTokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`);
    const longTokenData = await longTokenRes.json();
    const accessToken = longTokenData.access_token || shortLivedToken;

    const userRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    const userData = await userRes.json();

    let user = db.prepare("SELECT * FROM users WHERE fb_user_id = ?").get(userData.id) as any;
    const encryptedToken = encrypt(accessToken);
    
    if (!user) {
      const id = uuidv4();
      db.prepare("INSERT INTO users (id, email, name, fb_user_id, fb_access_token) VALUES (?, ?, ?, ?, ?)").run(
        id, userData.email || `${userData.id}@facebook.com`, userData.name, userData.id, encryptedToken
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    } else {
      db.prepare("UPDATE users SET fb_access_token = ?, name = ?, email = ? WHERE id = ?").run(
        encryptedToken, userData.name, userData.email || user.email, user.id
      );
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth Error:", error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// --- PAGES ROUTES ---
app.get("/api/pages", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const pages = db.prepare("SELECT id, user_id, fb_page_id, name, is_active FROM pages WHERE user_id = ?").all(userId);
  res.json({ pages });
});

app.post("/api/pages/sync", async (req, res) => {
  const { userId } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const accessToken = decrypt(user.fb_access_token);
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesRes.json();

    if (pagesData.error) throw new Error(pagesData.error.message);

    const stmt = db.prepare("INSERT INTO pages (id, user_id, fb_page_id, name, access_token) VALUES (?, ?, ?, ?, ?) ON CONFLICT(fb_page_id) DO UPDATE SET name = excluded.name, access_token = excluded.access_token");
    
    const insertMany = db.transaction((pages) => {
      for (const page of pages) {
        stmt.run(uuidv4(), userId, page.id, page.name, encrypt(page.access_token));
      }
    });

    if (pagesData.data) {
      insertMany(pagesData.data);
    }

    const updatedPages = db.prepare("SELECT id, user_id, fb_page_id, name, is_active FROM pages WHERE user_id = ?").all(userId);
    res.json({ pages: updatedPages });
  } catch (error: any) {
    console.error("Sync Pages Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pages/:id/toggle", (req, res) => {
  const pageId = req.params.id;
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return res.status(404).json({ error: "Page not found" });
  
  const newStatus = page.is_active ? 0 : 1;
  db.prepare("UPDATE pages SET is_active = ? WHERE id = ?").run(newStatus, pageId);
  res.json({ success: true, is_active: newStatus });
});

// --- FLOWS ROUTES ---
app.get("/api/pages/:pageId/flows", (req, res) => {
  const pageId = req.params.pageId;
  const flows = db.prepare("SELECT * FROM flows WHERE page_id = ?").all(pageId);
  res.json({ flows });
});

app.post("/api/flows", (req, res) => {
  const { pageId, name, nodes, edges } = req.body;
  const id = uuidv4();
  const defaultNodes = nodes ? JSON.stringify(nodes) : JSON.stringify([{ id: 'start', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start Trigger' } }]);
  const defaultEdges = edges ? JSON.stringify(edges) : JSON.stringify([]);
  
  db.prepare("INSERT INTO flows (id, page_id, name, nodes, edges) VALUES (?, ?, ?, ?, ?)").run(id, pageId, name, defaultNodes, defaultEdges);
  res.json({ success: true, flow: { id, page_id: pageId, name, is_active: 0, nodes: defaultNodes, edges: defaultEdges } });
});

app.get("/api/flows/:id", (req, res) => {
  const flowId = req.params.id;
  const flow = db.prepare("SELECT * FROM flows WHERE id = ?").get(flowId);
  if (!flow) return res.status(404).json({ error: "Flow not found" });
  res.json({ flow });
});

app.put("/api/flows/:id", (req, res) => {
  const flowId = req.params.id;
  const { nodes, edges } = req.body;
  db.prepare("UPDATE flows SET nodes = ?, edges = ? WHERE id = ?").run(JSON.stringify(nodes), JSON.stringify(edges), flowId);
  res.json({ success: true });
});

app.delete("/api/flows/:id", (req, res) => {
  const flowId = req.params.id;
  const result = db.prepare("DELETE FROM flows WHERE id = ?").run(flowId);
  if (result.changes === 0) return res.status(404).json({ error: "Flow not found" });
  res.json({ success: true });
});

app.post("/api/flows/:id/toggle", (req, res) => {
  const flowId = req.params.id;
  const flow = db.prepare("SELECT * FROM flows WHERE id = ?").get(flowId) as any;
  if (!flow) return res.status(404).json({ error: "Flow not found" });
  
  const newStatus = flow.is_active ? 0 : 1;
  if (newStatus === 1) {
    db.prepare("UPDATE flows SET is_active = 0 WHERE page_id = ?").run(flow.page_id);
  }
  db.prepare("UPDATE flows SET is_active = ? WHERE id = ?").run(newStatus, flowId);
  res.json({ success: true, is_active: newStatus });
});

// --- KEYWORDS ROUTES ---
app.get("/api/pages/:pageId/keywords", (req, res) => {
  const keywords = db.prepare("SELECT * FROM keywords WHERE page_id = ?").all(req.params.pageId);
  res.json({ keywords });
});

app.post("/api/keywords", (req, res) => {
  const { pageId, keyword, matchType, flowId } = req.body;
  const id = uuidv4();
  db.prepare("INSERT INTO keywords (id, page_id, keyword, match_type, flow_id) VALUES (?, ?, ?, ?, ?)").run(id, pageId, keyword, matchType, flowId);
  res.json({ success: true });
});

app.delete("/api/keywords/:id", (req, res) => {
  db.prepare("DELETE FROM keywords WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- SETTINGS ROUTES ---
app.post("/api/pages/:pageId/settings/greeting", async (req, res) => {
  const { text } = req.body;
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(req.params.pageId) as any;
  if (!page) return res.status(404).json({ error: "Page not found" });
  
  try {
    const token = decrypt(page.access_token);
    await fetch(`https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        greeting: [{ locale: "default", text }]
      })
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update greeting" });
  }
});

app.post("/api/pages/:pageId/settings/get_started", async (req, res) => {
  const { payload } = req.body;
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(req.params.pageId) as any;
  if (!page) return res.status(404).json({ error: "Page not found" });
  
  try {
    const token = decrypt(page.access_token);
    await fetch(`https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        get_started: { payload }
      })
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update get started" });
  }
});

// --- WEBHOOK ---
app.get("/webhook", (req, res) => {
  // Use the environment variable, or fallback to the token provided by the user ("pagebot")
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "pagebot";
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      // Meta requires the challenge to be returned as plain text
      return res.status(200).type('text/plain').send(challenge);
    } else {
      console.error("WEBHOOK_VERIFICATION_FAILED", { expected: VERIFY_TOKEN, received: token });
      return res.sendStatus(403);
    }
  }
  
  // Return 200 for basic ping
  return res.status(200).send("Webhook is running");
});

app.post("/webhook", async (req, res) => {
  const body = req.body;
  
  if (body.object === "page") {
    for (const entry of body.entry) {
      const pageId = entry.id;
      const page = db.prepare("SELECT * FROM pages WHERE fb_page_id = ? AND is_active = 1").get(pageId) as any;
      if (!page) continue;

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(page.user_id) as any;
      if (!user) continue;

      const limits: any = { 'Starter': 1000, 'Business': 10000, 'Pro': 100000 };
      if (user.message_count >= (limits[user.plan] || 1000)) {
        console.log(`User ${user.id} reached message limit.`);
        continue;
      }

      for (const webhook_event of entry.messaging) {
        const senderId = webhook_event.sender.id;
        
        let messageText = "";
        if (webhook_event.message && !webhook_event.message.is_echo) {
          messageText = webhook_event.message.text || "";
          if (webhook_event.message.quick_reply) {
            messageText = webhook_event.message.quick_reply.payload;
          }
        } else if (webhook_event.postback) {
          messageText = webhook_event.postback.payload;
        }

        if (messageText) {
          // Check Keywords
          const keywords = db.prepare("SELECT * FROM keywords WHERE page_id = ?").all(page.id) as any[];
          let matchedFlowId = null;
          for (const kw of keywords) {
            if (kw.match_type === 'exact' && messageText.toLowerCase() === kw.keyword.toLowerCase()) {
              matchedFlowId = kw.flow_id; break;
            } else if (kw.match_type === 'contains' && messageText.toLowerCase().includes(kw.keyword.toLowerCase())) {
              matchedFlowId = kw.flow_id; break;
            } else if (kw.match_type === 'regex') {
              try {
                const re = new RegExp(kw.keyword, 'i');
                if (re.test(messageText)) { matchedFlowId = kw.flow_id; break; }
              } catch(e) {}
            }
          }

          let flow;
          if (matchedFlowId) {
            flow = db.prepare("SELECT * FROM flows WHERE id = ?").get(matchedFlowId) as any;
            db.prepare("DELETE FROM conversations WHERE page_id = ? AND fb_user_id = ?").run(page.id, senderId);
          } else {
            flow = db.prepare("SELECT * FROM flows WHERE page_id = ? AND is_active = 1 LIMIT 1").get(page.id) as any;
          }

          if (flow) {
            const nodes = JSON.parse(flow.nodes || '[]');
            const edges = JSON.parse(flow.edges || '[]');
            await processFlow(page, user, senderId, messageText, nodes, edges);
          }
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

async function processFlow(page: any, user: any, senderId: string, messageText: string, nodes: any[], edges: any[]) {
  let conversation = db.prepare("SELECT * FROM conversations WHERE page_id = ? AND fb_user_id = ?").get(page.id, senderId) as any;
  let currentNodeId = null;

  if (!conversation) {
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) return;
    currentNodeId = triggerNode.id;
    db.prepare("INSERT INTO conversations (id, page_id, fb_user_id, state) VALUES (?, ?, ?, ?)").run(uuidv4(), page.id, senderId, currentNodeId);
  } else {
    currentNodeId = conversation.state;
  }

  let loopCount = 0;
  while (loopCount < 20) {
    loopCount++;
    const nextNodeId = getNextNodeForMessage(currentNodeId, nodes, edges, messageText);
    if (!nextNodeId) break;

    const nextNode = nodes.find((n: any) => n.id === nextNodeId);
    if (!nextNode) break;

    if (nextNode.type === 'message') {
      await sendMetaMessage(page.access_token, senderId, { text: nextNode.data.label });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      currentNodeId = nextNode.id;
    } else if (nextNode.type === 'image') {
      await sendMetaMessage(page.access_token, senderId, {
        attachment: { type: "image", payload: { url: nextNode.data.url || "https://picsum.photos/400/300", is_reusable: true } }
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      currentNodeId = nextNode.id;
    } else if (nextNode.type === 'quick_replies') {
      const replies = nextNode.data.replies || ['Yes', 'No'];
      const quickReplies = replies.map((r: string) => ({ content_type: "text", title: r, payload: r }));
      await sendMetaMessage(page.access_token, senderId, {
        text: nextNode.data.label,
        quick_replies: quickReplies
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      currentNodeId = nextNode.id;
      break; // Wait for input
    } else if (nextNode.type === 'buttons') {
      const buttons = (nextNode.data.buttons || ['Click Here']).map((b: string) => ({ type: "postback", title: b, payload: b }));
      await sendMetaMessage(page.access_token, senderId, {
        attachment: {
          type: "template",
          payload: { template_type: "button", text: nextNode.data.label, buttons: buttons.slice(0,3) }
        }
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      currentNodeId = nextNode.id;
      break; // Wait for input
    } else if (nextNode.type === 'set_variable') {
      db.prepare("INSERT INTO user_variables (id, page_id, fb_user_id, key, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT(page_id, fb_user_id, key) DO UPDATE SET value = excluded.value").run(uuidv4(), page.id, senderId, nextNode.data.key, nextNode.data.value);
      currentNodeId = nextNode.id;
    } else if (nextNode.type === 'add_tag') {
      db.prepare("INSERT OR IGNORE INTO user_tags (id, page_id, fb_user_id, tag) VALUES (?, ?, ?, ?)").run(uuidv4(), page.id, senderId, nextNode.data.tag);
      currentNodeId = nextNode.id;
    } else if (nextNode.type === 'input') {
      await sendMetaMessage(page.access_token, senderId, { text: nextNode.data.label });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      currentNodeId = nextNode.id;
      break; // Stop and wait for user input
    } else {
      currentNodeId = nextNode.id;
    }
  }

  if (currentNodeId !== (conversation?.state || null)) {
    db.prepare("UPDATE conversations SET state = ?, last_interaction = CURRENT_TIMESTAMP WHERE page_id = ? AND fb_user_id = ?").run(currentNodeId, page.id, senderId);
  }
}

function getNextNodeForMessage(currentNodeId: string, nodes: any[], edges: any[], messageText: string) {
  const currentNode = nodes.find((n: any) => n.id === currentNodeId);
  if (!currentNode) return null;

  if (currentNode.type === 'condition') {
      const conditionText = currentNode.data.label.toLowerCase();
      const isMatch = messageText.toLowerCase().includes(conditionText);
      const sourceHandle = isMatch ? 'true' : 'false';
      const edge = edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === sourceHandle);
      return edge ? edge.target : null;
  } else {
      const edge = edges.find((e: any) => e.source === currentNodeId);
      return edge ? edge.target : null;
  }
}

async function sendMetaMessage(encryptedToken: string, recipientId: string, messagePayload: any) {
  try {
    const token = decrypt(encryptedToken);
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload,
        messaging_type: "RESPONSE"
      })
    });
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
