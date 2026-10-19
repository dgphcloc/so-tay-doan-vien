/**
 * Tiện ích xử lý chuỗi tiếng Việt và tính toán tuổi đoàn viên
 */

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function calculateAge(birthDateStr: string): number {
  try {
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  } catch {
    return 0;
  }
}

export function isMemberMatured(birthDateStr: string, maturedAge: number = 30): boolean {
  return calculateAge(birthDateStr) >= maturedAge;
}
