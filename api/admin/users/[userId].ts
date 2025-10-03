import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/lib/supabaseClient'; // Alterado para usar o alias de caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Primeiro, deletar o perfil da tabela 'profiles'
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Supabase Profile Delete Error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // Em seguida, deletar o usuário do Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Supabase Auth Delete Error:', authError);
      return res.status(500).json({ error: authError.message });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Server Error deleting user:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
