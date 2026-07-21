import { readFileSync } from 'fs';
import { join } from 'path';

function loadPosts() {
  const filePath = join(process.cwd(), 'blog', 'data', 'posts.json');
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function publishedOnly(posts) {
  return posts.filter((p) => p.status === 'published');
}

function sortByDate(posts) {
  return [...posts].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}

export default function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = loadPosts();
    const { slug, category, tag, page = '1', limit = '20' } = req.query;

    let posts = publishedOnly(data.posts);
    posts = sortByDate(posts);

    if (category) {
      posts = posts.filter(
        (p) => p.category.toLowerCase() === String(category).toLowerCase()
      );
    }

    if (tag) {
      posts = posts.filter((p) =>
        p.tags.some((t) => t.toLowerCase() === String(tag).toLowerCase())
      );
    }

    if (slug) {
      const post = posts.find((p) => p.slug === slug);
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      return res.status(200).json({
        version: data.version,
        updatedAt: data.updatedAt,
        post,
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const paginated = posts.slice(start, start + limitNum);

    return res.status(200).json({
      version: data.version,
      updatedAt: data.updatedAt,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: posts.length,
        totalPages: Math.ceil(posts.length / limitNum),
      },
      posts: paginated,
    });
  } catch (err) {
    console.error('Blog API error:', err);
    return res.status(500).json({ error: 'Failed to load posts' });
  }
}
