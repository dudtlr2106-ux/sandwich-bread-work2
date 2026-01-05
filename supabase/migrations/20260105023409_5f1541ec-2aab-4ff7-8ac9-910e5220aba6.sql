-- 스케줄 데이터 테이블 (일별 부서별 교대조 근무자 배정)
CREATE TABLE public.schedule_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_key TEXT NOT NULL,
  department TEXT NOT NULL,
  shift TEXT NOT NULL,
  workers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date_key, department, shift)
);

-- 근무자 상태 테이블
CREATE TABLE public.worker_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  date_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_name, date_key)
);

-- 휴무일 테이블
CREATE TABLE public.day_offs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 공지 메모 테이블
CREATE TABLE public.notice_memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 주말 출근 가능 여부 테이블
CREATE TABLE public.weekend_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL UNIQUE,
  is_available BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.schedule_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekend_availability ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view schedule_data" ON public.schedule_data FOR SELECT USING (true);
CREATE POLICY "Anyone can view worker_statuses" ON public.worker_statuses FOR SELECT USING (true);
CREATE POLICY "Anyone can view day_offs" ON public.day_offs FOR SELECT USING (true);
CREATE POLICY "Anyone can view notice_memos" ON public.notice_memos FOR SELECT USING (true);
CREATE POLICY "Anyone can view weekend_availability" ON public.weekend_availability FOR SELECT USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Admins can manage schedule_data" ON public.schedule_data FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage worker_statuses" ON public.worker_statuses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage day_offs" ON public.day_offs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage notice_memos" ON public.notice_memos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage weekend_availability" ON public.weekend_availability FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 트리거 생성
CREATE TRIGGER update_schedule_data_updated_at
BEFORE UPDATE ON public.schedule_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_statuses_updated_at
BEFORE UPDATE ON public.worker_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notice_memos_updated_at
BEFORE UPDATE ON public.notice_memos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekend_availability_updated_at
BEFORE UPDATE ON public.weekend_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 초기 공지 메모 레코드 생성
INSERT INTO public.notice_memos (content) VALUES ('');