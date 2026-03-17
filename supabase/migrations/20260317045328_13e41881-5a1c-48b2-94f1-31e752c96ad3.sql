
-- Add week_key column to weekend_availability
ALTER TABLE public.weekend_availability ADD COLUMN week_key text NOT NULL DEFAULT '';

-- Drop the existing unique constraint on worker_name (if any) and create a new one including week_key
ALTER TABLE public.weekend_availability DROP CONSTRAINT IF EXISTS weekend_availability_worker_name_key;
ALTER TABLE public.weekend_availability ADD CONSTRAINT weekend_availability_worker_week_key UNIQUE (worker_name, week_key);
