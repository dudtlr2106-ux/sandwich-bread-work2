
CREATE TABLE public.production_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  current_quantity INTEGER NOT NULL DEFAULT 0,
  good_quantity INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view production schedules"
ON public.production_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert production schedules"
ON public.production_schedules FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update production schedules"
ON public.production_schedules FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete production schedules"
ON public.production_schedules FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
