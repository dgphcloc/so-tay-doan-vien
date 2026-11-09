import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar } from '../components/common/Avatar';
import {
  ShieldCheck,
  User,
  Key,
  Check,
  X,
  Shield,
  Lock,
  UserCheck,
  Power,
  RotateCcw,
  Info,
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { RoleId } from '../types';
import {
  exportAccountsExcel,
  downloadAccountTemplate,
  parseAccountsWorkbook,
  type ParsedAccountRow,
} from '../utils/accountsExcel';

export const AccountsPage: React.FC = () => {
  const {
    profiles,
    members,
    updateProfileRole,
    toggleProfileActive,
    showToast,
    currentUser,
  } = useApp();

  // Excel state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedAccountRow[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importValidCount, setImportValidCount] = useState(0);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportAccountsExcel(profiles, members);
    showToast({ title: 'Đã xuất file Excel tài khoản', type: 'success' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const res = await parseAccountsWorkbook(buf, profiles);
      setImportRows(res.rows);
      setImportTotal(res.totalRows);
      setImportValidCount(res.validCount);
      setImportFileName(file.name);
      setIsImportModalOpen(true);
    } catch (err) {
      showToast({ title: 'Không đọc được file Excel', description: err instanceof Error ? err.message : '', type: 'error' });
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => r.isValid && r.matchedProfileId);
    if (validRows.length === 0) {
      showToast({ title: 'Không có dòng hợp lệ để cập nhật', type: 'error' });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    try {
      for (const row of validRows) {
        if (!row.matchedProfileId) continue;
        await updateProfileRole(row.matchedProfileId, row.roleId);
        successCount++;
      }
      showToast({
        title: 'Cập nhật phân quyền thành công!',
        description: `Đã cập nhật vai trò cho ${successCount} tài khoản.`,
        type: 'success',
      });
      setIsImportModalOpen(false);
      setImportRows([]);
    } catch (err) {
      showToast({ title: 'Có lỗi trong quá trình cập nhật', description: err instanceof Error ? err.message : '', type: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: RoleId) => {
    const isSelf = profileId === currentUser?.profileId;
    try {
      await updateProfileRole(profileId, newRole);
      showToast({
        title: 'Đã cập nhật vai trò',
        description: isSelf
          ? `Quyền của bạn đã đổi thành "${newRole}". Giao diện và menu sẽ cập nhật ngay.`
          : `Đã thay đổi quyền tài khoản thành "${newRole}".`,
        type: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Không cập nhật được vai trò',
        description: err instanceof Error ? err.message : 'Lỗi không xác định',
        type: 'error',
      });
    }
  };

  const handleToggleStatus = (profileId: string) => {
    toggleProfileActive(profileId);
    showToast({
      title: 'Đã đổi trạng thái tài khoản',
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#1F5FBF]" />
            Tài khoản & Phân quyền Quản trị
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Quản lý tài khoản cán bộ vận hành hệ thống và cấu hình ma trận phân quyền (RBAC)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button title="Xuất Excel"
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button title="Phân quyền bằng Excel"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#1F5FBF]" /> Phân quyền bằng Excel
          </button>
        </div>
      </div>

      {/* DANH SÁCH TÀI KHOẢN VẬN HÀNH */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Danh sách Tài khoản Cán bộ ({profiles.length})
          </h2>
          <span className="text-xs text-slate-500">
            Cấp tài khoản theo quy chế quản trị nội bộ Đoàn xã
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Cán bộ đảm nhiệm</th>
                <th className="p-3.5">Vai trò hệ thống</th>
                <th className="p-3.5">Mô tả thẩm quyền</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map(prof => {
                const mem = members.find(m => m.id === prof.member_id);

                return (
                  <tr key={prof.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={mem?.avatar_url}
                          name={mem?.full_name}
                          seed={mem?.id ?? prof.member_id}
                          size={32}
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{mem?.full_name || 'Cán bộ quản trị'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{prof.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <select
                        value={prof.role_id}
                        onChange={e => handleRoleChange(prof.id, e.target.value as RoleId)}
                        className="p-1.5 text-xs font-bold bg-blue-50 border border-blue-200 text-[#1F5FBF] rounded-lg focus:outline-none"
                      >
                        <option value="super_admin">super_admin (Quản trị viên tối cao)</option>
                        <option value="admin">admin (Bí thư Đoàn xã)</option>
                        <option value="staff">staff (Cán bộ theo dõi — chỉ đọc)</option>
                        <option value="unit_secretary">unit_secretary (Bí thư / Phó Bí thư chi đoàn)</option>
                        <option value="member">member (Đoàn viên)</option>
                      </select>
                    </td>

                    <td className="p-3.5 text-slate-600 max-w-sm">
                      {prof.role_id === 'super_admin' && (
                        <span>Toàn quyền phê duyệt, đóng nhiệm vụ, chốt tiêu chí và quản lý tài khoản.</span>
                      )}
                      {prof.role_id === 'admin' && (
                        <span>Phê duyệt nhiệm vụ, chấm tiêu chí, thêm thành viên. Không sửa phân quyền.</span>
                      )}
                      {prof.role_id === 'staff' && (
                        <span>Chỉ xem dữ liệu, che số điện thoại, không có quyền duyệt điểm và sửa cấu hình.</span>
                      )}
                      {prof.role_id === 'unit_secretary' && (
                        <span>Quản lý chi đoàn mình: tạo nhiệm vụ từ tiêu chí được giao, duyệt bài đoàn viên, nộp minh chứng chi đoàn.</span>
                      )}
                      {prof.role_id === 'member' && (
                        <span>Đoàn viên: nộp minh chứng cá nhân, xem bảng tin, sổ tay và đoàn phí của mình.</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center whitespace-nowrap">
                      {prof.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                          <Check className="w-3 h-3" /> Đang kích hoạt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] border border-slate-200">
                          <X className="w-3 h-3" /> Đã khóa
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        title="Bật / tắt quyền truy cập của tài khoản"
                        onClick={() => handleToggleStatus(prof.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          prof.is_active
                            ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                            : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        {prof.is_active ? 'Khóa tài khoản' : 'Mở khóa'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BẢNG MA TRẬN PHÂN QUYỀN HỆ THỐNG (RBAC MATRIX) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#1F5FBF]" />
            Ma trận Phân quyền Chức năng (RBAC)
          </h3>
          <span className="text-xs text-slate-400">
            Áp dụng tức thì khi chuyển đổi quyền tại thanh điều hướng trên cùng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 border-r border-slate-200">Tính năng / Thẩm quyền nghiệp vụ</th>
                <th className="p-3 text-center border-r border-slate-200 text-blue-700">Super Admin</th>
                <th className="p-3 text-center border-r border-slate-200 text-[#1F5FBF]">Admin</th>
                <th className="p-3 text-center text-slate-600">Staff (Theo dõi)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-100">
                  Xem Tổng quan, Báo cáo & Thống kê
                </td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center text-emerald-600 font-bold">✓ Cho phép</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-100">
                  Phê duyệt / Từ chối minh chứng nhiệm vụ & tiêu chí
                </td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center text-rose-500 font-bold">✕ Bị ẩn</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-100">
                  Tạo nhiệm vụ mới & Chốt bộ tiêu chí thi đua
                </td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center text-rose-500 font-bold">✕ Chỉ xem</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-100">
                  Xem số điện thoại đầy đủ của Đoàn viên
                </td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Đầy đủ</td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Đầy đủ</td>
                <td className="p-3 text-center text-amber-600 font-bold">Che 6 số giữa</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-900 border-r border-slate-100">
                  Cấu hình Niên độ, Loại chi đoàn & Phân quyền tài khoản
                </td>
                <td className="p-3 text-center border-r border-slate-100 text-emerald-600 font-bold">✓ Toàn quyền</td>
                <td className="p-3 text-center border-r border-slate-100 text-rose-500 font-bold">✕ Bị ẩn</td>
                <td className="p-3 text-center text-rose-500 font-bold">✕ Bị ẩn</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Đối soát phân quyền tài khoản ({importFileName})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tổng: <b>{importTotal}</b> dòng • <span className="text-emerald-700 font-bold">{importValidCount} hợp lệ</span> • <span className="text-rose-600 font-bold">{importTotal - importValidCount} lỗi / chưa đăng ký</span>
                </p>
              </div>
              <button title="Đóng"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2">
              <span className="text-blue-900 text-[11px]">
                Quy tắc: Khớp tài khoản theo Email. Vai trò trong file sẽ được gán đè cho tài khoản tương ứng.
              </span>
              <button title="Tải file mẫu"
                type="button"
                onClick={downloadAccountTemplate}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shrink-0 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-[#1F5FBF]" /> Tải file mẫu
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
              {importRows.map((row) => (
                <div
                  key={row.rowNum}
                  className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                    !row.isValid ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      Dòng {row.rowNum}: {row.email}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Vai trò mới: <b className="text-[#1F5FBF]">{row.roleLabel}</b> ({row.roleId}) • {row.isActive ? 'Kích hoạt' : 'Tạm khóa'}
                    </p>
                    {row.error && <p className="text-[10px] font-bold text-rose-600 mt-0.5">{row.error}</p>}
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    !row.isValid ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
                  }`}>
                    {!row.isValid ? 'Lỗi' : 'Sẵn sàng gán quyền'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">
                Sẵn sàng cập nhật {importValidCount} tài khoản hợp lệ
              </span>
              <div className="flex items-center gap-2">
                <button title="Hủy"
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button title="Đang xử lý"
                  type="button"
                  disabled={isImporting || importValidCount === 0}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isImporting ? 'Đang cập nhật…' : 'Xác nhận gán quyền'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
