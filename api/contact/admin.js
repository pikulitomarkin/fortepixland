import {
  listContactMessages,
  updateContactMessageStatus,
  countNewMessages,
} from '../../lib/contact.js';
import { requireAdmin } from '../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    if (req.method === 'GET') {
      const { status } = req.query;
      const result = await listContactMessages({ status });
      const newCount = await countNewMessages();
      return res.status(200).json({ ...result, newCount });
    }

    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      if (!id || !['new', 'read', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'id e status válido são obrigatórios' });
      }
      const updated = await updateContactMessageStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: 'Mensagem não encontrada' });
      }
      return res.status(200).json({ message: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Contact admin API error:', err);
    return res.status(500).json({ error: 'Erro ao processar solicitação', detail: err.message });
  }
}
