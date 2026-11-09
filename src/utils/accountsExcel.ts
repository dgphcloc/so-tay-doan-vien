import ExcelJS from 'exceljs';
import type { DbProfile, DbMember, RoleId } from '../data/types';
import { downloadBlob } from './exportExcel';
import { formatDateVN } from '../mock/data';

export const ROLE_DISPLAY: Record<RoleId, string> = {
  super_admin: 'Quản trị viên tối cao',
  admin: 'Bí thư Đoàn xã',
  staff: 'Cán bộ theo dõi',
  unit_secretary: 'Bí thư Chi đoàn',
  member: 'Đoàn viên',
};

export const ROLE_KEY_BY_NAME: Record<string, RoleId> = {
  'quan tri vien toi cao': 'super_admin',
  'super admin': 'super_admin',
  'super_admin': 'super_admin',
  'bi thu doan xa': 'admin',
  'admin': 'admin',
  'can bo theo doi': 'staff',
  'can bo': 'staff',
  'staff': 'staff',
  'bi thu chi doan': 'unit_secretary',
  'bi thu cd': 'unit_secretary',
  'unit_secretary': 'unit_secretary',
  'doan vien': 'member',
  'member': 'member',
};

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

/** Xuất danh sách tài khoản & quyền quản trị */
export async function exportAccountsExcel(
  profiles: DbProfile[],
  members: DbMember[]
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách Tài khoản');

  ws.columns = [
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Email đăng nhập', key: 'email', width: 28 },
    { header: 'Họ tên nhân sự', key: 'name', width: 26 },
    { header: 'Vai trò phân quyền', key: 'role', width: 24 },
    { header: 'Mã vai trò (Role ID)', key: 'role_id', width: 18 },
    { header: 'Trạng thái tài khoản', key: 'status', width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const memberMap = new Map(members.map(m => [m.id, m]));

  profiles.forEach((p, idx) => {
    const mem = p.member_id ? memberMap.get(p.member_id) : null;
    const r = ws.addRow({
      stt: idx + 1,
      email: p.email || 'Chưa có email',
      name: mem ? `${mem.full_name} (${mem.phone})` : 'Chưa liên kết hồ sơ',
      role: ROLE_DISPLAY[p.role_id] || p.role_id,
      role_id: p.role_id,
      status: p.is_active ? 'Đang hoạt động' : 'Tạm khóa',
    });
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), `Danh_sach_tai_khoan_quan_tri_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Tải file mẫu phân quyền tài khoản hàng loạt */
export async function downloadAccountTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('PhanQuyenTaiKhoan');

  ws.columns = [
    { header: 'Email tài khoản (*)', key: 'email', width: 28 },
    { header: 'Vai trò quản trị (*)', key: 'role', width: 24 },
    { header: 'Trạng thái', key: 'status', width: 18 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const samples = [
    { email: 'bithudoan@example.com', role: 'Bí thư Đoàn xã', status: 'Hoạt động' },
    { email: 'canbodoan@example.com', role: 'Cán bộ theo dõi', status: 'Hoạt động' },
    { email: 'bithuap1@example.com', role: 'Bí thư Chi đoàn', status: 'Hoạt động' },
  ];

  samples.forEach(s => ws.addRow(s));

  for (let r = 2; r <= 200; r++) {
    ws.getCell(r, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Quản trị viên tối cao,Bí thư Đoàn xã,Cán bộ theo dõi,Bí thư Chi đoàn,Đoàn viên"'],
    };
    ws.getCell(r, 3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Hoạt động,Tạm khóa"'],
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), 'Mau_phan_quyen_tai_khoan.xlsx');
}

export interface ParsedAccountRow {
  rowNum: number;
  email: string;
  matchedProfileId?: string;
  roleId: RoleId;
  roleLabel: string;
  isActive: boolean;
  isValid: boolean;
  error: string;
}

export async function parseAccountsWorkbook(
  buffer: ArrayBuffer,
  existingProfiles: DbProfile[]
): Promise<{ rows: ParsedAccountRow[]; totalRows: number; validCount: number; invalidCount: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');

  const emailMap = new Map<string, DbProfile>();
  existingProfiles.forEach(p => {
    if (p.email) emailMap.set(p.email.toLowerCase().trim(), p);
  });

  const rows: ParsedAccountRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const rawEmail = cellText(ws.getCell(r, 1).value).toLowerCase().trim();
    if (!rawEmail) continue;

    const rawRole = norm(cellText(ws.getCell(r, 2).value));
    const roleId: RoleId = ROLE_KEY_BY_NAME[rawRole] || 'member';

    const rawStatus = norm(cellText(ws.getCell(r, 3).value));
    const isActive = !rawStatus.includes('khoa') && !rawStatus.includes('ngung');

    const matchedProfile = emailMap.get(rawEmail);
    let error = '';
    if (!rawEmail.includes('@')) {
      error = 'Email không hợp lệ';
    } else if (!matchedProfile) {
      error = 'Email này chưa được đăng ký trong hệ thống';
    }

    if (!error) validCount++;
    else invalidCount++;

    rows.push({
      rowNum: r,
      email: rawEmail,
      matchedProfileId: matchedProfile?.id,
      roleId,
      roleLabel: ROLE_DISPLAY[roleId],
      isActive,
      isValid: !error,
      error,
    });
  }

  return { rows, totalRows: rows.length, validCount, invalidCount };
}
