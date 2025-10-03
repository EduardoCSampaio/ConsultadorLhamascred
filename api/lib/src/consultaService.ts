import axios from 'axios';
import { apiConfig } from './config';

export async function enviarConsulta({ documentNumber, provider, token, consultaId }: { documentNumber: string, provider: string, token: string, consultaId?: string }) {
  const payload: any = {
    documentNumber,
    provider,
    webhook: apiConfig.webhookUrl
  };
  if (consultaId) payload.consultaId = consultaId;
  return axios.post(
    apiConfig.consultaUrl,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
}
