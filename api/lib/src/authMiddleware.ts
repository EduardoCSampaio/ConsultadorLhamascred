import { Request, Response, NextFunction } from 'express';
import { supabase } from './supabaseClient';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string; // Adicionando a propriedade role
        // ... outras propriedades do usuário Supabase que você possa usar
      };
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided or invalid format' });
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Buscar o perfil do usuário para obter a função (role)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Se não encontrar o perfil, pode ser um usuário novo ou um erro. Trate como não autorizado por segurança.
      return res.status(401).json({ error: 'User profile not found or access denied' });
    }

    req.user = { ...user, role: profile?.role };
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
