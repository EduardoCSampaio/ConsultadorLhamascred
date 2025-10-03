import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabaseClient';

// Armazenamento em memória para status/resultados das consultas por documentNumber (simulado)
const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { documentNumber } = req.query;

  if (!documentNumber || typeof documentNumber !== 'string') {
    return res.status(400).json({ error: 'Document number is required' });
  }

  const consulta = consultas[documentNumber];
  if (!consulta) {
    return res.status(404).json({ error: 'Consulta não encontrada' });
  }

  return res.json(consulta);
}
