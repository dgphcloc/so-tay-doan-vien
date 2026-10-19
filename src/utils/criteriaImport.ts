/**
 * Phân tích file Excel "Bộ Tiêu chí Xã, Phường đoàn" thành cây tiêu chí có cấu trúc.
 *
 * Cấu trúc file (Tỉnh đoàn ban hành) có 4 tầng nhưng app dùng 3 tầng:
 *   Phần (section)  ->  Tiêu chí N (criterion)  ->  Điều kiện chấm điểm (sub_criterion)
 *
 * Quy ước cột (dữ liệu):
 *   A = nội dung đánh giá (ô gộp dọc) / "Tiêu chí N:" / "Phần …"
 *   B = điều kiện chấm điểm
 *   C = điểm
 *   D = yêu cầu trong đánh giá kết quả thực hiện
 *   E = yêu cầu minh chứng hình ảnh, đường link
 *   F = nguyên tắc chấm điểm
 *   G = thời gian đóng cổng đăng tải minh chứng
 *   H = bộ phận phụ trách
 *
 * Riêng "Phần 2" (nội dung tự chọn) không có cột điểm (C trống) và tiêu chí
 * nằm ở ô A gộp; mỗi dòng B là một nội dung đề xuất.
 */
import ExcelJS from 'exceljs';
import type { UnitTypeId } from '../data/types';

export interface ImportedSub {
  condition_text: string;
  max_score: number;
  evaluation_method: string;
  evidence_requirement: string;
  scoring_rule: string;
  deadline: string; // ISO YYYY-MM-DD, hoặc '' nếu không xác định
  note?: string;
  unit_type_id: null;
  unit_id: null;
  unit_type_ids: [];
  unit_ids: [];
}

export interface ImportedCriterion {
  name: string;
  stt: number;
  subs: ImportedSub[];
}

export interface ImportedSection {
  name: string;
  stt: number;
  criteria: ImportedCriterion[];
}

export interface ParsedCriteriaTree {
  setName: string;
  year: number;
  sections: ImportedSection[];
  warnings: string[];
  totals: { sections: number; criteria: number; subs: number; points: number };
}

// ---------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------
const str = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    // Ô công thức / rich text của exceljs
    const anyV = v as Record<string, unknown>;
    if (typeof anyV.text === 'string') return anyV.text;
    if (Array.isArray(anyV.richText)) return anyV.richText.map((t: any) => t.text ?? '').join('');
    if ('result' in anyV) return str(anyV.result);
  }
  return String(v);
};

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Chuẩn hóa ô ngày về ISO YYYY-MM-DD; trả '' nếu không nhận dạng được. */
function normalizeDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = clean(str(v));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // 2026-10-30 hoặc 2026-10-30 00:00:00
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // 15/9/2026
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function toScore(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(clean(str(v)).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Phần 2 (nội dung tự chọn) không có cột điểm; điểm tối đa nằm trong
 * "nguyên tắc chấm điểm" (cột F) dạng "…: 10 điểm". Lấy số lớn nhất trước "điểm".
 */
function maxScoreFromRule(rule: string): number | null {
  const matches = [...rule.matchAll(/(\d+(?:[.,]\d+)?)\s*điểm/gi)];
  if (matches.length === 0) return null;
  const nums = matches.map((m) => Number(m[1].replace(',', '.'))).filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) : null;
}

// ---------------------------------------------------------------------
// Nhận dạng dòng
// ---------------------------------------------------------------------
const RE_SECTION = /^Phần\s+\d+\s*:/i;
const RE_CRITERION = /^Tiêu chí\s+\d+\s*:/i;
const RE_CONTENT = /^\d+\s*\./; // "1. Học tập…"
const HEADER_HINTS = ['Nội dung đánh giá', 'Tiêu chí Xã, Phường đoàn đăng ký', 'Nội dung gợi ý'];

const isHeaderRow = (a: string, b: string): boolean =>
  HEADER_HINTS.some((h) => a.includes(h) || b.includes(h));

// ---------------------------------------------------------------------
// Phân tích
// ---------------------------------------------------------------------
export async function parseCriteriaWorkbook(buffer: ArrayBuffer): Promise<ParsedCriteriaTree> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Ưu tiên sheet chứa dữ liệu tiêu chí; nếu không rõ thì lấy sheet đầu.
  const ws =
    wb.worksheets.find((w) => /XÃ|PHƯỜNG|TIÊU CHÍ/i.test(w.name)) ?? wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  const warnings: string[] = [];
  const sections: ImportedSection[] = [];

  let curSection: ImportedSection | null = null;
  let curCriterion: ImportedCriterion | null = null;
  let curContent = ''; // tên "nội dung đánh giá" đang áp dụng (ô A gộp dọc)
  let secStt = 0;
  let critStt = 0;
  let lastContentKey = '';

  const get = (r: number, c: number) => ws.getCell(r, c).value;
  // Ô gộp: chỉ xử lý ô "chủ" (master); các ô bị gộp theo bỏ qua để không đếm trùng.
  const isGhostCell = (r: number, c: number): boolean => {
    const cell = ws.getCell(r, c);
    return cell.isMerged && Number(cell.master.row) !== r;
  };

  const ensureSection = (): ImportedSection => {
    if (!curSection) {
      curSection = { name: 'Phần 1', stt: ++secStt, criteria: [] };
      sections.push(curSection);
    }
    return curSection;
  };

  for (let r = 1; r <= ws.rowCount; r++) {
    // Bỏ qua ô bị gộp theo (không phải ô chủ) ở cả cột A và B
    if (isGhostCell(r, 1) && isGhostCell(r, 2)) continue;

    const aRaw = str(get(r, 1));
    const bRaw = isGhostCell(r, 2) ? '' : str(get(r, 2));
    const a = clean(aRaw);
    const b = clean(bRaw);

    if (!a && !b) continue;

    // 1) Dòng "Phần N: …"
    if (RE_SECTION.test(a)) {
      curSection = { name: a, stt: ++secStt, criteria: [] };
      sections.push(curSection);
      curCriterion = null;
      curContent = '';
      lastContentKey = '';
      continue;
    }

    // 2) Dòng tiêu đề (bỏ qua)
    if (isHeaderRow(a, b)) continue;

    // 3) Dòng "Tiêu chí N: …"
    if (RE_CRITERION.test(a)) {
      const sec = ensureSection();
      curCriterion = { name: a, stt: ++critStt, subs: [] };
      sec.criteria.push(curCriterion);
      curContent = '';
      lastContentKey = '';
      continue;
    }

    // 4) Dòng "nội dung đánh giá" (A khớp "1." / "2." …) — có thể lặp lại do ô gộp
    if (RE_CONTENT.test(a)) {
      if (a !== lastContentKey) {
        lastContentKey = a;
        curContent = a;
        // Phần 2: không có tiêu đề "Tiêu chí N" -> dùng chính nội dung làm tiêu chí
        if (!curCriterion) {
          const sec = ensureSection();
          curCriterion = { name: a, stt: ++critStt, subs: [] };
          sec.criteria.push(curCriterion);
          curContent = '';
        }
      }
    }

    // 5) Điều kiện chấm điểm nằm ở cột B
    if (!b) continue;
    // Bỏ dòng tiêu đề phụ nếu lọt vào đây
    if (HEADER_HINTS.some((h) => b.includes(h))) continue;
    // Chỉ xử lý khi đã biết thuộc phần nào (tránh tạo section rác từ phần đầu file)
    if (!curSection) continue;

    const sec = ensureSection();
    if (!curCriterion) {
      // Chưa có tiêu chí nào -> tạo tiêu chí mặc định cho phần này
      curCriterion = { name: 'Nội dung đề xuất', stt: ++critStt, subs: [] };
      sec.criteria.push(curCriterion);
    }

    const rule = clean(str(get(r, 6)));
    let score = toScore(get(r, 3));
    if (score === null) {
      // Phần 2: điểm nằm trong "nguyên tắc chấm điểm"
      score = maxScoreFromRule(rule);
      if (score === null) {
        warnings.push(`Dòng ${r}: không đọc được điểm — tạm gán 0.`);
      }
    }

    const deadline = normalizeDate(get(r, 7));
    if (!deadline && str(get(r, 7))) {
      warnings.push(`Dòng ${r}: ngày "${clean(str(get(r, 7)))}" không nhận dạng được, để trống.`);
    }

    // Bỏ số thứ tự "1." ở đầu điều kiện để ghép với tên nội dung cho gọn
    const bText = b.replace(/^\d+\s*\.\s*/, '');
    const condition = curContent ? `${curContent}. ${bText}` : bText;

    // Điểm tối thiểu 1 (CSDL ràng buộc max_score > 0); nếu file không ghi điểm thì cảnh báo
    let finalScore = score ?? 0;
    if (finalScore <= 0) {
      finalScore = 1;
      warnings.push(`Dòng ${r}: file không ghi điểm — tạm gán 1đ, hãy kiểm tra lại.`);
    }

    curCriterion.subs.push({
      condition_text: condition,
      max_score: finalScore,
      evaluation_method: clean(str(get(r, 4))),
      evidence_requirement: clean(str(get(r, 5))),
      scoring_rule: rule,
      deadline,
      note: clean(str(get(r, 8))) || undefined,
      unit_type_id: null,
      unit_id: null,
      unit_type_ids: [],
      unit_ids: [],
    });
  }

  // Tổng kết
  const criteriaCount = sections.reduce((s, x) => s + x.criteria.length, 0);
  const subsCount = sections.reduce(
    (s, x) => s + x.criteria.reduce((t, c) => t + c.subs.length, 0),
    0
  );
  const points = sections.reduce(
    (s, x) => s + x.criteria.reduce((t, c) => t + c.subs.reduce((u, sub) => u + sub.max_score, 0), 0),
    0
  );

  if (sections.length === 0) {
    throw new Error('Không tìm thấy dữ liệu tiêu chí trong file. Kiểm tra lại đúng file bộ tiêu chí.');
  }

  // Năm: lấy từ tên file/sheet nếu có, mặc định năm hiện tại + 1 (file 2026)
  const yearMatch = `${ws.name} ${wb.title ?? ''}`.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

  const setName = `Bộ Tiêu chí Xã, Phường đoàn năm ${year} (nhập từ Excel)`;

  return {
    setName,
    year,
    sections,
    warnings,
    totals: { sections: sections.length, criteria: criteriaCount, subs: subsCount, points },
  };
}

// ---------------------------------------------------------------------
// Sinh payload phẳng để nạp vào repository
// ---------------------------------------------------------------------
export interface CriteriaImportPayload {
  set: { name: string; year: number; issuing_unit: string };
  sections: Array<{ id: string; stt: number; name: string }>;
  criteria: Array<{ id: string; section_id: string; stt: number; name: string }>;
  subCriteria: Array<{
    id: string;
    criterion_id: string;
    condition_text: string;
    max_score: number;
    evaluation_method: string;
    evidence_requirement: string;
    scoring_rule: string;
    deadline: string;
    unit_type_id: null;
    unit_id: null;
    unit_type_ids: UnitTypeId[];
    unit_ids: string[];
    note?: string;
  }>;
}

/** Biến cây đã phân tích thành các mảng phẳng với id tạm (không dùng Date.now để tránh trùng). */
export function toImportPayload(
  tree: ParsedCriteriaTree,
  opts?: { setName?: string; year?: number; issuingUnit?: string }
): CriteriaImportPayload {
  const sections: CriteriaImportPayload['sections'] = [];
  const criteria: CriteriaImportPayload['criteria'] = [];
  const subCriteria: CriteriaImportPayload['subCriteria'] = [];

  tree.sections.forEach((sec, si) => {
    const secId = `imp_sec_${si + 1}`;
    sections.push({ id: secId, stt: si + 1, name: sec.name });
    sec.criteria.forEach((crit, ci) => {
      const critId = `imp_crit_${si + 1}_${ci + 1}`;
      criteria.push({ id: critId, section_id: secId, stt: ci + 1, name: crit.name });
      crit.subs.forEach((sub, bi) => {
        subCriteria.push({
          id: `imp_sub_${si + 1}_${ci + 1}_${bi + 1}`,
          criterion_id: critId,
          condition_text: sub.condition_text,
          max_score: sub.max_score,
          evaluation_method: sub.evaluation_method,
          evidence_requirement: sub.evidence_requirement,
          scoring_rule: sub.scoring_rule,
          deadline: sub.deadline,
          unit_type_id: null,
          unit_id: null,
          unit_type_ids: [],
          unit_ids: [],
          note: sub.note,
        });
      });
    });
  });

  return {
    set: {
      name: opts?.setName ?? tree.setName,
      year: opts?.year ?? tree.year,
      issuing_unit: opts?.issuingUnit ?? 'Ban Thường vụ Tỉnh đoàn Cà Mau',
    },
    sections,
    criteria,
    subCriteria,
  };
}
