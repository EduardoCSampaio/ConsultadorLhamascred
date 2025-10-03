import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabaseClient'; // CORRIGIDO O CAMINHO
import { protect } from '../lib/authMiddleware'; // ADICIONADO
import { authorize } from '../lib/authorizationMiddleware'; // ADICIONADO

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Adaptação do middleware para Vercel Functions
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res);
  if (authzResult) return authzResult;

  try {
    const { data: users, error } = await supabase.from('profiles').select('id, email, role');

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // CORRIGIDO: Tipagem explícita para 'profile'
    const formattedUsers = users.map((profile: { id: string; email: string; role: string }) => ({
      id: profile.id,
      email: profile.email,
      role: profile.role,
    }));

    return res.status(200).json(formattedUsers);
  } catch (err: any) {
    console.error('Server Error fetching users:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}