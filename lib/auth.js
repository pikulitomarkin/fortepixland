import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getSql } from './db.js';

const DEFAULT_ADMIN_EMAIL = 'marcos@fortepixfinance.com';
/** Hash bcrypt da senha de acesso inicial (não é a senha em texto puro). */
const DEFAULT_ADMIN_PASSWORD_HASH =
  '$2b$10$lOREE9RYueW.Ve/kRpgtQ.10xoB13CK3OSIFc.lY.IUK9JR2SZmDy';

const SESSION_DAYS = 7;

export async function ensureAuthSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT 'Administrador',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions (expires_at)`;
}

export async function seedAdminUser(sql) {
  await ensureAuthSchema(sql);

  const existing = await sql`SELECT id FROM admin_users LIMIT 1`;
  if (existing.length > 0) return { seeded: false };

  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
  let passwordHash = DEFAULT_ADMIN_PASSWORD_HASH;

  if (process.env.ADMIN_PASSWORD) {
    passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  }

  const id = 'admin-' + randomBytes(6).toString('hex');
  await sql`
    INSERT INTO admin_users (id, email, password_hash, name)
    VALUES (${id}, ${email}, ${passwordHash}, ${'Marcos'})
  `;

  return { seeded: true, email };
}

export async function loginAdmin(email, password) {
  const sql = getSql();
  if (!sql) {
    return { ok: false, error: 'database_not_configured', status: 503 };
  }

  try {
    await seedAdminUser(sql);

    const rows = await sql`
      SELECT id, email, password_hash, name
      FROM admin_users
      WHERE LOWER(email) = LOWER(${email.trim()})
      LIMIT 1
    `;

    const user = rows[0];
    if (!user) {
      return { ok: false, error: 'E-mail ou senha inválidos', status: 401 };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return { ok: false, error: 'E-mail ou senha inválidos', status: 401 };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await sql`
      INSERT INTO admin_sessions (token, user_id, expires_at)
      VALUES (${token}, ${user.id}, ${expiresAt})
    `;

    await sql`DELETE FROM admin_sessions WHERE expires_at < NOW()`;

    return {
      ok: true,
      token,
      expiresAt,
      user: { id: user.id, email: user.email, name: user.name },
    };
  } catch (err) {
    console.error('Login error:', err);
    return { ok: false, error: err.message || 'Falha no login', status: 500 };
  }
}

export async function validateSession(token) {
  if (!token) return null;

  // Compatibilidade com token legado da Vercel, se ainda existir
  const legacy = process.env.BLOG_ADMIN_TOKEN;
  if (legacy && token === legacy) {
    return { id: 'legacy', email: 'legacy@admin', name: 'Admin' };
  }

  const sql = getSql();
  if (!sql) return null;

  try {
    await ensureAuthSchema(sql);
    const rows = await sql`
      SELECT u.id, u.email, u.name, s.expires_at
      FROM admin_sessions s
      JOIN admin_users u ON u.id = s.user_id
      WHERE s.token = ${token}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
      await sql`DELETE FROM admin_sessions WHERE token = ${token}`;
      return null;
    }

    return { id: row.id, email: row.email, name: row.name };
  } catch (err) {
    console.error('Session validation error:', err);
    return null;
  }
}

export async function logoutAdmin(token) {
  const sql = getSql();
  if (!sql || !token) return;
  try {
    await sql`DELETE FROM admin_sessions WHERE token = ${token}`;
  } catch (err) {
    console.error('Logout error:', err);
  }
}

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

export async function requireAdmin(req, res) {
  const token = getBearerToken(req);
  const user = await validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
    return null;
  }
  return { user, token };
}
