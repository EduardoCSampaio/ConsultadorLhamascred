import { createClient } from '@supabase/supabase-js'; // Importar createClient

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar a chave de service_role para operações de backend

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // É crucial que estas variáveis estejam configuradas no Vercel
  throw new Error('Supabase URL ou Service Role Key não configuradas!');
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);