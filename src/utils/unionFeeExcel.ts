/**
 * XUẤT EXCEL SỔ THEO DÕI THU NỘP ĐOÀN PHÍ 12 THÁNG
 * Theo biểu mẫu chuẩn của Hướng dẫn 39-HD/TWĐTN-BKT.
 */
import ExcelJS from 'exceljs';
import type { DbMember, DbUnit, DbUnionFeePayment } from '../data/types';
import { downloadBlob } from './exportExcel';

export interface ExportUnionFeeExcelOptions {
  year: number;
  unitName?: string; // Tên chi đoàn (hoặc để trống nếu toàn xã)
  members: DbMember[];
  units: DbUnit[];
  payments: DbUnionFeePayment[];
}

export async function exportUnionFeeWorkbook(options: ExportUnionFeeExcelOptions): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ tay Đoàn viên - Đoàn xã Hòa Bình';
  wb.created = new Date();

  const ws = wb.addWorksheet(`Đoàn phí ${options.year}`, {
    views: [{ showGridLines: true }],
  });

  const unitMap = new Map(options.units.map(u => [u.id, u.name]));

  // Bản đồ thanh toán đã duyệt: member_id -> Set các tháng đã đóng
  const paidMonthsMap = new Map<string, Set<number>>();
  for (const p of options.payments) {
    if (p.year === options.year && p.status === 'approved') {
      const set = paidMonthsMap.get(p.member_id) || new Set<number>();
      for (const m of p.months) set.add(m);
      paidMonthsMap.set(p.member_id, set);
    }
  }

  // TIÊU ĐỀ BÁO CÁO
  ws.mergeCells('A1:R1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `SỔ THEO DÕI THU NỘP ĐOÀN PHÍ NĂM ${options.year}`.toUpperCase();
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F5FBF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:R2');
  const subCell = ws.getCell('A2');
  subCell.value = `Đơn vị: ${options.unitName || 'Toàn xã Hòa Bình'} · Mức thu: 2.000đ/tháng (không lương), 5.000đ/tháng (có lương)`;
  subCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // DÒNG HEADER BẢNG
  const headers = [
    'STT',
    'Họ và tên đoàn viên',
    'Chi đoàn',
    'Đối tượng',
    'Mức/tháng',
    'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
    'Tổng thu (đ)',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F5FBF' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // ĐIỀN DỮ LIỆU ĐOÀN VIÊN
  let stt = 1;
  for (const m of options.members) {
    const ratePerMonth = m.has_salary ? 5000 : 2000;
    const paidSet = paidMonthsMap.get(m.id) || new Set<number>();
    const exemptSet = new Set(m.exempt_months || []);
    const joinedYear = m.joined_date ? Number(m.joined_date.slice(0, 4)) : 0;
    const joinedMonth = m.joined_date ? Number(m.joined_date.slice(5, 7)) : 0;
    const transferOut = m.transferred_out_month || 99;

    let totalCollected = 0;
    const monthCols: string[] = [];

    for (let month = 1; month <= 12; month++) {
      if (joinedYear === options.year && month < joinedMonth) {
        monthCols.push('-'); // Chưa vào Đoàn
      } else if (month >= transferOut) {
        monthCols.push('Chuyển'); // Đã chuyển sinh hoạt đi
      } else if (exemptSet.has(month)) {
        monthCols.push('Miễn'); // Được xét miễn hộ nghèo
      } else if (paidSet.has(month)) {
        monthCols.push('X'); // Đã nộp
        totalCollected += ratePerMonth;
      } else {
        monthCols.push(''); // Chưa nộp
      }
    }

    const row = ws.addRow([
      stt++,
      m.full_name,
      unitMap.get(m.unit_id) || 'Cơ sở',
      m.has_salary ? 'Có lương' : 'Không lương',
      ratePerMonth,
      ...monthCols,
      totalCollected,
    ]);

    row.height = 20;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (colNumber === 2) cell.alignment = { horizontal: 'left', vertical: 'middle' };
      if (colNumber >= 3 && colNumber <= 5) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (colNumber >= 6 && colNumber <= 17) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (cell.value === 'X') {
          cell.font = { bold: true, color: { argb: 'FF047857' } }; // Xanh lá
        } else if (cell.value === 'Miễn') {
          cell.font = { bold: true, color: { argb: 'FF1D4ED8' } }; // Xanh dương
        }
      }
      if (colNumber === 18) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
        cell.font = { bold: true };
      }
    });
  }

  // ĐỊNH DẠNG ĐỘ RỘNG CỘT
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 12;
  for (let c = 6; c <= 17; c++) {
    ws.getColumn(c).width = 5;
  }
  ws.getColumn(18).width = 16;

  // XUẤT VÀ TẢI FILE
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const fileName = `So_Theo_Doi_Doan_Phi_${options.year}_${options.unitName ? options.unitName.replace(/\s+/g, '_') : 'Toan_Xa'}.xlsx`;
  downloadBlob(blob, fileName);
}
