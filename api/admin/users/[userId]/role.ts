import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/lib/supabaseClient'; // Alterado para usar o alias de caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = req.query;
  const { role } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('Supabase Update Role Error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ message: 'User role updated successfully' });
  } catch (err: any) {
    console.error('Server Error updating user role:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
