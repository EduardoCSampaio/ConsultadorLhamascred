import axios from 'axios';
import 'dotenv/config';

// Corrigido para usar os nomes de variáveis de ambiente com prefixo V8_
const V8_AUTH_URL = process.env.V8_AUTH_URL;
const V8_CLIENT_ID = process.env.V8_CLIENT_ID;
const V8_USERNAME = process.env.V8_USERNAME;
const V8_PASSWORD = process.env.V8_PASSWORD;
const V8_AUDIENCE = process.env.V8_AUDIENCE;
const V8_SCOPE = process.env.V8_SCOPE;

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getToken(): Promise<string> {
  // Atualizado para verificar as novas variáveis de ambiente
  if (!V8_AUTH_URL || !V8_CLIENT_ID || !V8_USERNAME || !V8_PASSWORD || !V8_AUDIENCE || !V8_SCOPE) {
    throw new Error('Variáveis de ambiente da API de token (V8_...) não configuradas corretamente.');
  }

  const now = Date.now();
  // Se o token estiver em cache e ainda for válido por pelo menos 5 minutos
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  try {
    const response = await axios.post(
      V8_AUTH_URL, // Usando a variável V8_AUTH_URL
      new URLSearchParams({
        grant_type: 'password',
        username: V8_USERNAME, // Usando a variável V8_USERNAME
        password: V8_PASSWORD, // Usando a variável V8_PASSWORD
        audience: V8_AUDIENCE, // Usando a variável V8_AUDIENCE
        scope: V8_SCOPE,       // Usando a variável V8_SCOPE
        client_id: V8_CLIENT_ID, // Usando a variável V8_CLIENT_ID
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;
    cachedToken = {
      token: access_token,
      expiresAt: now + expires_in * 1000,
    };
    return access_token;
  } catch (error: any) {
    console.error('Erro ao obter token:', error.response?.data || error.message);
    throw new Error(`Falha ao obter token: ${error.response?.data?.message || error.message}`);
  }
}