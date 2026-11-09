/**
 * CÔNG THỨC XẾP LOẠI HẰNG NĂM
 * Theo Hướng dẫn 25-HD/TWĐTN-BTC ngày 13/9/2023 của Ban Bí thư TW Đoàn.
 *
 * Toàn bộ logic nằm trong file thuần (không React, không Supabase) để dễ kiểm thử
 * và để mọi màn hình dùng chung đúng một công thức.
 */
import type { DisciplineForm, RatingLevel } from '../data/types';

// ---------------------------------------------------------------------
// Ngưỡng theo văn bản
// ---------------------------------------------------------------------
/** Đoàn viên: >= 90% hoạt động -> mức tối đa "Xuất sắc". */
export const MEMBER_THRESHOLDS = { excellent: 90, good: 80, pass: 50 } as const;

/** Chi đoàn: % nhiệm vụ cấp trên giao hoàn thành. */
export const UNIT_TASK_THRESHOLDS = { excellent: 100, good: 100, pass: 70 } as const;

/** Chi đoàn: % đoàn viên đạt "Hoàn thành tốt" trở lên. */
export const UNIT_MEMBER_GOOD = { excellent: 80, good: 60, pass: 50 } as const;

/** Chi đoàn: % hồ sơ đoàn viên số hoá đầy đủ. */
export const UNIT_DIGITAL = { excellent: 100, good: 80, pass: 50 } as const;

/** Tỷ lệ tham gia bắt buộc của chi đoàn; dưới mốc này là "Không hoàn thành". */
export const UNIT_FAIL_TASK_RATE = 70;

// ---------------------------------------------------------------------
// Đoàn viên
// ---------------------------------------------------------------------
export interface MemberEvalInput {
  totalTasks: number;
  completedTasks: number;
  /** Mức Chương trình RLĐV của năm (nếu đã ghi nhận). */
  rldvLevel: RatingLevel | null;
  /** Có ít nhất một kỷ luật từ cảnh cáo trở lên trong kỳ. */
  hasStrictDiscipline: boolean;
  /** Đảng viên đang sinh hoạt Đoàn: không xếp loại. */
  isPartyMember: boolean;
  /** Đoàn viên nghỉ ≥ 3 tháng trong năm. */
  isLongAbsent: boolean;
}

export interface MemberEvalResult {
  participationRate: number;
  autoRating: RatingLevel;
  /** Mức bị chặn bởi điều kiện cứng (kỷ luật / nghỉ dài / đảng viên), null nếu chỉ theo %. */
  blockedBy: 'discipline' | 'absence' | 'party_member' | null;
  /** Ghi chú giải thích vì sao ra mức này — hiển thị cho người dùng. */
  reasons: string[];
}

const rank: Record<RatingLevel, number> = {
  excellent: 4,
  good: 3,
  pass: 2,
  fail: 1,
  not_rated: 0,
};

const minRank = (a: RatingLevel, b: RatingLevel): RatingLevel =>
  rank[a] <= rank[b] ? a : b;

/**
 * Tính mức xếp loại đoàn viên.
 *
 * Quy tắc theo văn bản:
 *  - Đảng viên đang sinh hoạt Đoàn -> không xếp loại (not_rated).
 *  - Bị kỷ luật từ cảnh cáo trở lên -> Không hoàn thành.
 *  - Nghỉ ≥ 3 tháng -> tối đa "Hoàn thành".
 *  - Còn lại theo tỷ lệ tham gia: >=90% Xuất sắc, >=80% Tốt, >=50% Hoàn thành, <50% Không hoàn thành.
 *  - Mức RLĐV (nếu có) không được cao hơn % tham gia cho phép.
 */
export function computeMemberRating(input: MemberEvalInput): MemberEvalResult {
  const reasons: string[] = [];
  const total = Math.max(input.totalTasks, 0);
  const done = Math.min(Math.max(input.completedTasks, 0), total);
  const rate = total > 0 ? (done / total) * 100 : 0;
  const rateRounded = Math.round(rate * 100) / 100;

  if (input.isPartyMember) {
    reasons.push('Đảng viên đang sinh hoạt Đoàn — chỉ đánh giá Chương trình RLĐV, không xếp loại.');
    return {
      participationRate: rateRounded,
      autoRating: 'not_rated',
      blockedBy: 'party_member',
      reasons,
    };
  }

  if (input.hasStrictDiscipline) {
    reasons.push('Có kỷ luật từ cảnh cáo trở lên trong kỳ.');
    return {
      participationRate: rateRounded,
      autoRating: 'fail',
      blockedBy: 'discipline',
      reasons,
    };
  }

  let rating: RatingLevel;
  if (rate >= MEMBER_THRESHOLDS.excellent) {
    rating = 'excellent';
    reasons.push(`Tham gia ${fmt(rateRounded)}% hoạt động (≥ 90%).`);
  } else if (rate >= MEMBER_THRESHOLDS.good) {
    rating = 'good';
    reasons.push(`Tham gia ${fmt(rateRounded)}% hoạt động (≥ 80%).`);
  } else if (rate >= MEMBER_THRESHOLDS.pass) {
    rating = 'pass';
    reasons.push(`Tham gia ${fmt(rateRounded)}% hoạt động (≥ 50%).`);
  } else {
    rating = 'fail';
    reasons.push(`Tham gia dưới 50% hoạt động (${fmt(rateRounded)}%).`);
  }

  // Mức RLĐV: không nâng được mức, chỉ có thể hạ.
  if (input.rldvLevel && input.rldvLevel !== 'not_rated') {
    const capped = minRank(rating, input.rldvLevel);
    if (rank[capped] < rank[rating]) {
      reasons.push('Mức Chương trình RLĐV thấp hơn mức theo tỷ lệ hoạt động nên bị hạ xuống.');
      rating = capped;
    }
  }

  if (input.isLongAbsent && rank[rating] > rank.pass) {
    rating = 'pass';
    reasons.push('Nghỉ từ 3 tháng trở lên trong năm — tối đa "Hoàn thành nhiệm vụ".');
    return { participationRate: rateRounded, autoRating: rating, blockedBy: 'absence', reasons };
  }

  return { participationRate: rateRounded, autoRating: rating, blockedBy: null, reasons };
}

/** Mức cao nhất được phép khi có nghỉ dài. */
export const ratingAfterAbsenceCap = (r: RatingLevel): RatingLevel =>
  rank[r] > rank.pass ? 'pass' : r;

// ---------------------------------------------------------------------
// Chi đoàn
// ---------------------------------------------------------------------
export interface UnitEvalInput {
  /** % nhiệm vụ đoàn cấp trên giao đã hoàn thành. */
  taskCompletionRate: number;
  /** % đoàn viên trong chi đoàn đạt "Hoàn thành tốt" trở lên. */
  memberGoodRate: number;
  /** % hồ sơ đoàn viên đã số hoá đầy đủ. */
  digitalRate: number;
  /** Họp chi đoàn đủ 1 tháng/lần. */
  meetingOk: boolean;
  /** Thu, nộp đoàn phí đúng quy định. */
  feeOk: boolean;
  /** Có đoàn viên bị kỷ luật trong kỳ. */
  hasDiscipline: boolean;
}

export interface UnitEvalResult {
  autoRating: RatingLevel;
  reasons: string[];
}

export function computeUnitRating(input: UnitEvalInput): UnitEvalResult {
  const reasons: string[] = [];

  if (input.hasDiscipline) {
    reasons.push('Có đoàn viên bị kỷ luật trong kỳ — không đạt từ mức "Tốt" trở lên.');
  }

  const taskRate = clamp(input.taskCompletionRate);
  const goodRate = clamp(input.memberGoodRate);
  const digital = clamp(input.digitalRate);

  let rating: RatingLevel;

  if (taskRate < UNIT_FAIL_TASK_RATE) {
    rating = 'fail';
    reasons.push(`Chỉ hoàn thành ${fmt(taskRate)}% nhiệm vụ được giao (< 70%).`);
    return { autoRating: rating, reasons };
  }

  const excellentOk =
    taskRate >= UNIT_TASK_THRESHOLDS.excellent &&
    goodRate >= UNIT_MEMBER_GOOD.excellent &&
    digital >= UNIT_DIGITAL.excellent &&
    input.meetingOk &&
    input.feeOk;

  const goodOk =
    taskRate >= UNIT_TASK_THRESHOLDS.good &&
    goodRate >= UNIT_MEMBER_GOOD.good &&
    digital >= UNIT_DIGITAL.good &&
    input.meetingOk &&
    input.feeOk;

  const passOk =
    taskRate >= UNIT_TASK_THRESHOLDS.pass &&
    goodRate >= UNIT_MEMBER_GOOD.pass &&
    digital >= UNIT_DIGITAL.pass;

  if (excellentOk && !input.hasDiscipline) {
    rating = 'excellent';
    reasons.push('Đạt đủ các mốc: 100% nhiệm vụ, ≥80% đoàn viên tốt trở lên, 100% hồ sơ số hoá, họp và đoàn phí đầy đủ.');
  } else if (goodOk && !input.hasDiscipline) {
    rating = 'good';
    reasons.push('Đạt các mốc: 100% nhiệm vụ, ≥60% đoàn viên tốt trở lên, ≥80% hồ sơ số hoá, họp và đoàn phí đầy đủ.');
  } else if (passOk) {
    rating = 'pass';
    reasons.push('Đạt mốc tối thiểu: ≥70% nhiệm vụ, ≥50% đoàn viên tốt trở lên, ≥50% hồ sơ số hoá.');
  } else {
    rating = 'pass';
    reasons.push('Chưa đạt đủ mốc của mức "Tốt" nên xếp "Hoàn thành nhiệm vụ".');
  }

  return { autoRating: rating, reasons };
}

// ---------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------
function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(v, 0), 100);
}

function fmt(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',');
}

/** Tỷ lệ % (0..100) từ hai số đếm. */
export function percent(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 10000) / 100;
}

/** Khoảng ngày của kỳ đánh giá theo loại kỳ. */
export function periodRange(year: number, type: 'calendar' | 'school_year'): { start: string; end: string } {
  if (type === 'school_year') {
    return { start: `${year}-06-01`, end: `${year + 1}-05-31` };
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Ngày nằm trong khoảng kỳ (so sánh chuỗi YYYY-MM-DD). */
export function inPeriod(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= start && d <= end;
}

/** Có kỷ luật nào từ cảnh cáo trở lên và hiệu lực trong kỳ. */
export function hasStrictDisciplineInPeriod(
  disciplines: Array<{ form: DisciplineForm; decided_at: string; effective_to?: string | null }>,
  start: string,
  end: string
): boolean {
  const strict = new Set<DisciplineForm>(['warning', 'dismissal', 'expulsion']);
  return disciplines.some(d => {
    if (!strict.has(d.form)) return false;
    if (d.decided_at > end) return false;
    if (d.effective_to && d.effective_to < start) return false;
    return true;
  });
}
