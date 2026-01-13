-- Allow duplicates in inspection/equipment rotation playlists by removing unique constraints on worker_name

ALTER TABLE public.inspection_rotation_playlist
  DROP CONSTRAINT IF EXISTS unique_inspection_worker;

ALTER TABLE public.equipment_rotation_playlist
  DROP CONSTRAINT IF EXISTS unique_equipment_worker;
