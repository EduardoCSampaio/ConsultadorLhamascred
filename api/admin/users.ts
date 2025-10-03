import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/lib/supabaseClient'; // Alterado para usar o alias de caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  try {
    // Criar o usuário no Supabase Auth
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma o email automaticamente
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      return res.status(500).json({ error: authError.message });
    }

    if (!user || !user.user) {
      return res.status(500).json({ error: 'Failed to create user in Supabase Auth' });
    }

    // O gatilho do Supabase (handle_new_user) já cria o perfil com role 'user'.
    // Se o papel solicitado for diferente de 'user', atualizamos.
    if (role !== 'user') {
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.user.id);

      if (updateProfileError) {
        console.error('Supabase Profile Update Error:', updateProfileError);
        await supabase.auth.admin.deleteUser(user.user.id); // Tentar deletar o usuário do auth para evitar inconsistência
        return res.status(500).json({ error: updateProfileError.message });
      }
    }

    return res.status(201).json({ message: 'User created successfully', userId: user.user.id });
  } catch (err: any) {
    console.error('Server Error creating user:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
