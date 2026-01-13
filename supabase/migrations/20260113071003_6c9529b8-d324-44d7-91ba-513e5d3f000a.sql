-- Create foreman rotation playlist table
CREATE TABLE public.foreman_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.foreman_rotation_playlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view foreman rotation playlist"
ON public.foreman_rotation_playlist
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage foreman rotation playlist"
ON public.foreman_rotation_playlist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.foreman_rotation_playlist;

-- Insert default foreman data (A조 김영식, B조 박노일)
INSERT INTO public.foreman_rotation_playlist (worker_name, position) VALUES
('김영식', 0),
('박노일', 1);
