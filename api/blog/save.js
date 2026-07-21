import { savePosts, seedIfEmpty } from '../../lib/blog.js';
import { requireAdmin } from '../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const { posts } = req.body || {};

    if (!Array.isArray(posts)) {
      return res.status(400).json({ error: 'Invalid payload: posts array required' });
    }

    try {
      await seedIfEmpty();
    } catch (_) {}

    const result = await savePosts(posts);

    if (!result.saved) {
      return res.status(503).json({
        saved: false,
        reason: result.reason,
        message:
          'Banco de dados não configurado. Verifique POSTGRES_URL ou DATABASE_URL na Vercel.',
      });
    }

    return res.status(200).json({
      saved: true,
      source: result.source,
      updatedAt: result.updatedAt,
      count: result.count,
    });
  } catch (err) {
    console.error('Blog save error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save posts' });
  }
}
