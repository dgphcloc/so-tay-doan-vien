import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  History,
  Calendar,
  User,
  Search,
  Filter,
  Download,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { formatDateTimeVN } from '../mock/data';
import { exportExcel } from '../utils/exportExcel';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs, members, showToast } = useApp();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Search in action, table_name, new_value
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchAction = log.action.toLowerCase().includes(query);
        const matchTable = log.table_name.toLowerCase().includes(query);
        const matchValue = (log.new_value || '').toLowerCase().includes(query);
        if (!matchAction && !matchTable && !matchValue) return false;
      }

      // Action Filter
      if (actionFilter !== 'all') {
        if (actionFilter === 'approve' && !log.action.toLowerCase().includes('duyệt')) return false;
        if (actionFilter === 'reject' && !log.action.toLowerCase().includes('từ chối')) return false;
        if (actionFilter === 'create' && !log.action.toLowerCase().includes('tạo') && !log.action.toLowerCase().includes('thêm')) return false;
        if (actionFilter === 'update' && !log.action.toLowerCase().includes('cập nhật') && !log.action.toLowerCase().includes('sửa')) return false;
      }

      // Actor Filter
      if (actorFilter !== 'all' && log.actor_id !== actorFilter) return false;

      return true;
    });
  }, [auditLogs, search, actionFilter, actorFilter]);

  const handleExportLogs = async () => {
    const rows = filteredLogs.map(log => ({
      time: formatDateTimeVN(log.created_at),
      actor: members.find(m => m.id === log.actor_id)?.full_name || 'Bí thư Đoàn',
      role: log.actor_role,
      action: log.action,
      table: log.table_name,
      detail: log.new_value || '',
    }));
    await exportExcel({
      fileName: `Nhat_ky_he_thong_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Nhật ký',
      title: 'NHẬT KÝ THAO TÁC HỆ THỐNG',
      columns: [
        { header: 'Thời gian', key: 'time', width: 18 },
        { header: 'Người thực hiện', key: 'actor', width: 22 },
        { header: 'Vai trò', key: 'role', width: 14 },
        { header: 'Hành động', key: 'action', width: 26 },
        { header: 'Bảng dữ liệu', key: 'table', width: 20 },
        { header: 'Chi tiết thay đổi', key: 'detail', width: 50 },
      ],
      rows,
    });
    showToast({
      title: 'Đã xuất nhật ký',
      description: `${filteredLogs.length} dòng theo bộ lọc hiện tại.`,
      type: 'success',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-[#1F5FBF]" />
            Nhật ký Thao tác Hệ thống (Audit Logs)
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Theo dõi chi tiết mọi thay đổi dữ liệu, hành động duyệt, từ chối và quản trị của cán bộ
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportLogs}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" /> Xuất nhật ký (Excel)
        </button>
      </div>

      {/* THANH TÌM KIẾM & BỘ LỌC */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung thay đổi, hành động, bảng dữ liệu..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lọc hành động */}
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="all">Mọi loại hành động</option>
            <option value="approve">Chỉ thao tác Phê duyệt</option>
            <option value="reject">Chỉ thao tác Từ chối</option>
            <option value="create">Tạo mới / Thêm</option>
            <option value="update">Cập nhật / Chỉnh sửa</option>
          </select>

          {/* Lọc người thực hiện */}
          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
          >
            <option value="all">Mọi cán bộ thực hiện</option>
            {members.slice(0, 15).map(m => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BẢNG NHẬT KÝ CHI TIẾT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 whitespace-nowrap">Thời gian</th>
                <th className="p-3.5 whitespace-nowrap">Người thực hiện</th>
                <th className="p-3.5">Hành động</th>
                <th className="p-3.5 whitespace-nowrap">Bảng dữ liệu</th>
                <th className="p-3.5">Chi tiết thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Không tìm thấy bản ghi nhật ký nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const actor = members.find(m => m.id === log.actor_id);
                  const isApprove = log.action.toLowerCase().includes('duyệt');
                  const isReject = log.action.toLowerCase().includes('từ chối');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDateTimeVN(log.created_at)}
                      </td>

                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <div>
                          <span>{actor?.full_name || 'Bí thư Đoàn'}</span>
                          <span className="block text-[10px] text-[#1F5FBF] font-mono font-normal">
                            vai trò: {log.actor_role}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            isApprove
                              ? 'bg-emerald-100 text-emerald-800'
                              : isReject
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-[#1F5FBF]'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                          {log.table_name}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-700 max-w-md font-mono text-[11px]">
                        <div className="line-clamp-2" title={log.new_value || ''}>
                          {log.new_value}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
