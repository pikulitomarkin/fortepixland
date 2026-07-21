import { loginAdmin } from '../../lib/auth.js';

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

  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const result = await loginAdmin(email, password);

    if (!result.ok) {
      return res.status(result.status || 401).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  } catch (err) {
    console.error('Auth login API error:', err);
    return res.status(500).json({ error: 'Falha ao autenticar', detail: err.message });
  }
}
