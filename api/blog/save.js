import { requireAdmin } from '../../lib/auth.js';
import { getSql, ensureBlogSchema } from '../../lib/db.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
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

    const sql = getSql();
    if (!sql) {
      return res.status(503).json({
        saved: false,
        reason: 'database_not_configured',
        message: 'Banco não configurado na Vercel.',
      });
    }

    await ensureBlogSchema(sql);
    const now = new Date().toISOString();
    const incomingIds = [];

    for (const post of posts) {
      if (!post?.id || !post?.slug || !post?.title) continue;
      incomingIds.push(post.id);

      const tagsJson = JSON.stringify(Array.isArray(post.tags) ? post.tags : []);
      const authorJson = JSON.stringify(post.author || { name: 'Equipe FortePix' });
      const publishedAt = post.publishedAt || now;
      const updatedAt = post.updatedAt || now;
      const status = post.status || 'draft';
      const category = post.category || 'Golpes';
      const reading = Number(post.readingTimeMinutes) || 1;

      await sql`
        INSERT INTO blog_posts (
          id, slug, title, excerpt, content, cover_image, category, tags, author,
          status, reading_time_minutes, published_at, updated_at
        ) VALUES (
          ${post.id},
          ${post.slug},
          ${post.title},
          ${post.excerpt || ''},
          ${post.content || ''},
          ${post.coverImage || null},
          ${category},
          ${tagsJson}::jsonb,
          ${authorJson}::jsonb,
          ${status},
          ${reading},
          ${publishedAt},
          ${updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          excerpt = EXCLUDED.excerpt,
          content = EXCLUDED.content,
          cover_image = EXCLUDED.cover_image,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          author = EXCLUDED.author,
          status = EXCLUDED.status,
          reading_time_minutes = EXCLUDED.reading_time_minutes,
          published_at = EXCLUDED.published_at,
          updated_at = EXCLUDED.updated_at
      `;
    }

    if (incomingIds.length > 0) {
      await sql`DELETE FROM blog_posts WHERE NOT (id = ANY(${incomingIds}))`;
    }

    return res.status(200).json({
      saved: true,
      source: 'postgres',
      updatedAt: now,
      count: incomingIds.length,
    });
  } catch (err) {
    console.error('Blog save error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save posts' });
  }
}
