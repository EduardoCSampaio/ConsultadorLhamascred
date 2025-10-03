import axios from 'axios';
import { apiConfig } from './config';

export async function getToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', apiConfig.username || '');
  params.append('password', apiConfig.password || '');
  params.append('audience', apiConfig.audience || '');
  params.append('scope', 'offline_access');
  params.append('client_id', apiConfig.clientId || '');

  interface TokenResponse {
    access_token: string;
    [key: string]: any;
  }

  const response = await axios.post<TokenResponse>(apiConfig.tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data.access_token;
}
