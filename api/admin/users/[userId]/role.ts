import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../../lib/supabaseClient'; // CORRIGIDO O CAMINHO
import { protect } from '../../../../lib/authMiddleware'; // ADICIONADO
import { authorize } from '../../../../lib/authorizationMiddleware'; // ADICIONADO

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = req.query;
  const { role } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }
  if (!role || typeof role !== 'string') {
    return res.status(400).json({ error: 'Role is required' });
  }

  // Adaptação do middleware para Vercel Functions
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res);
  if (authzResult) return authzResult;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'User role updated successfully', user: data });
  } catch (err: any) {
    console.error('Server Error updating user role:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}