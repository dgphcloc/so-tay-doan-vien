/**
 * TIỆN ÍCH TOẠ ĐỘ DÙNG CHUNG
 *
 * Trước đây `parseMapLink` chỉ nằm trong MemberSubmitPage. Tách ra đây để
 * trang tạo nhiệm vụ và trang nộp minh chứng dùng chung một cách hiểu link
 * Google Maps — tránh mỗi nơi hiểu một kiểu.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Bán kính Trái Đất (mét) — khớp hằng số dùng trong hàm SQL `haversine_m`. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Khoảng cách Haversine giữa 2 toạ độ, đơn vị MÉT.
 *
 * Dùng để NHẮC NHỞ phía trình duyệt ("có vẻ bạn đang ngoài phạm vi").
 * KẾT QUẢ CHÍNH THỨC luôn do database tính (`public.haversine_m`) — hàm này
 * chỉ để hiển thị gợi ý trước khi nộp và KHÔNG gửi lên server.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Toạ độ có nằm trong miền hợp lệ không. */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  return (
    Number.isFinite(a) && Number.isFinite(b) &&
    a >= -90 && a <= 90 && b >= -180 && b <= 180
  );
}

/**
 * Tách toạ độ từ link Google Maps. Hiểu các dạng phổ biến:
 *   .../@10.123,106.456,15z          (link bản đồ)
 *   ...?q=10.123,106.456             (link tìm kiếm)
 *   .../place/10.123,106.456         (link địa điểm)
 *   https://maps.google.com/?ll=10.123,106.456
 *
 * Link rút gọn (maps.app.goo.gl) KHÔNG chứa toạ độ — phải mở ra rồi sao chép
 * link đầy đủ. Hàm trả null trong trường hợp đó để nơi gọi báo cho người dùng.
 */
export function parseMapLink(raw: string): LatLng | null {
  const text = raw.trim();
  if (!text) return null;

  const candidates = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const re of candidates) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }
  return null;
}

/** Giới hạn bán kính điểm danh (mét) — khớp ràng buộc CHECK trong database. */
export const RADIUS_MIN_M = 20;
export const RADIUS_MAX_M = 1000;
/** Giới hạn ngưỡng sai số GPS (mét) — khớp ràng buộc CHECK trong database. */
export const ACCURACY_MIN_M = 5;
export const ACCURACY_MAX_M = 500;

/** Bán kính có hợp lệ không (dùng trước khi lưu để báo lỗi sớm). */
export function isValidRadius(v: number | null | undefined): boolean {
  if (v === null || v === undefined) return true; // trống = dùng mặc định
  return Number.isFinite(v) && v >= RADIUS_MIN_M && v <= RADIUS_MAX_M;
}
export function isValidAccuracyThreshold(v: number | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  return Number.isFinite(v) && v >= ACCURACY_MIN_M && v <= ACCURACY_MAX_M;
}

/** Định dạng mét cho dễ đọc: 42.3 -> "42 m", 1250 -> "1,3 km". */
export function formatDistance(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/**
 * Chuyển mốc ISO sang chuỗi cho <input type="datetime-local">.
 * Input đó cần giờ ĐỊA PHƯƠNG dạng "YYYY-MM-DDTHH:mm" (không có hậu tố Z),
 * nên không thể dùng thẳng `toISOString().slice(0,16)` — sẽ lệch múi giờ.
 */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}