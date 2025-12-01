# Nepali Love Finder (Supabase Version)

A mobile-first matchmaking web application for the Nepali community.

## ⚠️ Database Setup Required

This app is connected to **Supabase**, but you must create the database tables manually for it to work.

### 1. Run SQL Script
1.  Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Go to **SQL Editor**.
3.  Paste and Run this code:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Tables
create table public.profiles (
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

create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  user_a uuid references public.profiles(id),
  user_b uuid references public.profiles(id),
  created_at bigint,
  chat_room_id text,
  active boolean default true
);

create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  chat_room_id text,
  from_user_id uuid references public.profiles(id),
  text text,
  timestamp bigint,
  is_system boolean default false
);

create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  reporter_user_id uuid references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  reason text,
  timestamp bigint,
  resolved boolean default false
);

-- Enable Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.profiles;

-- Disable Row Level Security (For Prototype Ease)
alter table public.profiles disable row level security;
alter table public.matches disable row level security;
alter table public.messages disable row level security;
alter table public.reports disable row level security;
```

## Getting Started Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```

3.  **Build for Production:**
    ```bash
    npm run build
    ```
