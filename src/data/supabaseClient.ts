/**
 * Khởi tạo Supabase client cho web admin.
 *
 * Biến môi trường (đặt trong .env.local, KHÔNG commit lên git):
 *   VITE_SUPABASE_URL      = https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY = <anon public key>   (Project Settings -> API)
 *
 * Anon key là khoá công khai, an toàn để nhúng vào web; quyền thực thi
 * do Row Level Security + RPC quyết định phía Supabase.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Client, hoặc null nếu chưa cấu hình .env.local (khi đó app chạy bằng dữ liệu mock). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = (): boolean => supabase !== null;

/** Client chắc chắn có (ném lỗi rõ ràng nếu thiếu cấu hình). */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Chưa cấu hình Supabase. Hãy tạo file .env.local với VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
