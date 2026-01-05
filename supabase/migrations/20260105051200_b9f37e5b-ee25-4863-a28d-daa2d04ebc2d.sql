-- Enable realtime for schedule-related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_offs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_memos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekend_availability;