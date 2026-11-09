import ExcelJS from 'exceljs';
import type { DbUnitType, DbEthnicity } from '../data/types';
import { downloadBlob } from './exportExcel';

/** Xuất danh mục Loại chi đoàn và Dân tộc ra 2 sheet trong 1 file Excel */
export async function exportSettingsCatalogExcel(
  unitTypes: DbUnitType[],
  ethnicities: DbEthnicity[]
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ tay Đoàn viên';

  // Sheet 1: Loại chi đoàn
  const wsTypes = wb.addWorksheet('Loại chi đoàn');
  wsTypes.columns = [
    { header: 'Mã định danh (ID)', key: 'id', width: 20 },
    { header: 'Tên hiển thị Loại Chi đoàn', key: 'name', width: 30 },
  ];
  wsTypes.getRow(1).height = 26;
  wsTypes.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  unitTypes.forEach(t => wsTypes.addRow({ id: t.id, name: t.name }));

  // Sheet 2: Danh mục Dân tộc
  const wsEth = wb.addWorksheet('Danh mục Dân tộc');
  wsEth.columns = [
    { header: 'Mã (ID)', key: 'id', width: 12 },
    { header: 'Tên Dân tộc', key: 'name', width: 24 },
  ];
  wsEth.getRow(1).height = 26;
  wsEth.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ethnicities.forEach(e => wsEth.addRow({ id: e.id, name: e.name }));

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), `DanhMuc_CauHinh_DoanXa_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Tải file mẫu nhập thêm loại chi đoàn */
export async function downloadUnitTypeTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('LoaiChiDoan');

  ws.columns = [
    { header: 'Tên loại Chi đoàn mới (*)', key: 'name', width: 32 },
  ];

  ws.getRow(1).height = 26;
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5FBF' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  ws.addRow({ name: 'Khối Lực lượng vũ trang' });
  ws.addRow({ name: 'Khối Doanh nghiệp ngoài nhà nước' });

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf]), 'Mau_nhap_loai_chi_doan.xlsx');
}

export async function parseUnitTypesWorkbook(buffer: ArrayBuffer): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const list: string[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const val = ws.getCell(r, 1).value;
    const name = (val ? String(val).trim() : '');
    if (name) list.push(name);
  }
  return list;
}
