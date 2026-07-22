import { neon } from '@neondatabase/serverless';

export function getDatabaseUrl() {
  const raw =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null;

  if (!raw) return null;

  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }
    return url.toString();
  } catch {
    return raw
      .replace(/[?&]channel_binding=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '');
  }
}

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) return null;
  return neon(url);
}

export async function ensureBlogSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(255) UNIQUE NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT,
      category VARCHAR(100) NOT NULL DEFAULT 'Aprendendo com a FortePix',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      author JSONB NOT NULL DEFAULT '{"name":"Equipe FortePix"}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      reading_time_minutes INTEGER NOT NULL DEFAULT 1,
      published_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts (published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts (category)`;
}
