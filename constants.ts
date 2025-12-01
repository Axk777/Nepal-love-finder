
import { Role } from './types';

export const APP_NAME = "Nepali Love Finder";
export const MIN_AGE = 13;
export const MAX_AGE_GAP = 2; // +/- years
export const SYSTEM_USER_ID = 'system-sender';
export const MESSAGE_TTL = 120000; // 2 minutes in milliseconds

export const SAFETY_TIPS = [
  "Do not share your personal phone number or address.",
  "Report anyone who makes you feel uncomfortable.",
  "If you are under 18, tell a guardian about your matches.",
  "Meet safely in public places if you ever decide to meet."
];

export const INTERESTS = [
    "Momo Lover 🥟", "Dal Bhat Power 🍛", "Trekking 🏔️", "Guitar 🎸", 
    "Cricket 🏏", "Football ⚽", "Movies 🎬", "Dancing 💃", 
    "Reading 📚", "Traveling ✈️", "Photography 📸", "Cooking 🍳",
    "Gaming 🎮", "Anime ⛩️", "Bikes 🏍️", "Poetry ✍️"
];

export const HOROSCOPES = [
    "Love is just around the corner. Be ready to say Namaste! 🙏",
    "Your soulmate is also looking for you right now. ✨",
    "A surprise conversation will make your day brighter. 💖",
    "Don't be shy today, make the first move! 🚀",
    "Your charm is irresistible today. Use it wisely! 😉",
    "Someone with a great smile is waiting for you. 😊",
    "Good vibes only! Your energy attracts love. ⚡"
];

export const ICEBREAKERS = [
  "Namaste! What's your favorite Nepali food?",
  "Do you prefer mountains or the city?",
  "What song have you been listening to lately?",
  "Momo or Dal Bhat? Choose wisely!",
  "If you could travel anywhere in Nepal right now, where would it be?",
  "What's your favorite movie of all time?",
  "Are you a morning person or a night owl?",
  "What's the funniest thing that happened to you recently?",
  "Do you play any sports or games?",
  "What's your dream job?",
  "Have you ever been trekking in the Himalayas?",
  "What is your favorite festival: Dashain or Tihar?",
  "Tea or Coffee? (Chiya is the only right answer!)",
  "What's your most adventurous thing you've ever done?",
  "If you had a superpower, what would it be?",
  "Do you believe in love at first chat?",
  "What's your best advice you've ever received?",
  "If you could have dinner with any Nepali celebrity, who would it be?",
  "What's your favorite thing about your hometown?",
  "Dogs or cats?",
  "What's a talent you have that no one knows about?",
  "If you were a color, what color would you be and why?",
  "What's your favorite season in Nepal?",
  "Do you like to read books or watch movies?",
  "What is the one thing you can't live without?"
];

export const PROFANITY_LIST = ['badword1', 'badword2', 'hell', 'stupid', 'idiot']; 

export const SQL_SETUP_SCRIPT = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Tables (If they don't exist)
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  age int,
  role text,
  email text,
  bio text,
  photo_url text,
  online boolean default false,
  last_seen bigint,
  blocked_users text[] default '{}',
  is_banned boolean default false
);

create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references public.profiles(id),
  user_b uuid references public.profiles(id),
  created_at bigint,
  chat_room_id text,
  active boolean default true
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_room_id text,
  from_user_id uuid references public.profiles(id),
  text text,
  timestamp bigint,
  is_system boolean default false
);

create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_user_id uuid references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  reason text,
  timestamp bigint,
  resolved boolean default false
);

-- 2. MIGRATION: Add 'interests' column if missing
alter table public.profiles add column if not exists interests text[] default '{}';

-- 3. Enable Realtime (Safe Block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    alter publication supabase_realtime add table public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches') THEN
    alter publication supabase_realtime add table public.matches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    alter publication supabase_realtime add table public.profiles;
  END IF;
END $$;

-- 4. Disable RLS for prototype (Fixes permission errors)
alter table public.profiles disable row level security;
alter table public.matches disable row level security;
alter table public.messages disable row level security;
alter table public.reports disable row level security;
`;

export const SQL_RESET_SCRIPT = `
-- DANGER: This script deletes EVERYTHING.
-- Use it in the Supabase Dashboard SQL Editor.

-- 1. Delete all App Data
TRUNCATE TABLE public.messages, public.matches, public.reports, public.profiles CASCADE;

-- 2. Delete all Auth Users (Requires admin privileges)
-- This deletes the actual login accounts.
DELETE FROM auth.users;
`;
