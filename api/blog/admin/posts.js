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

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await seedIfEmpty();

    const result = await listPosts({
      publishedOnly: false,
      page: 1,
      limit: 100,
    });

    return res.status(200).json({
      source: result.source,
      updatedAt: result.updatedAt,
      posts: result.posts,
    });
  } catch (err) {
    console.error('Blog admin API error:', err);
    return res.status(500).json({ error: 'Failed to load posts' });
  }
}
