-- Add unique constraint on display_name to prevent duplicate names
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);