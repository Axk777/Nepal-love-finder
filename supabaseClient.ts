import { createClient } from '@supabase/supabase-js';

// Use environment variables if present, otherwise use placeholders to prevent crash
// The app will detect the invalid configuration and show the Setup screen.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cfznrbtzpkyscyxiasjq.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);