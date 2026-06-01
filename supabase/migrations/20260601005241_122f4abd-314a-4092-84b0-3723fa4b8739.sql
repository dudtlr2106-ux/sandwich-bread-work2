CREATE TABLE public.special_workdays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_workdays TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_workdays TO authenticated;
GRANT ALL ON public.special_workdays TO service_role;

ALTER TABLE public.special_workdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view special_workdays" ON public.special_workdays FOR SELECT USING (true);
CREATE POLICY "Admins can manage special_workdays" ON public.special_workdays FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.special_workdays;