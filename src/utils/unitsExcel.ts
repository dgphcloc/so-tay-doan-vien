import ExcelJS from 'exceljs';
import type { DbUnit, DbUnitType, UnitTypeId } from '../data/types';
import { downloadBlob } from './exportExcel';

export interface ParsedUnitRow {
  rowNum: number;
  name: string;
  unit_type_id: UnitTypeId;
  unit_type_name: string;
  union_member_count: number;
  youth_count: number;
  is_active: boolean;
  note: string;
  existingId?: string; // Nếu đã có trong DB
  isUpdate: boolean;   // true: cập nhật đè, false: thêm mới
  isValid: boolean;
  error: string;
}

export interface UnitParseResult {
  rows: ParsedUnitRow[];
  totalRows: number;
  createCount: number;
  updateCount: number;
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

export const UNIT_TYPE_MAP: Record<UnitTypeId, string> = {
  residential: 'Dân cư',
  school: 'Trường học',
  health: 'Y tế',
  police: 'Công an',
  other: 'Khác',
};

export function mapTypeNameToId(name: string): UnitTypeId {
  const n = norm(name);
  if (n.includes('dan cu') || n.includes('ap') || n.includes('khom') || n.includes('thon') || n.includes('to dan pho')) return 'residential';
  if (n.includes('truong') || n.includes('hoc') || n.includes('mam non') || n.includes('thcs') || n.includes('thpt') || n.includes('tieu hoc')) return 'school';
  if (n.includes('y te') || n.includes('benh vien') || n.includes('tram')) return 'health';
  if (n.includes('cong an') || n.includes('canh sat')) return 'police';
  return 'other';
}

/** Tải file Excel mẫu chuẩn nhập danh sách Chi đoàn */
export async function downloadUnitTemplate(unitTypes: DbUnitType[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ tay Đoàn viên';
  const ws = wb.addWorksheet('Danh sách Chi đoàn');

  ws.columns = [
    { header: 'Tên Chi đoàn (*)', key: 'name', width: 32 },
    { header: 'Loại Chi đoàn (*)', key: 'unit_type', width: 20 },
    { header: 'Đoàn viên khai báo', key: 'member_count', width: 22 },
    { header: 'Thanh niên địa bàn', key: 'youth_count', width: 22 },
    { header: 'Trạng thái', key: 'status', width: 18 },
    { header: 'Ghi chú / Địa bàn', key: 'note', width: 30 },
  ];

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Mẫu ví dụ
  const sampleData = [
    {
      name: 'Chi đoàn ấp 1',
      unit_type: 'Dân cư',
      member_count: 40,
      youth_count: 120,
      status: 'Hoạt động',
      note: 'Địa bàn ấp 1, xã Hòa Bình',
    },
    {
      name: 'Chi đoàn Trường THPT Hòa Bình',
      unit_type: 'Trường học',
      member_count: 65,
      youth_count: 80,
      status: 'Hoạt động',
      note: 'Khối trường học',
    },
    {
      name: 'Chi đoàn Trạm Y tế xã',
      unit_type: 'Y tế',
      member_count: 12,
      youth_count: 15,
      status: 'Hoạt động',
      note: 'Khối y tế',
    },
  ];

  sampleData.forEach((row) => {
    const r = ws.addRow(row);
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  // Validation dropdown cho cột Loại Chi đoàn (cột B = 2) và Trạng thái (cột E = 5)
  const typeList = unitTypes.length > 0 ? unitTypes.map(t => t.name).join(',') : 'Dân cư,Trường học,Y tế,Công an,Khác';
  for (let r = 2; r <= 300; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${typeList}"`],
    };
    ws.getCell(r, 5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Hoạt động,Ngừng hoạt động"'],
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), 'Mau_nhap_danh_sach_chi_doan.xlsx');
}

/** Xuất danh sách Chi đoàn hiện có ra Excel */
export async function exportUnitsExcel(
  units: DbUnit[],
  unitTypes: DbUnitType[],
  secretariesMap?: Map<string, string>
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Chi đoàn cơ sở');

  ws.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Tên Chi đoàn', key: 'name', width: 32 },
    { header: 'Loại Chi đoàn', key: 'type', width: 18 },
    { header: 'Bí thư Chi đoàn', key: 'secretary', width: 24 },
    { header: 'Đoàn viên khai báo', key: 'declared', width: 20 },
    { header: 'Thanh niên địa bàn', key: 'youth', width: 20 },
    { header: 'Trạng thái', key: 'status', width: 16 },
    { header: 'Ghi chú', key: 'note', width: 28 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const typeMap = new Map(unitTypes.map(t => [t.id, t.name]));

  units.forEach((u, i) => {
    const r = ws.addRow({
      stt: i + 1,
      name: u.name,
      type: typeMap.get(u.unit_type_id) || UNIT_TYPE_MAP[u.unit_type_id] || u.unit_type_id,
      secretary: secretariesMap?.get(u.id) || 'Khuyết Bí thư',
      declared: u.union_member_count,
      youth: u.youth_count,
      status: u.is_active ? 'Hoạt động' : 'Ngừng hoạt động',
      note: u.note || '',
    });
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), `Danh_sach_chi_doan_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Phân tích file Excel nhập Chi đoàn */
export async function parseUnitsWorkbook(
  buffer: ArrayBuffer,
  existingUnits: DbUnit[],
  unitTypes: DbUnitType[]
): Promise<UnitParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  // Tìm header
  let headerRow = 1;
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const rowTexts = [];
    for (let c = 1; c <= 8; c++) rowTexts.push(norm(cellText(ws.getCell(r, c).value)));
    if (rowTexts.some(t => t.includes('ten chi doan') || t.includes('chi doan') || t === 'ten')) {
      headerRow = r;
      break;
    }
  }

  const colOf: Record<string, number> = {};
  for (let c = 1; c <= Math.min(15, ws.columnCount || 8); c++) {
    const h = norm(cellText(ws.getCell(headerRow, c).value));
    if (!h) continue;
    if (h.includes('ten chi doan') || h.includes('chi doan') || (h === 'ten' && !colOf.name)) colOf.name = c;
    else if (h.includes('loai')) colOf.type = c;
    else if (h.includes('khai bao') || h.includes('doan vien') || h.includes('quan so')) colOf.memberCount = c;
    else if (h.includes('thanh nien') || h.includes('dia ban')) colOf.youthCount = c;
    else if (h.includes('trang thai') || h.includes('hoat dong')) colOf.status = c;
    else if (h.includes('ghi chu')) colOf.note = c;
  }

  if (!colOf.name) colOf.name = 1;
  if (!colOf.type) colOf.type = 2;

  const existingMap = new Map<string, DbUnit>();
  existingUnits.forEach(u => existingMap.set(norm(u.name), u));

  const rows: ParsedUnitRow[] = [];
  let createCount = 0;
  let updateCount = 0;
  let invalidCount = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const rawName = cellText(ws.getCell(r, colOf.name).value).trim();
    if (!rawName) continue; // Bỏ dòng trống

    const rawType = colOf.type ? cellText(ws.getCell(r, colOf.type).value).trim() : '';
    const typeId = mapTypeNameToId(rawType);
    const typeName = UNIT_TYPE_MAP[typeId];

    const rawMemCount = colOf.memberCount ? cellText(ws.getCell(r, colOf.memberCount).value).replace(/[^0-9]/g, '') : '0';
    const memberCount = parseInt(rawMemCount, 10) || 0;

    const rawYouthCount = colOf.youthCount ? cellText(ws.getCell(r, colOf.youthCount).value).replace(/[^0-9]/g, '') : '0';
    const youthCount = parseInt(rawYouthCount, 10) || 0;

    const rawStatus = colOf.status ? norm(cellText(ws.getCell(r, colOf.status).value)) : 'hoat dong';
    const isActive = !rawStatus.includes('ngung') && !rawStatus.includes('dung') && !rawStatus.includes('khoa') && !rawStatus.includes('false');

    const note = colOf.note ? cellText(ws.getCell(r, colOf.note).value).trim() : '';

    let error = '';
    if (!rawName) error = 'Thiếu tên Chi đoàn';

    const existing = existingMap.get(norm(rawName));
    const isUpdate = !!existing;

    if (!error) {
      if (isUpdate) updateCount++;
      else createCount++;
    } else {
      invalidCount++;
    }

    rows.push({
      rowNum: r,
      name: rawName,
      unit_type_id: typeId,
      unit_type_name: typeName,
      union_member_count: memberCount,
      youth_count: youthCount,
      is_active: isActive,
      note,
      existingId: existing?.id,
      isUpdate,
      isValid: !error,
      error,
    });
  }

  return {
    rows,
    totalRows: rows.length,
    createCount,
    updateCount,
    invalidCount,
  };
}
