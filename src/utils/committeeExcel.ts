import ExcelJS from 'exceljs';
import type { DbUnitCommittee, DbMember, DbUnit, CommitteePosition } from '../data/types';
import { downloadBlob } from './exportExcel';
import { formatDateVN } from '../mock/data';

export interface ParsedCommitteeRow {
  rowNum: number;
  memberName: string;
  matchedMemberId?: string;
  scopeUnitName: string; // "Đoàn xã" hoặc tên Chi đoàn
  matchedUnitId?: string | null; // null: Đoàn xã
  position: CommitteePosition;
  positionLabel: string;
  isStanding: boolean;
  termStart: string;
  termEnd?: string;
  isValid: boolean;
  error: string;
}

export interface CommitteeParseResult {
  rows: ParsedCommitteeRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
}

const stripTones = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

const norm = (s: string) => stripTones(s).replace(/\s+/g, ' ');

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

export function parseCommitteePosition(v: unknown): CommitteePosition {
  const s = norm(String(v ?? ''));
  if (s.includes('pho bi thu') || s.includes('pbt')) return 'deputy_secretary';
  if (s.includes('bi thu') || s.includes('bt')) return 'secretary';
  if (s.includes('thuong vu') || s.includes('uy vien btv')) return 'committee_member';
  if (s.includes('uy vien') || s.includes('bch')) return 'committee_member';
  return 'member';
}

function normalizeDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
}

/** Tải file mẫu Excel nhập Ban Chấp Hành */
export async function downloadCommitteeTemplate(units: DbUnit[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách BCH');

  ws.columns = [
    { header: 'Họ và tên (*)', key: 'name', width: 28 },
    { header: 'Cấp bộ Đoàn (*)', key: 'scope', width: 30 },
    { header: 'Chức vụ (*)', key: 'position', width: 22 },
    { header: 'Ban Thường vụ', key: 'is_standing', width: 18 },
    { header: 'Ngày bắt đầu nhiệm kỳ (*)', key: 'term_start', width: 24 },
    { header: 'Ngày kết thúc nhiệm kỳ', key: 'term_end', width: 24 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const sampleUnits = ['BCH Đoàn xã', units[0]?.name || 'Chi đoàn ấp 1', units[1]?.name || 'Chi đoàn ấp 2'];

  const sampleRows = [
    {
      name: 'Trần Thị Mai',
      scope: 'BCH Đoàn xã',
      position: 'Bí thư',
      is_standing: 'Có',
      term_start: '01/01/2022',
      term_end: '',
    },
    {
      name: 'Nguyễn Văn Cương',
      scope: 'BCH Đoàn xã',
      position: 'Phó Bí thư',
      is_standing: 'Có',
      term_start: '01/01/2022',
      term_end: '',
    },
    {
      name: 'Lê Văn Nam',
      scope: sampleUnits[1],
      position: 'Bí thư',
      is_standing: 'Không',
      term_start: '15/03/2023',
      term_end: '',
    },
  ];

  sampleRows.forEach((row) => {
    const r = ws.addRow(row);
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  // Validation dropdown
  const scopeList = ['BCH Đoàn xã', ...units.map(u => u.name)].join(',');
  for (let r = 2; r <= 300; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${scopeList}"`],
    };
    ws.getCell(r, 3).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Bí thư,Phó Bí thư,Ủy viên BTV,Ủy viên BCH,Thành viên"'],
    };
    ws.getCell(r, 4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Có,Không"'],
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), 'Mau_nhap_ban_chap_hanh.xlsx');
}

/** Xuất danh sách BCH hiện tại ra Excel */
export async function exportCommitteeExcel(
  committees: DbUnitCommittee[],
  members: DbMember[],
  units: DbUnit[],
  scopeLabel: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ban Chấp hành');

  ws.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Họ và tên', key: 'name', width: 28 },
    { header: 'Cấp bộ Đoàn', key: 'scope', width: 30 },
    { header: 'Chức vụ', key: 'position', width: 20 },
    { header: 'Ban Thường vụ', key: 'standing', width: 16 },
    { header: 'Số điện thoại', key: 'phone', width: 16 },
    { header: 'Nhiệm kỳ bắt đầu', key: 'term_start', width: 18 },
    { header: 'Trạng thái', key: 'status', width: 18 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const memberMap = new Map(members.map(m => [m.id, m]));
  const unitMap = new Map(units.map(u => [u.id, u.name]));

  const posLabel: Record<CommitteePosition, string> = {
    secretary: 'Bí thư',
    deputy_secretary: 'Phó Bí thư',
    committee_member: 'Ủy viên BCH',
    member: 'Thành viên',
  };

  committees.forEach((c, idx) => {
    const mem = memberMap.get(c.member_id);
    const scopeName = c.unit_id ? unitMap.get(c.unit_id) || 'Chi đoàn' : 'BCH Đoàn xã';
    const r = ws.addRow({
      stt: idx + 1,
      name: mem?.full_name || '—',
      scope: scopeName,
      position: posLabel[c.position] || c.position,
      standing: c.is_standing ? 'UV BTV' : 'Không',
      phone: mem?.phone || '',
      term_start: formatDateVN(c.term_start),
      status: !c.term_end ? 'Đang giữ chức' : `Đã kết thúc (${formatDateVN(c.term_end)})`,
    });
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), `Danh_sach_BCH_${norm(scopeLabel).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Đọc file Excel nhập danh sách BCH */
export async function parseCommitteeWorkbook(
  buffer: ArrayBuffer,
  members: DbMember[],
  units: DbUnit[]
): Promise<CommitteeParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  let headerRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const texts = [];
    for (let c = 1; c <= 8; c++) texts.push(norm(cellText(ws.getCell(r, c).value)));
    if (texts.some(t => t.includes('ho ten') || t.includes('chuc vu') || t === 'ten')) {
      headerRow = r;
      break;
    }
  }

  const colOf: Record<string, number> = {};
  for (let c = 1; c <= Math.min(15, ws.columnCount || 8); c++) {
    const h = norm(cellText(ws.getCell(headerRow, c).value));
    if (!h) continue;
    if (h.includes('ho ten') || h.includes('ho va ten') || (h === 'ten' && !colOf.name)) colOf.name = c;
    else if (h.includes('cap bo') || h.includes('doan xa') || h.includes('chi doan') || h.includes('don vi')) colOf.scope = c;
    else if (h.includes('chuc vu')) colOf.position = c;
    else if (h.includes('thuong vu') || h.includes('btv')) colOf.standing = c;
    else if (h.includes('bat dau') || h.includes('nhiem ky')) colOf.start = c;
    else if (h.includes('ket thuc')) colOf.end = c;
  }

  if (!colOf.name) colOf.name = 1;
  if (!colOf.scope) colOf.scope = 2;
  if (!colOf.position) colOf.position = 3;

  const memberNormMap = new Map<string, DbMember>();
  members.forEach(m => memberNormMap.set(norm(m.full_name), m));

  const unitNormMap = new Map<string, string>(); // norm name -> unit id
  units.forEach(u => unitNormMap.set(norm(u.name), u.id));

  const rows: ParsedCommitteeRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  const posLabel: Record<CommitteePosition, string> = {
    secretary: 'Bí thư',
    deputy_secretary: 'Phó Bí thư',
    committee_member: 'Ủy viên BCH',
    member: 'Thành viên',
  };

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const rawName = cellText(ws.getCell(r, colOf.name).value).trim();
    if (!rawName) continue;

    const rawScope = colOf.scope ? cellText(ws.getCell(r, colOf.scope).value).trim() : 'BCH Đoàn xã';
    const scopeNorm = norm(rawScope);
    const isCommune = scopeNorm.includes('doan xa') || scopeNorm.includes('xa') || scopeNorm === 'bch doan xa';
    const unitId = isCommune ? null : (unitNormMap.get(scopeNorm) || null);

    const pos = parseCommitteePosition(colOf.position ? ws.getCell(r, colOf.position).value : '');
    const isStanding = colOf.standing ? (norm(cellText(ws.getCell(r, colOf.standing).value)) === 'co' || norm(cellText(ws.getCell(r, colOf.standing).value)) === 'x') : false;

    const termStart = colOf.start ? normalizeDate(ws.getCell(r, colOf.start).value) : new Date().toISOString().slice(0, 10);
    const termEnd = colOf.end ? normalizeDate(ws.getCell(r, colOf.end).value) : undefined;

    let error = '';
    const matchedMember = memberNormMap.get(norm(rawName));
    if (!matchedMember) {
      error = `Không tìm thấy đoàn viên "${rawName}" trong danh sách đoàn viên`;
    } else if (!isCommune && !unitId) {
      error = `Không tìm thấy chi đoàn "${rawScope}" trong hệ thống`;
    }

    if (!error) validCount++;
    else invalidCount++;

    rows.push({
      rowNum: r,
      memberName: rawName,
      matchedMemberId: matchedMember?.id,
      scopeUnitName: isCommune ? 'BCH Đoàn xã' : rawScope,
      matchedUnitId: unitId,
      position: pos,
      positionLabel: posLabel[pos],
      isStanding,
      termStart: termStart || new Date().toISOString().slice(0, 10),
      termEnd,
      isValid: !error,
      error,
    });
  }

  return {
    rows,
    totalRows: rows.length,
    validCount,
    invalidCount,
  };
}
