/**
 * Kiểu TypeScript cho mọi bảng trong mô hình dữ liệu Đoàn xã
 * Các tên trường đúng định dạng snake_case
 */

// 1. roles
export type RoleId = 'super_admin' | 'admin' | 'staff' | 'unit_secretary' | 'member';

export interface DbRole {
  id: RoleId;
  name: string;
  note: string;
}

// 2. unit_types
export type UnitTypeId = 'residential' | 'school' | 'health' | 'police' | 'other';

export interface DbUnitType {
  id: UnitTypeId;
  name: string;
}

// 3. ethnicities
export interface DbEthnicity {
  id: string;
  name: string;
}

// 4. units
export interface DbUnit {
  id: string;
  name: string;
  note?: string;
  unit_type_id: UnitTypeId;
  is_active: boolean;
  union_member_count: number;
  youth_count: number;
}

// 5. members
export type Gender = 'male' | 'female' | 'other';
export type CurrentPosition = 'secretary' | 'deputy_secretary' | 'member';
export type PoliticalTheoryLevel = 'advanced' | 'intermediate' | 'elementary' | 'other';
export type PartyTargetStatus = 'none' | 'elite' | 'trained_class' | 'introduced' | 'admitted';

export interface DbMember {
  id: string;
  full_name: string;
  birth_date: string;
  gender: Gender;
  phone: string;
  joined_date: string;
  unit_id: string;
  current_position: CurrentPosition;
  planned_position?: string;
  education_grade: string;
  specialization?: string;
  political_theory_level: PoliticalTheoryLevel;
  is_active: boolean;
  religion: string;
  is_party_member: boolean;
  is_elite_member?: boolean;
  elite_date?: string;
  party_target_status?: PartyTargetStatus;
  ethnicity_id: string;
  avatar_url: string;
  current_job: string;
  central_member_code: string;
  note?: string;
  // Bổ sung Đoàn phí (Hướng dẫn 39)
  has_salary?: boolean;
  exempt_months?: number[];
  transferred_out_month?: number | null;
  // Bổ sung duyệt tự đăng ký & chỉ tiêu đoàn viên mới
  approval_status?: 'pending' | 'approved' | 'rejected';
  is_newly_admitted?: boolean;
  rejection_reason?: string;
}

// 6. profiles
export interface DbProfile {
  id: string;
  member_id: string | null;
  role_id: RoleId;
  is_active: boolean;
  email?: string;
}

// 7. criteria_sets
export interface DbCriteriaSet {
  id: string;
  year: number;
  name: string;
  issuing_unit: string;
  /** Có giá trị = bộ đã được lưu trữ (soft delete): ẩn khỏi danh sách, khôi phục được. */
  archived_at?: string | null;
}

// 8. criteria_sections
export interface DbCriteriaSection {
  id: string;
  criteria_set_id: string;
  stt: number;
  name: string;
}

// 9. criteria
export interface DbCriterion {
  id: string;
  section_id: string;
  stt: number;
  name: string;
}

// 10. sub_criteria
export interface DbSubCriterion {
  id: string;
  criterion_id: string;
  condition_text: string;
  max_score: number;
  evaluation_method: string;
  evidence_requirement: string;
  scoring_rule: string;
  deadline: string; // ISO date string
  /** @deprecated dùng unit_type_ids. Giữ để tương thích dữ liệu cũ. */
  unit_type_id: UnitTypeId | null;
  /** @deprecated dùng unit_ids. Giữ để tương thích dữ liệu cũ. */
  unit_id: string | null;
  /** Các loại chi đoàn áp dụng; rỗng = mọi loại. */
  unit_type_ids: UnitTypeId[];
  /** Các chi đoàn cụ thể áp dụng; rỗng = mọi chi đoàn trong phạm vi loại. */
  unit_ids: string[];
  /** Ghi chú — dùng lưu "Bộ phận phụ trách" (cột H của file Excel). */
  note?: string;
}

// 11. criterion_submissions
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface DbCriterionSubmission {
  id: string;
  sub_criterion_id: string;
  unit_id: string;
  self_score: number;
  approved_score: number | null;
  status: ReviewStatus;
  note?: string;
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note?: string;
}

// 12. tasks
export type TaskStatus = 'draft' | 'published' | 'closed';

export interface DbTask {
  id: string;
  title: string;
  content: string;
  due_date: string; // ISO string
  assigned_by: string;
  assigned_at: string;
  status: TaskStatus;
  reminder_days: number[]; // e.g. [7, 3, 1]
  target: string;
  evaluation_criteria?: string;
  max_score: number;
  lat: number | null;
  lng: number | null;
  closed_by: string | null;
  closed_at: string | null;
  /** Phạm vi nộp: 'assigned' = chỉ đoàn viên chi đoàn được giao; 'open' = ai cũng tham gia. */
  submit_scope: 'assigned' | 'open';
  /** Tiêu chí nguồn (KPI) mà nhiệm vụ này được tạo ra để hoàn thành. */
  source_sub_criterion_id?: string | null;
  /** Bán kính điểm danh riêng của nhiệm vụ (mét). null = dùng yearly_settings.default_radius_m. */
  radius_m?: number | null;
  /** Giờ mở điểm danh. null = không giới hạn riêng, chỉ dùng due_date. */
  attendance_open_at?: string | null;
  /** Giờ đóng điểm danh. null = không giới hạn riêng. */
  attendance_close_at?: string | null;
}

// 13. task_units
export interface DbTaskUnit {
  task_id: string;
  unit_id: string;
}

// 14. task_registrations
export interface DbTaskRegistration {
  id: string;
  task_id: string;
  member_id: string;
  is_joining: boolean;
}

// 15. task_sub_criteria
export interface DbTaskSubCriterion {
  task_id: string;
  sub_criterion_id: string;
  contribution_score: number;
}

// 16. task_results
export interface DbTaskResult {
  id: string;
  task_id: string;
  unit_id: string;
  completed_at: string;
  is_overdue: boolean;
  lat: number | null;
  lng: number | null;
  note?: string;
  participant_count: number;
  submitted_by: string;
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note?: string;
  /** Bí thư xã duyệt cấp 2 (sau khi bí thư chi đoàn đã duyệt). */
  admin_reviewed_by?: string | null;
  admin_reviewed_at?: string | null;
}

/**
 * Báo cáo riêng của Bí thư / Phó Bí thư chi đoàn về quá trình chỉ đạo
 * thực hiện một nhiệm vụ. ĐỘC LẬP với DbTaskResult:
 *   - DbTaskResult  = chi đoàn đã làm được gì (kết quả tổng hợp)
 *   - DbUnitReport  = bí thư đã chỉ đạo thế nào (báo cáo)
 */
export interface DbUnitReport {
  id: string;
  task_id: string;
  unit_id: string;
  /** Người nộp báo cáo (bí thư hoặc phó bí thư chi đoàn). */
  submitted_by: string;
  note?: string;
  status: ReviewStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note?: string;
}

// 16b. member_submissions — bài nộp CÁ NHÂN của đoàn viên (tách khỏi task_results)
/** Kết quả kiểm tra vị trí khi nộp minh chứng. */
export type CheckinResult = 'in_range' | 'out_of_range' | 'no_coords' | 'low_accuracy';
/** Nguồn toạ độ: thiết bị / nhập tay / dán link Google Maps. */
export type CoordSource = 'gps' | 'manual' | 'link';

export interface DbMemberSubmission {
  id: string;
  task_id: string;
  member_id: string;
  unit_id: string;
  note?: string;
  lat: number | null;
  lng: number | null;
  status: ReviewStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note?: string;

  // --- Kết quả kiểm tra vị trí ("check-in") — do trigger trong DB tính, client không ghi ---
  /** Sai số GPS của ảnh được dùng (mét). */
  accuracy_m?: number | null;
  /** Khoảng cách NHỎ NHẤT từ ảnh minh chứng tới điểm tổ chức (mét). */
  distance_m?: number | null;
  /** Bán kính đã áp dụng lúc tính (mét). Lưu lại để sửa cấu hình sau không đổi kết quả cũ. */
  radius_applied_m?: number | null;
  /** Kết quả check-in. null = chưa tính hoặc nhiệm vụ không có toạ độ. */
  checkin_result?: CheckinResult | null;
  /** Nguồn toạ độ: gps (thiết bị) / manual (nhập tay) / link (dán Google Maps). */
  coord_source?: CoordSource | null;
  /** Ảnh gần nhất được dùng để tính khoảng cách. */
  closest_evidence_id?: string | null;
  /** Nộp ngoài khung giờ điểm danh của nhiệm vụ (vẫn cho nộp, chỉ gắn cờ). */
  submitted_outside_window?: boolean;
}

// 17. evidences
export type EvidenceType = 'photo' | 'report' | 'file' | 'link' | 'list';
export type EvidenceSource = 'camera' | 'upload';

export interface DbEvidence {
  id: string;
  task_id: string | null;
  submission_id: string | null;
  /** Bài nộp cá nhân của đoàn viên (member_submissions). */
  member_submission_id?: string | null;
  /** Báo cáo của bí thư chi đoàn (unit_reports). */
  unit_report_id?: string | null;
  member_id: string;
  unit_id: string;
  evidence_type: EvidenceType;
  storage_path: string;
  url: string;
  file_name: string;
  captured_at: string;
  uploaded_at: string;
  lat: number | null;
  lng: number | null;
  source: EvidenceSource;
  file_hash: string;
  is_locked: boolean;
  /** Sai số GPS do thiết bị báo về (mét). null với minh chứng không phải ảnh. */
  accuracy_m?: number | null;
  /** Nguồn toạ độ của ảnh này. */
  coord_source?: CoordSource | null;
}

// 18. notifications
export type NotificationType = 'reminder' | 'system' | 'review_request' | 'overdue';
export type NotificationLevel = 'yellow' | 'orange' | 'red';

export interface DbNotification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  level: NotificationLevel;
  title: string;
  body: string;
  task_id: string | null;
  sub_criterion_id: string | null;
  is_read: boolean;
  created_at: string;
}

// 19. warnings
export interface DbWarning {
  id: string;
  unit_id: string;
  task_id: string | null;
  sub_criterion_id: string | null;
  codes: Array<'DUE_SOON' | 'OVERDUE'>;
  level: 'yellow' | 'orange' | 'red';
  message: string;
  is_read: boolean;
  resolved_at: string | null;
}

// 20. unit_committees
export type CommitteePosition = 'secretary' | 'deputy_secretary' | 'committee_member' | 'member';

export interface DbUnitCommittee {
  id: string;
  unit_id: string | null; // null = BCH Đoàn xã
  member_id: string;
  position: CommitteePosition;
  is_standing: boolean; // Ủy viên Ban Thường vụ
  term_start: string;
  term_end: string | null;
}

// 21. reports
export type ReportType =
  | 'member_stats'
  | 'task_summary'
  | 'criteria_summary'
  | 'annual'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'special';

export interface DbReport {
  id: string;
  title: string;
  report_type: ReportType;
  type?: ReportType;
  period_start: string;
  period_end: string;
  unit_id: string | null;
  data: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

// 22. yearly_settings
export interface DbYearlySettings {
  year: number;
  criteria_set_id: string;
  matured_age: number; // 30
  new_member_target: number; // e.g. 40
  max_photos: number; // số ảnh minh chứng tối đa / bài nộp
  max_files: number; // số file minh chứng tối đa / bài nộp
  max_links: number; // số link minh chứng tối đa / bài nộp
  require_gps: boolean; // bắt buộc ảnh có toạ độ GPS
  /** Bán kính điểm danh mặc định toàn hệ thống (mét). 20..1000. */
  default_radius_m: number;
  /** Sai số GPS tối đa chấp nhận (mét). Vượt ngưỡng -> nhãn "Độ chính xác kém". 5..500. */
  max_accuracy_m: number;
}

// 23b. Sổ tay cá nhân (riêng tư tuyệt đối)
export interface DbJournalImage {
  id: string;
  entry_id: string;
  storage_path: string;
  url: string;
  file_name?: string;
}

export interface DbJournalLink {
  id: string;
  entry_id: string;
  url: string;
  note?: string;
}

export interface DbJournalEntry {
  id: string;
  profile_id: string;
  title: string;
  activity_date: string;
  note?: string;
  created_at: string;
  updated_at: string;
  images: DbJournalImage[];
  links: DbJournalLink[];
}

// =====================================================================
// 24. ĐÁNH GIÁ, XẾP LOẠI HẰNG NĂM (Hướng dẫn 25-HD/TWĐTN-BTC)
// =====================================================================

/** Bốn mức xếp loại theo Hướng dẫn 25. */
export type RatingLevel = 'excellent' | 'good' | 'pass' | 'fail' | 'not_rated';

export const RATING_LABELS: Record<RatingLevel, string> = {
  excellent: 'Hoàn thành xuất sắc nhiệm vụ',
  good: 'Hoàn thành tốt nhiệm vụ',
  pass: 'Hoàn thành nhiệm vụ',
  fail: 'Không hoàn thành nhiệm vụ',
  not_rated: 'Chưa xếp loại',
};

export const RATING_SHORT_LABELS: Record<RatingLevel, string> = {
  excellent: 'Xuất sắc',
  good: 'Tốt',
  pass: 'Hoàn thành',
  fail: 'Không hoàn thành',
  not_rated: 'Chưa xếp loại',
};

export type PeriodType = 'calendar' | 'school_year';
export type PeriodStatus = 'draft' | 'open' | 'closed';

export interface DbEvaluationPeriod {
  id: string;
  year: number;
  name: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  note?: string;
  created_at: string;
  updated_at: string;
}

/** Mức Chương trình Rèn luyện đoàn viên của từng người, từng năm. */
export interface DbMemberRldvLevel {
  id: string;
  member_id: string;
  year: number;
  level: RatingLevel;
  note?: string;
  evaluated_at?: string | null;
  evaluated_by?: string | null;
}

export type DisciplineForm = 'reprimand' | 'warning' | 'dismissal' | 'expulsion';

export const DISCIPLINE_LABELS: Record<DisciplineForm, string> = {
  reprimand: 'Khiển trách',
  warning: 'Cảnh cáo',
  dismissal: 'Cách chức',
  expulsion: 'Khai trừ',
};

/** Hình thức từ cảnh cáo trở lên mới đủ điều kiện xếp "Không hoàn thành". */
export const isStrictDiscipline = (form: DisciplineForm): boolean =>
  form === 'warning' || form === 'dismissal' || form === 'expulsion';

export interface DbMemberDiscipline {
  id: string;
  member_id: string;
  decision_no: string;
  form: DisciplineForm;
  decided_at: string;
  effective_from?: string | null;
  effective_to?: string | null;
  reason?: string;
  created_by?: string | null;
  created_at: string;
}

export type MemberEvaluationStatus = 'auto' | 'member_responded' | 'secretary_done' | 'finalized';

export interface DbMemberEvaluation {
  id: string;
  period_id: string;
  member_id: string;
  unit_id: string;
  total_tasks: number;
  completed_tasks: number;
  participation_rate: number;
  is_party_member_block: boolean;
  is_long_absent: boolean;
  auto_rating: RatingLevel;
  member_response: 'confirmed' | 'disagreed' | null;
  member_feedback?: string;
  member_responded_at?: string | null;
  secretary_rating: RatingLevel | null;
  secretary_note?: string;
  secretary_id?: string | null;
  secretary_at?: string | null;
  admin_rating: RatingLevel | null;
  admin_note?: string;
  admin_id?: string | null;
  admin_at?: string | null;
  status: MemberEvaluationStatus;
  created_at: string;
  updated_at: string;
}

export interface DbUnitEvaluation {
  id: string;
  period_id: string;
  unit_id: string;
  task_completion_rate: number;
  member_good_rate: number;
  member_fail_count: number;
  member_total: number;
  digital_rate: number;
  meeting_ok: boolean;
  fee_ok: boolean;
  has_discipline: boolean;
  auto_rating: RatingLevel;
  final_rating: RatingLevel | null;
  note?: string;
  rated_by?: string | null;
  rated_at?: string | null;
  status: 'auto' | 'finalized';
  created_at: string;
  updated_at: string;
}

// =====================================================================
// 25. THU NỘP & QUẢN LÝ ĐOÀN PHÍ (Hướng dẫn 39-HD/TWĐTN-BKT)
// =====================================================================

export interface DbUnionFeeSettings {
  id: number;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_holder: string;
  auto_remind_day: number;
  fee_non_salary: number; // 2.000đ
  fee_has_salary: number; // 5.000đ
  payos_client_id: string;
  payos_api_key: string;
  payos_checksum_key: string;
  payos_active: boolean;
  updated_by?: string | null;
  updated_at: string;
}

export type FeePaymentMethod = 'payos' | 'bank_transfer' | 'cash';
export type FeePaymentStatus = 'pending' | 'approved' | 'rejected';

export interface DbUnionFeePayment {
  id: string;
  member_id: string;
  unit_id: string;
  year: number;
  months: number[];
  amount: number;
  payment_method: FeePaymentMethod;
  status: FeePaymentStatus;
  order_code?: number | null;
  evidence_url?: string | null;
  note?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUnitFeeDistribution {
  id: string;
  unit_id: string;
  year: number;
  period_label: string;
  total_collected: number;
  unit_share: number;     // 2/3 giữ lại
  commune_share: number;  // 1/3 nộp xã
  is_refunded: boolean;
  refunded_at?: string | null;
  refunded_by?: string | null;
  receipt_no?: string | null;
  note?: string;
  created_at: string;
  updated_at: string;
}

// 26. LÊN LỊCH THÔNG BÁO TỰ ĐỘNG
export interface DbScheduledNotification {
  id: string;
  title: string;
  content: string;
  level: 'yellow' | 'orange' | 'red';
  recipient_type: 'unit' | 'member' | 'all';
  target_id: string | null;
  scheduled_at: string;
  is_sent: boolean;
  sent_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

// 23. audit_logs
export interface DbAuditLog {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  table_name: string;
  row_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

// DTOs & Computed structures returned by Repository
export interface DashboardStats {
  pendingCount: number;
  taskPendingCount: number;
  criteriaPendingCount: number;
  overdueUnitsCount: number;
  dueSoon7DaysCount: number;
  newMembersCount: number;
  maturedCount: number;
  totalMembers: number;
  totalUnits: number;
}

export interface UnitScoreCalculation {
  unit: DbUnit;
  /** Điểm thi đua = điểm tiêu chí. Không cộng điểm nhiệm vụ. */
  totalScore: number;
  maxPossible: number;
  /** Tổng approved_score của bài chấm tiêu chí đã duyệt (theo tổng điểm bộ tiêu chí). */
  criteriaScore: number;
  /**
   * Số nhiệm vụ chi đoàn đã nộp và được duyệt.
   * Chỉ đếm nhiệm vụ CÓ gắn tiêu chí (task_sub_criteria).
   */
  taskCount: number;
  /** Tổng số nhiệm vụ có gắn tiêu chí được giao cho chi đoàn trong năm. */
  taskAssignedCount: number;
  /** Số lượt đoàn viên tham gia (bài nộp cá nhân đã duyệt) — chỉ để thống kê. */
  participantCount: number;
  /** Tỷ lệ = taskCount / taskAssignedCount (0..100). Không liên quan điểm. */
  completionRate: number;
}

export interface MemberComputed {
  member: DbMember;
  age: number;
  is_matured: boolean;
  unit_name: string;
  phone_masked: string;
}

export interface TaskDeadlineStatus {
  is_overdue: boolean;
  days_remaining: number;
  chip_color: 'emerald' | 'amber' | 'rose';
  chip_label: string;
}

export interface EvidenceAuditWarning {
  evidence_id: string;
  is_missing_gps: boolean;
  is_duplicate_hash: boolean;
  is_captured_after_deadline: boolean;
  warning_text?: string;
}
