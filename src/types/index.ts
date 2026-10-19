/**
 * Mô hình dữ liệu Sổ tay Đoàn viên – Quản trị
 * Các trường đặt tên snake_case theo đặc tả yêu cầu
 */

export type RoleId = 'super_admin' | 'admin' | 'staff' | 'unit_secretary' | 'member';

export interface Role {
  id: RoleId;
  name: string;
  note: string;
}

export type UnitTypeId = 'residential' | 'school' | 'health' | 'police' | 'other';

export interface UnitType {
  id: UnitTypeId;
  name: string; // Dân cư, Trường học, Y tế, Công an, Khác
}

export interface Ethnicity {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
  note?: string;
  unit_type_id: UnitTypeId;
  is_active: boolean;
  union_member_count: number;
  youth_count: number;
}

export type Gender = 'male' | 'female' | 'other';
export type CurrentPosition = 'secretary' | 'deputy_secretary' | 'member';
export type PoliticalTheoryLevel = 'advanced' | 'intermediate' | 'elementary' | 'other';

export interface Member {
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

export interface Profile {
  id: string;
  member_id: string | null;
  role_id: RoleId;
  is_active: boolean;
  email?: string;
}

export interface CriteriaSet {
  id: string;
  year: number;
  name: string;
  issuing_unit: string;
  /** Có giá trị = bộ đã được lưu trữ (soft delete). */
  archived_at?: string | null;
}

export interface CriteriaSection {
  id: string;
  criteria_set_id: string;
  stt: number;
  name: string;
}

export interface Criterion {
  id: string;
  section_id: string;
  stt: number;
  name: string;
}

export interface SubCriterion {
  id: string;
  criterion_id: string;
  condition_text: string;
  max_score: number;
  evaluation_method: string;
  evidence_requirement: string;
  scoring_rule: string;
  deadline: string; // ISO date string
  /** @deprecated dùng unit_type_ids. Giữ để tương thích dữ liệu cũ. */
  unit_type_id: UnitTypeId | null; // null = áp dụng cho mọi loại
  /** @deprecated dùng unit_ids. Giữ để tương thích dữ liệu cũ. */
  unit_id: string | null;
  /** Các loại chi đoàn áp dụng; rỗng = mọi loại. */
  unit_type_ids: UnitTypeId[];
  /** Các chi đoàn cụ thể áp dụng; rỗng = mọi chi đoàn trong phạm vi loại. */
  unit_ids: string[];
  /** Ghi chú — dùng lưu "Bộ phận phụ trách". */
  note?: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CriterionSubmission {
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

export type TaskStatus = 'draft' | 'published' | 'closed';

export interface Task {
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
  submit_scope: 'assigned' | 'open';
}

export interface TaskUnit {
  task_id: string;
  unit_id: string;
}

export interface TaskRegistration {
  id: string;
  task_id: string;
  member_id: string;
  is_joining: boolean;
}

export interface TaskSubCriterion {
  task_id: string;
  sub_criterion_id: string;
  contribution_score: number;
}

export interface TaskResult {
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

export interface MemberSubmission {
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

export type EvidenceType = 'photo' | 'report' | 'file' | 'link' | 'list';
export type EvidenceSource = 'camera' | 'upload';

export interface Evidence {
  id: string;
  task_id: string | null;
  submission_id: string | null;
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

export type NotificationType = 'reminder' | 'system' | 'review_request' | 'overdue';
export type NotificationLevel = 'yellow' | 'orange' | 'red';

export interface Notification {
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

export interface Warning {
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

export type CommitteePosition = 'secretary' | 'deputy_secretary' | 'committee_member' | 'member';

export interface UnitCommittee {
  id: string;
  unit_id: string | null; // null = BCH Đoàn xã
  member_id: string;
  position: CommitteePosition;
  is_standing: boolean; // Uỷ viên Ban Thường vụ
  term_start: string;
  term_end: string | null;
}

export type ReportType =
  | 'member_stats'
  | 'task_summary'
  | 'criteria_summary'
  | 'annual'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'special';

export interface Report {
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

export interface YearlySettings {
  year: number;
  criteria_set_id: string;
  matured_age: number; // 30
  new_member_target: number; // vd 40
  max_photos: number;
  max_files: number;
  max_links: number;
  require_gps: boolean;
}

export interface AuditLog {
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
