/**
 * Đọc file Excel danh sách đoàn viên -> các dòng đã kiểm tra.
 *
 * Cột mong đợi (theo thứ tự hoặc theo tên tiêu đề, không phân biệt hoa/thường, có/không dấu):
 *   Họ tên | Ngày sinh | Giới tính | SĐT | Ngày vào Đoàn | Chi đoàn
 *
 * Trả về mỗi dòng kèm cờ hợp lệ + lý do lỗi để hiển thị ở bước xem trước.
 */
import ExcelJS from 'exceljs';

export interface ParsedMemberRow {
  rowNum: number;
  full_name: string;
  birth_date: string;
  phone: string;
  joined_date: string;
  unit_name: string;
  gender: 'male' | 'female' | 'other';
  isValid: boolean;
  isDuplicate: boolean;
  error: string;
}

interface UnitRef { id: string; name: string }
interface MemberRef { full_name: string; birth_date: string; phone: string }

const stripTones = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const norm = (s: string) => stripTones(s).replace(/\s+/g, ' ');

/** Chuẩn hóa ô ngày -> YYYY-MM-DD; trả '' nếu không nhận dạng. */
function normalizeDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function parseGender(v: unknown): 'male' | 'female' | 'other' {
  const s = stripTones(String(v ?? ''));
  if (s.includes('nu') || s === 'f' || s.includes('female')) return 'female';
  if (s.includes('nam') || s === 'm' || s.includes('male')) return 'male';
  return 'other';
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t.text ?? '').join('');
    if ('result' in o) return String(o.result ?? '');
  }
  return String(v);
};

export async function parseMembersWorkbook(
  buffer: ArrayBuffer,
  units: UnitRef[],
  existingMembers: MemberRef[]
): Promise<ParsedMemberRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  // Tìm dòng tiêu đề: dòng đầu tiên có chứa "tên" hoặc "họ"
  let headerRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const texts = [];
    for (let c = 1; c <= 10; c++) texts.push(norm(cellText(ws.getCell(r, c).value)));
    if (texts.some(t => t.includes('ten') || t.includes('ho ten'))) { headerRow = r; break; }
  }

  // Ánh xạ cột theo tiêu đề
  const colOf: Record<string, number> = {};
  for (let c = 1; c <= 10; c++) {
    const h = norm(cellText(ws.getCell(headerRow, c).value));
    if (!h) continue;
    if (h.includes('ho ten') || h === 'ten' || h.includes('ho va ten')) colOf.name = c;
    else if (h.includes('ngay sinh') || h.includes('sinh')) colOf.birth = c;
    else if (h.includes('gioi')) colOf.gender = c;
    else if (h.includes('dien thoai') || h.includes('sdt') || h.includes('phone')) colOf.phone = c;
    else if (h.includes('vao doan') || h.includes('ngay vao')) colOf.joined = c;
    else if (h.includes('chi doan') || h.includes('don vi') || h.includes('dia ban')) colOf.unit = c;
  }
  // Nếu không nhận được cột nào theo tên -> giả định thứ tự mặc định
  if (!colOf.name) {
    colOf.name = 1; colOf.birth = 2; colOf.gender = 3; colOf.phone = 4; colOf.joined = 5; colOf.unit = 6;
  }

  const rows: ParsedMemberRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const name = cellText(ws.getCell(r, colOf.name).value).trim();
    const birth = normalizeDate(ws.getCell(r, colOf.birth ?? 2).value);
    const phone = cellText(ws.getCell(r, colOf.phone ?? 4).value).replace(/[^0-9]/g, '');
    const joined = normalizeDate(ws.getCell(r, colOf.joined ?? 5).value);
    const unitName = cellText(ws.getCell(r, colOf.unit ?? 6).value).trim();
    const gender = parseGender(colOf.gender ? ws.getCell(r, colOf.gender).value : '');

    if (!name && !birth && !phone) continue; // dòng trống

    let error = '';
    if (!name) error = 'Thiếu họ tên';
    else if (!birth) error = 'Thiếu/không rõ ngày sinh';
    else if (phone && !/^[0-9]{9,11}$/.test(phone)) error = 'SĐT không đủ 9-11 chữ số';
    else if (joined && joined < birth) error = 'Ngày vào Đoàn trước ngày sinh';

    // Trùng trong DB
    const isDuplicate = !error && existingMembers.some(m =>
      norm(m.full_name) === norm(name) && m.birth_date === birth);

    rows.push({
      rowNum: r, full_name: name, birth_date: birth, phone,
      joined_date: joined, unit_name: unitName, gender,
      isValid: !error, isDuplicate, error,
    });
  }
  return rows;
}
