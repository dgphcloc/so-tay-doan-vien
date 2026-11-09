/**
 * KÊNH BÁO LỖI TẢI DỮ LIỆU
 *
 * Tách riêng khỏi `index.ts` để tránh vòng lặp import (index.ts nạp
 * supabaseRepository.ts, mà supabaseRepository.ts cũng cần báo lỗi).
 *
 * Trước đây lỗi đọc Supabase chỉ nằm trong console.warn của hybridSnapshot:
 * app lặng lẽ rơi về dữ liệu mẫu. Người dùng thấy giao diện "như đang đăng
 * nhập" nhưng nội dung là Chi đoàn Ấp 1…25 giả — không cách nào phân biệt.
 */

let lastError: string | null = null;
const listeners = new Set<() => void>();

/** Lỗi tải dữ liệu thật gần nhất (null = đang đọc được bình thường). */
export function getSnapshotError(): string | null {
  return lastError;
}

/** Đăng ký nghe thay đổi (dùng cho useSyncExternalStore). */
export function subscribeSnapshotError(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Ghi nhận lỗi mới; truyền null để xóa khi đã đọc được bình thường. */
export function reportSnapshotError(message: string | null): void {
  if (lastError === message) return;
  lastError = message;
  listeners.forEach(cb => cb());
}