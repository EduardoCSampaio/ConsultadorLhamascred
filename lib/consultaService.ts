import axios from 'axios';
import 'dotenv/config';
import { getToken } from './tokenService.js'; // Importar a função getToken

const CONSULTA_API_BASE_URL = process.env.CONSULTA_API_BASE_URL; // Nova variável para a base URL da consulta
const ALLOWED_PROVIDERS = ["bms", "cartos", "qi"]; // Provedores permitidos


export async function enviarConsulta(documento: string, provider: string): Promise<any> { // ADICIONE 'provider: string' AQUI
  if (!CONSULTA_API_BASE_URL) {
    throw new Error('Variável de ambiente CONSULTA_API_BASE_URL não configurada.');
  }

  // Validação do provider
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(`Provedor inválido: ${provider}. Os valores permitidos são: ${ALLOWED_PROVIDERS.join(', ')}`);
  }

  try {
    const accessToken = await getToken(); // Obter o token de acesso
    const response = await axios.post(
      `${CONSULTA_API_BASE_URL}/fgts/balance`,
      {
        documentNumber: documento,
        provider: provider // <--- AGORA USA O PARÂMETRO 'provider'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Erro ao enviar consulta:', error.response?.data || error.message);
    throw new Error(`Falha na consulta: ${error.response?.data?.message || error.message}`);
  }
}