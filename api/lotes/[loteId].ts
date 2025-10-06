// filepath: c:\Users\Eduardo\Desktop\SistemaConsultas\api\lotes\[loteId].ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabaseClient'; // Ajuste o caminho conforme sua estrutura
import { protect } from '../../lib/authMiddleware'; // Ajuste o caminho
import { authorize } from '../../lib/authorizationMiddleware'; // Ajuste o caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  const { loteId } = req.query;

  if (!loteId || typeof loteId !== 'string') {
    return res.status(400).json({ error: 'ID do lote é obrigatório.' });
  }

  // Aplica middlewares de autenticação e autorização
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res); // Ou a role apropriada
  if (authzResult) return authzResult;

  if (req.method === 'GET') {
    // Lógica para obter o STATUS do lote
    // Isso substitui o que estava em api/lote-status/[loteId].ts
    try {
      const { data: lote, error } = await supabase
        .from('lotes_consulta')
        .select('status, data_inicio, data_fim, result_url')
        .eq('id', loteId)
        .single();

      if (error) {
        console.error('Erro ao buscar status do lote:', error);
        return res.status(500).json({ error: 'Falha ao buscar status do lote.' });
      }
      if (!lote) {
        return res.status(404).json({ error: 'Lote não encontrado.' });
      }
      return res.status(200).json(lote);
    } catch (err: any) {
      console.error('Erro no servidor ao buscar status do lote:', err);
      return res.status(500).json({ error: err.message || 'Erro interno do servidor.' });
    }
  } else if (req.method === 'POST') {
    // Lógica para obter o RESULTADO do lote (se for um POST para iniciar download ou algo assim)
    // Isso substitui o que estava em api/lote-resultado/[loteId].ts
    // Se o resultado for apenas um GET para a URL, você pode mover a lógica para o GET acima
    // ou ter um endpoint separado como /api/lotes/[loteId]/download
    // Por enquanto, vamos assumir que o GET acima já retorna a URL do resultado.
    return res.status(405).json({ error: 'Método POST não suportado para este endpoint de lote. Use GET para status/resultado.' });
  } else {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
}