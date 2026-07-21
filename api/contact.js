import { createContactMessage } from '../../lib/contact.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    const { name, email, subject, message } = req.body || {};

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'E-mail inválido' });
    }

    const result = await createContactMessage({
      name: name.trim().slice(0, 255),
      email: email.trim().slice(0, 255),
      subject: subject.trim().slice(0, 255),
      message: message.trim().slice(0, 5000),
    });

    return res.status(201).json({
      success: true,
      id: result.id,
      message: 'Mensagem enviada com sucesso',
    });
  } catch (err) {
    console.error('Contact API error:', err);
    return res.status(500).json({ error: 'Não foi possível enviar a mensagem' });
  }
}
