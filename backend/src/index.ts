import 'dotenv/config'; // Carrega as variáveis de ambiente do .env
import express from 'express';
import cors from 'cors';
import { getToken } from './tokenService';
import { enviarConsulta } from './consultaService';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { extractDocumentNumbersFromExcel, buildResultExcel } from './excelUtils';
import { protect } from './authMiddleware';
import { authorize } from './authorizationMiddleware'; // Importar o middleware de autorização
import { supabase } from './supabaseClient'; // Importar o cliente Supabase para operações de admin

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
app.use(cors({
  origin: ['http://localhost:3000', 'https://consultador-lhamascred-3fo3.vercel.app/'], // Adicione a URL do seu frontend no Vercel
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
const port = 3001;

const upload = multer();

// Armazenamento em memória para status/resultados das consultas por documentNumber
const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};
// Armazenamento em memória para lotes higienizados
const lotes: Record<string, {
  id: string;
  nomeArquivo: string;
  dataInicio: string;
  dataFim?: string;
  status: 'processando' | 'finalizado' | 'erro';
  resultBuffer?: Buffer;
  resultUrl?: string;
}> = {};

// Rota para consulta manual FGTS (um documento)
app.post('/consultaFGTSv8', protect, async (req, res) => {
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
});

// Rota para upload de Excel e processamento em lote (assíncrona)
app.post('/consulta-excel', protect, upload.single('file'), async (req, res) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ error: 'Arquivo Excel não enviado' });
  }
  const loteId = randomUUID();
  const nomeArquivo = file.originalname || `lote_${loteId}.xlsx`;
  lotes[loteId] = {
    id: loteId,
    nomeArquivo,
    dataInicio: new Date().toISOString(),
    status: 'processando',
  };
  res.json({ loteId }); // resposta imediata
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
        results.push({ documentNumber, provider, errorMessage: errorMsg });
      }
    }
    const excelBuffer = buildResultExcel(results);
    lotes[loteId].dataFim = new Date().toISOString();
    lotes[loteId].status = 'finalizado';
    lotes[loteId].resultBuffer = excelBuffer;
    lotes[loteId].resultUrl = `/lote-resultado/${loteId}`;
  })();
});

// Rota para listar lotes higienizados
app.get('/lotes-higienizados', protect, (req, res) => {
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

// Rota para baixar resultado do lote
app.get('/lote-resultado/:id', protect, (req, res) => {
  const lote = lotes[req.params.id];
  if (!lote || !lote.resultBuffer) {
    return res.status(404).json({ error: 'Lote não encontrado ou não finalizado' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${lote.nomeArquivo.replace(/\.[^.]+$/, '')}_resultado.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(lote.resultBuffer);
});

// Rota para buscar status/resultado da consulta por documentNumber
app.get('/consulta-status/:documentNumber', protect, (req, res) => {
  const consulta = consultas[req.params.documentNumber];
  if (!consulta) {
    return res.status(404).json({ error: 'Consulta não encontrada' });
  }
  res.json(consulta);
});

// Rota para verificar o status de um lote
app.get('/lote-status/:loteId', protect, (req, res) => {
  const lote = lotes[req.params.loteId];
  if (!lote) {
    return res.status(404).json({ error: 'Lote não encontrado' });
  }
  res.json(lote);
});

// Rota para download do Excel de resultados
app.get('/download-excel/:loteId', protect, (req, res) => {
  const lote = lotes[req.params.loteId];
  if (!lote || !lote.resultBuffer) {
    return res.status(404).json({ error: 'Lote não encontrado ou não finalizado' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${lote.nomeArquivo.replace(/\.[^.]+$/, '')}_resultado.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(lote.resultBuffer);
});

// Novas rotas para gerenciamento de usuários (apenas para administradores)
app.get('/admin/users', protect, authorize(['admin']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, role');

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(users);
  } catch (err) {
    console.error('Error in /admin/users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/admin/users/:id/role', protect, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id);

    if (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    console.error('Error in /admin/users/:id/role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para criar um novo usuário (apenas para administradores)
app.post('/admin/users', protect, authorize(['admin']), async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  try {
    // Criar o usuário no Supabase Auth
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma o email automaticamente
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      return res.status(500).json({ error: authError.message });
    }

    if (!user || !user.user) {
      return res.status(500).json({ error: 'Failed to create user in Supabase Auth' });
    }

    // O gatilho do Supabase (handle_new_user) já cria o perfil com role 'user'.
    // Se o papel solicitado for diferente de 'user', atualizamos.
    if (role !== 'user') {
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.user.id);

      if (updateProfileError) {
        console.error('Supabase Profile Update Error:', updateProfileError);
        // Se falhar ao atualizar o perfil, tentar deletar o usuário do auth para evitar inconsistência
        await supabase.auth.admin.deleteUser(user.user.id);
        return res.status(500).json({ error: updateProfileError.message });
      }
    }

    return res.status(201).json({ message: 'User created successfully', userId: user.user.id });
  } catch (err: any) {
    console.error('Server Error creating user:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Rota para listar todos os usuários e seus papéis (apenas para administradores)
app.get('/admin/users-list', protect, authorize(['admin']), async (req, res) => {
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, role');

    if (profilesError) {
      console.error('Supabase Profiles Error:', profilesError);
      return res.status(500).json({ error: profilesError.message });
    }

    const usersWithEmails = await Promise.all(profiles.map(async (profile) => {
      const { data: userAuth, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      if (authError) {
        console.error("Error fetching auth user for profile:", profile.id, authError);
        return { ...profile, email: 'N/A' };
      }
      return { ...profile, email: userAuth?.user?.email || 'N/A' };
    }));

    return res.status(200).json(usersWithEmails);
  } catch (err: any) {
    console.error('Server Error listing users:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Rota para atualizar a função de um usuário (apenas para administradores)
app.put('/admin/users/:userId/role', protect, authorize(['admin']), async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('Supabase Update Role Error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'User role updated successfully' });
  } catch (err: any) {
    console.error('Server Error updating user role:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Rota para deletar um usuário (apenas para administradores)
app.delete('/admin/users/:userId', protect, authorize(['admin']), async (req, res) => {
  const { userId } = req.params;

  try {
    // Primeiro, deletar o perfil da tabela 'profiles'
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Supabase Profile Delete Error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // Em seguida, deletar o usuário do Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Supabase Auth Delete Error:', authError);
      return res.status(500).json({ error: authError.message });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Server Error deleting user:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Rota webhook para receber resposta externa
app.post('/webhook', (req, res) => {
  const { documentNumber, ...resto } = req.body;
  const docStr = String(documentNumber).trim();
  console.log('Webhook recebido:', { recebido: documentNumber, normalizado: docStr, body: req.body });
  if (docStr && consultas[docStr]) {
    consultas[docStr] = { status: 'finalizado', resultado: resto };
    console.log('Webhook associado ao documentNumber:', docStr, resto);
  } else {
    console.log('Webhook recebido, mas documentNumber não encontrado:', req.body);
  }
  res.status(200).json({ received: true });
});

// Rota para buscar a função de um usuário específico (acessível por qualquer usuário autenticado para sua própria função)
app.get('/user-role/:userId', protect, async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role from profiles:', error);
      // Adicionar log para depuração
      console.log('Supabase query error for user role:', error);
      return res.status(500).json({ error: 'Failed to fetch user role' });
    }

    if (!profile) {
      // Adicionar log para depuração
      console.log('User profile not found for ID:', userId);
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Adicionar log para depuração
    console.log('Fetched user role:', profile.role, 'for user ID:', userId);
    return res.status(200).json({ role: profile.role });
  } catch (err: any) {
    console.error('Server Error fetching user role:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
