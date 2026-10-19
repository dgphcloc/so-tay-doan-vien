/**
 * Quy tắc phân quyền — một nguồn sự thật cho cả UI lẫn route guard.
 *
 * Vai trò:
 *   super_admin  — quản trị kỹ thuật, toàn quyền
 *   admin        — bí thư Đoàn xã, quản trị nghiệp vụ
 *   staff        — cán bộ Đoàn xã (chỉ đọc)
 *   unit_secretary — bí thư/phó bí thư chi đoàn
 *   member       — đoàn viên
 */
import type { RoleId } from '../data/types';

export const isAdminLevel = (role: RoleId): boolean => role === 'super_admin' || role === 'admin';

/** Quản lý nhiệm vụ toàn xã (tạo/giao mọi chi đoàn, đóng, xóa). */
export const canManageTasks = (role: RoleId): boolean => isAdminLevel(role);

/** Được tạo nhiệm vụ: admin toàn quyền; bí thư chi đoàn chỉ giao chi đoàn mình. */
export const canCreateTask = (role: RoleId): boolean => isAdminLevel(role) || role === 'unit_secretary';

/** Quản lý chi đoàn (thêm/xóa/sửa). */
export const canManageUnits = (role: RoleId): boolean => isAdminLevel(role);

/** Sửa bộ tiêu chí (thêm/xóa/chốt). */
export const canEditCriteria = (role: RoleId): boolean => isAdminLevel(role);

/** Quản lý đoàn viên, BCH, tài khoản, cấu hình. */
export const canManageOrg = (role: RoleId): boolean => isAdminLevel(role);

/**
 * Được duyệt/từ chối minh chứng.
 * - admin/super_admin: mọi bài.
 * - unit_secretary: chỉ bài thuộc chi đoàn mình VÀ nhiệm vụ do chính mình giao.
 */
export function canReview(
  role: RoleId,
  ctx: { itemUnitId?: string | null; taskOwnerUnitId?: string | null; myUnitId?: string | null; assignedByMe?: boolean }
): boolean {
  if (isAdminLevel(role)) return true;
  if (role === 'unit_secretary') {
    // Chỉ duyệt bài của chi đoàn mình, với nhiệm vụ do chính mình giao
    if (!ctx.myUnitId || !ctx.itemUnitId) return false;
    return ctx.itemUnitId === ctx.myUnitId && !!ctx.assignedByMe;
  }
  return false;
}

/** Bí thư chi đoàn chỉ được giao nhiệm vụ cho chi đoàn mình. */
export const restrictTaskUnitsToOwnUnit = (role: RoleId): boolean => role === 'unit_secretary';

/** Danh sách đường dẫn được phép theo vai trò (dùng cho route guard). */
export const ROUTE_ACCESS: Record<string, RoleId[]> = {
  '/': ['super_admin', 'admin', 'staff', 'unit_secretary', 'member'],
  // Nộp bài của CHI ĐOÀN: chỉ bí thư chi đoàn (admin để hỗ trợ). Đoàn viên nộp cá nhân ở /nop-ca-nhan.
  '/nop-minh-chung': ['super_admin', 'admin', 'unit_secretary'],
  '/nop-ca-nhan': ['super_admin', 'admin', 'unit_secretary', 'member'],
  '/bang-tin': ['super_admin', 'admin', 'staff', 'unit_secretary', 'member'],
  '/ho-so': ['super_admin', 'admin', 'unit_secretary', 'member'],
  '/so-tay': ['super_admin', 'admin', 'staff', 'unit_secretary', 'member'],
  '/duyet': ['super_admin', 'admin', 'unit_secretary'], // bí thư CĐ: duyệt bài đoàn viên + bài chi đoàn do mình giao
  '/nhiem-vu': ['super_admin', 'admin', 'staff', 'unit_secretary'],
  '/tieu-chi': ['super_admin', 'admin', 'staff'],
  '/nhac-nho': ['super_admin', 'admin'],
  '/chi-doan': ['super_admin', 'admin', 'staff', 'unit_secretary'],
  '/doan-vien': ['super_admin', 'admin', 'staff'],
  '/ban-chap-hanh': ['super_admin', 'admin', 'staff'],
  '/bao-cao': ['super_admin', 'admin', 'staff'],
  '/cau-hinh': ['super_admin', 'admin'],
  '/tai-khoan': ['super_admin'],
  '/nhat-ky': ['super_admin'],
};

/** Vai trò có được vào đường dẫn này không. */
export const canAccessRoute = (role: RoleId, path: string): boolean => {
  const allowed = ROUTE_ACCESS[path];
  if (!allowed) return true; // đường dẫn lạ -> không chặn ở đây
  return allowed.includes(role);
};

/** Trang mặc định cho mỗi vai trò khi bị chặn. */
export const homeForRole = (role: RoleId): string =>
  role === 'unit_secretary' ? '/nop-minh-chung' : role === 'member' ? '/nop-ca-nhan' : '/';
