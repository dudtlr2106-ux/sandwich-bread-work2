-- Add is_dummy column to all rotation playlist tables
ALTER TABLE public.logistics_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.equipment_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.inspection_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.foreman_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;

ALTER TABLE public.package_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;

-- Also add to logistics_mid_rotation_playlist if it's being used
ALTER TABLE public.logistics_mid_rotation_playlist 
ADD COLUMN is_dummy boolean NOT NULL DEFAULT false;