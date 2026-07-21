import { seedIfEmpty } from '../../lib/blog.js';

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

  const token = req.headers.authorization?.replace('Bearer ', '');
  const adminToken = process.env.BLOG_ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await seedIfEmpty();
    return res.status(200).json(result);
  } catch (err) {
    console.error('Blog setup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to setup database' });
  }
}
