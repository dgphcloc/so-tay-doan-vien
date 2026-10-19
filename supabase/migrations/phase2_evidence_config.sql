-- =====================================================================
-- GIAI ĐOẠN 2 · CẤU HÌNH MINH CHỨNG: thêm cột vào yearly_settings
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

alter table public.yearly_settings
  add column if not exists max_photos  smallint not null default 3,
  add column if not exists max_files   smallint not null default 3,
  add column if not exists max_links   smallint not null default 5,
  add column if not exists require_gps boolean  not null default true;

comment on column public.yearly_settings.max_photos is 'Số ảnh minh chứng tối đa cho mỗi bài nộp';
comment on column public.yearly_settings.max_files is 'Số file minh chứng tối đa cho mỗi bài nộp';
comment on column public.yearly_settings.max_links is 'Số link minh chứng tối đa cho mỗi bài nộp';
comment on column public.yearly_settings.require_gps is 'Bắt buộc ảnh minh chứng phải có toạ độ GPS';

-- Kiểm tra
select year, max_photos, max_files, max_links, require_gps from public.yearly_settings order by year;
