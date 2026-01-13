-- Create logistics rotation playlist table
CREATE TABLE public.logistics_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_name)
);

-- Enable RLS
ALTER TABLE public.logistics_rotation_playlist ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view logistics rotation playlist"
ON public.logistics_rotation_playlist
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage logistics rotation playlist"
ON public.logistics_rotation_playlist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_logistics_rotation_playlist_updated_at
BEFORE UPDATE ON public.logistics_rotation_playlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial logistics workers in default order
INSERT INTO public.logistics_rotation_playlist (worker_name, position) VALUES
  ('강윤묵', 0),
  ('연명옥', 1),
  ('서민성', 2),
  ('윤기은', 3),
  ('김용주', 4),
  ('이상민', 5);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_rotation_playlist;