import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabaseClient'; // CAMINHO CORRIGIDO
import { enviarConsulta } from '../lib/consultaService'; // CAMINHO CORRIGIDO
import { protect } from '../lib/authMiddleware'; // ADICIONADO
import { authorize } from '../lib/authorizationMiddleware'; // ADICIONADO

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Aplicar middlewares de autenticação e autorização
  const authResult = await protect(req, res);
  if (authResult) return authResult; // Se a autenticação falhar, retorna a resposta do middleware

  // Exemplo: Apenas usuários 'admin' ou 'user' podem usar esta consulta
  const authzResult = await authorize('admin')(req, res); // Ou 'user', dependendo da sua regra
  if (authzResult) return authzResult; // Se a autorização falhar, retorna a resposta do middleware

  const { documentNumber } = req.body; // 'provider' não é mais necessário aqui, pois está fixo em consultaService.ts
  if (!documentNumber) {
    return res.status(400).json({ error: 'documentNumber é obrigatório' });
  }

  try {
    // 2. Chamar enviarConsulta corretamente com apenas o documentNumber
    const resultado = await enviarConsulta(documentNumber);

    // 3. Lógica de resposta simplificada, sem cache em memória ou polling
    if (resultado && resultado.balance !== undefined && resultado.balance !== null && resultado.balance !== '') {
      return res.json({ documentNumber, balance: resultado.balance });
    } else if (resultado?.errorMessage || resultado?.error) {
      return res.json({ error: resultado.errorMessage || resultado.error });
    } else {
      return res.json({ error: 'Sem resposta ou formato inesperado da API externa.' });
    }
  } catch (err: any) {
    let errorMsg = 'Erro desconhecido ao processar a consulta.';
    if (err?.response?.data) {
      if (typeof err.response.data === 'object' && err.response.data.message) { // Ajuste para 'message' se a API retornar assim
        errorMsg = err.response.data.message;
      } else if (typeof err.response.data === 'string') {
        errorMsg = err.response.data;
      } else {
        errorMsg = JSON.stringify(err.response.data);
      }
    } else if (err?.message) {
      errorMsg = err.message;
    }
    console.error('Erro na função consultaFGTSv8:', err);
    return res.status(500).json({ error: errorMsg });
  }
}