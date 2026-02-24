import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Encryption
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "dev-fixed-key-12345678901234567890123456789012"; // Fixed fallback for demo persistence
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error("Decryption failed:", e);
    return ""; // Return empty string on failure
  }
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
    ai_enabled BOOLEAN DEFAULT 1,
    ai_prompt TEXT DEFAULT 'You are a helpful assistant.',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    name TEXT,
    is_active BOOLEAN DEFAULT 0,
    is_default BOOLEAN DEFAULT 0,
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
    channel TEXT DEFAULT 'messenger',
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

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    page_id TEXT,
    fb_user_id TEXT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel TEXT DEFAULT 'messenger',
    FOREIGN KEY (page_id) REFERENCES pages(id)
  );
`);

// Migration for existing tables
try {
  db.exec("ALTER TABLE conversations ADD COLUMN channel TEXT DEFAULT 'messenger'");
} catch (e) {}
try {
  db.exec("ALTER TABLE messages ADD COLUMN channel TEXT DEFAULT 'messenger'");
} catch (e) {}

// Migration for existing tables
try {
  db.prepare("ALTER TABLE pages ADD COLUMN ai_enabled BOOLEAN DEFAULT 1").run();
} catch (e) {
  // If column exists, ensure default is 1 for new rows (SQLite doesn't support ALTER COLUMN DEFAULT easily, but we can update existing nulls/0s if desired)
  // For this demo, let's just update all existing pages to enable AI if it was 0 or null, as requested "enable it by default"
  db.prepare("UPDATE pages SET ai_enabled = 1 WHERE ai_enabled IS NULL OR ai_enabled = 0").run();
}
try {
  db.prepare("ALTER TABLE pages ADD COLUMN ai_prompt TEXT DEFAULT 'You are a helpful assistant.'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE flows ADD COLUMN is_default BOOLEAN DEFAULT 0").run();
} catch (e) {}

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
  const scopes = "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement";
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

    const stmt = db.prepare("INSERT INTO pages (id, user_id, fb_page_id, name, access_token, is_active) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(fb_page_id) DO UPDATE SET name = excluded.name, access_token = excluded.access_token");
    
    const insertMany = db.transaction((pages) => {
      for (const page of pages) {
        stmt.run(uuidv4(), userId, page.id, page.name, encrypt(page.access_token));
      }
    });

    if (pagesData.data) {
      insertMany(pagesData.data);
      
      // Subscribe to pages after DB insertion
      for (const page of pagesData.data) {
        try {
          console.log(`[Sync] Subscribing app to page: ${page.name} (${page.id})`);
          const subRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads&access_token=${page.access_token}`, {
            method: 'POST'
          });
          const subData = await subRes.json();
          if (subData.success) {
             console.log(`[Sync] Successfully subscribed to page: ${page.name}`);
          } else {
             console.error(`[Sync] Failed to subscribe to page ${page.name}:`, JSON.stringify(subData));
          }
        } catch (e) {
          console.error(`[Sync] Error subscribing to page ${page.name}:`, e);
        }
      }
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

app.post("/api/pages/:id/ai", (req, res) => {
  const pageId = req.params.id;
  const { ai_enabled, ai_prompt } = req.body;
  
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  if (!page) return res.status(404).json({ error: "Page not found" });

  db.prepare("UPDATE pages SET ai_enabled = ?, ai_prompt = ? WHERE id = ?").run(ai_enabled ? 1 : 0, ai_prompt, pageId);
  res.json({ success: true });
});

app.post("/api/pages/:id/ai-config", (req, res) => {
  const pageId = req.params.id;
  const { openai_keys, anthropic_keys, gemini_keys } = req.body;
  const config = JSON.stringify({ openai_keys, anthropic_keys, gemini_keys });
  db.prepare("UPDATE pages SET ai_config = ? WHERE id = ?").run(config, pageId);
  res.json({ success: true });
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

// --- ANALYTICS ROUTES ---
app.get("/api/pages/:pageId/analytics", (req, res) => {
  const { pageId } = req.params;

  try {
    // Total Messages
    const totalMessages = db.prepare(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE page_id = ?
    `).get(pageId) as { count: number };

    // Active Users (Unique conversations)
    const activeUsers = db.prepare(`
      SELECT COUNT(DISTINCT fb_user_id) as count 
      FROM messages 
      WHERE page_id = ?
    `).get(pageId) as { count: number };

    // Messages over time (last 7 days)
    const messagesOverTime = db.prepare(`
      SELECT strftime('%Y-%m-%d', created_at) as date, COUNT(*) as count
      FROM messages
      WHERE page_id = ? AND created_at >= date('now', '-7 days')
      GROUP BY date
      ORDER BY date ASC
    `).all(pageId);

    // Flows Triggered (Count of flows for this page)
    const totalFlows = db.prepare(`
      SELECT COUNT(*) as count FROM flows WHERE page_id = ?
    `).get(pageId) as { count: number };

    res.json({
      totalMessages: totalMessages.count,
      activeUsers: activeUsers.count,
      totalFlows: totalFlows.count,
      messagesOverTime
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
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
  console.log("WEBHOOK_RECEIVED", JSON.stringify(body, null, 2));
  
  if (body.object === "page") {
    for (const entry of body.entry) {
      const pageId = entry.id;
      
      // Fetch page without is_active check first to debug
      const page = db.prepare("SELECT * FROM pages WHERE fb_page_id = ?").get(pageId) as any;
      
      if (!page) {
        console.error(`[Webhook] Page ${pageId} not found in DB.`);
        continue;
      }
      
      if (!page.is_active) {
        console.warn(`[Webhook] Page ${page.name} (${pageId}) is INACTIVE. Ignoring message.`);
        continue;
      }

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(page.user_id) as any;
      if (!user) {
        console.error(`[Webhook] User for page ${pageId} not found.`);
        continue;
      }

      // Check message limits
      const limits: any = { 'Starter': 1000, 'Business': 10000, 'Pro': 100000 };
      if (user.message_count >= (limits[user.plan] || 1000)) {
        console.warn(`[Webhook] User ${user.id} reached message limit.`);
        continue;
      }

      for (const webhook_event of entry.messaging) {
        const senderId = webhook_event.sender.id;
        console.log(`[Webhook] Processing event from sender: ${senderId}`);
        
        let messageText = "";
        if (webhook_event.message && !webhook_event.message.is_echo) {
          messageText = webhook_event.message.text || "";
          if (webhook_event.message.quick_reply) {
            messageText = webhook_event.message.quick_reply.payload;
          }
        } else if (webhook_event.postback) {
          messageText = webhook_event.postback.payload;
          console.log(`[Webhook] Received postback: ${messageText}`);
        }

        if (messageText) {
          console.log(`[Webhook] Message text: "${messageText}"`);
          
          // Save user message
          db.prepare("INSERT INTO messages (id, page_id, fb_user_id, role, content, channel) VALUES (?, ?, ?, ?, ?, ?)").run(uuidv4(), page.id, senderId, 'user', messageText, 'messenger');
          
          await handleIncomingMessage(page, user, senderId, messageText, 'messenger');
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

app.post("/api/webchat/message", async (req, res) => {
  const { pageId, userId, text } = req.body;
  const page = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId) as any;
  if (!page) return res.status(404).json({ error: "Page not found" });
  
  if (!page.is_active) return res.status(400).json({ error: "Page is inactive" });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(page.user_id) as any;
  if (!user) return res.status(404).json({ error: "User not found" });
  
  // Save user message
  db.prepare("INSERT INTO messages (id, page_id, fb_user_id, role, content, channel) VALUES (?, ?, ?, ?, ?, ?)").run(uuidv4(), pageId, userId, 'user', text, 'webchat');
  
  await handleIncomingMessage(page, user, userId, text, 'webchat');
  
  res.json({ success: true });
});

app.get("/api/webchat/messages", (req, res) => {
  const { pageId, userId } = req.query;
  if (!pageId || !userId) return res.status(400).json({ error: "Missing pageId or userId" });

  const messages = db.prepare("SELECT * FROM messages WHERE page_id = ? AND fb_user_id = ? AND channel = 'webchat' ORDER BY created_at ASC").all(pageId, userId);
  res.json(messages);
});

async function handleIncomingMessage(page: any, user: any, senderId: string, messageText: string, channel: string = 'messenger') {
  // 1. Check Keywords
  const keywords = db.prepare("SELECT * FROM keywords WHERE page_id = ?").all(page.id) as any[];
  let matchedFlowId = null;
  
  for (const kw of keywords) {
    if (kw.match_type === 'exact' && messageText.toLowerCase() === kw.keyword.toLowerCase()) {
      matchedFlowId = kw.flow_id; 
      console.log(`[${channel}] Keyword Match (Exact): ${kw.keyword}`);
      break;
    } else if (kw.match_type === 'contains' && messageText.toLowerCase().includes(kw.keyword.toLowerCase())) {
      matchedFlowId = kw.flow_id; 
      console.log(`[${channel}] Keyword Match (Contains): ${kw.keyword}`);
      break;
    } else if (kw.match_type === 'regex') {
      try {
        const re = new RegExp(kw.keyword, 'i');
        if (re.test(messageText)) { 
          matchedFlowId = kw.flow_id; 
          console.log(`[${channel}] Keyword Match (Regex): ${kw.keyword}`);
          break; 
        }
      } catch(e) {
        console.error(`[${channel}] Invalid Regex for keyword ${kw.keyword}:`, e);
      }
    }
  }

  let flow;
  if (matchedFlowId) {
    flow = db.prepare("SELECT * FROM flows WHERE id = ?").get(matchedFlowId) as any;
    // Reset conversation state on keyword match to start fresh
    db.prepare("DELETE FROM conversations WHERE page_id = ? AND fb_user_id = ?").run(page.id, senderId);
  } else {
    // 2. Check for active conversation state
    const conversation = db.prepare("SELECT * FROM conversations WHERE page_id = ? AND fb_user_id = ?").get(page.id, senderId) as any;
    
    if (conversation) {
      console.log(`[${channel}] Continuing conversation: ${conversation.id}, State: ${conversation.state}`);
      // Try to find the flow containing the current node
      const allFlows = db.prepare("SELECT * FROM flows WHERE page_id = ?").all(page.id) as any[];
      flow = allFlows.find(f => {
        const nodes = JSON.parse(f.nodes || '[]');
        return nodes.some((n: any) => n.id === conversation.state);
      });
      
      if (!flow) {
         console.warn(`[${channel}] Conversation state ${conversation.state} not found in any flow. Resetting.`);
         db.prepare("DELETE FROM conversations WHERE page_id = ? AND fb_user_id = ?").run(page.id, senderId);
      }
    } 
    
    if (!flow) {
      // 3. Try Default Flow
      console.log(`[${channel}] No active conversation. Checking default flow.`);
      flow = db.prepare("SELECT * FROM flows WHERE page_id = ? AND is_default = 1 AND is_active = 1").get(page.id) as any;
    }
  }

  if (flow) {
    console.log(`[${channel}] Processing flow: ${flow.name} (${flow.id})`);
    const nodes = JSON.parse(flow.nodes || '[]');
    const edges = JSON.parse(flow.edges || '[]');
    await processFlow(page, user, senderId, messageText, nodes, edges, channel);
  } else {
    // 4. Fallback to AI if enabled
    if (page.ai_enabled) {
      console.log(`[${channel}] No flow matched. Using AI.`);
      await processAIResponse(page, user, senderId, messageText, channel);
    } else {
      console.log(`[${channel}] No flow matched and AI disabled. No response sent.`);
    }
  }
}

async function callLLM(provider: string, model: string, messages: any[], systemInstruction: string, config: any) {
  // Key Rotation Logic
  let apiKey = process.env.GEMINI_API_KEY; // Default
  
  if (config && config.api_keys && config.api_keys[provider]) {
    const keys = config.api_keys[provider].split(',').map((k: string) => k.trim()).filter((k: string) => k);
    if (keys.length > 0) {
      apiKey = keys[Math.floor(Math.random() * keys.length)]; // Random rotation
    }
  }

  if (provider === 'google') {
    const genAI = new GoogleGenAI({ apiKey });
    const aiModel = genAI.getGenerativeModel({ 
      model: model || "gemini-3-flash-preview",
      systemInstruction: systemInstruction
    });
    
    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = aiModel.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const lastMsg = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMsg);
    return result.response.text;
  } 
  
  // Placeholder for OpenAI (requires fetch implementation since no SDK)
  if (provider === 'openai') {
    if (!apiKey) throw new Error("OpenAI API Key not configured");
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages
        ]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }

  // Placeholder for Anthropic
  if (provider === 'anthropic') {
    if (!apiKey) throw new Error("Anthropic API Key not configured");
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-opus-20240229',
        system: systemInstruction,
        messages: messages
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  throw new Error(`Provider ${provider} not supported`);
}

async function processAIResponse(page: any, user: any, senderId: string, messageText: string, channel: string = 'messenger', nodeConfig: any = {}) {
  try {
    console.log(`[AI] Generating response for: "${messageText}"`);
    
    // Fetch conversation history (last 10 messages)
    const history = db.prepare("SELECT role, content FROM messages WHERE page_id = ? AND fb_user_id = ? ORDER BY created_at DESC LIMIT 10").all(page.id, senderId) as any[];
    const formattedHistory = history.reverse().map(m => ({ role: m.role, content: m.content }));
    
    // Fetch User Variables
    const variables = db.prepare("SELECT key, value FROM user_variables WHERE page_id = ? AND fb_user_id = ?").all(page.id, senderId) as any[];
    const variablesText = variables.map(v => `${v.key}: ${v.value}`).join('\n');

    // Fetch User Tags
    const tags = db.prepare("SELECT tag FROM user_tags WHERE page_id = ? AND fb_user_id = ?").all(page.id, senderId) as any[];
    const tagsText = tags.map(t => t.tag).join(', ');

    // Context Construction
    let context = "";
    if (variables.length > 0) context += `\nUser Variables:\n${variablesText}`;
    if (tags.length > 0) context += `\nUser Tags: ${tagsText}`;
    if (nodeConfig.knowledgeBase) context += `\nKnowledge Base:\n${nodeConfig.knowledgeBase}`;

    const systemInstruction = `${nodeConfig.systemPrompt || page.ai_prompt || 'You are a helpful assistant.'}\n${context}`;
    
    // Determine Provider and Model
    const selectedModel = nodeConfig.model || 'gemini-3-flash-preview';
    let provider = 'google';
    if (selectedModel.startsWith('gpt')) provider = 'openai';
    if (selectedModel.startsWith('claude')) provider = 'anthropic';

    // Parse Page AI Config
    const pageAiConfig = page.ai_config ? JSON.parse(page.ai_config) : {};

    // Prepare messages for LLM
    const messages = [...formattedHistory, { role: 'user', content: messageText }];

    const text = await callLLM(provider, selectedModel, messages, systemInstruction, pageAiConfig);
    console.log(`[AI] Response generated: "${text}"`);
    
    await sendMessage(channel, page, senderId, { text });
    db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
  } catch (err) {
    console.error("[AI] Error:", err);
    // Fallback
    if (nodeConfig.fallbackMessage) {
       await sendMessage(channel, page, senderId, { text: nodeConfig.fallbackMessage });
    } else {
       await sendMessage(channel, page, senderId, { text: "I'm having trouble thinking right now. Please try again later." });
    }
  }
}

async function processFlow(page: any, user: any, senderId: string, messageText: string, nodes: any[], edges: any[], channel: string = 'messenger') {
  let conversation = db.prepare("SELECT * FROM conversations WHERE page_id = ? AND fb_user_id = ?").get(page.id, senderId) as any;
  let currentNodeId = null;

  if (!conversation) {
    // Start of flow
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) {
      console.error("[Flow] No trigger node found in flow.");
      return;
    }
    currentNodeId = triggerNode.id;
    console.log(`[Flow] Starting new conversation at node: ${currentNodeId}`);
    db.prepare("INSERT INTO conversations (id, page_id, fb_user_id, state, channel) VALUES (?, ?, ?, ?, ?)").run(uuidv4(), page.id, senderId, currentNodeId, channel);
  } else {
    currentNodeId = conversation.state;
  }

  let loopCount = 0;
  // Process nodes until we hit a wait state (input) or end
  while (loopCount < 20) {
    loopCount++;
    console.log(`[Flow] Processing node: ${currentNodeId}`);
    
    const nextNodeId = getNextNodeForMessage(currentNodeId, nodes, edges, messageText);
    
    if (!nextNodeId) {
      console.log(`[Flow] No next node found from ${currentNodeId}. Ending flow.`);
      break;
    }

    const nextNode = nodes.find((n: any) => n.id === nextNodeId);
    if (!nextNode) break;
    
    currentNodeId = nextNode.id; // Move to next node
    console.log(`[Flow] Moved to node: ${nextNode.type} (${nextNode.id})`);

    if (nextNode.type === 'message') {
      await sendMessage(channel, page, senderId, { text: nextNode.data.label });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
    } else if (nextNode.type === 'image') {
      await sendMessage(channel, page, senderId, {
        attachment: { type: "image", payload: { url: nextNode.data.url || "https://picsum.photos/400/300", is_reusable: true } }
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
    } else if (nextNode.type === 'quick_replies') {
      const replies = nextNode.data.replies || ['Yes', 'No'];
      const quickReplies = replies.map((r: string) => ({ content_type: "text", title: r, payload: r }));
      await sendMessage(channel, page, senderId, {
        text: nextNode.data.label,
        quick_replies: quickReplies
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      break; // Wait for input
    } else if (nextNode.type === 'buttons') {
      const buttons = (nextNode.data.buttons || ['Click Here']).map((b: string) => ({ type: "postback", title: b, payload: b }));
      await sendMessage(channel, page, senderId, {
        attachment: {
          type: "template",
          payload: { template_type: "button", text: nextNode.data.label, buttons: buttons.slice(0,3) }
        }
      });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      break; // Wait for input
    } else if (nextNode.type === 'set_variable') {
      db.prepare("INSERT INTO user_variables (id, page_id, fb_user_id, key, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT(page_id, fb_user_id, key) DO UPDATE SET value = excluded.value").run(uuidv4(), page.id, senderId, nextNode.data.key, nextNode.data.value);
    } else if (nextNode.type === 'add_tag') {
      db.prepare("INSERT OR IGNORE INTO user_tags (id, page_id, fb_user_id, tag) VALUES (?, ?, ?, ?)").run(uuidv4(), page.id, senderId, nextNode.data.tag);
    } else if (nextNode.type === 'input') {
      await sendMessage(channel, page, senderId, { text: nextNode.data.label });
      db.prepare("UPDATE users SET message_count = message_count + 1 WHERE id = ?").run(user.id);
      break; // Stop and wait for user input
    } else if (nextNode.type === 'ai_response') {
      await processAIResponse(page, user, senderId, nextNode.data.prompt || messageText, channel, nextNode.data);
    }
  }

  // Update conversation state
  db.prepare("UPDATE conversations SET state = ?, last_interaction = CURRENT_TIMESTAMP WHERE page_id = ? AND fb_user_id = ?").run(currentNodeId, page.id, senderId);
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

async function sendMessage(channel: string, page: any, recipientId: string, messagePayload: any) {
  let content = "";
  if (messagePayload.text) content = messagePayload.text;
  else if (messagePayload.attachment) content = `[Attachment: ${messagePayload.attachment.type}]`;
  else if (messagePayload.quick_replies) content = `${messagePayload.text} [Quick Replies: ${messagePayload.quick_replies.map((r:any)=>r.title).join(', ')}]`;
  
  if (channel === 'messenger') {
    await sendMetaMessage(page.access_token, recipientId, messagePayload);
  }
  
  db.prepare("INSERT INTO messages (id, page_id, fb_user_id, role, content, channel) VALUES (?, ?, ?, ?, ?, ?)").run(uuidv4(), page.id, recipientId, 'assistant', content, channel);
}

async function sendMetaMessage(encryptedToken: string, recipientId: string, messagePayload: any) {
  try {
    const token = decrypt(encryptedToken);
    if (!token) {
      console.error("[Meta API] Decryption failed for access token. Page needs reconnection.");
      return;
    }
    
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: messagePayload,
        messaging_type: "RESPONSE"
      })
    });
    const data = await res.json();
    if (data.error) {
       console.error("[Meta API] Error sending message:", JSON.stringify(data.error));
    } else {
       console.log("[Meta API] Message sent successfully.");
    }
  } catch (err) {
    console.error("[Meta API] Failed to send message:", err);
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
