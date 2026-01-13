-- Harden attendance_requests INSERT policy (avoid WITH CHECK (true) and prevent self-approval on insert)

DROP POLICY IF EXISTS "Anyone can create requests" ON public.attendance_requests;

CREATE POLICY "Anyone can create requests"
ON public.attendance_requests
FOR INSERT
WITH CHECK (
  worker_name IS NOT NULL AND worker_name <> ''
  AND requester_name IS NOT NULL AND requester_name <> ''
  AND requested_status IS NOT NULL AND requested_status <> ''
  AND date_key IS NOT NULL AND date_key <> ''
  AND day IS NOT NULL AND day <> ''
  AND (status IS NULL OR status = 'pending')
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND rejection_reason IS NULL
);
