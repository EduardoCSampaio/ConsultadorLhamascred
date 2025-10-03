// Este arquivo não é mais necessário para iniciar um servidor Express,
// pois todas as rotas foram migradas para Vercel Serverless Functions na pasta 'api/'.
// O conteúdo original deste arquivo foi comentado ou removido para evitar conflitos.

// import 'dotenv/config';
// import express from 'express';
// import { getToken } from './tokenService';
// import { enviarConsulta } from './consultaService';
// import { randomUUID } from 'crypto';
// import multer from 'multer';
// import { extractDocumentNumbersFromExcel, buildResultExcel } from './excelUtils';
// import { protect } from './authMiddleware';
// import { authorize } from './authorizationMiddleware';
// import { supabase } from './supabaseClient';

// // Captura global de erros não tratados
// process.on('uncaughtException', (err) => {
// //   console.error('Uncaught Exception:', err);
// //   process.exit(1);
// });
// process.on('unhandledRejection', (reason, promise) => {
// //   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// //   process.exit(1);
// });

// const app = express();
// app.use(express.json());
// const port = 3001;
// const upload = multer();

// // Função para adicionar cabeçalhos CORS manualmente
// const addCorsHeaders = (res: express.Response) => {
// //   res.setHeader('Access-Control-Allow-Origin', 'https://consultador-lhamascred-3fo3.vercel.app');
// //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
// //   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
// };

// // Lidar com requisições OPTIONS (preflight)
// app.options('*', (req, res) => {
// //   addCorsHeaders(res);
// //   res.status(204).send();
// });

// // Armazenamento em memória (agora deve ser persistido no Supabase)
// const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};
// const lotes: Record<string, {
// //   id: string;
// //   nomeArquivo: string;
// //   dataInicio: string;
// //   dataFim?: string;
// //   status: 'processando' | 'finalizado' | 'erro';
// //   resultBuffer?: Buffer;
// //   resultUrl?: string;
// }> = {};

// // ROTAS (todas migradas para 'api/' como Serverless Functions)
// // ... todas as definições de rota foram removidas daqui ...

// app.listen(port, () => {
// //   console.log(`Backend listening at http://localhost:${port}`);
// });
