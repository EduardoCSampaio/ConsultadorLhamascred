import 'dotenv/config'; // Carrega as variáveis de ambiente do .env
import express from 'express';
import { getToken } from './tokenService';
import { enviarConsulta } from './consultaService';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { extractDocumentNumbersFromExcel, buildResultExcel } from './excelUtils';
import { protect } from './authMiddleware';
import { authorize } from './authorizationMiddleware';
import { supabase } from './supabaseClient';

// Captura global de erros não tratados
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const app = express();
app.use(express.json());
const port = 3001;
const upload = multer();

// Função para adicionar cabeçalhos CORS manualmente
const addCorsHeaders = (res: express.Response) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://consultador-lhamascred-3fo3.vercel.app'); // URL do frontend
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// Lidar com requisições OPTIONS (preflight)
app.options('*', (req, res) => {
  addCorsHeaders(res);
  res.status(204).send();
});

// Armazenamento em memória para status/resultados das consultas
const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};
const lotes: Record<string, {
  id: string;
  nomeArquivo: string;
  dataInicio: string;
  dataFim?: string;
  status: 'processando' | 'finalizado' | 'erro';
  resultBuffer?: Buffer;
  resultUrl?: string;
}> = {};

// ROTAS
// Consulta manual FGTS
app.post('/consultaFGTSv8', protect, async (req, res) => {
  addCorsHeaders(res);

  const { documentNumber, provider } = req.body;
  if (!documentNumber) return res.status(400).json({ error: 'documentNumber é obrigatório' });

  try {
    const token = await getToken();
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
    let errorMsg = err?.message || 'Erro desconhecido';
    return res.status(500).json({ error: errorMsg });
  }
});

// Upload Excel e processamento em lote
app.post('/consulta-excel', protect, upload.single('file'), async (req, res) => {
  addCorsHeaders(res);

  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: 'Arquivo Excel não enviado' });

  const loteId = randomUUID();
  const nomeArquivo = file.originalname || `lote_${loteId}.xlsx`;
  lotes[loteId] = {
    id: loteId,
    nomeArquivo,
    dataInicio: new Date().toISOString(),
    status: 'processando',
  };
  res.json({ loteId });

  (async () => {
    const documentNumbers = extractDocumentNumbersFromExcel(file.buffer);
    const provider = req.body.provider || 'Cartos';
    const token = await getToken();
    const results: any[] = [];

    for (const documentNumber of documentNumbers) {
      try {
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
          results.push({ documentNumber, provider, balance: resultado.balance });
        } else {
          results.push({ documentNumber, provider, errorMessage: resultado?.errorMessage || resultado?.error || 'Sem resposta' });
        }
      } catch (err: any) {
        results.push({ documentNumber, provider, errorMessage: err?.message || 'Erro desconhecido' });
      }
    }

    const excelBuffer = buildResultExcel(results);
    lotes[loteId].dataFim = new Date().toISOString();
    lotes[loteId].status = 'finalizado';
    lotes[loteId].resultBuffer = excelBuffer;
    lotes[loteId].resultUrl = `/lote-resultado/${loteId}`;
  })();
});

// Outras rotas (listar lotes, baixar resultados, status, admin, webhook, etc.)
// Em cada rota, basta adicionar `addCorsHeaders(res);` no início
// Exemplo:
app.get('/lotes-higienizados', protect, (req, res) => {
  addCorsHeaders(res);
  const lista = Object.values(lotes).map(lote => ({
    id: lote.id,
    nomeArquivo: lote.nomeArquivo,
    dataInicio: lote.dataInicio,
    dataFim: lote.dataFim,
    status: lote.status,
    resultUrl: lote.status === 'finalizado' ? lote.resultUrl : null,
  })).sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
  res.json(lista);
});

// Aqui você aplicaria o mesmo para todas as outras rotas que o frontend consome

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
