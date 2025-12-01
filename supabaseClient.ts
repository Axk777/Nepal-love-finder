import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wixaqtfpeoqjbujszphc.supabase.co';
// The key provided was missing the JWT header (eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9). 
// I have reconstructed the full key below.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpeGFxdGZwZW9xamJ1anN6cGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MDQyNDQsImV4cCI6MjA3OTk4MDI0NH0.1f1R07mP9lwHIigR4LRFU6ltOzy8KbifFefEZVbztrc';

export const supabase = createClient(supabaseUrl, supabaseKey);