-- Create function to sync team members to rotation playlists
CREATE OR REPLACE FUNCTION public.sync_team_member_to_playlists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    VALUES (NEW.worker_name, max_position)
    ON CONFLICT (worker_name) DO NOTHING;
    
    -- Add to equipment_rotation_playlist
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM equipment_rotation_playlist;
    INSERT INTO equipment_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position)
    ON CONFLICT (worker_name) DO NOTHING;
    
    -- Add to inspection_rotation_playlist
    SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM inspection_rotation_playlist;
    INSERT INTO inspection_rotation_playlist (worker_name, position)
    VALUES (NEW.worker_name, max_position)
    ON CONFLICT (worker_name) DO NOTHING;
    
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
      VALUES (NEW.worker_name, max_position)
      ON CONFLICT (worker_name) DO NOTHING;
      
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM equipment_rotation_playlist;
      INSERT INTO equipment_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position)
      ON CONFLICT (worker_name) DO NOTHING;
      
      SELECT COALESCE(MAX(position), -1) + 1 INTO max_position FROM inspection_rotation_playlist;
      INSERT INTO inspection_rotation_playlist (worker_name, position)
      VALUES (NEW.worker_name, max_position)
      ON CONFLICT (worker_name) DO NOTHING;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger on team_members table
DROP TRIGGER IF EXISTS sync_team_member_playlists_trigger ON team_members;
CREATE TRIGGER sync_team_member_playlists_trigger
AFTER INSERT OR UPDATE OR DELETE ON team_members
FOR EACH ROW
EXECUTE FUNCTION sync_team_member_to_playlists();

-- Insert all current team members (except 반장) into rotation playlists
-- First, clear existing data to avoid duplicates
DELETE FROM logistics_rotation_playlist;
DELETE FROM equipment_rotation_playlist;
DELETE FROM inspection_rotation_playlist;

-- Insert all non-반장 members into all three playlists
INSERT INTO logistics_rotation_playlist (worker_name, position)
SELECT worker_name, ROW_NUMBER() OVER (ORDER BY team, display_order) - 1
FROM team_members
WHERE role != '반장'
ON CONFLICT (worker_name) DO NOTHING;

INSERT INTO equipment_rotation_playlist (worker_name, position)
SELECT worker_name, ROW_NUMBER() OVER (ORDER BY team, display_order) - 1
FROM team_members
WHERE role != '반장'
ON CONFLICT (worker_name) DO NOTHING;

INSERT INTO inspection_rotation_playlist (worker_name, position)
SELECT worker_name, ROW_NUMBER() OVER (ORDER BY team, display_order) - 1
FROM team_members
WHERE role != '반장'
ON CONFLICT (worker_name) DO NOTHING;