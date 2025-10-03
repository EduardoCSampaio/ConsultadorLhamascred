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

// Função para adicionar cabeçalhos CORS
const addCorsHeaders = (res: express.Response) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://consultador-lhamascred-3fo3.vercel.app'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// Tratar requisições OPTIONS (preflight)
app.options('*', (req, res) => {
  addCorsHeaders(res);
  res.status(204).send();
});

// ================== Armazenamento em memória ==================
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

// ================== ROTAS ==================

// Consulta manual FGTS
app.post('/consultaFGTSv8', protect, async (req, res) => {
  addCorsHeaders(res);
  const { documentNumber, provider } = req.body;
  if (!documentNumber) {
    return res.status(400).json({ error: 'documentNumber é obrigatório' });
  }
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
    return res.status(500).json({ error: err.message || 'Erro desconhecido' });
  }
});

// Upload de Excel e processamento em lote
app.post('/consulta-excel', protect, upload.single('file'), async (req, res) => {
  addCorsHeaders(res);
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ error: 'Arquivo Excel não enviado' });
  }
  const loteId = randomUUID();
  const nomeArquivo = file.originalname || `lote_${loteId}.xlsx`;
  lotes[loteId] = { id: loteId, nomeArquivo, dataInicio: new Date().toISOString(), status: 'processando' };
  res.json({ loteId });

  // Processamento em background
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
          const errorMsg = resultado?.errorMessage || resultado?.error || 'Sem resposta';
          results.push({ documentNumber, provider, errorMessage: errorMsg });
        }
      } catch (err: any) {
        results.push({ documentNumber, provider, errorMessage: err.message || 'Erro desconhecido' });
      }
    }
    const excelBuffer = buildResultExcel(results);
    lotes[loteId].dataFim = new Date().toISOString();
    lotes[loteId].status = 'finalizado';
    lotes[loteId].resultBuffer = excelBuffer;
    lotes[loteId].resultUrl = `/lote-resultado/${loteId}`;
  })();
});

// Listar lotes
app.get('/lotes-higienizados', protect, (req, res) => {
  addCorsHeaders(res);
  const lista = Object.values(lotes).map(lote => ({
    id: lote.id,
    nomeArquivo: lote.nomeArquivo,
    dataInicio: lote.dataInicio,
    dataFim: lote.dataFim,
    status: lote.status,
    resultUrl: lote.status === 'finalizado' ? lote.resultUrl : null,
  })).sort((a, b) => (b.dataInicio.localeCompare(a.dataInicio)));
  res.json(lista);
});

// Baixar resultado do lote
app.get('/lote-resultado/:id', protect, (req, res) => {
  addCorsHeaders(res);
  const lote = lotes[req.params.id];
  if (!lote || !lote.resultBuffer) {
    return res.status(404).json({ error: 'Lote não encontrado ou não finalizado' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${lote.nomeArquivo.replace(/\.[^.]+$/, '')}_resultado.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(lote.resultBuffer);
});

// Status por documento
app.get('/consulta-status/:documentNumber', protect, (req, res) => {
  addCorsHeaders(res);
  const consulta = consultas[req.params.documentNumber];
  if (!consulta) return res.status(404).json({ error: 'Consulta não encontrada' });
  res.json(consulta);
});

// Status de lote
app.get('/lote-status/:loteId', protect, (req, res) => {
  addCorsHeaders(res);
  const lote = lotes[req.params.loteId];
  if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
  res.json(lote);
});

// Download Excel
app.get('/download-excel/:loteId', protect, (req, res) => {
  addCorsHeaders(res);
  const lote = lotes[req.params.loteId];
  if (!lote || !lote.resultBuffer) {
    return res.status(404).json({ error: 'Lote não encontrado ou não finalizado' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${lote.nomeArquivo.replace(/\.[^.]+$/, '')}_resultado.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(lote.resultBuffer);
});

// Admin - listar usuários
app.get('/admin/users', protect, authorize(['admin']), async (req, res) => {
  addCorsHeaders(res);
  try {
    const { data: users, error } = await supabase.from('profiles').select('id, username, role');
    if (error) return res.status(500).json({ error: 'Failed to fetch users' });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin - atualizar role
app.put('/admin/users/:id/role', protect, authorize(['admin']), async (req, res) => {
  addCorsHeaders(res);
  const { id } = req.params;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to update user role' });
  res.json({ message: 'User role updated successfully' });
});

// Admin - criar usuário
app.post('/admin/users', protect, authorize(['admin']), async (req, res) => {
  addCorsHeaders(res);
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  const { data: user, error: authError } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (authError) return res.status(500).json({ error: authError.message });
  if (role !== 'user') {
    await supabase.from('profiles').update({ role }).eq('id', user.user.id);
  }
  res.status(201).json({ message: 'User created successfully', userId: user.user.id });
});

// Webhook
app.post('/webhook', (req, res) => {
  addCorsHeaders(res);
  const { documentNumber, ...resto } = req.body;
  const docStr = String(documentNumber).trim();
  if (docStr && consultas[docStr]) {
    consultas[docStr] = { status: 'finalizado', resultado: resto };
  }
  res.status(200).json({ received: true });
});

// Buscar role do usuário
app.get('/user-role/:userId', protect, async (req, res) => {
  addCorsHeaders(res);
  const { userId } = req.params;
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) return res.status(500).json({ error: 'Failed to fetch user role' });
  if (!profile) return res.status(404).json({ error: 'User profile not found' });
  res.json({ role: profile.role });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
