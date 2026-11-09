import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { supabase, dataSource } from '../../data';
import { RoleId } from '../../types';
import {
  Bell,
  Search,
  Calendar,
  Shield,
  UserCheck,
  Check,
  ChevronDown,
  Layers,
  Flag,
  FileCheck2,
  ExternalLink,
  LogOut,
  X,
  AlertCircle,
} from 'lucide-react';
import { formatDateTimeVN } from '../../mock/data';
import type { Notification } from '../../types';
import { Link, useNavigate } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    currentMember,
    selectedYear,
    setSelectedYear,
    globalSearch,
    setGlobalSearch,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    pendingCount,
    showToast,
    units,
  } = useApp();

  // Tên vai trò tiếng Việt để hiển thị
  const ROLE_LABEL: Record<RoleId, string> = {
    super_admin: 'Quản trị viên tối cao',
    admin: 'Bí thư Đoàn xã',
    staff: 'Cán bộ Đoàn xã',
    unit_secretary: 'Bí thư Chi đoàn',
    member: 'Đoàn viên',
  };
  // Tên hiển thị: ưu tiên hồ sơ đoàn viên gắn tài khoản, sau đó email, cuối cùng là "Người dùng"
  const displayName = currentMember?.full_name ?? currentUser?.email ?? 'Người dùng';
  const roleLabel = ROLE_LABEL[currentRole] ?? 'Người dùng';
  const avatarUrl = currentMember?.avatar_url ?? null;
  // Bí thư chi đoàn / đoàn viên: hiện thêm đang thuộc chi đoàn nào
  const myUnitName = currentMember
    ? (units.find(u => u.id === currentMember.unit_id)?.name ?? '')
    : '';
  const showUnitLine = (currentRole === 'unit_secretary' || currentRole === 'member') && !!myUnitName;

  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotifDetail, setSelectedNotifDetail] = useState<Notification | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rolesConfig: Array<{ id: RoleId; label: string; desc: string }> = [
    { id: 'super_admin', label: 'Quản trị viên tối cao (Super Admin)', desc: 'Thấy toàn bộ 11 chức năng hệ thống' },
    { id: 'admin', label: 'Quản trị viên Đoàn xã (Admin)', desc: 'Ẩn: Tài khoản & quyền, Nhật ký' },
    { id: 'staff', label: 'Cán bộ theo dõi (Staff)', desc: 'Chỉ đọc 6 mục, ẩn Chờ duyệt/Cấu hình, che 6 số giữa SĐT' },
  ];

  const handleSelectRole = (newRole: RoleId) => {
    setCurrentRole(newRole);
    setShowRoleMenu(false);
    showToast({
      title: 'Đã chuyển góc nhìn quyền',
      description: `Đang xem với quyền: ${rolesConfig.find(r => r.id === newRole)?.label}`,
      type: 'info',
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-3">
        {/* Logo & App Name */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-2.5 text-slate-800 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#1F5FBF] to-[#2563eb] text-white flex items-center justify-center shadow-xs">
              <Flag className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900 leading-none">
                  Sổ tay Đoàn viên
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-100 text-[#1F5FBF]">
                  Quản trị
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">Đoàn Thanh niên xã Hòa Bình</span>
            </div>
          </Link>
        </div>

        {/* Ô tìm kiếm toàn cục đã bỏ: mỗi trang có ô tìm riêng.
            Chừa khoảng trống để nhóm bên phải vẫn dạt phải. */}
        <div className="hidden sm:block flex-1" />

        {/* Right Action Group */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Quyền Demo Switcher — chỉ hiện ở chế độ mock (chưa cấu hình Supabase).
              Trước đây điều kiện là `!currentUser`, nên khi session Supabase còn
              nhưng đọc bảng profiles lỗi thì thanh mô phỏng hiện nhầm trên app thật. */}
          {dataSource === 'mock' && (
          <div className="relative" ref={roleRef}>
            <button
              type="button"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs md:text-sm font-medium bg-blue-50/80 hover:bg-blue-100 text-[#1F5FBF] border border-blue-200/80 rounded-lg transition-colors cursor-pointer"
              title="Chuyển quyền để xem mô phỏng phân quyền menu"
            >
              <Shield className="w-3.5 h-3.5 text-[#1F5FBF]" />
              <span className="hidden xl:inline">Xem với quyền:</span>
              <span className="font-semibold capitalize">
                {currentRole === 'super_admin' ? 'Super Admin' : currentRole === 'admin' ? 'Admin' : 'Staff'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#1F5FBF]" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mô phỏng phân quyền</p>
                  <p className="text-xs text-slate-500 mt-0.5">Chọn vai trò để kiểm tra hiển thị menu</p>
                </div>
                <div className="py-1">
                  {rolesConfig.map(r => (
                    <button title="Xác nhận"
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectRole(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition-colors cursor-pointer ${
                        currentRole === r.id ? 'bg-blue-50 text-[#1F5FBF] font-semibold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{r.label}</span>
                        {currentRole === r.id && <Check className="w-4 h-4 text-[#1F5FBF]" />}
                      </div>
                      <span className="text-[11px] text-slate-400 font-normal">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button title="Xem thông báo"
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Thông báo"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-0 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Thông báo hệ thống</span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {unreadCount} mới
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button title="Đã đọc tất cả"
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-[#1F5FBF] hover:underline cursor-pointer font-medium"
                    >
                      Đã đọc tất cả
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">Không có thông báo nào</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          if (n.type === 'review_request') {
                            setShowNotifications(false);
                            navigate('/duyet');
                          } else {
                            setSelectedNotifDetail(n);
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${
                          !n.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {n.level === 'red' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block ring-2 ring-red-100" />
                          ) : n.level === 'orange' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block ring-2 ring-orange-100" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ring-2 ring-blue-100" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                        </div>
                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationAsRead(n.id);
                            }}
                            className="shrink-0 p-1 text-slate-400 hover:text-[#1F5FBF] hover:bg-slate-100 rounded"
                            title="Đánh dấu đã đọc"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {pendingCount > 0 && currentRole !== 'staff' && (
                  <div className="p-2.5 bg-blue-50/80 border-t border-blue-100 text-center">
                    <Link
                      to="/duyet"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-semibold text-[#1F5FBF] hover:underline inline-flex items-center gap-1.5"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Đi đến trang Chờ duyệt ({pendingCount} mục)
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={userRef}>
            <button title="Mở rộng / Thu gọn"
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Avatar src={avatarUrl} name={currentMember?.full_name} seed={currentUser?.profileId ?? currentMember?.id} size={32} ring />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">{displayName}</span>
                <span className="text-[11px] text-slate-500 truncate max-w-[10rem]">
                  {showUnitLine ? myUnitName : roleLabel}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{displayName}</p>
                  {currentUser?.email && (
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  )}
                  {showUnitLine && (
                    <p className="text-[11px] text-slate-600 font-semibold truncate">{myUnitName}</p>
                  )}
                  <p className="text-[11px] text-slate-500">Đoàn TNCS Hồ Chí Minh xã Hòa Bình</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold bg-blue-100 text-[#1F5FBF] px-1.5 py-0.5 rounded">
                    {roleLabel} • Đang trực tuyến
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    to="/ban-chap-hanh"
                    onClick={() => setShowUserMenu(false)}
                    className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    Xem hồ sơ BCH Đoàn xã
                  </Link>
                  <Link
                    to="/cau-hinh"
                    onClick={() => setShowUserMenu(false)}
                    className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-md"
                  >
                    Thiết lập hệ thống
                  </Link>
                </div>
                {/* Chỉ cần có Supabase là luôn có đường đăng xuất — kể cả khi
                    trạng thái đăng nhập đang lỗi, người dùng vẫn thoát ra được. */}
                {supabase && (
                  <div className="pt-1 border-t border-slate-100">
                    <button title="Đăng xuất"
                      type="button"
                      onClick={() => supabase?.auth.signOut()}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: XEM CHI TIẾT THÔNG BÁO TỪ CHUÔNG — dùng createPortal để gắn trực tiếp vào body, không bị co lại trong header */}
      {selectedNotifDetail && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    selectedNotifDetail.level === 'red'
                      ? 'bg-red-500 ring-4 ring-red-100'
                      : selectedNotifDetail.level === 'orange'
                      ? 'bg-orange-500 ring-4 ring-orange-100'
                      : 'bg-blue-500 ring-4 ring-blue-100'
                  }`}
                />
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{selectedNotifDetail.title}</h3>
              </div>
              <button title="Đóng"
                type="button"
                onClick={() => setSelectedNotifDetail(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                <span>Thời gian gửi:</span>
                <span className="font-mono text-slate-700 font-semibold">{formatDateTimeVN(selectedNotifDetail.created_at)}</span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Nội dung thông báo:</span>
                <div className="p-3.5 bg-blue-50/40 border border-blue-200/80 rounded-xl text-slate-800 leading-relaxed whitespace-pre-wrap font-medium max-h-60 overflow-y-auto">
                  {selectedNotifDetail.body}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {selectedNotifDetail.task_id && (
                <button title="Xem nhiệm vụ"
                  type="button"
                  onClick={() => {
                    const tId = selectedNotifDetail.task_id;
                    setSelectedNotifDetail(null);
                    navigate(currentRole === 'member' ? `/nop-ca-nhan?task=${tId}` : '/nhiem-vu');
                  }}
                  className="px-3 py-1.5 font-bold text-[#1F5FBF] bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  Xem nhiệm vụ <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
              <button title="Đóng"
                type="button"
                onClick={() => setSelectedNotifDetail(null)}
                className="px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
