CREATE TABLE public.rotation_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  mode text NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed', 'team_swap')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.rotation_settings (id, mode)
VALUES (true, 'fixed');

ALTER TABLE public.rotation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rotation settings"
ON public.rotation_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can update rotation settings"
ON public.rotation_settings
FOR UPDATE
TO authenticated
USING (public.has_role((select auth.uid()), 'admin'))
WITH CHECK (public.has_role((select auth.uid()), 'admin'));
