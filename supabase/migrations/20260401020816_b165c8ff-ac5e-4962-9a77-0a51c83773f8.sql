
-- Allow authenticated users to insert/update their own weekend availability
CREATE POLICY "Authenticated users can insert weekend_availability"
ON public.weekend_availability FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update weekend_availability"
ON public.weekend_availability FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
