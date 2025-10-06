import { VercelRequest, VercelResponse } from '@vercel/node'; // Usar tipos do Vercel
import { supabase } from './supabaseClient.js';

// Adaptado para Vercel Functions: retorna uma função que, quando chamada,
// retorna uma resposta de erro ou null se sucesso
export function authorize(requiredRole: string) {
  return async (req: VercelRequest, res: VercelResponse): Promise<VercelResponse | null> => {
    const userId = (req as any).user?.id; // Obter user do objeto de requisição anexado por 'protect'

    if (!userId) {
      return res.status(403).json({ error: 'User not authenticated or user ID missing' });
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !profile || profile.role !== requiredRole) {
        console.error('Authorization error:', error);
        return res.status(403).json({ error: 'Forbidden: Insufficient role' });
      }

      return null; // Indica sucesso, continue para a próxima lógica
    } catch (err) {
      console.error('Server Error during authorization:', err);
      return res.status(500).json({ error: 'Internal server error during authorization' });
    }
  };
}