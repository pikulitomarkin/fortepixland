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

  try {
    try {
      await seedIfEmpty();
    } catch (seedErr) {
      console.error('Seed skipped:', seedErr);
    }

    const { slug, category, tag, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await listPosts({
      publishedOnly: true,
      slug,
      category,
      tag,
      page: pageNum,
      limit: limitNum,
    });

    if (slug) {
      if (!result.post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      return res.status(200).json({
        source: result.source,
        updatedAt: result.updatedAt,
        post: result.post,
      });
    }

    return res.status(200).json({
      source: result.source,
      updatedAt: result.updatedAt,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil((result.total || 0) / limitNum),
      },
      posts: result.posts,
    });
  } catch (err) {
    console.error('Blog API error:', err);
    return res.status(500).json({ error: 'Failed to load posts', detail: err.message });
  }
}
