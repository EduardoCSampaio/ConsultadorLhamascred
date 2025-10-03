import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabaseClient'; // CORRIGIDO O CAMINHO
import { protect } from '../lib/authMiddleware'; // ADICIONADO
import { authorize } from '../lib/authorizationMiddleware'; // ADICIONADO

export default async function (req: VercelRequest, res: VercelResponse) {
  // Adaptação do middleware para Vercel Functions
  const authResult = await protect(req, res);
  if (authResult) return authResult;

  const authzResult = await authorize('admin')(req, res);
  if (authzResult) return authzResult;

  if (req.method === 'POST') {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required.' });
    }

    try {
      const { data: user, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        console.error('Error creating user in auth:', authError);
        return res.status(500).json({ error: authError.message });
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.user?.id,
        email,
        role,
      });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Tentar reverter a criação do usuário se o perfil falhar
        await supabase.auth.admin.deleteUser(user.user?.id as string);
        return res.status(500).json({ error: profileError.message });
      }

      return res.status(201).json({ message: 'User created successfully', userId: user.user?.id });
    } catch (err: any) {
      console.error('Server Error creating user:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}