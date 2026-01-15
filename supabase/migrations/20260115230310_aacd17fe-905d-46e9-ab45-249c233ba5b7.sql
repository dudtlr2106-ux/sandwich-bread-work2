-- notice_memos 테이블에 is_public 컬럼 추가
ALTER TABLE public.notice_memos 
ADD COLUMN is_public boolean NOT NULL DEFAULT true;

-- 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Anyone can view notice_memos" ON public.notice_memos;

-- 새로운 SELECT 정책: 공개이거나 관리자일 때만 조회 가능
CREATE POLICY "Anyone can view public notice_memos or admins can view all"
ON public.notice_memos
FOR SELECT
USING (is_public = true OR has_role(auth.uid(), 'admin'::app_role));