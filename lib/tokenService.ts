import axios from 'axios';
import 'dotenv/config';

const TOKEN_API_URL = process.env.TOKEN_API_URL;
const TOKEN_API_CLIENT_ID = process.env.TOKEN_API_CLIENT_ID;
const TOKEN_API_USERNAME = process.env.TOKEN_API_USERNAME; // Nova variável
const TOKEN_API_PASSWORD = process.env.TOKEN_API_PASSWORD; // Nova variável
const TOKEN_API_AUDIENCE = process.env.TOKEN_API_AUDIENCE; // Nova variável
const TOKEN_API_SCOPE = process.env.TOKEN_API_SCOPE; // Nova variável

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getToken(): Promise<string> {
  if (!TOKEN_API_URL || !TOKEN_API_CLIENT_ID || !TOKEN_API_USERNAME || !TOKEN_API_PASSWORD || !TOKEN_API_AUDIENCE || !TOKEN_API_SCOPE) {
    throw new Error('Variáveis de ambiente da API de token não configuradas corretamente.');
  }

  const now = Date.now();
  // Se o token estiver em cache e ainda for válido por pelo menos 5 minutos
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const response = await axios.post(
      TOKEN_API_URL,
      new URLSearchParams({ // Usar URLSearchParams para enviar dados como application/x-www-form-urlencoded
        grant_type: 'password',
        username: TOKEN_API_USERNAME,
        password: TOKEN_API_PASSWORD,
        audience: TOKEN_API_AUDIENCE,
        scope: TOKEN_API_SCOPE,
        client_id: TOKEN_API_CLIENT_ID,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded', // Mudar o Content-Type
        },
      }
    );

    const { access_token, expires_in } = response.data;
    cachedToken = {
      token: access_token,
      expiresAt: now + expires_in * 1000, // expires_in geralmente em segundos
    };
    return access_token;
  } catch (error: any) {
    console.error('Erro ao obter token:', error.response?.data || error.message);
    throw new Error(`Falha ao obter token: ${error.response?.data?.message || error.message}`);
  }
}