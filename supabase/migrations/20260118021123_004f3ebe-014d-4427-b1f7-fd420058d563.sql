-- Create package rotation playlist table for 3조 workers
CREATE TABLE public.package_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.package_rotation_playlist ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Anyone can view package playlist" 
ON public.package_rotation_playlist 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert package playlist"
ON public.package_rotation_playlist
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update package playlist"
ON public.package_rotation_playlist
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete package playlist"
ON public.package_rotation_playlist
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_package_rotation_playlist_updated_at
BEFORE UPDATE ON public.package_rotation_playlist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for package rotation playlist
ALTER PUBLICATION supabase_realtime ADD TABLE public.package_rotation_playlist;