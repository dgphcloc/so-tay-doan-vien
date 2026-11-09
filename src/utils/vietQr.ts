/**
 * TIỆN ÍCH VIETQR NAPAS 247 & TÍCH HỢP PAYOS
 *
 * Chuẩn VietQR (Napas 247):
 * Định dạng: https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<CONTENT>&accountName=<NAME>
 */

export interface VietQrInput {
  bankCode: string;       // Mã BIN ngân hàng, ví dụ '970422' (MB Bank)
  accountNumber: string;  // Số tài khoản nhận tiền
  accountHolder: string;  // Tên chủ tài khoản
  amount: number;         // Số tiền cần nộp (đồng)
  content: string;        // Nội dung chuyển khoản
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
}

/**
 * Xóa dấu tiếng Việt, ký tự đặc biệt để đảm bảo nội dung chuyển khoản
 * tương thích 100% với hệ thống xử lý của mọi ngân hàng Việt Nam.
 */
export function sanitizeTransferContent(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Sinh cú pháp chuyển khoản đoàn phí chuẩn:
 * DP [Mã_ĐV/SĐT] [Họ_Tên] [Tháng]
 * Ví dụ: DP 430 NGUYEN VAN A T3-T12
 */
export function buildFeeTransferContent(
  memberId: string | number,
  fullName: string,
  months: number[],
  year: number
): string {
  const cleanName = sanitizeTransferContent(fullName).slice(0, 15);
  const sorted = [...months].sort((a, b) => a - b);
  let monthStr = '';
  if (sorted.length === 1) {
    monthStr = `T${sorted[0]}`;
  } else if (sorted.length === 12) {
    monthStr = `NAM${year}`;
  } else if (sorted.length > 1 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) {
    monthStr = `T${sorted[0]}-T${sorted[sorted.length - 1]}`;
  } else {
    monthStr = `T${sorted.join('_')}`;
  }

  const raw = `DP ${memberId} ${cleanName} ${monthStr}`;
  return sanitizeTransferContent(raw).slice(0, 50);
}

/**
 * Tạo link ảnh mã VietQR Napas 247 động có sẵn số tiền và nội dung.
 */
export function generateVietQrUrl(input: VietQrInput): string {
  const template = input.template || 'compact2';
  const cleanContent = encodeURIComponent(sanitizeTransferContent(input.content));
  const cleanHolder = encodeURIComponent(sanitizeTransferContent(input.accountHolder));
  const bankBin = input.bankCode || '970422'; // fallback MB Bank
  const accNum = input.accountNumber.trim();
  const amt = Math.max(0, Math.round(input.amount));

  return `https://img.vietqr.io/image/${bankBin}-${accNum}-${template}.png?amount=${amt}&addInfo=${cleanContent}&accountName=${cleanHolder}`;
}

/**
 * Sinh mã đơn hàng ngẫu nhiên duy nhất cho PayOS (số nguyên an toàn dưới 2^53).
 */
export function generatePayOsOrderCode(): number {
  const timestamp = Date.now().toString().slice(-8); // 8 chữ số cuối timestamp
  const random = Math.floor(1000 + Math.random() * 9000).toString(); // 4 chữ số ngẫu nhiên
  return Number(`${timestamp}${random}`);
}

/**
 * Danh sách mã BIN các ngân hàng phổ biến tại Việt Nam
 */
export const POPULAR_BANKS = [
  { code: '970422', shortName: 'MB Bank', fullName: 'Ngân hàng TMCP Quân đội' },
  { code: '970436', shortName: 'Vietcombank', fullName: 'Ngân hàng Ngoại thương Việt Nam' },
  { code: '970415', shortName: 'VietinBank', fullName: 'Ngân hàng Công thương Việt Nam' },
  { code: '970418', shortName: 'BIDV', fullName: 'Ngân hàng Đầu tư và Phát triển Việt Nam' },
  { code: '970405', shortName: 'Agribank', fullName: 'Ngân hàng Nông nghiệp & PT Nông thôn' },
  { code: '970407', shortName: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { code: '970416', shortName: 'ACB', fullName: 'Ngân hàng TMCP Á Châu' },
  { code: '970423', shortName: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong' },
  { code: '970432', shortName: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
] as const;
