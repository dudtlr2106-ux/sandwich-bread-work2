-- 패턴 규칙 히스토리 테이블 생성
CREATE TABLE public.pattern_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  command TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  previous_state JSONB,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  applied_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX idx_pattern_rules_applied_at ON public.pattern_rules(applied_at DESC);
CREATE INDEX idx_pattern_rules_is_active ON public.pattern_rules(is_active);

-- RLS 활성화
ALTER TABLE public.pattern_rules ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
CREATE POLICY "Anyone can view pattern rules"
  ON public.pattern_rules
  FOR SELECT
  USING (true);

-- 관리자만 생성 가능
CREATE POLICY "Admins can insert pattern rules"
  ON public.pattern_rules
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 관리자만 수정 가능
CREATE POLICY "Admins can update pattern rules"
  ON public.pattern_rules
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 관리자만 삭제 가능
CREATE POLICY "Admins can delete pattern rules"
  ON public.pattern_rules
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.pattern_rules;