import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabaseClient.js'; // CAMINHO CORRIGIDO
import { enviarConsulta } from '../lib/consultaService.js'; // CAMINHO CORRIGIDO
import { protect } from '../lib/authMiddleware.js'; // ADICIONADO (com .js)
import { authorize } from '../lib/authorizationMiddleware.js'; // ADICIONADO (com .js)

// Defina os provedores permitidos para validação (pode ser importado de consultaService.js se preferir)
const ALLOWED_PROVIDERS = ["bms", "qi", "cartos"];

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Aplicar middlewares de autenticação e autorização
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res); // Ou 'user', dependendo da sua regra
  if (authzResult) return authzResult;

  const { documentNumber, provider } = req.body; // <--- OBTENHA 'provider' DO CORPO DA REQUISIÇÃO

  if (!documentNumber) {
    return res.status(400).json({ error: 'documentNumber é obrigatório' });
  }

  // Validação do provider recebido do frontend
  if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Provedor inválido ou ausente. Os valores permitidos são: ${ALLOWED_PROVIDERS.join(', ')}` });
  }

  try {
    // 2. Chamar enviarConsulta corretamente com o documentNumber E o provider
    const resultado = await enviarConsulta(documentNumber, provider); // <--- PASSE O 'provider' AQUI

    // 3. Lógica de resposta simplificada
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
      if (typeof err.response.data === 'object' && err.response.data.message) {
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