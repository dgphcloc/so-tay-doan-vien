/**
 * Xuất PDF không cần thư viện ngoài: dựng một trang HTML in được rồi gọi
 * hộp thoại In của trình duyệt (người dùng chọn "Lưu thành PDF").
 *
 * Ưu điểm: không thêm dependency, chữ tiếng Việt hiển thị đúng, kết quả giống
 * bản xem trước. Nhược điểm: người dùng phải bấm "Save as PDF" trong hộp thoại in
 * thay vì tải thẳng file.
 */

export interface PdfTableColumn {
  header: string;
  key: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PdfOptions {
  title: string;
  subtitle?: string;
  /** Đơn vị ban hành, hiện ở góc trên bên trái. */
  organization?: string;
  columns: PdfTableColumn[];
  rows: Array<Record<string, string | number>>;
  /** Ghi chú cuối trang. */
  footerNote?: string;
}

const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Mở cửa sổ in với nội dung bảng. Trả về false nếu trình duyệt chặn popup. */
export function exportPdf(opts: PdfOptions): boolean {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;

  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const headerRow = opts.columns
    .map(c => `<th style="width:${c.width ?? 'auto'};text-align:${c.align ?? 'left'}">${escapeHtml(c.header)}</th>`)
    .join('');

  const bodyRows = opts.rows
    .map(r => `<tr>${opts.columns.map(c => {
      const v = r[c.key];
      return `<td style="text-align:${c.align ?? 'left'}">${escapeHtml(v)}</td>`;
    }).join('')}</tr>`)
    .join('');

  win.document.write(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", "DejaVu Serif", serif;
    color: #111;
    margin: 0;
    font-size: 12pt;
  }
  .org { font-size: 11pt; text-align: left; margin-bottom: 2mm; }
  .org .name { font-weight: bold; text-transform: uppercase; }
  h1 { font-size: 15pt; text-align: center; margin: 4mm 0 1mm; text-transform: uppercase; }
  .subtitle { text-align: center; font-size: 11pt; margin-bottom: 5mm; font-style: italic; }
  .meta { text-align: right; font-size: 10pt; margin-bottom: 4mm; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  th, td { border: 1px solid #444; padding: 2mm 2mm; vertical-align: top; }
  th { background: #eef2f7; font-weight: bold; }
  tr:nth-child(even) td { background: #fafafa; }
  .note { margin-top: 5mm; font-size: 10pt; font-style: italic; }
  .sign { margin-top: 10mm; display: flex; justify-content: flex-end; }
  .sign div { text-align: center; width: 60mm; }
  .sign .role { font-weight: bold; }
  .sign .space { height: 20mm; }
  .toolbar {
    position: fixed; top: 0; left: 0; right: 0; padding: 8px 12px;
    background: #1F5FBF; color: #fff; font-family: system-ui, sans-serif;
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    font-size: 13px;
  }
  .toolbar button {
    background: #fff; color: #1F5FBF; border: 0; padding: 6px 14px;
    border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;
  }
  .toolbar .hint { opacity: .9; }
  @media print {
    .toolbar { display: none; }
    body { padding-top: 0; }
  }
  body { padding-top: 46px; }
</style>
</head>
<body>
  <div class="toolbar">
    <span class="hint">Chọn "Lưu thành PDF" (Save as PDF) trong hộp thoại in để tải file.</span>
    <button onclick="window.print()">In / Lưu PDF</button>
  </div>

  <div class="org">
    ${opts.organization ? `<div class="name">${escapeHtml(opts.organization)}</div>` : ''}
    <div>Số: ....../BC-ĐTN</div>
  </div>

  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<div class="subtitle">${escapeHtml(opts.subtitle)}</div>` : ''}
  <div class="meta">Ngày ${escapeHtml(dateStr)}</div>

  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>

  ${opts.footerNote ? `<div class="note">${escapeHtml(opts.footerNote)}</div>` : ''}

  <div class="sign">
    <div>
      <div class="role">BÍ THƯ ĐOÀN XÃ</div>
      <div class="space"></div>
    </div>
  </div>

  <script>
    // Tự mở hộp thoại in sau khi trang tải xong
    window.onload = function () { setTimeout(function () { window.print(); }, 300); };
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
