-- Create equipment rotation playlist table
CREATE TABLE public.equipment_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_equipment_worker UNIQUE (worker_name)
);

-- Create inspection rotation playlist table
CREATE TABLE public.inspection_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_inspection_worker UNIQUE (worker_name)
);

-- Enable RLS
ALTER TABLE public.equipment_rotation_playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_rotation_playlist ENABLE ROW LEVEL SECURITY;

-- Equipment policies
CREATE POLICY "Anyone can view equipment rotation playlist"
ON public.equipment_rotation_playlist
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage equipment rotation playlist"
ON public.equipment_rotation_playlist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Inspection policies
CREATE POLICY "Anyone can view inspection rotation playlist"
ON public.inspection_rotation_playlist
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage inspection rotation playlist"
ON public.inspection_rotation_playlist
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_rotation_playlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_rotation_playlist;