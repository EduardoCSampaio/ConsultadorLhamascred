import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../backend/src/supabaseClient'; // ADICIONE ESTA LINHA
import { getToken } from '../backend/src/tokenService';
import { extractDocumentNumbersFromExcel, buildResultExcel } from '../backend/src/excelUtils'; // ADICIONE ESTA LINHA
import { enviarConsulta } from '../backend/src/consultaService';
import { randomUUID } from 'crypto';
import { IncomingForm } from 'formidable';

// Remover armazenamento em memória, agora usaremos o Supabase Database e Storage
// const consultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};
// const lotes: Record<string, {
//   id: string;
//   nomeArquivo: string;
//   dataInicio: string;
//   dataFim?: string;
//   status: 'processando' | 'finalizado' | 'erro';
//   resultBuffer?: Buffer;
//   resultUrl?: string;
// }> = {};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }
  const access_token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const form = new IncomingForm();

  form.parse(req, async (err: any, fields: any, files: any) => {
    if (err) {
      console.error('Error parsing form data:', err);
      return res.status(500).json({ error: 'Error processing file upload' });
    }

    const file = files.file?.[0];
    const provider = Array.isArray(fields.provider) ? fields.provider[0] : fields.provider;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo Excel não enviado' });
    }

    const loteId = randomUUID();
    const nomeArquivo = file.originalFilename || `lote_${loteId}.xlsx`;

    // Inserir o registro do lote no banco de dados
    const { data: newBatch, error: insertError } = await supabase
      .from('batches')
      .insert({
        id: loteId,
        user_id: user.id,
        file_name: nomeArquivo,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting batch into database:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ loteId: newBatch.id }); // resposta imediata

    // Processamento em background
    (async () => {
      let finalStatus: 'finalizado' | 'erro' = 'finalizado';
      let resultUrl: string | null = null;
      try {
        const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
          const fs = require('fs');
          fs.readFile(file.filepath, (readErr: any, data: Buffer) => {
            if (readErr) reject(readErr);
            resolve(data);
          });
        });

        const documentNumbers = extractDocumentNumbersFromExcel(fileBuffer);
        const results: any[] = [];

        for (const documentNumber of documentNumbers) {
          try {
            // Simulação de consulta (manteremos o armazenamento em memória para consultas individuais temporariamente)
            // Idealmente, isso também seria persistido ou processado de forma mais robusta
            const tempConsultas: Record<string, { status: 'pendente' | 'finalizado', resultado?: any }> = {};
            tempConsultas[documentNumber] = { status: 'pendente' };
            await enviarConsulta({ documentNumber, provider, token: access_token });
            let tentativas = 0;
            let resultado;
            while (tentativas < 20) {
              await new Promise(r => setTimeout(r, 1000));
              const consulta = tempConsultas[documentNumber]; // Usar tempConsultas
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

        // Fazer upload do arquivo Excel para o Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('batch-results') // Nome do seu bucket no Supabase Storage
          .upload(`${user.id}/${loteId}_resultado.xlsx`, excelBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading file to Supabase Storage:', uploadError);
          finalStatus = 'erro';
        } else {
          // Obter a URL pública do arquivo
          const { data: publicUrlData } = supabase.storage
            .from('batch-results')
            .getPublicUrl(uploadData.path);
          resultUrl = publicUrlData.publicUrl;
        }
      } catch (processErr) {
        console.error('Error during background Excel processing:', processErr);
        finalStatus = 'erro';
      } finally {
        // Atualizar o registro do lote no banco de dados com o status final e a URL
        const { error: updateError } = await supabase
          .from('batches')
          .update({
            status: finalStatus,
            finished_at: new Date().toISOString(),
            result_url: resultUrl,
          })
          .eq('id', newBatch.id);

        if (updateError) {
          console.error('Error updating batch status in database:', updateError);
        }
      }
    })();
  });
}
