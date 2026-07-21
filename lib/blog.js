import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ensureBlogSchema, getSql } from './db.js';

const SEED_POSTS = [
  {
    id: 'post-001',
    slug: 'como-identificar-golpe-do-pix',
    title: 'Como identificar o golpe do Pix em 5 passos',
    excerpt:
      'Golpistas usam urgência e falsas promessas para convencer vítimas a transferir via Pix. Aprenda os sinais de alerta antes de confirmar qualquer pagamento.',
    content:
      '## O que é o golpe do Pix?\n\nO golpe do Pix explora a velocidade das transferências instantâneas.\n\n## 5 sinais de alerta\n\n1. **Urgência extrema**\n2. **Chave Pix desconhecida**\n3. **Valor diferente do combinado**\n4. **Contato por WhatsApp sem contexto**\n5. **Promessa de retorno rápido**',
    coverImage: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80',
    category: 'Golpes',
    tags: ['pix', 'golpe', 'segurança'],
    author: { name: 'Equipe FortePix' },
    publishedAt: '2026-07-21T10:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
    status: 'published',
    readingTimeMinutes: 4,
  },
];

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function rowToPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImage: row.cover_image || '',
    category: row.category,
    tags: parseJsonField(row.tags, []),
    author: parseJsonField(row.author, { name: 'Equipe FortePix' }),
    status: row.status,
    readingTimeMinutes: row.reading_time_minutes,
    publishedAt: new Date(row.published_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function postToRow(post) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    cover_image: post.coverImage || null,
    category: post.category || 'Golpes',
    tags: post.tags || [],
    author: post.author || { name: 'Equipe FortePix' },
    status: post.status || 'draft',
    reading_time_minutes: post.readingTimeMinutes || 1,
    published_at: post.publishedAt,
    updated_at: post.updatedAt || new Date().toISOString(),
  };
}

function loadJsonFallback() {
  const filePath = join(process.cwd(), 'blog', 'data', 'posts.json');
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    posts: SEED_POSTS,
  };
}

function listFromJson(options) {
  const { publishedOnly = true, category, tag, slug, page = 1, limit = 20 } = options;
  const data = loadJsonFallback();
  let posts = data.posts || [];
  if (publishedOnly) posts = posts.filter((p) => p.status === 'published');
  posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  if (category) {
    posts = posts.filter(
      (p) => p.category.toLowerCase() === String(category).toLowerCase()
    );
  }
  if (tag) {
    posts = posts.filter((p) =>
      (p.tags || []).some((t) => t.toLowerCase() === String(tag).toLowerCase())
    );
  }
  if (slug) {
    const post = posts.find((p) => p.slug === slug);
    return { source: 'json', updatedAt: data.updatedAt, post, posts };
  }

  const start = (page - 1) * limit;
  return {
    source: 'json',
    updatedAt: data.updatedAt,
    posts: posts.slice(start, start + limit),
    total: posts.length,
  };
}

export async function getBlogStore() {
  const sql = getSql();
  if (!sql) return { source: 'json', sql: null };

  try {
    await ensureBlogSchema(sql);
    return { source: 'postgres', sql };
  } catch (err) {
    console.error('Blog schema error:', err);
    return { source: 'json', sql: null };
  }
}

export async function listPosts(options = {}) {
  const store = await getBlogStore();

  if (store.source === 'json') {
    return listFromJson(options);
  }

  const { publishedOnly = true, category, tag, slug, page = 1, limit = 20 } = options;

  try {
    const { sql } = store;

    if (slug) {
      const rows = publishedOnly
        ? await sql`
            SELECT * FROM blog_posts
            WHERE slug = ${slug} AND status = 'published'
            LIMIT 1
          `
        : await sql`
            SELECT * FROM blog_posts
            WHERE slug = ${slug}
            LIMIT 1
          `;
      const post = rowToPost(rows[0]);
      const meta = await sql`SELECT MAX(updated_at) AS updated_at FROM blog_posts`;
      return {
        source: 'postgres',
        updatedAt: meta[0]?.updated_at
          ? new Date(meta[0].updated_at).toISOString()
          : new Date().toISOString(),
        post,
      };
    }

    const offset = (page - 1) * limit;
    let rows;
    let countRows;

    if (publishedOnly && category) {
      rows = await sql`
        SELECT * FROM blog_posts
        WHERE status = 'published' AND LOWER(category) = LOWER(${category})
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*)::int AS total FROM blog_posts
        WHERE status = 'published' AND LOWER(category) = LOWER(${category})
      `;
    } else if (publishedOnly) {
      rows = await sql`
        SELECT * FROM blog_posts
        WHERE status = 'published'
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM blog_posts WHERE status = 'published'`;
    } else if (category) {
      rows = await sql`
        SELECT * FROM blog_posts
        WHERE LOWER(category) = LOWER(${category})
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*)::int AS total FROM blog_posts
        WHERE LOWER(category) = LOWER(${category})
      `;
    } else {
      rows = await sql`
        SELECT * FROM blog_posts
        ORDER BY published_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*)::int AS total FROM blog_posts`;
    }

    let posts = rows.map(rowToPost);

    if (tag) {
      posts = posts.filter((p) =>
        p.tags.some((t) => t.toLowerCase() === String(tag).toLowerCase())
      );
    }

    const meta = await sql`SELECT MAX(updated_at) AS updated_at FROM blog_posts`;

    return {
      source: 'postgres',
      updatedAt: meta[0]?.updated_at
        ? new Date(meta[0].updated_at).toISOString()
        : new Date().toISOString(),
      posts,
      total: countRows[0]?.total || 0,
    };
  } catch (err) {
    console.error('Blog postgres list error:', err);
    return listFromJson(options);
  }
}

export async function savePosts(posts) {
  const store = await getBlogStore();
  const now = new Date().toISOString();

  if (store.source === 'json') {
    return { saved: false, reason: 'database_not_configured', updatedAt: now };
  }

  const { sql } = store;
  const incomingIds = posts.map((p) => p.id);

  for (const post of posts) {
    const row = postToRow({ ...post, updatedAt: post.updatedAt || now });
    await sql`
      INSERT INTO blog_posts (
        id, slug, title, excerpt, content, cover_image, category, tags, author,
        status, reading_time_minutes, published_at, updated_at
      ) VALUES (
        ${row.id}, ${row.slug}, ${row.title}, ${row.excerpt}, ${row.content},
        ${row.cover_image}, ${row.category}, ${row.tags}, ${row.author},
        ${row.status}, ${row.reading_time_minutes}, ${row.published_at}, ${row.updated_at}
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

  if (incomingIds.length) {
    await sql`DELETE FROM blog_posts WHERE NOT (id = ANY(${incomingIds}::text[]))`;
  }

  return { saved: true, updatedAt: now, count: posts.length, source: 'postgres' };
}

export async function seedIfEmpty() {
  try {
    const store = await getBlogStore();
    if (store.source === 'json') return { seeded: false, reason: 'database_not_configured' };

    const { sql } = store;
    const countRows = await sql`SELECT COUNT(*)::int AS total FROM blog_posts`;
    if (countRows[0]?.total > 0) return { seeded: false, reason: 'already_has_posts' };

    const data = loadJsonFallback();
    return await savePosts(data.posts || SEED_POSTS);
  } catch (err) {
    console.error('Blog seed error:', err);
    return { seeded: false, reason: 'seed_failed', error: err.message };
  }
}
