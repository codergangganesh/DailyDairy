-- DreamVault Database Schema
-- Run this in your Supabase SQL Editor to set up tables

-- 1. PROFILES TABLE
-- Stores user profile info (linked to Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. DIARIES TABLE
-- Track user diaries (optional, allows multiple, but default uses one)
CREATE TABLE IF NOT EXISTS public.diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  diary_name TEXT NOT NULL DEFAULT 'My Journal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on diaries
ALTER TABLE public.diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own diaries" 
  ON public.diaries FOR ALL USING (auth.uid() = user_id);

-- 3. DIARY SECURITY TABLE
-- Stores client-side encrypted master keys and verification hashes
CREATE TABLE IF NOT EXISTS public.diary_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,                  -- Verification hash of Diary Password
  recovery_question TEXT NOT NULL,
  recovery_answer_hash TEXT NOT NULL,           -- Verification hash of recovery answer
  encrypted_master_key TEXT NOT NULL,           -- Master key encrypted with diary password
  master_key_iv TEXT NOT NULL,                  -- IV for master key encryption
  master_key_salt TEXT NOT NULL,                -- Salt used to derive password key
  recovery_encrypted_master_key TEXT NOT NULL,  -- Master key encrypted with recovery answer
  recovery_master_key_iv TEXT NOT NULL,         -- IV for recovery master key encryption
  recovery_master_key_salt TEXT NOT NULL,       -- Salt used to derive recovery answer key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on diary_security
ALTER TABLE public.diary_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own diary security record" 
  ON public.diary_security FOR ALL USING (auth.uid() = user_id);

-- 4. ENTRIES TABLE
-- Stores E2E encrypted entries. The encrypted_content houses JSON { title, content, tags }
CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,  -- AES-256-GCM ciphertext containing { title, content, tags }
  iv TEXT NOT NULL,                 -- Initialization Vector for entry encryption
  salt TEXT NOT NULL,               -- Salt (or extra random identifier)
  mood TEXT NOT NULL CHECK (mood IN ('happy', 'calm', 'sad', 'angry', 'tired', 'excited')),
  category TEXT NOT NULL CHECK (category IN ('Daily Journal', 'Dream Journal', 'Personal Notes', 'Goals', 'Memories', 'Gratitude')),
  page_number INTEGER NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on entries
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entries" 
  ON public.entries FOR ALL USING (auth.uid() = user_id);

-- 5. ACTIVITY LOGS TABLE
-- Tracks events like logins, password resets, suspension toggles
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs" 
  ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs" 
  ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. ADMIN-SPECIFIC POLICIES & TRIGGER
-- Admins can query profiles and activity logs for management, reset user passwords, suspend accounts.
-- Create a policy for profiles: admin role can update any profile

CREATE POLICY "Admins can update all profiles" 
  ON public.profiles FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view all activity logs" 
  ON public.activity_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update diary security (resets)" 
  ON public.diary_security FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can select diary security (needed to fetch recovery question for resets)" 
  ON public.diary_security FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 7. SUPABASE STORAGE — avatars bucket
-- Run this AFTER the tables above.
-- Creates a public bucket for profile photos and sets RLS.
-- ═══════════════════════════════════════════════════════════

-- Create the public avatars bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                                  -- public = anyone can read via URL
  2097152,                               -- 2 MB max per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read avatar files (they are public)
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload to their own folder (userId/*)
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: authenticated users can update/replace their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: authenticated users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ═══════════════════════════════════════════════════════════
-- 8. SUPABASE STORAGE — attachments bucket (private E2E)
-- ═══════════════════════════════════════════════════════════

-- Create the private attachments bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,                                 -- public = false (private content)
  10485760,                              -- 10 MB max per file
  ARRAY['text/plain', 'application/json', 'application/octet-stream'] -- E2E encrypted JSON payloads
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can read their own attachments
CREATE POLICY "Users can read their own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: authenticated users can upload to their own folder (userId/*)
CREATE POLICY "Users can upload their own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: authenticated users can update/replace their own attachments
CREATE POLICY "Users can update their own attachments"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: authenticated users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

