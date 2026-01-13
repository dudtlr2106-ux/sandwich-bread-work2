-- 물류 플레이리스트 unique 제약 제거
ALTER TABLE public.logistics_rotation_playlist DROP CONSTRAINT IF EXISTS logistics_rotation_playlist_worker_name_key;

-- 설비 플레이리스트 unique 제약 제거
ALTER TABLE public.equipment_rotation_playlist DROP CONSTRAINT IF EXISTS equipment_rotation_playlist_worker_name_key;

-- 검사 플레이리스트 unique 제약 제거
ALTER TABLE public.inspection_rotation_playlist DROP CONSTRAINT IF EXISTS inspection_rotation_playlist_worker_name_key;

-- 팀 동기화 트리거 함수 수정 (ON CONFLICT 제거 - 더 이상 필요하지 않으므로 단순 INSERT)
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
    -- Skip 반장 role
    IF NEW.role = '반장' THEN
      RETURN NEW;
    END IF;
    
    -- Add to logistics_rotation_playlist
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_rotation_playlist;
    INSERT INTO logistics_rotation_playlist (worker_name, position)
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
    DELETE FROM equipment_rotation_playlist WHERE worker_name = OLD.worker_name;
    DELETE FROM inspection_rotation_playlist WHERE worker_name = OLD.worker_name;
    RETURN OLD;
  END IF;
  
  -- On UPDATE: If worker_name changed, update in playlists
  IF TG_OP = 'UPDATE' THEN
    IF OLD.worker_name != NEW.worker_name THEN
      UPDATE logistics_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
      UPDATE equipment_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
      UPDATE inspection_rotation_playlist SET worker_name = NEW.worker_name WHERE worker_name = OLD.worker_name;
    END IF;
    
    -- If role changed to 반장, remove from playlists
    IF NEW.role = '반장' AND OLD.role != '반장' THEN
      DELETE FROM logistics_rotation_playlist WHERE worker_name = NEW.worker_name;
      DELETE FROM equipment_rotation_playlist WHERE worker_name = NEW.worker_name;
      DELETE FROM inspection_rotation_playlist WHERE worker_name = NEW.worker_name;
    END IF;
    
    -- If role changed from 반장 to other, add to playlists
    IF OLD.role = '반장' AND NEW.role != '반장' THEN
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM logistics_rotation_playlist;
      INSERT INTO logistics_rotation_playlist (worker_name, position)
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