import axios from 'axios';
import 'dotenv/config';
import { getToken } from './tokenService.js'; // Importar a função getToken

const CONSULTA_API_BASE_URL = process.env.CONSULTA_API_BASE_URL; // Nova variável para a base URL da consulta
// const API_KEY = process.env.CONSULTA_API_KEY; // REMOVER: Não é mais usada

export async function enviarConsulta(documento: string): Promise<any> {
  if (!CONSULTA_API_BASE_URL) {
    throw new Error('Variável de ambiente CONSULTA_API_BASE_URL não configurada.');
  }

  try {
    const accessToken = await getToken(); // Obter o token de acesso
    const response = await axios.post(
      `${CONSULTA_API_BASE_URL}/fgts/balance`, // Usar a base URL e o path da documentação
      {
        documentNumber: documento,
        provider: "CARTOS" // Conforme a documentação
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`, // Usar o token de acesso
          // 'X-API-Key': API_KEY, // REMOVER: Não é mais usada
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Erro ao enviar consulta:', error.response?.data || error.message);
    throw new Error(`Falha na consulta: ${error.response?.data?.message || error.message}`);
  }
}