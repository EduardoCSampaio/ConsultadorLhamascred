import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/lib/supabaseClient'; // Alterado para usar o alias de caminho

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // A autenticação e autorização serão tratadas aqui ou por um middleware Vercel
  // Por simplicidade inicial, vamos assumir que o token já foi validado
  // e que o usuário é admin (isso será refinado com um middleware Vercel)

  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, role');

    if (profilesError) {
      console.error('Supabase Profiles Error:', profilesError);
      return res.status(500).json({ error: profilesError.message });
    }

    const usersWithEmails = await Promise.all(profiles.map(async (profile) => {
      const { data: userAuth, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      if (authError) {
        console.error("Error fetching auth user for profile:", profile.id, authError);
        return { ...profile, email: 'N/A' };
      }
      return { ...profile, email: userAuth?.user?.email || 'N/A' };
    }));

    return res.status(200).json(usersWithEmails);
  } catch (err: any) {
    console.error('Server Error listing users:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
