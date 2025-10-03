import { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { readFileSync } from 'fs';
import { supabase } from './lib/supabaseClient'; // CORRIGIDO O CAMINHO
import { extractDocumentNumbersFromExcel, buildResultExcel } from './lib/excelUtils'; // CORRIGIDO O CAMINHO
import { enviarConsulta } from './lib/consultaService'; // CORRIGIDO O CAMINHO
import { protect } from './lib/authMiddleware'; // ADICIONADO
import { authorize } from './lib/authorizationMiddleware'; // ADICIONADO

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Adaptação do middleware para Vercel Functions
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res); // Exemplo: requer role 'admin'
  if (authzResult) return authzResult;

  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const buffer = readFileSync(file.filepath);
    const documentNumbers = extractDocumentNumbersFromExcel(buffer);

    if (documentNumbers.length === 0) {
      return res.status(400).json({ error: 'Nenhum número de documento encontrado no arquivo.' });
    }

    const userId = (req as any).user?.id; // Assumindo que o protect anexa o user
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: lote, error: loteError } = await supabase
      .from('lotes_consulta')
      .insert({
        user_id: userId,
        nome_arquivo: file.originalFilename || 'arquivo_excel',
        status: 'processando',
        data_inicio: new Date().toISOString(),
      })
      .select()
      .single();

    if (loteError || !lote) {
      console.error('Erro ao criar lote:', loteError);
      return res.status(500).json({ error: 'Erro ao iniciar o processamento do lote.' });
    }

    // Processamento assíncrono
    processBatch(lote.id, documentNumbers, userId);

    return res.status(202).json({
      message: 'Processamento do lote iniciado.',
      loteId: lote.id,
    });
  } catch (error: any) {
    console.error('Erro no processamento do arquivo:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
  }
}

async function processBatch(loteId: string, documentNumbers: string[], userId: string) {
  // ... (sua lógica de processamento de lote aqui)
  // Certifique-se de que esta função também usa as importações relativas corretas
  // e lida com erros de forma robusta.
  // Exemplo:
  const results = [];
  for (const doc of documentNumbers) {
    try {
      const consultaResult = await enviarConsulta(doc);
      results.push({ documento: doc, resultado: consultaResult });
    } catch (err) {
      console.error(`Erro ao consultar documento ${doc}:`, err);
      results.push({ documento: doc, erro: (err as Error).message });
    }
  }

  const resultBuffer = buildResultExcel(results);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('lotes-resultados')
    .upload(`${userId}/${loteId}/resultado.xlsx`, resultBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (uploadError) {
    console.error('Erro ao fazer upload do resultado:', uploadError);
    await supabase.from('lotes_consulta').update({ status: 'erro' }).eq('id', loteId);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from('lotes-resultados')
    .getPublicUrl(uploadData.path);

  await supabase
    .from('lotes_consulta')
    .update({
      status: 'finalizado',
      data_fim: new Date().toISOString(),
      result_url: publicUrlData.publicUrl,
    })
    .eq('id', loteId);
}