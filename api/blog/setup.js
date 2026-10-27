import { seedIfEmpty } from '../../lib/blog.js';
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
    // Seed seguro: só preenche banco vazio ou adiciona slugs do JSON ausentes.
    // Nunca apaga posts criados no CMS.
    const result = await seedIfEmpty();
    return res.status(200).json({
      ...result,
      note: 'Seed não remove publicações do CMS. Para publicar posts novos, use Publicar no painel com status published.',
    });
  } catch (err) {
    console.error('Blog setup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to setup database' });
  }
}
