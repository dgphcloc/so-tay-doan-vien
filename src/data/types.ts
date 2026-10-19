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
  ethnicity_id: string;
  avatar_url: string;
  current_job: string;
  central_member_code: string;
  note?: string;
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
}

// 16b. member_submissions — bài nộp CÁ NHÂN của đoàn viên (tách khỏi task_results)
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
  /** Tổng approved_score của bài chấm tiêu chí đã duyệt (thang 100). */
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
