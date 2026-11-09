import ExcelJS from 'exceljs';
import { downloadBlob } from './exportExcel';

export interface TemplateUnitOption {
  id: string;
  name: string;
}

/**
 * Sinh và tải về file Excel mẫu chuẩn để nhập danh sách đoàn viên.
 * Có sẵn tiêu đề chuẩn, dropdown chọn chi đoàn và 3 dòng dữ liệu ví dụ.
 */
export async function downloadMemberTemplate(units: TemplateUnitOption[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ tay Đoàn viên';
  wb.created = new Date();

  // Sheet 1: Danh sách đoàn viên
  const ws = wb.addWorksheet('Danh sách đoàn viên', {
    views: [{ showGridLines: true }],
  });

  const columns = [
    { header: 'Họ và tên (*)', key: 'full_name', width: 26 },
    { header: 'Ngày sinh (*)', key: 'birth_date', width: 14 },
    { header: 'Giới tính (*)', key: 'gender', width: 12 },
    { header: 'Chi đoàn (*)', key: 'unit_name', width: 28 },
    { header: 'Chức vụ', key: 'current_position', width: 16 },
    { header: 'Số điện thoại', key: 'phone', width: 15 },
    { header: 'Ngày vào Đoàn', key: 'joined_date', width: 15 },
    { header: 'Trình độ học vấn', key: 'education_grade', width: 18 },
    { header: 'Chuyên môn', key: 'specialization', width: 20 },
    { header: 'Lý luận chính trị', key: 'political_theory', width: 18 },
    { header: 'Dân tộc', key: 'ethnicity', width: 14 },
    { header: 'Tôn giáo', key: 'religion', width: 14 },
    { header: 'Đảng viên', key: 'is_party', width: 12 },
    { header: 'Đoàn viên ưu tú', key: 'is_elite', width: 18 },
    { header: 'Ghi chú', key: 'note', width: 25 },
  ];
  ws.columns = columns;

  // Định dạng dòng tiêu đề (Header row 1)
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F5FBF' },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFF' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'medium', color: { argb: '0F3D82' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } },
    };
  });

  // Tên chi đoàn mặc định
  const sampleUnit1 = units[0]?.name || 'Chi đoàn ấp 1';
  const sampleUnit2 = units[1]?.name || 'Chi đoàn ấp 2';
  const sampleUnit3 = units[2]?.name || sampleUnit1;

  // Dữ liệu mẫu (3 dòng minh họa thực tế)
  const sampleRows = [
    {
      full_name: 'Nguyễn Văn An',
      birth_date: '15/05/2002',
      gender: 'Nam',
      unit_name: sampleUnit1,
      current_position: 'Bí thư',
      phone: '0912345678',
      joined_date: '26/03/2018',
      education_grade: '12/12',
      specialization: 'Đại học Luật',
      political_theory: 'Sơ cấp',
      ethnicity: 'Kinh',
      religion: 'Không',
      is_party: 'Có',
      is_elite: 'Có',
      note: 'Đoàn viên tiêu biểu',
    },
    {
      full_name: 'Trần Thị Bích',
      birth_date: '20/11/2004',
      gender: 'Nữ',
      unit_name: sampleUnit2,
      current_position: 'Phó Bí thư',
      phone: '0987654321',
      joined_date: '19/05/2020',
      education_grade: '12/12',
      specialization: 'Cao đẳng Y tế',
      political_theory: 'Không',
      ethnicity: 'Kinh',
      religion: 'Không',
      is_party: 'Không',
      is_elite: 'Có',
      note: '',
    },
    {
      full_name: 'Thạch Minh Trí',
      birth_date: '08/08/2005',
      gender: 'Nam',
      unit_name: sampleUnit3,
      current_position: 'Đoàn viên',
      phone: '0901234567',
      joined_date: '26/03/2021',
      education_grade: '12/12',
      specialization: 'Công nhân cơ khí',
      political_theory: 'Không',
      ethnicity: 'Khmer',
      religion: 'Không',
      is_party: 'Không',
      is_elite: 'Không',
      note: '',
    },
  ];

  sampleRows.forEach((rowData) => {
    const r = ws.addRow(rowData);
    r.height = 22;
    r.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E5E7EB' } },
        left: { style: 'thin', color: { argb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
        right: { style: 'thin', color: { argb: 'E5E7EB' } },
      };
    });
  });

  // Sheet 2: Danh sách Chi đoàn làm nguồn cho Data Validation (dropdown)
  if (units.length > 0) {
    const wsRef = wb.addWorksheet('DanhMuc_ChiDoan');
    wsRef.state = 'hidden'; // ẩn sheet tham chiếu để giao diện gọn gàng
    wsRef.getColumn(1).values = ['Danh sách Chi đoàn', ...units.map(u => u.name)];

    const maxDataRows = 500; // Áp dụng validation cho 500 dòng đầu
    const unitFormula = `DanhMuc_ChiDoan!$A$2:$A$${units.length + 1}`;

    for (let r = 2; r <= maxDataRows; r++) {
      // Dropdown Chi đoàn (cột D = 4)
      ws.getCell(r, 4).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [unitFormula],
        errorStyle: 'warning',
        errorTitle: 'Chi đoàn chưa có',
        error: 'Nếu đây là chi đoàn mới, hệ thống sẽ tự động tạo mới chi đoàn này khi import.',
      };

      // Dropdown Giới tính (cột C = 3)
      ws.getCell(r, 3).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"Nam,Nữ,Khác"'],
      };

      // Dropdown Chức vụ (cột E = 5)
      ws.getCell(r, 5).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Đoàn viên,Bí thư,Phó Bí thư"'],
      };

      // Dropdown Đảng viên (cột M = 13)
      ws.getCell(r, 13).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Có,Không"'],
      };

      // Dropdown Đoàn viên ưu tú (cột N = 14)
      ws.getCell(r, 14).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Có,Không"'],
      };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, 'Mau_nhap_danh_sach_doan_vien.xlsx');
}
