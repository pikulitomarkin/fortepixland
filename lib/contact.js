import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getSql, getDatabaseUrl } from './db.js';

const FALLBACK_PATH = join(process.cwd(), 'blog', 'data', 'contacts.json');

export async function ensureContactSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC)`;
}

function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function loadFallback() {
  if (!existsSync(FALLBACK_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8'));
    return data.messages || [];
  } catch {
    return [];
  }
}

function saveFallback(messages) {
  const dir = join(process.cwd(), 'blog', 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    FALLBACK_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), messages }, null, 2) + '\n',
    'utf8'
  );
}

function newId() {
  return `msg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export async function createContactMessage({ name, email, subject, message }) {
  const id = newId();
  const now = new Date().toISOString();
  const sql = getSql();

  if (!sql || !getDatabaseUrl()) {
    const messages = loadFallback();
    const entry = { id, name, email, subject, message, status: 'new', createdAt: now };
    messages.unshift(entry);
    saveFallback(messages);
    return { saved: true, source: 'json', id };
  }

  try {
    await ensureContactSchema(sql);
    await sql`
      INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
      VALUES (${id}, ${name}, ${email}, ${subject}, ${message}, 'new', ${now})
    `;
    return { saved: true, source: 'postgres', id };
  } catch (err) {
    console.error('Contact postgres save error:', err);
    const messages = loadFallback();
    const entry = { id, name, email, subject, message, status: 'new', createdAt: now };
    messages.unshift(entry);
    saveFallback(messages);
    return { saved: true, source: 'json', id };
  }
}

export async function listContactMessages({ status } = {}) {
  const sql = getSql();

  if (!sql) {
    let messages = loadFallback();
    if (status) messages = messages.filter((m) => m.status === status);
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { source: 'json', messages };
  }

  await ensureContactSchema(sql);

  const rows = status
    ? await sql`
        SELECT * FROM contact_messages
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT 200
      `
    : await sql`
        SELECT * FROM contact_messages
        ORDER BY created_at DESC
        LIMIT 200
      `;

  return { source: 'postgres', messages: rows.map(rowToMessage) };
}

export async function updateContactMessageStatus(id, status) {
  const sql = getSql();

  if (!sql) {
    const messages = loadFallback();
    const msg = messages.find((m) => m.id === id);
    if (!msg) return null;
    msg.status = status;
    saveFallback(messages);
    return msg;
  }

  await ensureContactSchema(sql);
  const rows = await sql`
    UPDATE contact_messages
    SET status = ${status}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToMessage(rows[0]);
}

export async function countNewMessages() {
  const sql = getSql();

  if (!sql) {
    return loadFallback().filter((m) => m.status === 'new').length;
  }

  await ensureContactSchema(sql);
  const rows = await sql`SELECT COUNT(*)::int AS total FROM contact_messages WHERE status = 'new'`;
  return rows[0]?.total || 0;
}
