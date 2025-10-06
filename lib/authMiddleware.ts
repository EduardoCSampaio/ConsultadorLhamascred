import { VercelRequest, VercelResponse } from '@vercel/node'; // Usar tipos do Vercel
import { supabase } from './supabaseClient.js';

// Adaptado para Vercel Functions: retorna uma resposta de erro ou null se sucesso
export async function protect(req: VercelRequest, res: VercelResponse): Promise<VercelResponse | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    const { data: userSession, error } = await supabase.auth.getUser(token);

    if (error || !userSession?.user) {
      console.error('Authentication error:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Anexar o usuário ao objeto de requisição para uso posterior
    // VercelRequest não tem uma propriedade 'user' por padrão, então usamos 'as any'
    (req as any).user = userSession.user;
    return null; // Indica sucesso, continue para a próxima lógica
  } catch (err) {
    console.error('Server Error during authentication:', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}