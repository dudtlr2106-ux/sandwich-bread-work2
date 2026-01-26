-- attendance_requests 테이블의 status 체크 제약 조건에 'cancelled' 추가
ALTER TABLE public.attendance_requests 
DROP CONSTRAINT attendance_requests_status_check;

ALTER TABLE public.attendance_requests 
ADD CONSTRAINT attendance_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]));