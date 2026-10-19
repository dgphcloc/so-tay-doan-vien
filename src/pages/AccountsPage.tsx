import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
} from 'lucide-react';
import { RoleId } from '../types';

export const AccountsPage: React.FC = () => {
  const {
    profiles,
    members,
    updateProfileRole,
    toggleProfileActive,
    showToast,
  } = useApp();

  const handleRoleChange = (profileId: string, newRole: RoleId) => {
    updateProfileRole(profileId, newRole);
    showToast({
      title: 'Đã cập nhật vai trò',
      description: `Đã thay đổi quyền tài khoản thành "${newRole}".`,
      type: 'success',
    });
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
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-[#1F5FBF]" />
          Tài khoản & Phân quyền Quản trị
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Quản lý tài khoản cán bộ vận hành hệ thống và cấu hình ma trận phân quyền (RBAC)
        </p>
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
                        <img
                          src={mem?.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
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
                        <option value="super_admin">super_admin (Toàn quyền)</option>
                        <option value="admin">admin (Quản trị viên)</option>
                        <option value="staff">staff (Cán bộ theo dõi)</option>
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
    </div>
  );
};
