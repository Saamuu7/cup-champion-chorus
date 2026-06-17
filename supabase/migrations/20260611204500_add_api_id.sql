-- Add api_id column to matches table to uniquely map them to the external API games
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS api_id TEXT UNIQUE;
