import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './lib/src/supabaseClient';

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

  const lista = Object.values(lotes).map(lote => ({
    id: lote.id,
    nomeArquivo: lote.nomeArquivo,
    dataInicio: lote.dataInicio,
    dataFim: lote.dataFim,
    status: lote.status,
    resultUrl: lote.status === 'finalizado' ? lote.resultUrl : null,
  })).sort((a, b) => (b.dataInicio.localeCompare(a.dataInicio)));

  return res.json(lista);
}
