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
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Fulter";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Fulter@12345";
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "data", "navo.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

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
`);

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

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "ADMIN_ONLY" });
  next();
}

function ensureAdmin() {
  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(ADMIN_USERNAME);
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

  if (!existing) {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, display_name, xp, level)
      VALUES (?, ?, 'admin', ?, 1000, 4)
    `).run(ADMIN_USERNAME, hash, ADMIN_USERNAME);
    console.log(`Admin created: ${ADMIN_USERNAME}`);
  } else if (existing.role !== "admin") {
    db.prepare("UPDATE users SET role='admin', password_hash=?, status='active' WHERE id=?").run(hash, existing.id);
    console.log(`Admin upgraded: ${ADMIN_USERNAME}`);
  }
}
ensureAdmin();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "Navo", db: DB_PATH });
});

app.post("/api/auth/register", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!/^[a-z0-9_\-\u0600-\u06ff]{3,24}$/i.test(username)) {
    return res.status(400).json({ error: "BAD_USERNAME" });
  }
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
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "BAD_LOGIN" });
  }
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
    UPDATE users
    SET xp=?, level=?, focus_minutes=focus_minutes+?, focus_sessions=focus_sessions+1, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(xp, levelFromXp(xp), minutes, req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({ user: publicUser(user), xpAdded });
});

app.get("/api/admin/stats", auth, adminOnly, (req, res) => {
  const users = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='active'").get().c;
  const banned = db.prepare("SELECT COUNT(*) as c FROM users WHERE status='banned'").get().c;
  const tasks = db.prepare("SELECT COUNT(*) as c FROM tasks").get().c;
  const focus = db.prepare("SELECT COALESCE(SUM(minutes),0) as c FROM focus_logs").get().c;
  res.json({ users, active, banned, tasks, focus });
});

app.get("/api/admin/users", auth, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, display_name, xp, level, focus_minutes, focus_sessions, status, created_at
    FROM users ORDER BY id DESC
  `).all().map(publicUser);
  res.json({ users });
});

app.patch("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!existing) return res.status(404).json({ error: "NOT_FOUND" });

  const role = ["admin", "user"].includes(req.body.role) ? req.body.role : existing.role;
  const status = ["active", "banned"].includes(req.body.status) ? req.body.status : existing.status;
  const xp = Number.isFinite(Number(req.body.xp)) ? Math.max(0, Number(req.body.xp)) : existing.xp;
  const displayName = typeof req.body.displayName === "string" ? req.body.displayName.slice(0,40) : (existing.display_name || existing.username);

  db.prepare(`
    UPDATE users SET role=?, status=?, xp=?, level=?, display_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(role, status, xp, levelFromXp(xp), displayName, id);

  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", auth, adminOnly, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "CANT_DELETE_SELF" });
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true });
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Navo running on http://localhost:${PORT}`);
  console.log(`Admin: ${ADMIN_USERNAME}`);
});
