import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/supabaseClient'; // CORRIGIDO O CAMINHO
import { protect } from '../../lib/authMiddleware'; // ADICIONADO
import { authorize } from '../../lib/authorizationMiddleware'; // ADICIONADO

export default async function (req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Adaptação do middleware para Vercel Functions
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res);
  if (authzResult) return authzResult;

  if (req.method === 'GET') {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
      }

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(profile);
    } catch (err: any) {
      console.error('Server Error fetching user:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      // Primeiro, exclua o perfil
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        return res.status(500).json({ error: profileError.message });
      }

      // Depois, exclua o usuário da autenticação
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Error deleting user from auth:', authError);
        return res.status(500).json({ error: authError.message });
      }

      return res.status(204).send(null); // No Content
    } catch (err: any) {
      console.error('Server Error deleting user:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}