/**
 * Tiện ích xuất Excel (.xlsx) bằng exceljs.
 * Tạo workbook, ghi tiêu đề + dữ liệu, rồi tải xuống qua thẻ <a download>.
 */
import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  /** Khoá lấy giá trị từ mỗi dòng (hoặc hàm tự tính). */
  key: string | ((row: Record<string, unknown>) => string | number);
  width?: number;
}

/** Tải một Blob thành file trên máy người dùng. */
export function downloadBlob(blob: Blob, fileName: string): void {
  // Làm sạch tên file: bỏ ký tự cấm trên Windows
  const safe = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportOptions {
  fileName: string;
  sheetName?: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  /** Tiêu đề lớn in ở dòng đầu (tùy chọn). */
  title?: string;
}

/** Tạo file Excel và tải xuống. */
export async function exportExcel(opts: ExportOptions): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.sheetName ?? 'Sheet1');

  const nCols = opts.columns.length;
  let headerRowIdx = 1;

  // Tiêu đề lớn (gộp ô)
  if (opts.title) {
    ws.mergeCells(1, 1, 1, nCols);
    const cell = ws.getCell(1, 1);
    cell.value = opts.title;
    cell.font = { bold: true, size: 14 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 24;
    headerRowIdx = 3; // chừa 1 dòng trống
  }

  // Dòng tiêu đề cột
  const headerRow = ws.getRow(headerRowIdx);
  opts.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  headerRow.commit();

  // Độ rộng cột
  opts.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? Math.max(12, c.header.length + 4);
  });

  // Dữ liệu
  for (const row of opts.rows) {
    const values = opts.columns.map((c) =>
      typeof c.key === 'function' ? c.key(row) : (row[c.key] as string | number)
    );
    const r = ws.addRow(values);
    r.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), opts.fileName);
}
