import { listPosts, seedIfEmpty } from '../../lib/blog.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const adminToken = process.env.BLOG_ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(503).json({
      error: 'CMS não configurado',
      message: 'Defina BLOG_ADMIN_TOKEN nas variáveis de ambiente da Vercel.',
    });
  }

  if (token !== adminToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    try {
      await seedIfEmpty();
    } catch (seedErr) {
      console.error('Seed skipped:', seedErr);
    }

    const result = await listPosts({
      publishedOnly: false,
      page: 1,
      limit: 100,
    });

    return res.status(200).json({
      source: result.source,
      updatedAt: result.updatedAt,
      posts: result.posts || [],
    });
  } catch (err) {
    console.error('Blog admin API error:', err);
    return res.status(500).json({ error: 'Failed to load posts', detail: err.message });
  }
}
