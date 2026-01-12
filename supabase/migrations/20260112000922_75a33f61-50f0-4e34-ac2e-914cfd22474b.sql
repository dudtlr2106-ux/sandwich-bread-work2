-- Add time fields for partial vacation
ALTER TABLE public.attendance_requests
ADD COLUMN start_time text,
ADD COLUMN end_time text;