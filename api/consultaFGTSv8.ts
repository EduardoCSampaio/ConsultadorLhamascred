import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../backend/src/supabaseClient';
import { getToken } from '../backend/src/tokenService';
import { enviarConsulta } from '../backend/src/consultaService';

// Armazenamento em memória para status/resultados das consultas por documentNumber
const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { documentNumber, provider } = req.body;
  if (!documentNumber) {
    return res.status(400).json({ error: 'documentNumber é obrigatório' });
  }

  try {
    // Autenticação (simplificada para serverless, idealmente usaria um middleware Vercel)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided or invalid format' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Lógica de consulta
    consultas[documentNumber] = { status: 'pendente' };
    await enviarConsulta({ documentNumber, provider, token });

    let tentativas = 0;
    let resultado;
    while (tentativas < 20) {
      await new Promise(r => setTimeout(r, 1000));
      const consulta = consultas[documentNumber];
      if (consulta?.status === 'finalizado') {
        resultado = consulta.resultado;
        break;
      }
      tentativas++;
    }

    if (resultado && resultado.balance !== undefined && resultado.balance !== null && resultado.balance !== '') {
      return res.json({ documentNumber, provider, balance: resultado.balance });
    } else if (resultado?.errorMessage || resultado?.error) {
      return res.json({ error: resultado.errorMessage || resultado.error });
    } else {
      return res.json({ error: 'Sem resposta' });
    }
  } catch (err: any) {
    let errorMsg = 'Erro desconhecido';
    if (err?.response?.data) {
      if (typeof err.response.data === 'object' && err.response.data.error) {
        errorMsg = err.response.data.error;
      } else {
        errorMsg = JSON.stringify(err.response.data);
      }
    } else if (err?.message) {
      errorMsg = err.message;
    }
    return res.status(500).json({ error: errorMsg });
  }
}
