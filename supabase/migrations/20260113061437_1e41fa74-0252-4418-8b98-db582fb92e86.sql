-- 물류 중반조 전용 플레이리스트 테이블 생성
CREATE TABLE public.logistics_mid_rotation_playlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.logistics_mid_rotation_playlist ENABLE ROW LEVEL SECURITY;

-- RLS 정책 추가
CREATE POLICY "Admins can manage logistics mid rotation playlist"
  ON public.logistics_mid_rotation_playlist
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view logistics mid rotation playlist"
  ON public.logistics_mid_rotation_playlist
  FOR SELECT
  USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.logistics_mid_rotation_playlist;

-- 기존 logistics_rotation_playlist를 초반조 전용으로 사용 (이름은 유지)
-- 기존 데이터에서 홀수 위치(1,3,5...)의 인원을 중반조 테이블로 이동
INSERT INTO public.logistics_mid_rotation_playlist (worker_name, position)
SELECT worker_name, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
FROM public.logistics_rotation_playlist
WHERE (position % 2) = 1;

-- 기존 테이블에서 초반조 인원만 남기고 위치 재정렬
WITH early_workers AS (
  SELECT id, worker_name, ROW_NUMBER() OVER (ORDER BY position) - 1 as new_position
  FROM public.logistics_rotation_playlist
  WHERE (position % 2) = 0
)
UPDATE public.logistics_rotation_playlist lrp
SET position = ew.new_position
FROM early_workers ew
WHERE lrp.id = ew.id;

-- 중반조로 이동한 인원 삭제
DELETE FROM public.logistics_rotation_playlist
WHERE (position % 2) = 1 OR position >= (
  SELECT COUNT(*) FROM public.logistics_rotation_playlist WHERE (position % 2) = 0
);

-- 팀 동기화 트리거 함수 업데이트 (중반조 테이블 포함)
CREATE OR REPLACE FUNCTION public.sync_team_member_to_playlists()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_position INT;
BEGIN
  -- On INSERT: Add to all rotation playlists (반장 제외)
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = '반장' THEN
      RETURN NEW;
    END IF;
    
    -- Add to logistics_rotation_playlist (초반조)
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_rotation_playlist;
    INSERT INTO logistics_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position);
    
    -- Add to logistics_mid_rotation_playlist (중반조)
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_mid_rotation_playlist;
    INSERT INTO logistics_mid_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position);
    
    -- Add to equipment_rotation_playlist
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM equipment_rotation_playlist;
    INSERT INTO equipment_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position);
    
    -- Add to inspection_rotation_playlist
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM inspection_rotation_playlist;
    INSERT INTO inspection_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position);
    
    RETURN NEW;
  END IF;
  
  -- On DELETE: Remove from all rotation playlists
  IF TG_OP = 'DELETE' THEN
    DELETE FROM logistics_rotation_playlist WHERE worker_name = OLD.worker_name;
    DELETE FROM logistics_mid_rotation_playlist WHERE worker_name = OLD.worker_name;
    DELETE FROM equipment_rotation_playlist WHERE worker_name = OLD.worker_name;
    DELETE FROM inspection_rotation_playlist WHERE worker_name = OLD.worker_name;
    RETURN OLD;
  END IF;
  
  -- On UPDATE: If worker_name changed, update in playlists
  IF TG_OP = 'UPDATE' THEN
    IF OLD.worker_name != NEW.worker_name THEN
      UPDATE logistics_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
      UPDATE logistics_mid_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
      UPDATE equipment_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
      UPDATE inspection_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
    END IF;
    
    -- If role changed to 반장, remove from playlists
    IF NEW.role = '반장' AND OLD.role != '반장' THEN
      DELETE FROM logistics_rotation_playlist WHERE worker_name = NEW.worker_name;
      DELETE FROM logistics_mid_rotation_playlist WHERE worker_name = NEW.worker_name;
      DELETE FROM equipment_rotation_playlist WHERE worker_name = NEW.worker_name;
      DELETE FROM inspection_rotation_playlist WHERE worker_name = NEW.worker_name;
    END IF;
    
    -- If role changed from 반장 to other, add to playlists
    IF OLD.role = '반장' AND NEW.role != '반장' THEN
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_rotation_playlist;
      INSERT INTO logistics_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position);
      
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_mid_rotation_playlist;
      INSERT INTO logistics_mid_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position);
      
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM equipment_rotation_playlist;
      INSERT INTO equipment_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position);
      
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM inspection_rotation_playlist;
      INSERT INTO inspection_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;