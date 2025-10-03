import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../backend/src/supabaseClient'; // Corrigido o caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role from profiles:', error);
      return res.status(500).json({ error: 'Failed to fetch user role' });
    }

    if (!profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json({ role: profile.role });
  } catch (err: any) {
    console.error('Server Error fetching user role:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
