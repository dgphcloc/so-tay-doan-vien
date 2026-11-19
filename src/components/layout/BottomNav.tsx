import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { canAccessRoute } from "../../utils/permissions";
import {
  LayoutDashboard,
  FileCheck2,
  CheckSquare,
  Building2,
  Menu,
  X,
  Award,
  BellRing,
  Users,
  UserCheck,
  BarChart3,
  Sliders,
  ShieldCheck,
  History,
  Upload,
  Camera,
  Newspaper,
  UserCircle,
  BookOpen,
  BadgeCheck,
  CreditCard,
  ClipboardList,
  QrCode,
  Sparkles,
} from "lucide-react";

type NavItem = {
  id: string;
  to: string;
  label: string;
  tabLabel?: string; // nhãn ngắn cho thanh đáy
  icon: React.ComponentType<{ className?: string }>;
  allowed: boolean;
  end?: boolean;
  badge?: boolean; // hiện số chờ duyệt
};

export const BottomNav: React.FC = () => {
  const { currentRole, pendingCount } = useApp();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const is = (...roles: string[]) => roles.includes(currentRole);
  const adminLevel = is("admin", "super_admin");

  // Toàn bộ mục, khai báo một lần; quyền xem khớp với Sidebar
  const items: Record<string, NavItem> = useMemo(() => {
    const list: NavItem[] = [
      {
        id: "overview",
        to: "/",
        label: "Tổng quan",
        icon: LayoutDashboard,
        allowed: true,
        end: true,
      },
      {
        id: "submit",
        to: "/nop-minh-chung",
        label: "Nộp minh chứng",
        tabLabel: "Minh chứng",
        icon: Upload,
        allowed: is("unit_secretary"),
      },
      {
        id: "personal",
        to: "/nop-ca-nhan",
        label: "Nộp cá nhân",
        icon: Camera,
        allowed: is("unit_secretary", "member") || adminLevel,
      },
      {
        id: "feed",
        to: "/bang-tin",
        label: "Bảng tin",
        icon: Newspaper,
        allowed: canAccessRoute(currentRole, "/bang-tin"),
      },
      {
        id: "review",
        to: "/duyet",
        label: "Chờ duyệt",
        icon: FileCheck2,
        allowed: is("unit_secretary") || adminLevel,
        badge: true,
      },
      {
        id: "tasks",
        to: "/nhiem-vu",
        label: "Nhiệm vụ",
        icon: CheckSquare,
        allowed: canAccessRoute(currentRole, "/nhiem-vu"),
      },
      {
        id: "criteria",
        to: "/tieu-chi",
        label: "Tiêu chí",
        icon: Award,
        allowed: canAccessRoute(currentRole, "/tieu-chi"),
      },
      {
        id: "evaluation",
        to: "/danh-gia",
        label: "Đánh giá",
        icon: BadgeCheck,
        allowed: true,
      },
      {
        id: "union_fee",
        to: "/doan-phi",
        label: "Đoàn phí",
        icon: CreditCard,
        allowed: true,
      },
      {
        id: "reminders",
        to: "/nhac-nho",
        label: "Nhắc nhở",
        icon: BellRing,
        allowed: canAccessRoute(currentRole, "/nhac-nho"),
      },
      {
        id: "units",
        to: "/chi-doan",
        label: "Chi đoàn",
        icon: Building2,
        allowed: is("unit_secretary", "staff") || adminLevel,
      },
      {
        id: "members",
        to: "/doan-vien",
        label: "Đoàn viên",
        icon: Users,
        allowed: canAccessRoute(currentRole, "/doan-vien"),
      },
      {
        id: "committee",
        to: "/ban-chap-hanh",
        label: "Ban chấp hành",
        icon: UserCheck,
        allowed: canAccessRoute(currentRole, "/ban-chap-hanh"),
      },
      {
        id: "reports",
        to: "/bao-cao",
        label: "Báo cáo",
        icon: BarChart3,
        allowed: canAccessRoute(currentRole, "/bao-cao"),
      },
      {
        id: "unit_report",
        to: "/bao-cao-chi-doan",
        label: "Báo cáo chi đoàn",
        icon: ClipboardList,
        allowed: true,
      },
      { id: "qr", to: "/tao-qr", label: "Tạo QR", icon: QrCode, allowed: true },
      {
        id: "setup",
        to: "/thiet-lap",
        label: "Thiết lập ban đầu",
        icon: Sparkles,
        allowed: adminLevel,
      },
      {
        id: "config",
        to: "/cau-hinh",
        label: "Cấu hình",
        icon: Sliders,
        allowed: canAccessRoute(currentRole, "/cau-hinh"),
      },
      {
        id: "accounts",
        to: "/tai-khoan",
        label: "Tài khoản & quyền",
        icon: ShieldCheck,
        allowed: is("super_admin"),
      },
      {
        id: "logs",
        to: "/nhat-ky",
        label: "Nhật ký",
        icon: History,
        allowed: is("super_admin"),
      },
      {
        id: "profile",
        to: "/ho-so",
        label: "Hồ sơ của tôi",
        icon: UserCircle,
        allowed: canAccessRoute(currentRole, "/ho-so"),
      },
      {
        id: "journal",
        to: "/so-tay",
        label: "Sổ tay",
        icon: BookOpen,
        allowed: canAccessRoute(currentRole, "/so-tay"),
      },
    ];
    return Object.fromEntries(list.map((i) => [i.id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  // 4 ô đầu của thanh đáy theo vai trò (ô thứ 5 luôn là "Menu")
  const TABS_BY_ROLE: Record<string, string[]> = {
    member: ["overview", "feed", "personal", "journal"],
    unit_secretary: ["overview", "review", "submit", "tasks"],
    staff: ["overview", "tasks", "units", "members"],
    admin: ["overview", "review", "tasks", "units"],
    super_admin: ["overview", "review", "tasks", "units"],
  };

  const tabItems = (TABS_BY_ROLE[currentRole] ?? ["overview"])
    .map((id) => items[id])
    .filter((i) => i && i.allowed);

  // Các nhóm trong bảng "Menu"; mục nào đã có trên thanh đáy vẫn hiện để dễ tìm
  const sheetGroups = [
    {
      title: "Công việc",
      ids: [
        "submit",
        "personal",
        "feed",
        "review",
        "tasks",
        "criteria",
        "evaluation",
        "union_fee",
        "reminders",
      ],
    },
    { title: "Tổ chức", ids: ["units", "members", "committee"] },
    { title: "Báo cáo", ids: ["reports", "unit_report"] },
    { title: "Tiện ích", ids: ["qr"] },
    { title: "Hệ thống", ids: ["setup", "config", "accounts", "logs"] },
    { title: "Cá nhân", ids: ["profile", "journal"] },
  ]
    .map((g) => ({
      title: g.title,
      items: g.ids.map((id) => items[id]).filter((i) => i && i.allowed),
    }))
    .filter((g) => g.items.length > 0);

  // Đổi trang thì đóng bảng; Esc để đóng; khóa cuộn nền khi mở
  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showMoreMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMoreMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [showMoreMenu]);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 px-1 text-[10px] font-medium transition-colors relative ${
      isActive ? "text-doan font-bold" : "text-slate-500 hover:text-slate-900"
    }`;

  return (
    <>
      <nav
        aria-label="Điều hướng chính"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg safe-area-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch text-center max-w-xl mx-auto">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.end}
                className={navItemClass}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-3 min-w-4 px-1 text-[10px] leading-4 font-bold rounded-full bg-red-500 text-white">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </div>
                <span className="leading-tight">
                  {item.tabLabel ?? item.label}
                </span>
              </NavLink>
            );
          })}

          <button
            title="Menu"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={showMoreMenu}
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 px-1 text-[10px] font-medium cursor-pointer ${
              showMoreMenu
                ? "text-doan font-bold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="leading-tight">Menu</span>
          </button>
        </div>
      </nav>

      {/* Bảng chức năng trượt từ dưới lên */}
      {showMoreMenu && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tất cả chức năng"
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">
                  Tất cả chức năng
                </span>
                <span className="text-[10px] bg-blue-100 text-doan px-2 py-0.5 rounded font-semibold capitalize">
                  {currentRole}
                </span>
              </div>
              <button
                title="Đóng"
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
              {sheetGroups.map((g) => (
                <div key={g.title} className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {g.title}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={item.label}
                          onClick={() => {
                            setShowMoreMenu(false);
                            navigate(item.to);
                          }}
                          className="flex items-center gap-3 p-3 min-h-14 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 active:bg-blue-50 text-slate-700 hover:text-doan text-xs font-semibold text-left transition-colors cursor-pointer"
                        >
                          <div className="relative w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-600 shrink-0">
                            <Icon className="w-4 h-4" />
                            {item.badge && pendingCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-4 px-1 text-[10px] leading-4 font-bold rounded-full bg-red-500 text-white text-center">
                                {pendingCount > 99 ? "99+" : pendingCount}
                              </span>
                            )}
                          </div>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
