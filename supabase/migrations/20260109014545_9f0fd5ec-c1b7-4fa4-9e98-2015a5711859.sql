-- 팀 구성 테이블 생성
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL CHECK (team IN ('A조', 'B조')),
  role TEXT NOT NULL CHECK (role IN ('반장', '1조', '2조')),
  worker_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (team, worker_name)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view team members"
ON public.team_members
FOR SELECT
USING (true);

-- 관리자만 수정/추가/삭제 가능
CREATE POLICY "Admins can insert team members"
ON public.team_members
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update team members"
ON public.team_members
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete team members"
ON public.team_members
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 초기 데이터 삽입 (A조)
INSERT INTO public.team_members (team, role, worker_name, display_order) VALUES
('A조', '반장', '김영식', 1),
('A조', '1조', '김광시', 2),
('A조', '1조', '서민성', 3),
('A조', '1조', '백승빈', 4),
('A조', '2조', '장영광', 5),
('A조', '2조', '연명옥', 6),
('A조', '2조', '이상민', 7);

-- 초기 데이터 삽입 (B조)
INSERT INTO public.team_members (team, role, worker_name, display_order) VALUES
('B조', '반장', '박노일', 1),
('B조', '1조', '강윤묵', 2),
('B조', '1조', '김용주', 3),
('B조', '1조', '김순기', 4),
('B조', '2조', '윤기은', 5),
('B조', '2조', '오세홍', 6),
('B조', '2조', '고장윤', 7);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;

-- Trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();