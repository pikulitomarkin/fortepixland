import { readFileSync } from 'fs';
import { join } from 'path';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function saveViaGitHub(content, message) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'landingpage';

  if (!token || !repo) {
    return { ok: false, reason: 'github_not_configured' };
  }

  const filePath = 'blog/data/posts.json';
  const apiBase = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  const currentRes = await fetch(`${apiBase}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  let sha;
  if (currentRes.ok) {
    const current = await currentRes.json();
    sha = current.sha;
  }

  const body = {
    message: message || 'Atualiza posts do blog via CMS',
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const saveRes = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  if (!saveRes.ok) {
    const err = await saveRes.text();
    throw new Error(`GitHub API error: ${err}`);
  }

  return { ok: true };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const adminToken = process.env.BLOG_ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { posts, version = 1 } = req.body;

    if (!Array.isArray(posts)) {
      return res.status(400).json({ error: 'Invalid payload: posts array required' });
    }

    const payload = {
      version,
      updatedAt: new Date().toISOString(),
      posts,
    };

    const content = JSON.stringify(payload, null, 2) + '\n';
    const result = await saveViaGitHub(content, 'Publica conteúdo do blog via CMS FortePix');

    if (!result.ok) {
      return res.status(200).json({
        saved: false,
        reason: result.reason,
        data: payload,
        message:
          'Configure GITHUB_TOKEN e GITHUB_REPO na Vercel para publicação automática. Use exportar JSON como alternativa.',
      });
    }

    return res.status(200).json({
      saved: true,
      updatedAt: payload.updatedAt,
      count: posts.length,
    });
  } catch (err) {
    console.error('Blog save error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save posts' });
  }
}
