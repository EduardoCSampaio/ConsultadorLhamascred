import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../backend/src/supabaseClient';

// Armazenamento em memória para lotes higienizados (simulado)
const lotes: Record<string, {
  id: string;
  nomeArquivo: string;
  dataInicio: string;
  dataFim?: string;
  status: 'processando' | 'finalizado' | 'erro';
  resultBuffer?: Buffer;
  resultUrl?: string;
}> = {};

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

  const { loteId } = req.query;

  if (!loteId || typeof loteId !== 'string') {
    return res.status(400).json({ error: 'Lote ID is required' });
  }

  const lote = lotes[loteId];
  if (!lote || !lote.resultBuffer) {
    return res.status(404).json({ error: 'Lote não encontrado ou não finalizado' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${lote.nomeArquivo.replace(/\.[^.]+$/, '')}_resultado.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(lote.resultBuffer);
}
