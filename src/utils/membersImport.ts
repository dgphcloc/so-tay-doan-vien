/**
 * Đọc và chuẩn hóa file Excel danh sách đoàn viên.
 *
 * Hỗ trợ linh hoạt:
 *   1. File mẫu chuẩn (1 dòng header).
 *   2. File thực tế hành chính (Header 2 dòng gộp như du_lieu_doan_vien_mau.xlsx).
 *   3. Tự phát hiện và sửa các lỗi nhập liệu phổ biến của Excel:
 *      - Cột học vấn gõ "12/12" bị Excel tự biến thành ngày "12/12/2026".
 *      - Cột năm sinh lúc là Date, lúc là chuỗi "dd/mm/yyyy".
 *      - Tự suy đoán giới tính (Nam/Nữ) qua tên đệm (Văn/Thị) nếu file thiếu cột giới tính.
 *      - Map từ viết tắt chức vụ (BTCĐ -> Bí thư, phó BTCĐ -> Phó Bí thư).
 *      - Chuẩn hóa dân tộc (Kh-mer -> Khmer).
 *      - Phát hiện các Chi đoàn chưa có trong DB để tự động tạo mới.
 */
import ExcelJS from 'exceljs';
import type { CurrentPosition, Gender, PoliticalTheoryLevel } from '../data/types';

export interface ParsedMemberRow {
  rowNum: number;
  full_name: string;
  birth_date: string;
  gender: Gender;
  phone: string;
  joined_date: string;
  unit_name: string;
  current_position: CurrentPosition;
  education_grade: string;
  specialization: string;
  political_theory_level: PoliticalTheoryLevel;
  ethnicity_name: string;
  religion: string;
  is_party_member: boolean;
  is_elite_member: boolean;
  note: string;
  isValid: boolean;
  isDuplicate: boolean;
  error: string;
}

export interface ParseResult {
  rows: ParsedMemberRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  newUnitsToCreate: string[];
}

interface UnitRef { id: string; name: string }
interface MemberRef { full_name: string; birth_date: string; phone: string }

const stripTones = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const norm = (s: string) => stripTones(s).replace(/\s+/g, ' ');

/** Chuẩn hóa ô ngày -> YYYY-MM-DD; trả '' nếu không nhận dạng được */
function normalizeDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const d = parseInt(m[3], 10);
    if (y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // Chỉ có năm sinh (ví dụ "1998") -> mặc định lấy 01/01/năm đó
  m = s.match(/^(\d{4})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    if (y > 1900 && y < 2100) return `${y}-01-01`;
  }
  return '';
}

/** Tự đoán giới tính nếu file không có cột giới tính */
function guessGender(name: string, explicitGenderVal: unknown): Gender {
  const gStr = stripTones(String(explicitGenderVal ?? ''));
  if (gStr.includes('nu') || gStr === 'f' || gStr.includes('female')) return 'female';
  if (gStr.includes('nam') || gStr === 'm' || gStr.includes('male')) return 'male';

  const n = norm(name);
  if (n.includes(' thi ') || n.endsWith(' thi') || n.includes(' thi')) return 'female';
  if (n.includes(' van ') || n.includes(' duc ') || n.includes(' minh ') || n.includes(' quang ') || n.includes(' hoang ')) return 'male';
  return 'female'; // Mặc định nếu không rõ
}

/** Chuẩn hóa chức vụ */
function parsePosition(v: unknown): CurrentPosition {
  const s = norm(String(v ?? ''));
  if (s.includes('pho bt') || s.includes('pho bi thu') || s.includes('pbtc') || s === 'pbt') return 'deputy_secretary';
  if (s.includes('btcd') || s.includes('bi thu') || s === 'bt') return 'secretary';
  return 'member';
}

/** Xử lý lỗi Excel tự đổi 12/12 thành ngày tháng */
function parseEducation(v: unknown): string {
  if (v === null || v === undefined || v === '') return '12/12';
  if (v instanceof Date) {
    const m = v.getMonth() + 1;
    const d = v.getDate();
    if (d === 12 && m === 12) return '12/12';
    if (d === 9 && m === 12) return '9/12';
    if (d === 12 && m === 9) return '12/12';
    return `${d}/${m}`;
  }
  const s = String(v).trim();
  const dateMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) {
    const d = parseInt(dateMatch[3], 10);
    const m = parseInt(dateMatch[2], 10);
    if (d === 12 && m === 12) return '12/12';
    if (d === 9 && m === 12) return '9/12';
    return `${d}/${m}`;
  }
  if (/^\d{1,2}$/.test(s)) return `${s}/12`;
  return s || '12/12';
}

/** Parse boolean Đảng viên / Ưu tú (c, x, có, yes, 1) */
function parseBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = norm(String(v ?? ''));
  return s === 'c' || s === 'x' || s === 'co' || s === 'yes' || s === '1' || s === 'true' || s === 'dang vien';
}

function parsePoliticalTheory(v: unknown): PoliticalTheoryLevel {
  const s = norm(String(v ?? ''));
  if (s.includes('cao cap')) return 'advanced';
  if (s.includes('trung cap')) return 'intermediate';
  if (s.includes('so cap')) return 'elementary';
  return 'elementary';
}

function parseEthnicity(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return 'Kinh';
  const clean = s.replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  if (norm(clean) === 'khmer') return 'Khmer';
  return s;
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
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  // 1. Dò tìm dòng tiêu đề chính
  // Hỗ trợ cả file mẫu 1 dòng (dòng có "Họ và tên") và file 2 dòng gộp (dòng 3 & 4)
  let headerRow = 1;
  let subHeaderRow: number | null = null;

  for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
    const texts = [];
    for (let c = 1; c <= 15; c++) texts.push(norm(cellText(ws.getCell(r, c).value)));
    if (texts.some(t => t.includes('ho ten') || t.includes('ho va ten') || t === 'ten')) {
      headerRow = r;
      // Kiểm tra dòng kế tiếp có phải là sub-header (ví dụ dòng 4 của file gộp: "Chuyên môn", "Lý luận chính trị")
      if (r < ws.rowCount) {
        const nextTexts = [];
        for (let c = 1; c <= 15; c++) nextTexts.push(norm(cellText(ws.getCell(r + 1, c).value)));
        if (nextTexts.some(t => t.includes('chuyen mon') || t.includes('ly luan') || t.includes('sdt'))) {
          subHeaderRow = r + 1;
        }
      }
      break;
    }
  }

  // 2. Lập bản đồ ánh xạ cột
  const colOf: Record<string, number> = {};
  const maxCols = Math.min(25, ws.columnCount || 15);

  const scanCell = (r: number, c: number) => {
    const h = norm(cellText(ws.getCell(r, c).value));
    if (!h) return;
    if (h.includes('ho ten') || h.includes('ho va ten') || (h === 'ten' && !colOf.name)) colOf.name = c;
    else if (h.includes('ngay sinh') || h === 'nam sinh' || h === 'sinh') colOf.birth = c;
    else if (h.includes('gioi tinh') || h === 'gioi') colOf.gender = c;
    else if (h.includes('chuc vu')) colOf.position = c;
    else if (h.includes('chi doan') || (h.includes('don vi') && !h.includes('cong tac')) || h.includes('dia ban')) colOf.unit = c;
    else if (h.includes('dien thoai') || h.includes('sdt') || h.includes('phone')) colOf.phone = c;
    else if (h.includes('vao doan') || h.includes('ngay vao')) colOf.joined = c;
    else if (h.includes('pho thong') || h.includes('hoc van') || h.includes('trinh do')) colOf.education = c;
    else if (h.includes('chuyen mon')) colOf.specialization = c;
    else if (h.includes('ly luan') || h.includes('chinh tri')) colOf.political = c;
    else if (h.includes('dan toc')) colOf.ethnicity = c;
    else if (h.includes('ton giao')) colOf.religion = c;
    else if (h.includes('dang vien')) colOf.party = c;
    else if (h.includes('uu tu')) colOf.elite = c;
    else if (h.includes('ghi chu')) colOf.note = c;
  };

  // Quét dòng header chính
  for (let c = 1; c <= maxCols; c++) scanCell(headerRow, c);
  // Nếu có sub-header thì quét đè bổ sung
  if (subHeaderRow) {
    for (let c = 1; c <= maxCols; c++) scanCell(subHeaderRow, c);
  }

  // Nếu không thấy tên cột, dùng vị trí mặc định
  if (!colOf.name) colOf.name = 2; // Cột B
  if (!colOf.birth) colOf.birth = 3; // Cột C
  if (!colOf.unit) colOf.unit = 7; // Cột G

  const dataStartRow = (subHeaderRow || headerRow) + 1;
  const rows: ParsedMemberRow[] = [];
  const existingUnitNames = new Set(units.map(u => norm(u.name)));
  const newUnitsSet = new Set<string>();

  for (let r = dataStartRow; r <= ws.rowCount; r++) {
    const rawName = cellText(ws.getCell(r, colOf.name).value).trim();
    if (!rawName) continue; // Bỏ qua dòng trống

    const birthVal = ws.getCell(r, colOf.birth).value;
    const birth = normalizeDate(birthVal);

    const explicitGender = colOf.gender ? ws.getCell(r, colOf.gender).value : null;
    const gender = guessGender(rawName, explicitGender);

    const rawUnit = colOf.unit ? cellText(ws.getCell(r, colOf.unit).value).trim() : '';
    const cleanUnit = rawUnit.replace(/\s+/g, ' ');

    const phone = colOf.phone ? cellText(ws.getCell(r, colOf.phone).value).replace(/[^0-9]/g, '') : '';
    const joined = colOf.joined ? normalizeDate(ws.getCell(r, colOf.joined).value) : '';
    const position = colOf.position ? parsePosition(ws.getCell(r, colOf.position).value) : 'member';

    const education = colOf.education ? parseEducation(ws.getCell(r, colOf.education).value) : '12/12';
    const specialization = colOf.specialization ? cellText(ws.getCell(r, colOf.specialization).value).trim() : '';
    const political = colOf.political ? parsePoliticalTheory(ws.getCell(r, colOf.political).value) : 'elementary';
    const ethnicity = colOf.ethnicity ? parseEthnicity(ws.getCell(r, colOf.ethnicity).value) : 'Kinh';
    const religion = colOf.religion ? cellText(ws.getCell(r, colOf.religion).value).trim() || 'Không' : 'Không';
    const isParty = colOf.party ? parseBoolean(ws.getCell(r, colOf.party).value) : false;
    const isElite = colOf.elite ? parseBoolean(ws.getCell(r, colOf.elite).value) : isParty;
    const note = colOf.note ? cellText(ws.getCell(r, colOf.note).value).trim() : '';

    let error = '';
    if (!rawName) error = 'Thiếu họ và tên';
    else if (!birth) error = 'Không rõ ngày/năm sinh';
    else if (phone && !/^[0-9]{9,11}$/.test(phone)) error = 'SĐT không đủ 9-11 chữ số';
    else if (joined && joined < birth) error = 'Ngày vào Đoàn trước ngày sinh';

    // Theo dõi chi đoàn mới cần tạo
    if (cleanUnit && !existingUnitNames.has(norm(cleanUnit))) {
      newUnitsSet.add(cleanUnit);
    }

    // Kiểm tra trùng lặp với DB hiện tại
    const isDuplicate = !error && existingMembers.some(m =>
      norm(m.full_name) === norm(rawName) && m.birth_date === birth
    );

    rows.push({
      rowNum: r,
      full_name: rawName,
      birth_date: birth,
      gender,
      phone,
      joined_date: joined,
      unit_name: cleanUnit,
      current_position: position,
      education_grade: education,
      specialization,
      political_theory_level: political,
      ethnicity_name: ethnicity,
      religion,
      is_party_member: isParty,
      is_elite_member: isElite,
      note,
      isValid: !error,
      isDuplicate,
      error,
    });
  }

  const validCount = rows.filter(r => r.isValid && !r.isDuplicate).length;
  const duplicateCount = rows.filter(r => r.isDuplicate).length;
  const invalidCount = rows.filter(r => !r.isValid).length;

  return {
    rows,
    totalRows: rows.length,
    validCount,
    invalidCount,
    duplicateCount,
    newUnitsToCreate: Array.from(newUnitsSet),
  };
}
