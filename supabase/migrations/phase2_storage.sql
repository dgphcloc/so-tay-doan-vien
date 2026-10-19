-- =====================================================================
-- GIAI ĐOẠN 2 · NỘP MINH CHỨNG: tạo bucket Storage cho ảnh minh chứng
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

-- Bucket công khai để <img src> xem được ảnh trực tiếp.
insert into storage.buckets (id, name, public)
values ('evidences', 'evidences', true)
on conflict (id) do nothing;

-- Người đã đăng nhập được tải lên
drop policy if exists evidences_upload on storage.objects;
create policy evidences_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidences');

-- Người đã đăng nhập được đọc
drop policy if exists evidences_read on storage.objects;
create policy evidences_read on storage.objects
  for select to authenticated
  using (bucket_id = 'evidences');

-- Cho phép xóa ảnh mình đã tải (tuỳ chọn)
drop policy if exists evidences_delete on storage.objects;
create policy evidences_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidences');

-- Kiểm tra
select id, name, public from storage.buckets where id = 'evidences';
