import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { requireAdmin } from '../../lib/auth.js';
import { getSql, ensureBlogSchema } from '../../lib/db.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function loadJsonPosts() {
  try {
    const filePath = join(process.cwd(), 'blog', 'data', 'posts.json');
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(data.posts) ? data.posts : [];
  } catch (err) {
    console.error('JSON posts fallback error:', err);
    return [];
  }
}

function mapRow(row) {
  let tags = row.tags;
  let author = row.author;
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }
  if (typeof author === 'string') {
    try { author = JSON.parse(author); } catch { author = { name: 'Equipe FortePix' }; }
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.cover_image || '',
    category: row.category,
    tags: Array.isArray(tags) ? tags : [],
    author: author || { name: 'Equipe FortePix' },
    status: row.status,
    readingTimeMinutes: row.reading_time_minutes || 1,
    publishedAt: new Date(row.published_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function loadPostgresPosts() {
  const sql = getSql();
  if (!sql) return [];

  await ensureBlogSchema(sql);
  const rows = await sql`
    SELECT *
    FROM blog_posts
    ORDER BY published_at DESC NULLS LAST
    LIMIT 100
  `;
  return rows.map(mapRow);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await requireAdmin(req, res);
    if (!auth) return;

    // Sempre começa pelo JSON local — garante resposta 200
    let posts = loadJsonPosts();
    let source = 'json';

    try {
      const dbPosts = await withTimeout(loadPostgresPosts(), 4000);
      if (Array.isArray(dbPosts) && dbPosts.length > 0) {
        posts = dbPosts;
        source = 'postgres';
      }
    } catch (dbErr) {
      console.error('Postgres admin posts skipped:', dbErr?.message || dbErr);
    }

    return res.status(200).json({
      source,
      updatedAt: new Date().toISOString(),
      posts,
      user: auth.user,
    });
  } catch (err) {
    console.error('Admin posts fatal:', err);
    return res.status(200).json({
      source: 'json',
      updatedAt: new Date().toISOString(),
      posts: loadJsonPosts(),
      warning: String(err?.message || err),
    });
  }
}
