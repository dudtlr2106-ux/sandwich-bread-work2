-- 관리자 역할 enum 생성
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 사용자 역할 테이블
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 근태 수정 요청 테이블
CREATE TABLE public.attendance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_name TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    date_key TEXT NOT NULL,
    day TEXT NOT NULL,
    current_status TEXT,
    requested_status TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_requests ENABLE ROW LEVEL SECURITY;

-- 역할 확인 함수 (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- user_roles RLS 정책
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- attendance_requests RLS 정책
CREATE POLICY "Anyone can create requests"
ON public.attendance_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view requests"
ON public.attendance_requests
FOR SELECT
USING (true);

CREATE POLICY "Admins can update requests"
ON public.attendance_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_requests;