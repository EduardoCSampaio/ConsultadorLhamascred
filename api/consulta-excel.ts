import { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import { readFileSync } from 'fs';
import { supabase } from '../lib/supabaseClient.js'; // CORRIGIDO O CAMINHO
import { extractDocumentNumbersFromExcel, buildResultExcel } from '../lib/excelUtils.js'; // CORRIGIDO O CAMINHO
import { enviarConsulta } from '../lib/consultaService.js'; // CORRIGIDO O CAMINHO
import { protect } from '../lib/authMiddleware.js'; // ADICIONADO (com .js)
import { authorize } from '../lib/authorizationMiddleware.js'; // ADICIONADO (com .js)

// Defina os provedores permitidos para validação
const ALLOWED_PROVIDERS = ["bms", "qi", "cartos"];

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res); // Exemplo: requer role 'admin'
  if (authzResult) return authzResult;

  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];
    const provider = fields.provider?.[0]; // <--- OBTENHA 'provider' DOS FIELDS DO FORMULÁRIO

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Validação do provider recebido do frontend
    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({ error: `Provedor inválido ou ausente. Os valores permitidos são: ${ALLOWED_PROVIDERS.join(', ')}` });
    }

    const buffer = readFileSync(file.filepath);
    const documentNumbers = extractDocumentNumbersFromExcel(buffer);

    if (documentNumbers.length === 0) {
      return res.status(400).json({ error: 'Nenhum número de documento encontrado no arquivo.' });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Gerar um nome para o lote, usando o nome do arquivo ou um padrão
    const nomeLote = file.originalFilename || `Lote de Consulta - ${new Date().toLocaleString('pt-BR')}`;

    const { data: lote, error: loteError } = await supabase
      .from('lotes_consulta')
      .insert({
        user_id: userId,
        nome_lote: nomeLote, // <--- CORREÇÃO: Adicionado nome_lote
        nome_arquivo: file.originalFilename || 'arquivo_excel',
        status: 'processando',
        data_inicio: new Date().toISOString(),
        provider_selecionado: provider, // <--- Salva o provider escolhido no lote
      })
      .select()
      .single();

    if (loteError || !lote) {
      console.error('Erro ao criar lote:', loteError);
      return res.status(500).json({ error: 'Erro ao iniciar o processamento do lote.' });
    }

    // Processamento assíncrono - PASSE O 'provider' PARA processBatch
    processBatch(lote.id, documentNumbers, userId, provider); // <--- PASSE O 'provider' AQUI

    return res.status(202).json({
      message: 'Processamento do lote iniciado.',
      loteId: lote.id,
    });
  } catch (error: any) {
    console.error('Erro no processamento do arquivo:', error);
    return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
  }
}

// A função processBatch também precisa aceitar o parâmetro 'provider'
async function processBatch(loteId: string, documentNumbers: string[], userId: string, provider: string) { // <--- ADICIONE 'provider: string' AQUI
  const results = [];
  for (const doc of documentNumbers) {
    try {
      const consultaResult = await enviarConsulta(doc, provider); // <--- PASSE O 'provider' AQUI
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