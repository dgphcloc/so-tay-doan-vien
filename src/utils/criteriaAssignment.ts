/**
 * Quy tắc "tiêu chí con này áp dụng cho chi đoàn nào".
 *
 * Thứ tự ưu tiên (cascade):
 *   1. Có unit_ids        -> chỉ đúng các chi đoàn đó.
 *   2. Không có unit_type_ids -> TẤT CẢ chi đoàn.
 *   3. Còn lại            -> các chi đoàn thuộc các loại trong unit_type_ids.
 *
 * Đọc cả trường mảng mới (unit_type_ids/unit_ids) lẫn 2 trường cũ
 * (unit_type_id/unit_id) để không vỡ dữ liệu cũ.
 */
import type { UnitTypeId } from '../data/types';

interface ScopeLike {
  unit_type_ids?: UnitTypeId[] | null;
  unit_ids?: string[] | null;
  /** @deprecated */
  unit_type_id?: UnitTypeId | null;
  /** @deprecated */
  unit_id?: string | null;
}

interface UnitLike {
  id: string;
  unit_type_id: UnitTypeId;
}

/** Chuẩn hóa phạm vi về 2 mảng, có tính tới trường cũ. */
export function normalizeScope(sub: ScopeLike): { typeIds: UnitTypeId[]; unitIds: string[] } {
  const unitIds = sub.unit_ids && sub.unit_ids.length ? sub.unit_ids : sub.unit_id ? [sub.unit_id] : [];
  const typeIds =
    sub.unit_type_ids && sub.unit_type_ids.length
      ? sub.unit_type_ids
      : sub.unit_type_id
      ? [sub.unit_type_id]
      : [];
  return { typeIds, unitIds };
}

/** Tiêu chí con có áp dụng cho chi đoàn này không. */
export function isSubCriterionApplicableToUnit(sub: ScopeLike, unit: UnitLike): boolean {
  const { typeIds, unitIds } = normalizeScope(sub);
  if (unitIds.length > 0) return unitIds.includes(unit.id);
  if (typeIds.length === 0) return true; // mọi chi đoàn
  return typeIds.includes(unit.unit_type_id);
}

const UNIT_TYPE_LABEL: Record<UnitTypeId, string> = {
  residential: 'Dân cư',
  school: 'Trường học',
  health: 'Y tế',
  police: 'Công an',
  other: 'Khác',
};

export function unitTypeLabel(id: UnitTypeId): string {
  return UNIT_TYPE_LABEL[id] ?? 'Khác';
}

/**
 * Nhãn tiếng Việt mô tả phạm vi phân công, ví dụ:
 *   "Tất cả chi đoàn"
 *   "Tất cả chi đoàn Dân cư, Trường học"
 *   "Chi đoàn THPT Nguyễn Du, Chi đoàn THCS Tân Phú"
 */
export function describeAssignment(
  sub: ScopeLike,
  units: Array<{ id: string; name: string }>
): string {
  const { typeIds, unitIds } = normalizeScope(sub);
  if (unitIds.length > 0) {
    const names = unitIds
      .map((id) => units.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);
    if (names.length === 0) return `${unitIds.length} chi đoàn cụ thể`;
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} chi đoàn khác`;
  }
  if (typeIds.length === 0) return 'Tất cả chi đoàn';
  return `Tất cả chi đoàn ${typeIds.map(unitTypeLabel).join(', ')}`;
}
