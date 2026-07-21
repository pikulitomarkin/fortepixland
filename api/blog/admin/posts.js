import { listPosts, seedIfEmpty } from '../../lib/blog.js';
import { requireAdmin } from '../../lib/auth.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function loadJsonPosts() {
  try {
    const filePath = join(process.cwd(), 'blog', 'data', 'posts.json');
    if (!existsSync(filePath)) return [];
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    return data.posts || [];
  } catch {
    return [];
  }
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

    let posts = [];
    let source = 'json';
    let updatedAt = new Date().toISOString();

    try {
      await seedIfEmpty();
    } catch (seedErr) {
      console.error('Seed skipped:', seedErr?.message || seedErr);
    }

    try {
      const result = await listPosts({
        publishedOnly: false,
        page: 1,
        limit: 100,
      });
      posts = result.posts || [];
      source = result.source || 'postgres';
      updatedAt = result.updatedAt || updatedAt;
    } catch (listErr) {
      console.error('List posts failed:', listErr?.message || listErr);
      posts = [];
    }

    if (!posts.length) {
      posts = loadJsonPosts();
      source = 'json';
    }

    return res.status(200).json({
      source,
      updatedAt,
      posts,
      user: auth.user,
    });
  } catch (err) {
    console.error('Blog admin API error:', err);
    // Nunca derruba o painel: devolve JSON local
    return res.status(200).json({
      source: 'json',
      updatedAt: new Date().toISOString(),
      posts: loadJsonPosts(),
      warning: err.message || 'Fallback para posts locais',
    });
  }
}
