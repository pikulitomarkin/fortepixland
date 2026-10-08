import { listPosts } from '../../lib/blog.js';
import { requireAdmin } from '../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
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

    const result = await listPosts({
      publishedOnly: false,
      page: 1,
      limit: 100,
    });

    return res.status(200).json({
      source: result.source || 'json',
      updatedAt: result.updatedAt || new Date().toISOString(),
      posts: result.posts || [],
      user: auth.user,
    });
  } catch (err) {
    console.error('Admin posts fatal:', err);
    // Nunca derruba o CMS: devolve lista pública/JSON como fallback
    try {
      const fallback = await listPosts({ publishedOnly: false, page: 1, limit: 100 });
      return res.status(200).json({
        source: fallback.source || 'json',
        updatedAt: fallback.updatedAt || new Date().toISOString(),
        posts: fallback.posts || [],
        warning: String(err?.message || err),
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        error: 'Failed to load admin posts',
        detail: String(err?.message || err),
        fallback: String(fallbackErr?.message || fallbackErr),
      });
    }
  }
}
