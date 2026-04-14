
CREATE TABLE public.working_saturdays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.working_saturdays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view working_saturdays"
  ON public.working_saturdays FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage working_saturdays"
  ON public.working_saturdays FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
