require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const OWNER_USERNAME = process.env.OWNER_USERNAME || process.env.ADMIN_USERNAME || "Fulter";
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD || "Fulter@12345";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || OWNER_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || OWNER_PASSWORD;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "data", "navo.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  display_name TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  focus_minutes INTEGER NOT NULL DEFAULT 0,
  focus_sessions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS focus_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  xp_added INTEGER NOT NULL DEFAULT 75,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  type TEXT NOT NULL DEFAULT 'problem',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'site',
  telegram_chat_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_username TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}
if (!columnExists("tickets", "telegram_chat_id")) {
  db.exec("ALTER TABLE tickets ADD COLUMN telegram_chat_id TEXT");
}

function levelFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1);
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.display_name || u.username,
    xp: u.xp,
    level: u.level,
    focusMinutes: u.focus_minutes,
    focusSessions: u.focus_sessions,
    status: u.status,
    createdAt: u.created_at
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

function logAudit(req, action, targetType, targetId, details = {}) {
  const actor = req.user || {};
  db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_username, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actor.id || null, actor.username || "system", action, targetType, targetId || null, JSON.stringify(details));
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(data.id);
    if (!user || user.status === "banned") return res.status(401).json({ error: "UNAUTHORIZED" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "BAD_TOKEN" });
  }
}

function staffOnly(req, res, next) {
  if (!["owner", "admin"].includes(req.user.role)) return res.status(403).json({ error: "STAFF_ONLY" });
  next();
}

function ownerOnly(req, res, next) {
  if (req.user.role !== "owner") return res.status(403).json({ error: "OWNER_ONLY" });
  next();
}

function ensureRootAccounts() {
  const ownerHash = bcrypt.hashSync(OWNER_PASSWORD, 10);
  const existingOwner = db.prepare("SELECT * FROM users WHERE username = ?").get(OWNER_USERNAME);

  if (!existingOwner) {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, display_name, xp, level, status)
      VALUES (?, ?, 'owner', ?, 2000, 5, 'active')
    `).run(OWNER_USERNAME, ownerHash, OWNER_USERNAME);
    console.log(`Owner created: ${OWNER_USERNAME}`);
  } else {
    db.prepare(`
      UPDATE users SET role='owner', password_hash=?, status='active', updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(ownerHash, existingOwner.id);
    console.log(`Owner protected: ${OWNER_USERNAME}`);
  }

  if (ADMIN_USERNAME && ADMIN_USERNAME !== OWNER_USERNAME) {
    const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const existingAdmin = db.prepare("SELECT * FROM users WHERE username=?").get(ADMIN_USERNAME);
    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO users (username, password_hash, role, display_name, xp, level, status)
        VALUES (?, ?, 'admin', ?, 1000, 4, 'active')
      `).run(ADMIN_USERNAME, adminHash, ADMIN_USERNAME);
    }
  }
}
ensureRootAccounts();

async function telegramSend(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: "HTML"
      })
    });
  } catch (err) {
    console.warn("Telegram notify failed:", err.message);
  }
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ ok: true, app: "Navo Admin Pro", db: DB_PATH }));

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^[a-z0-9_\-\u0600-\u06ff]{3,24}$/i.test(username)) return res.status(400).json({ error: "BAD_USERNAME" });
  if (password.length < 6) return res.status(400).json({ error: "BAD_PASSWORD" });

  const exists = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (exists) return res.status(409).json({ error: "USERNAME_EXISTS" });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)").run(username, hash, username);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "BAD_LOGIN" });
  if (user.status === "banned") return res.status(403).json({ error: "BANNED" });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  const tasks = db.prepare("SELECT id, title, priority, done, created_at as createdAt FROM tasks WHERE user_id=? ORDER BY id DESC").all(req.user.id);
  res.json({ user: publicUser(req.user), tasks });
});

app.patch("/api/me", auth, (req, res) => {
  const displayName = String(req.body.displayName || req.user.username).slice(0, 40);
  db.prepare("UPDATE users SET display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(displayName, req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: publicUser(user) });
});

app.post("/api/tasks", auth, (req, res) => {
  const title = String(req.body.title || "").trim();
  const priority = ["high", "medium", "low"].includes(req.body.priority) ? req.body.priority : "medium";
  if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });
  const info = db.prepare("INSERT INTO tasks (user_id, title, priority) VALUES (?, ?, ?)").run(req.user.id, title, priority);
  const task = db.prepare("SELECT id, title, priority, done, created_at as createdAt FROM tasks WHERE id=?").get(info.lastInsertRowid);
  res.json({ task });
});

app.patch("/api/tasks/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  const task = db.prepare("SELECT * FROM tasks WHERE id=? AND user_id=?").get(id, req.user.id);
  if (!task) return res.status(404).json({ error: "NOT_FOUND" });

  const title = typeof req.body.title === "string" ? req.body.title.trim() : task.title;
  const priority = ["high", "medium", "low"].includes(req.body.priority) ? req.body.priority : task.priority;
  const done = typeof req.body.done === "boolean" ? (req.body.done ? 1 : 0) : task.done;

  db.prepare("UPDATE tasks SET title=?, priority=?, done=? WHERE id=? AND user_id=?").run(title, priority, done, id, req.user.id);
  if (!task.done && done) {
    const xp = req.user.xp + 25;
    db.prepare("UPDATE users SET xp=?, level=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(xp, levelFromXp(xp), req.user.id);
  }
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

app.post("/api/focus/complete", auth, (req, res) => {
  const minutes = Math.max(1, Math.min(240, Number(req.body.minutes || 25)));
  const xpAdded = 75;
  const xp = req.user.xp + xpAdded;
  db.prepare("INSERT INTO focus_logs (user_id, minutes, xp_added) VALUES (?, ?, ?)").run(req.user.id, minutes, xpAdded);
  db.prepare(`
    UPDATE users SET xp=?, level=?, focus_minutes=focus_minutes+?, focus_sessions=focus_sessions+1, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(xp, levelFromXp(xp), minutes, req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: publicUser(user), xpAdded });
});

/* Support tickets */
app.post("/api/support/tickets", auth, async (req, res) => {
  const type = ["problem", "suggestion", "complaint", "feature"].includes(req.body.type) ? req.body.type : "problem";
  const title = String(req.body.title || "").trim().slice(0, 120);
  const message = String(req.body.message || "").trim().slice(0, 2000);
  if (!title || !message) return res.status(400).json({ error: "MISSING_FIELDS" });

  const info = db.prepare(`
    INSERT INTO tickets (user_id, username, type, title, message, source)
    VALUES (?, ?, ?, ?, ?, 'site')
  `).run(req.user.id, req.user.username, type, title, message);

  const text = `🎫 <b>Navo Ticket #${info.lastInsertRowid}</b>\n` +
    `From: ${req.user.username}\nType: ${type}\nTitle: ${title}\n\n${message}`;
  telegramSend(text);

  res.json({ ok: true, ticketId: info.lastInsertRowid });
});

app.get("/api/my/tickets", auth, (req, res) => {
  const tickets = db.prepare(`
    SELECT id, type, title, message, status, source, created_at as createdAt
    FROM tickets WHERE user_id=? ORDER BY id DESC
  `).all(req.user.id);
  res.json({ tickets });
});

/* Admin Pro */
app.get("/api/admin/stats", auth, staffOnly, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
  const banned = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='banned'").get().c;
  const tasks = db.prepare("SELECT COUNT(*) as c FROM tasks").get().c;
  const focus = db.prepare("SELECT COALESCE(SUM(minutes),0) as c FROM focus_logs").get().c;
  const ticketsNew = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='new'").get().c;
  const tickets = db.prepare("SELECT COUNT(*) as c FROM tickets").get().c;
  res.json({ users, active, banned, tasks, focus, tickets, ticketsNew });
});

app.get("/api/admin/users", auth, staffOnly, (req, res) => {
  const q = String(req.query.q || "").trim();
  const role = String(req.query.role || "");
  const status = String(req.query.status || "");
  let sql = `
    SELECT id, username, role, display_name, xp, level, focus_minutes, focus_sessions, status, created_at
    FROM users WHERE 1=1
  `;
  const params = [];
  if (q) {
    sql += " AND (username LIKE ? OR display_name LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  if (["owner", "admin", "user"].includes(role)) {
    sql += " AND role=?";
    params.push(role);
  }
  if (["active", "banned"].includes(status)) {
    sql += " AND status=?";
    params.push(status);
  }
  sql += " ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, id DESC";
  const users = db.prepare(sql).all(...params).map(publicUser);
  res.json({ users });
});

app.get("/api/admin/users/:id", auth, staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  const tasks = db.prepare("SELECT id, title, priority, done, created_at as createdAt FROM tasks WHERE user_id=? ORDER BY id DESC").all(id);
  const focusLogs = db.prepare("SELECT id, minutes, xp_added as xpAdded, created_at as createdAt FROM focus_logs WHERE user_id=? ORDER BY id DESC LIMIT 30").all(id);
  const tickets = db.prepare("SELECT id, type, title, status, source, created_at as createdAt FROM tickets WHERE user_id=? ORDER BY id DESC").all(id);
  res.json({ user: publicUser(user), tasks, focusLogs, tickets });
});

app.patch("/api/admin/users/:id", auth, staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  if (existing.role === "owner" && req.user.id !== existing.id) {
    return res.status(403).json({ error: "OWNER_PROTECTED" });
  }
  if (req.user.id === existing.id && existing.role === "owner" && req.body.role && req.body.role !== "owner") {
    return res.status(400).json({ error: "CANT_DEMOTE_OWNER" });
  }
  if (req.user.role !== "owner" && req.body.role && req.body.role !== existing.role) {
    return res.status(403).json({ error: "OWNER_ONLY_ROLE_CHANGE" });
  }

  let role = existing.role;
  if (req.user.role === "owner" && ["owner", "admin", "user"].includes(req.body.role)) role = req.body.role;
  if (existing.username === OWNER_USERNAME) role = "owner";

  const status = ["active", "banned"].includes(req.body.status) ? req.body.status : existing.status;
  const xp = Number.isFinite(Number(req.body.xp)) ? Math.max(0, Number(req.body.xp)) : existing.xp;
  const displayName = typeof req.body.displayName === "string" ? req.body.displayName.slice(0, 40) : (existing.display_name || existing.username);

  if (id === req.user.id && status === "banned") return res.status(400).json({ error: "CANT_BAN_SELF" });
  if (existing.username === OWNER_USERNAME && status === "banned") return res.status(400).json({ error: "OWNER_PROTECTED" });

  db.prepare(`
    UPDATE users SET role=?, status=?, xp=?, level=?, display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(role, status, xp, levelFromXp(xp), displayName, id);

  logAudit(req, "UPDATE_USER", "user", id, { role, status, xp, displayName });
  res.json({ ok: true });
});

app.post("/api/admin/users/:id/reset-password", auth, staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
  if (existing.role === "owner" && req.user.role !== "owner") return res.status(403).json({ error: "OWNER_PROTECTED" });

  const password = String(req.body.password || "");
  if (password.length < 6) return res.status(400).json({ error: "BAD_PASSWORD" });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(hash, id);
  logAudit(req, "RESET_PASSWORD", "user", id, {});
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", auth, staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });
  if (id === req.user.id) return res.status(400).json({ error: "CANT_DELETE_SELF" });
  if (existing.role === "owner" || existing.username === OWNER_USERNAME) return res.status(403).json({ error: "OWNER_PROTECTED" });
  if (req.user.role !== "owner" && existing.role === "admin") return res.status(403).json({ error: "OWNER_ONLY" });

  db.prepare("DELETE FROM users WHERE id=?").run(id);
  logAudit(req, "DELETE_USER", "user", id, { username: existing.username });
  res.json({ ok: true });
});

app.get("/api/admin/tickets", auth, staffOnly, (req, res) => {
  const status = String(req.query.status || "");
  let sql = "SELECT id, user_id as userId, username, type, title, message, status, source, created_at as createdAt FROM tickets WHERE 1=1";
  const params = [];
  if (["new", "reviewing", "solved", "rejected"].includes(status)) {
    sql += " AND status=?";
    params.push(status);
  }
  sql += " ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, id DESC";
  res.json({ tickets: db.prepare(sql).all(...params) });
});

app.patch("/api/admin/tickets/:id", auth, staffOnly, (req, res) => {
  const id = Number(req.params.id);
  const status = ["new", "reviewing", "solved", "rejected"].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.status(400).json({ error: "BAD_STATUS" });
  const ticket = db.prepare("SELECT * FROM tickets WHERE id=?").get(id);
  if (!ticket) return res.status(404).json({ error: "NOT_FOUND" });
  db.prepare("UPDATE tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status, id);
  logAudit(req, "UPDATE_TICKET", "ticket", id, { status });
  res.json({ ok: true });
});

app.get("/api/admin/audit-logs", auth, staffOnly, (req, res) => {
  const logs = db.prepare(`
    SELECT id, actor_username as actorUsername, action, target_type as targetType, target_id as targetId, details, created_at as createdAt
    FROM audit_logs ORDER BY id DESC LIMIT 100
  `).all();
  res.json({ logs });
});

/* Telegram bot webhook / polling helper */
app.post("/api/telegram/webhook", async (req, res) => {
  const msg = req.body.message;
  if (!msg || !msg.text) return res.json({ ok: true });

  const chatId = String(msg.chat.id);
  const from = msg.from?.username ? "@" + msg.from.username : (msg.from?.first_name || "telegram-user");
  const text = String(msg.text).trim();

  if (text === "/start") {
    if (TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ chat_id: chatId, text: "حيّاك في دعم Navo. اكتب مشكلتك أو اقتراحك وسنوصله للإدارة." })
      });
    }
    return res.json({ ok: true });
  }

  const title = text.slice(0, 80);
  const info = db.prepare(`
    INSERT INTO tickets (username, type, title, message, source, telegram_chat_id)
    VALUES (?, 'problem', ?, ?, 'telegram', ?)
  `).run(from, title, text.slice(0, 2000), chatId);

  telegramSend(`📩 <b>Telegram Ticket #${info.lastInsertRowid}</b>\nFrom: ${from}\n\n${text}`);
  res.json({ ok: true });
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Navo Admin Pro running on http://localhost:${PORT}`);
  console.log(`Owner protected: ${OWNER_USERNAME}`);
});
