-- Drop the existing check constraint and create a new one that includes '3조'
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_check CHECK (role IN ('반장', '1조', '2조', '3조'));