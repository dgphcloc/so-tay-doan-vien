/**
 * SUPABASE REPOSITORY - GIAI ĐOẠN 1 (web admin của bí thư xã đoàn)
 *
 * Làm thật với Supabase: đoàn viên, chi đoàn, BCH, báo cáo, cấu hình năm, loại chi đoàn,
 * dân tộc, tài khoản, nhật ký, dashboard (phần đoàn viên).
 * Các hàm giai đoạn 2 (nhiệm vụ, tiêu chí, duyệt, nhắc nhở, minh chứng) KHÔNG nằm ở đây:
 * file index.ts ghép chúng từ bản mock.
 *
 * Quy ước chuyển đổi (để giữ nguyên types.ts):
 *  - id trong CSDL là số (bigint / smallint), giao diện dùng chuỗi: đọc thì String(id), ghi thì Number(id).
 *  - unit_types.id (số) <-> UnitTypeId ('residential'...): theo thứ tự nạp ban đầu 1..5
 *    (Dân cư, Trường học, Y tế, Công an, Khác).
 *  - roles.name = RoleId.
 *  - Cột trống (NULL) hiện ra là chuỗi rỗng ở các trường kiểu string của DbMember.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository, EvidenceInput } from './repository';
import type {
  CommitteePosition, DashboardStats, DbAuditLog, DbEthnicity, DbMember, DbProfile, DbReport, DbUnit,
  DbUnitCommittee, DbUnitType, DbYearlySettings, Gender, MemberComputed, PoliticalTheoryLevel,
  ReportType, RoleId, UnitTypeId, CurrentPosition,
  DbCriteriaSet, DbCriteriaSection, DbCriterion, DbSubCriterion, DbCriterionSubmission, ReviewStatus,
  DbJournalEntry,
  DbTask, DbTaskUnit, DbTaskRegistration, DbTaskSubCriterion, DbTaskResult, DbMemberSubmission, DbEvidence, DbNotification,
  DbWarning, TaskStatus, TaskDeadlineStatus, EvidenceType, EvidenceSource, NotificationType, NotificationLevel,
  EvidenceAuditWarning, UnitScoreCalculation,
} from './types';
import { isSubCriterionApplicableToUnit } from '../utils/criteriaAssignment';

// ---------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const SLUG_BY_UNIT_TYPE_DB_ID: Record<number, UnitTypeId> = { 1: 'residential', 2: 'school', 3: 'health', 4: 'police', 5: 'other' };
const DB_ID_BY_UNIT_TYPE_SLUG: Record<UnitTypeId, number> = { residential: 1, school: 2, health: 3, police: 4, other: 5 };
const DB_REPORT_TYPES: ReportType[] = ['member_stats', 'task_summary', 'criteria_summary', 'annual'];
const SENSITIVE_MEMBER_COLUMNS = ['phone', 'religion', 'is_party_member', 'ethnicity_id'] as const;

type Row = Record<string, any>;

export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Trừ n năm khỏi chuỗi ngày YYYY-MM-DD (xử lý 29/02) */
function subYears(date: string, years: number): string {
  const y = Number(date.slice(0, 4)) - years;
  let md = date.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (md === '02-29' && !leap) md = '02-28';
  return `${String(y).padStart(4, '0')}-${md}`;
}

function ageOn(birthDate: string, today: string): number {
  let age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  if (today.slice(5) < birthDate.slice(5)) age -= 1;
  return age;
}

function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  return '*'.repeat(Math.max(phone.length - 3, 0)) + phone.slice(-3);
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const emptyToNull = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim());

/** Đổi lỗi kỹ thuật của Supabase thành câu tiếng Việt dễ hiểu */
export function friendlyError(error: { code?: string; message?: string; details?: string } | null | undefined): string {
  if (!error) return 'Có lỗi không xác định';
  const msg = error.message ?? '';
  if (/row-level security|permission denied/i.test(msg)) return 'Bạn không có quyền thực hiện thao tác này';
  switch (error.code) {
    case '23505': return 'Dữ liệu bị trùng với một bản ghi đã có';
    case '23503': return 'Dữ liệu đang được dùng ở nơi khác nên không thể thực hiện thao tác này';
    case '23514': return 'Dữ liệu không hợp lệ (vi phạm ràng buộc của hệ thống)';
    case '23502': return 'Thiếu thông tin bắt buộc';
    default: return msg || 'Có lỗi không xác định';
  }
}

function fail(error: any): never {
  throw new Error(friendlyError(error));
}

export async function fetchAll<T = Row>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await make(from, from + size - 1);
    if (error) fail(error);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

// ---------------------------------------------------------------------
// Bộ chuyển đổi dòng CSDL -> kiểu của giao diện
// ---------------------------------------------------------------------
function toUnit(r: Row): DbUnit {
  return {
    id: String(r.id), name: r.name, note: r.note ?? undefined,
    unit_type_id: SLUG_BY_UNIT_TYPE_DB_ID[r.unit_type_id] ?? 'other',
    is_active: r.is_active, union_member_count: r.union_member_count ?? 0, youth_count: r.youth_count ?? 0,
  };
}

function toMember(r: Row): DbMember {
  return {
    id: String(r.id), full_name: r.full_name, birth_date: r.birth_date, gender: r.gender as Gender,
    phone: str(r.phone), joined_date: str(r.joined_date), unit_id: String(r.unit_id),
    current_position: r.current_position as CurrentPosition, planned_position: r.planned_position ?? undefined,
    education_grade: str(r.education_grade), specialization: r.specialization ?? undefined,
    political_theory_level: (r.political_theory_level ?? 'elementary') as PoliticalTheoryLevel,
    is_active: r.is_active, religion: str(r.religion), is_party_member: r.is_party_member ?? false,
    ethnicity_id: str(r.ethnicity_id), avatar_url: str(r.avatar_url), current_job: str(r.current_job),
    central_member_code: str(r.central_member_code), note: r.note ?? undefined,
  };
}

function toCommittee(r: Row): DbUnitCommittee {
  return {
    id: String(r.id), unit_id: r.unit_id === null ? null : String(r.unit_id), member_id: String(r.member_id),
    position: r.position as CommitteePosition, is_standing: r.is_standing, term_start: r.term_start, term_end: r.term_end,
  };
}

const REPORT_TYPE_LABEL: Record<string, string> = {
  member_stats: 'Thống kê đoàn viên', task_summary: 'Tổng hợp nhiệm vụ', criteria_summary: 'Tổng hợp tiêu chí', annual: 'Báo cáo năm',
};

function toReport(r: Row): DbReport {
  const data = (r.data ?? {}) as Record<string, unknown>;
  const title = typeof data.title === 'string' && data.title ? data.title
    : `${REPORT_TYPE_LABEL[r.report_type] ?? r.report_type} ${r.period_start} đến ${r.period_end}`;
  return {
    id: String(r.id), title, report_type: r.report_type as ReportType, type: r.report_type as ReportType,
    period_start: r.period_start, period_end: r.period_end, unit_id: r.unit_id === null ? null : String(r.unit_id),
    data, created_by: str(r.created_by), created_at: r.created_at,
  };
}

// ----- Tiêu chí -----------------------------------------------------
export function toCriteriaSet(r: Row): DbCriteriaSet {
  return {
    id: String(r.id), year: r.year, name: r.name, issuing_unit: r.issuing_unit,
    archived_at: r.archived_at ?? null,
  };
}

export function toCriteriaSection(r: Row): DbCriteriaSection {
  return { id: String(r.id), criteria_set_id: String(r.criteria_set_id), stt: r.stt, name: r.name };
}

export function toCriterion(r: Row): DbCriterion {
  return { id: String(r.id), section_id: String(r.section_id), stt: r.stt, name: r.name };
}

/** DB lưu deadline là `date` (YYYY-MM-DD); UI dùng chuỗi ISO. */
export function toSubCriterion(r: Row): DbSubCriterion {
  const deadline = r.deadline ? String(r.deadline) : '';
  return {
    id: String(r.id),
    criterion_id: String(r.criterion_id),
    condition_text: r.condition_text,
    max_score: Number(r.max_score ?? 0),
    evaluation_method: r.evaluation_method ?? '',
    evidence_requirement: r.evidence_requirement ?? '',
    scoring_rule: r.scoring_rule ?? '',
    deadline,
    unit_type_id: r.unit_type_id === null || r.unit_type_id === undefined ? null : (SLUG_BY_UNIT_TYPE_DB_ID[r.unit_type_id] ?? 'other'),
    unit_id: r.unit_id === null || r.unit_id === undefined ? null : String(r.unit_id),
    unit_type_ids: ((r.unit_type_ids ?? []) as number[]).map((id) => SLUG_BY_UNIT_TYPE_DB_ID[id] ?? 'other'),
    unit_ids: ((r.unit_ids ?? []) as Array<number | string>).map((id) => String(id)),
    note: r.note ?? undefined,
  };
}

export function toCriterionSubmission(r: Row): DbCriterionSubmission {
  return {
    id: String(r.id), sub_criterion_id: String(r.sub_criterion_id), unit_id: String(r.unit_id),
    self_score: Number(r.self_score ?? 0),
    approved_score: r.approved_score === null || r.approved_score === undefined ? null : Number(r.approved_score),
    status: r.status as ReviewStatus,
    note: r.note ?? undefined,
    submitted_by: str(r.submitted_by), submitted_at: r.submitted_at,
    reviewed_by: r.reviewed_by === null ? null : String(r.reviewed_by),
    reviewed_at: r.reviewed_at,
    review_note: r.review_note ?? undefined,
  };
}

// ----- Nhiệm vụ / Duyệt / Nhắc nhở -----------------------------------
/** DB lưu due_date là `date` (YYYY-MM-DD); UI dùng chuỗi ISO. */
export function toTask(r: Row): DbTask {
  return {
    id: String(r.id), title: r.title, content: r.content,
    due_date: r.due_date ? String(r.due_date) : '',
    assigned_by: str(r.assigned_by), assigned_at: r.assigned_at,
    status: r.status as TaskStatus,
    reminder_days: ((r.reminder_days ?? []) as number[]).map(Number),
    target: r.target ?? '',
    evaluation_criteria: r.evaluation_criteria ?? undefined,
    max_score: Number(r.max_score ?? 0),
    lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
    lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
    closed_by: r.closed_by === null || r.closed_by === undefined ? null : String(r.closed_by),
    closed_at: r.closed_at ?? null,
    submit_scope: r.submit_scope === 'open' ? 'open' : 'assigned',
  };
}

export function toTaskUnit(r: Row): DbTaskUnit {
  return { task_id: String(r.task_id), unit_id: String(r.unit_id) };
}

export function toTaskSubCriterion(r: Row): DbTaskSubCriterion {
  return {
    task_id: String(r.task_id), sub_criterion_id: String(r.sub_criterion_id),
    contribution_score: Number(r.contribution_score ?? 0),
  };
}

export function toTaskRegistration(r: Row): DbTaskRegistration {
  return {
    id: String(r.id), task_id: String(r.task_id), member_id: String(r.member_id), is_joining: r.is_joining,
  };
}

export function toTaskResult(r: Row): DbTaskResult {
  return {
    id: String(r.id), task_id: String(r.task_id), unit_id: String(r.unit_id),
    completed_at: r.completed_at ? String(r.completed_at) : '',
    is_overdue: !!r.is_overdue,
    lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
    lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
    note: r.note ?? undefined,
    participant_count: Number(r.participant_count ?? 0),
    submitted_by: str(r.submitted_by),
    status: r.status as ReviewStatus,
    reviewed_by: r.reviewed_by === null ? null : String(r.reviewed_by),
    reviewed_at: r.reviewed_at,
    review_note: r.review_note ?? undefined,
  };
}

export function toMemberSubmission(r: Row): DbMemberSubmission {
  return {
    id: String(r.id), task_id: String(r.task_id), member_id: String(r.member_id), unit_id: String(r.unit_id),
    note: r.note ?? undefined,
    lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
    lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
    status: r.status as ReviewStatus,
    submitted_at: r.submitted_at ? String(r.submitted_at) : '',
    reviewed_by: r.reviewed_by === null || r.reviewed_by === undefined ? null : String(r.reviewed_by),
    reviewed_at: r.reviewed_at ?? null,
    review_note: r.review_note ?? undefined,
  };
}

export function toEvidence(r: Row): DbEvidence {
  return {
    id: String(r.id),
    task_id: r.task_id === null ? null : String(r.task_id),
    submission_id: r.submission_id === null ? null : String(r.submission_id),
    member_submission_id: r.member_submission_id === null || r.member_submission_id === undefined ? null : String(r.member_submission_id),
    member_id: str(r.member_id), unit_id: str(r.unit_id),
    evidence_type: r.evidence_type as EvidenceType,
    storage_path: r.storage_path ?? '', url: r.url ?? '', file_name: r.file_name ?? '',
    captured_at: r.captured_at ? String(r.captured_at) : '',
    uploaded_at: r.created_at ? String(r.created_at) : '',
    lat: r.lat === null || r.lat === undefined ? null : Number(r.lat),
    lng: r.lng === null || r.lng === undefined ? null : Number(r.lng),
    source: r.source as EvidenceSource,
    file_hash: r.file_hash ?? '', is_locked: !!r.is_locked,
  };
}

export function toNotification(r: Row): DbNotification {
  return {
    id: String(r.id), recipient_id: str(r.recipient_id),
    type: r.type as NotificationType, level: r.level as NotificationLevel,
    title: r.title, body: r.body,
    task_id: r.task_id === null ? null : String(r.task_id),
    sub_criterion_id: r.sub_criterion_id === null ? null : String(r.sub_criterion_id),
    is_read: !!r.is_read, created_at: r.created_at,
  };
}

export function toWarning(r: Row): DbWarning {
  return {
    id: String(r.id), unit_id: str(r.unit_id),
    task_id: r.task_id === null ? null : String(r.task_id),
    sub_criterion_id: r.sub_criterion_id === null ? null : String(r.sub_criterion_id),
    codes: (r.codes ?? []) as Array<'DUE_SOON' | 'OVERDUE'>,
    level: r.level as 'yellow' | 'orange' | 'red',
    message: r.message, is_read: !!r.is_read,
    resolved_at: r.resolved_at,
  };
}

// ---------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------
export interface CurrentUser {
  profileId: string;
  email: string | null;
  role: RoleId;
  memberId: string | null;
  isActive: boolean;
}

export type SaveMemberResult = { success: boolean; message?: string; member?: DbMember; code?: 'DUPLICATE' | 'INVALID' | 'FORBIDDEN' };
export type ImportMembersResult = {
  importedCount: number;
  errors: Array<{ row: number; message: string }>;
  ignoredColumns: string[];
  dryRun: boolean;
};

type Gd1Keys =
  | 'getSignupOptions' | 'selfRegisterMember'
  | 'listJournalEntries' | 'saveJournalEntry' | 'deleteJournalEntry' | 'uploadJournalImage'
  | 'getCurrentUser'
  | 'listMyTodo' | 'uploadEvidence' | 'submitTaskResult' | 'submitCriterionSubmission'
  | 'updateMyProfile' | 'listMyFeed' | 'setTaskRegistration'
  | 'submitMemberResult' | 'listMemberSubmissions' | 'reviewMemberSubmission'
  | 'listMemberSubmissionEvidences' | 'listTaskParticipants' | 'listTaskParticipantsAll'
  | 'getDashboard' | 'listUnits' | 'getUnit' | 'saveUnit' | 'deactivateUnit' | 'createUnit' | 'deleteUnit'
  | 'listMembers' | 'getMember' | 'saveMember' | 'deleteMember' | 'importMembers'
  | 'listCommittees' | 'addCommitteeMember' | 'endCommitteeTerm'
  | 'listReports' | 'createReport' | 'getYearlySettings' | 'updateYearlySettings'
  | 'listUnitTypes' | 'saveUnitType' | 'deleteUnitType' | 'listEthnicities'
  | 'listProfiles' | 'setProfileRole' | 'toggleProfileActive' | 'linkProfileMember' | 'listAuditLogs'
  // Giai đoạn 2 — tiêu chí
  | 'listCriteriaSets' | 'getCriteriaTree' | 'saveCriteriaNode' | 'reorderCriteriaNodes'
  | 'cloneCriteriaSetFromPreviousYear' | 'importCriteriaTree'
  | 'deleteCriteriaSet' | 'restoreCriteriaSet' | 'getCriteriaSetImpact' | 'purgeCriteriaSet'
  // Giai đoạn 2 — nhiệm vụ / duyệt / nhắc nhở / điểm
  | 'listTasks' | 'getTask' | 'createTask' | 'publishTask' | 'closeTask' | 'deleteTask' | 'cloneTask'
  | 'remindUnit' | 'remindAllUnsubmitted' | 'setTaskSubCriteria' | 'countUnitsWithoutResult'
  | 'approveAllMemberSubmissions'
  | 'listPendingReviews' | 'getReviewDetail' | 'approve' | 'reject'
  | 'listWarnings' | 'resolveWarning' | 'sendNotification'
  | 'calculateUnitScores';

export class SupabaseGd1Repository implements Pick<Repository, Gd1Keys> {
  private roleNameById: Map<number, RoleId> | null = null;
  private roleIdByName: Map<string, number> | null = null;
  private currentUserCache: { at: number; value: CurrentUser | null } | null = null;
  /** Cache bản ghi yearly_settings của năm hiện tại (để biết bộ tiêu chí đã chốt). */
  private yearlySettingsCache: DbYearlySettings | null = null;

  constructor(private readonly supabase: SupabaseClient) {}

  // =====================================================================
  // SỔ TAY CÁ NHÂN — riêng tư tuyệt đối (RLS chỉ cho auth.uid() = profile_id)
  // =====================================================================

  private async requireProfileId(): Promise<string> {
    const { data: auth } = await this.supabase.auth.getUser();
    if (!auth.user) throw new Error('Chưa đăng nhập');
    return auth.user.id;
  }

  async listJournalEntries(): Promise<DbJournalEntry[]> {
    const profileId = await this.requireProfileId();
    const entries = await fetchAll((f, t) =>
      this.supabase.from('journal_entries').select('*')
        .eq('profile_id', profileId)
        .order('activity_date', { ascending: false })
        .order('id', { ascending: false })
        .range(f, t));

    const ids = entries.map((r: Row) => Number(r.id));
    const [images, links] = ids.length === 0
      ? [[], []]
      : await Promise.all([
          fetchAll((f, t) => this.supabase.from('journal_images').select('*').in('entry_id', ids).range(f, t)),
          fetchAll((f, t) => this.supabase.from('journal_links').select('*').in('entry_id', ids).range(f, t)),
        ]);

    const imgByEntry = new Map<string, Row[]>();
    for (const r of images) {
      const k = String(r.entry_id);
      imgByEntry.set(k, [...(imgByEntry.get(k) ?? []), r]);
    }
    const linkByEntry = new Map<string, Row[]>();
    for (const r of links) {
      const k = String(r.entry_id);
      linkByEntry.set(k, [...(linkByEntry.get(k) ?? []), r]);
    }

    return entries.map((r: Row) => ({
      id: String(r.id),
      profile_id: String(r.profile_id),
      title: String(r.title),
      activity_date: String(r.activity_date),
      note: r.note ?? undefined,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
      images: (imgByEntry.get(String(r.id)) ?? []).map((x: Row) => ({
        id: String(x.id), entry_id: String(x.entry_id),
        storage_path: String(x.storage_path), url: String(x.url),
        file_name: x.file_name ?? undefined,
      })),
      links: (linkByEntry.get(String(r.id)) ?? []).map((x: Row) => ({
        id: String(x.id), entry_id: String(x.entry_id),
        url: String(x.url), note: x.note ?? undefined,
      })),
    }));
  }

  async saveJournalEntry(input: {
    id?: string; title: string; activity_date: string; note?: string;
    images: Array<{ storagePath: string; url: string; fileName?: string }>;
    links: Array<{ url: string; note?: string }>;
  }): Promise<{ success: boolean; message?: string; entryId?: string }> {
    try {
      const profileId = await this.requireProfileId();
      const payload = {
        profile_id: profileId,
        title: input.title.trim(),
        activity_date: input.activity_date,
        note: emptyToNull(input.note),
        updated_at: new Date().toISOString(),
      };

      let entryId: string;
      if (input.id) {
        const { data, error } = await this.supabase.from('journal_entries')
          .update(payload).eq('id', Number(input.id)).eq('profile_id', profileId).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        entryId = String((data as Row).id);
        // Thay toàn bộ ảnh/link cũ bằng bộ mới
        await this.supabase.from('journal_images').delete().eq('entry_id', Number(entryId));
        await this.supabase.from('journal_links').delete().eq('entry_id', Number(entryId));
      } else {
        const { data, error } = await this.supabase.from('journal_entries').insert(payload).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        entryId = String((data as Row).id);
      }

      if (input.images.length > 0) {
        const { error } = await this.supabase.from('journal_images').insert(
          input.images.map(i => ({
            entry_id: Number(entryId), profile_id: profileId,
            storage_path: i.storagePath, url: i.url, file_name: i.fileName ?? null,
          }))
        );
        if (error) return { success: false, message: friendlyError(error) };
      }
      if (input.links.length > 0) {
        const { error } = await this.supabase.from('journal_links').insert(
          input.links.map(l => ({
            entry_id: Number(entryId), profile_id: profileId,
            url: l.url.trim(), note: emptyToNull(l.note),
          }))
        );
        if (error) return { success: false, message: friendlyError(error) };
      }
      return { success: true, entryId };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async deleteJournalEntry(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const profileId = await this.requireProfileId();
      // Xóa ảnh trong Storage trước (chỉ file thuộc thư mục của mình)
      const imgs = await fetchAll((f, t) =>
        this.supabase.from('journal_images').select('storage_path').eq('entry_id', Number(id)).eq('profile_id', profileId).range(f, t));
      const paths = imgs.map((r: Row) => String(r.storage_path)).filter(Boolean);
      if (paths.length > 0) {
        await this.supabase.storage.from('evidences').remove(paths);
      }
      const { error } = await this.supabase.from('journal_entries')
        .delete().eq('id', Number(id)).eq('profile_id', profileId);
      if (error) return { success: false, message: friendlyError(error) };
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async uploadJournalImage(file: File): Promise<{ url: string; storagePath: string }> {
    const profileId = await this.requireProfileId();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const storagePath = `journal_${profileId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await this.supabase.storage.from('evidences').upload(storagePath, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
    });
    if (error) throw new Error(friendlyError(error));
    const { data } = this.supabase.storage.from('evidences').getPublicUrl(storagePath);
    return { url: data.publicUrl, storagePath };
  }

  // ----- Đăng ký tự phục vụ (Google lần đầu) --------------------------

  async getSignupOptions(): Promise<{
    units: Array<{ id: string; name: string; unit_type_id: UnitTypeId }>;
    ethnicities: Array<{ id: string; name: string }>;
  }> {
    const { data, error } = await this.supabase.rpc('signup_options');
    if (error) fail(error);
    const r = (data ?? {}) as Row;
    const units = ((r.units ?? []) as Row[]).map((u) => ({
      id: String(u.id),
      name: String(u.name),
      unit_type_id: (SLUG_BY_UNIT_TYPE_DB_ID[Number(u.unit_type_id)] ?? 'other') as UnitTypeId,
    }));
    const ethnicities = ((r.ethnicities ?? []) as Row[]).map((e) => ({ id: String(e.id), name: String(e.name) }));
    return { units, ethnicities };
  }

  async selfRegisterMember(input: {
    full_name: string; birth_date: string; gender: string; unit_id: string;
    phone?: string; joined_date?: string; education_grade?: string; specialization?: string;
    political_theory_level?: string; religion?: string; is_party_member?: boolean;
    ethnicity_id?: string; avatar_url?: string; current_job?: string;
  }): Promise<{ success: boolean; message?: string; memberId?: string }> {
    const { data, error } = await this.supabase.rpc('self_register_member', { p: input });
    if (error) return { success: false, message: friendlyError(error) };
    const r = (data ?? {}) as Row;
    if (!r.success) return { success: false, message: r.message ?? 'Không tạo được hồ sơ' };
    this.clearCache();
    return { success: true, memberId: r.member_id === undefined ? undefined : String(r.member_id) };
  }

  // ----- Người dùng hiện tại -----------------------------------------
  /** Người đang đăng nhập (null nếu chưa đăng nhập). Cache 30 giây. */
  async getCurrentUser(force = false): Promise<CurrentUser | null> {
    const now = Date.now();
    if (!force && this.currentUserCache && now - this.currentUserCache.at < 30_000) return this.currentUserCache.value;
    const { data: auth } = await this.supabase.auth.getUser();
    let value: CurrentUser | null = null;
    if (auth.user) {
      const { data, error } = await this.supabase
        .from('profiles').select('id, member_id, is_active, role:roles(name)').eq('id', auth.user.id).maybeSingle();
      if (error) fail(error);
      if (data) {
        const role = (Array.isArray((data as Row).role) ? (data as Row).role[0] : (data as Row).role) as Row | null;
        value = {
          profileId: auth.user.id, email: auth.user.email ?? null, role: (role?.name ?? 'member') as RoleId,
          memberId: (data as Row).member_id === null ? null : String((data as Row).member_id), isActive: (data as Row).is_active,
        };
      }
    }
    this.currentUserCache = { at: now, value };
    return value;
  }

  clearCache(): void {
    this.currentUserCache = null;
  }

  /** Bảng đọc đoàn viên: admin đọc bảng gốc, staff / bí thư chi đoàn đọc khung nhìn đã ẩn cột nhạy cảm */
  private async memberSource(): Promise<'members' | 'members_limited'> {
    const user = await this.getCurrentUser();
    return user && (user.role === 'staff' || user.role === 'unit_secretary') ? 'members_limited' : 'members';
  }

  private async loadRoles(): Promise<void> {
    if (this.roleNameById) return;
    const { data, error } = await this.supabase.from('roles').select('id, name');
    if (error) fail(error);
    this.roleNameById = new Map((data ?? []).map((r: Row) => [Number(r.id), r.name as RoleId]));
    this.roleIdByName = new Map((data ?? []).map((r: Row) => [String(r.name), Number(r.id)]));
  }

  private async fetchMembersByIds(ids: number[]): Promise<Map<string, DbMember>> {
    const out = new Map<string, DbMember>();
    if (ids.length === 0) return out;
    const table = await this.memberSource();
    const unique = Array.from(new Set(ids));
    for (let i = 0; i < unique.length; i += 200) {
      const { data, error } = await this.supabase.from(table).select('*').in('id', unique.slice(i, i + 200));
      if (error) fail(error);
      for (const r of data ?? []) out.set(String(r.id), toMember(r));
    }
    return out;
  }

  private async unitNameMap(): Promise<Map<string, string>> {
    const rows = await fetchAll((f, t) => this.supabase.from('units').select('id, name').range(f, t));
    return new Map(rows.map((r) => [String(r.id), r.name as string]));
  }

  // ----- Dashboard (phần giai đoạn 1) -----------------------------------
  async getDashboard(year: number): Promise<DashboardStats> {
    const table = await this.memberSource();
    const today = todayVN();
    const settings = await this.getYearlySettings(year);
    const members = await fetchAll((f, t) =>
      this.supabase.from(table).select('id, birth_date, joined_date').eq('is_active', true).range(f, t));
    const units = await this.supabase.from('units').select('id', { count: 'exact', head: true }).eq('is_active', true);
    if (units.error) fail(units.error);

    const countPending = async (tableName: string): Promise<number> => {
      const r = await this.supabase.from(tableName).select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return r.error ? 0 : (r.count ?? 0);   // chưa có quyền / chưa dùng: coi như 0
    };
    const [taskPending, criteriaPending] = await Promise.all([countPending('task_results'), countPending('criterion_submissions')]);

    // Số tổng hợp lấy từ RPC để mọi vai trò thấy cùng một con số
    // (RLS members_select khiến đoàn viên chỉ đọc được đúng dòng của mình).
    let totals: Row | null = null;
    const rpc = await this.supabase.rpc('stats_overview');
    if (!rpc.error && rpc.data) totals = rpc.data as Row;

    return {
      pendingCount: taskPending + criteriaPending,
      taskPendingCount: taskPending,
      criteriaPendingCount: criteriaPending,
      overdueUnitsCount: 0,    // giai đoạn 2: cần dữ liệu nhiệm vụ / tiêu chí
      dueSoon7DaysCount: 0,    // giai đoạn 2
      newMembersCount: members.filter((m) => m.joined_date && Number(String(m.joined_date).slice(0, 4)) === year).length,
      maturedCount: members.filter((m) => ageOn(m.birth_date, today) >= settings.matured_age).length,
      totalMembers: totals ? Number(totals.total_members ?? 0) : members.length,
      totalUnits: totals ? Number(totals.total_units ?? 0) : (units.count ?? 0),
    };
  }

  // ----- Chi đoàn -----------------------------------------------------
  async listUnits(filters?: { unitTypeId?: UnitTypeId; search?: string; isActive?: boolean }) {
    let q = this.supabase.from('units').select('*').order('name');
    if (filters?.unitTypeId) q = q.eq('unit_type_id', DB_ID_BY_UNIT_TYPE_SLUG[filters.unitTypeId]);
    if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive);
    const { data, error } = await q;
    if (error) fail(error);
    let units = (data ?? []).map(toUnit);
    if (filters?.search) {
      const s = normalizeText(filters.search);
      units = units.filter((u) => normalizeText(u.name).includes(s));
    }

    const table = await this.memberSource();
    const members = await fetchAll((f, t) => this.supabase.from(table).select('id, unit_id, current_position').eq('is_active', true).range(f, t));
    const actualCount = new Map<string, number>();
    const secretaryByUnit = new Map<string, string>();   // dự phòng theo members.current_position
    for (const m of members) {
      const uid = String(m.unit_id);
      actualCount.set(uid, (actualCount.get(uid) ?? 0) + 1);
      if (m.current_position === 'secretary') secretaryByUnit.set(uid, String(m.id));
    }

    const committees = await fetchAll((f, t) =>
      this.supabase.from('unit_committees').select('unit_id, member_id').eq('position', 'secretary').is('term_end', null).not('unit_id', 'is', null).range(f, t));
    const committeeSecretary = new Map<string, string>(committees.map((c) => [String(c.unit_id), String(c.member_id)]));

    const wanted = units.map((u) => committeeSecretary.get(u.id) ?? secretaryByUnit.get(u.id)).filter((x): x is string => !!x).map(Number);
    const memberMap = await this.fetchMembersByIds(wanted);

    const warnRows = await this.supabase.from('warnings').select('unit_id').is('resolved_at', null);
    const openWarnings = new Map<string, number>();
    if (!warnRows.error) for (const w of warnRows.data ?? []) openWarnings.set(String(w.unit_id), (openWarnings.get(String(w.unit_id)) ?? 0) + 1);

    return units.map((unit) => {
      const secId = committeeSecretary.get(unit.id) ?? secretaryByUnit.get(unit.id);
      const currentSecretary = secId ? memberMap.get(secId) ?? null : null;
      const actual = actualCount.get(unit.id) ?? 0;
      return {
        unit, currentSecretary, hasMissingSecretary: !currentSecretary && unit.is_active,
        actualMemberCount: actual, declaredMemberCount: unit.union_member_count,
        hasCountMismatch: actual !== unit.union_member_count, openWarningsCount: openWarnings.get(unit.id) ?? 0,
      };
    });
  }

  async getUnit(id: string) {
    const { data, error } = await this.supabase.from('units').select('*').eq('id', Number(id)).maybeSingle();
    if (error) fail(error);
    if (!data) {
      return { unit: null, currentSecretary: null, members: [], committee: [], taskResults: [], submissions: [], score: null };
    }
    const table = await this.memberSource();
    const memberRows = await fetchAll((f, t) => this.supabase.from(table).select('*').eq('unit_id', Number(id)).order('full_name').range(f, t));
    const committeeRows = await this.supabase.from('unit_committees').select('*').eq('unit_id', Number(id)).order('term_start', { ascending: false });
    if (committeeRows.error) fail(committeeRows.error);
    const committee = (committeeRows.data ?? []).map(toCommittee);
    const members = memberRows.map(toMember);
    const secretaryId = committee.find((c) => c.position === 'secretary' && c.term_end === null)?.member_id;
    const currentSecretary = (secretaryId && members.find((m) => m.id === secretaryId))
      || members.find((m) => m.current_position === 'secretary' && m.is_active) || null;
    return { unit: toUnit(data), currentSecretary, members, committee, taskResults: [], submissions: [], score: null };
  }

  async saveUnit(id: string, updates: Partial<DbUnit>) {
    const payload: Row = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.note !== undefined) payload.note = emptyToNull(updates.note);
    if (updates.unit_type_id !== undefined) payload.unit_type_id = DB_ID_BY_UNIT_TYPE_SLUG[updates.unit_type_id];
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.union_member_count !== undefined) payload.union_member_count = updates.union_member_count;
    if (updates.youth_count !== undefined) payload.youth_count = updates.youth_count;
    const { data, error } = await this.supabase.from('units').update(payload).eq('id', Number(id)).select('id');
    if (error) fail(error);
    return { success: (data ?? []).length > 0 };
  }

  async deactivateUnit(id: string) {
    const table = await this.memberSource();
    const active = await this.supabase.from(table).select('id', { count: 'exact', head: true }).eq('unit_id', Number(id)).eq('is_active', true);
    if (active.error) fail(active.error);
    if ((active.count ?? 0) > 0) {
      return { success: false, message: `Chi đoàn còn ${active.count} đoàn viên đang hoạt động, hãy chuyển hoặc ngừng hoạt động họ trước` };
    }
    const { data, error } = await this.supabase.from('units').update({ is_active: false }).eq('id', Number(id)).select('id');
    if (error) return { success: false, message: friendlyError(error) };
    return (data ?? []).length > 0 ? { success: true } : { success: false, message: 'Không tìm thấy chi đoàn hoặc bạn không có quyền' };
  }

  async createUnit(input: {
    name: string; unit_type_id: UnitTypeId; note?: string; union_member_count?: number; youth_count?: number;
  }): Promise<{ success: boolean; message?: string; unit?: DbUnit }> {
    const name = input.name.trim();
    if (!name) return { success: false, message: 'Tên chi đoàn không được để trống' };
    const { data, error } = await this.supabase.from('units').insert({
      name,
      note: emptyToNull(input.note),
      unit_type_id: DB_ID_BY_UNIT_TYPE_SLUG[input.unit_type_id],
      is_active: true,
      union_member_count: input.union_member_count ?? 0,
      youth_count: input.youth_count ?? 0,
    }).select('*').single();
    if (error) {
      if (error.code === '23505') return { success: false, message: 'Đã có chi đoàn trùng tên' };
      return { success: false, message: friendlyError(error) };
    }
    return { success: true, unit: toUnit(data as Row) };
  }

  async deleteUnit(id: string): Promise<{ success: boolean; message?: string }> {
    const table = await this.memberSource();
    const memberCount = await this.supabase.from(table).select('id', { count: 'exact', head: true }).eq('unit_id', Number(id));
    if (memberCount.error) fail(memberCount.error);
    if ((memberCount.count ?? 0) > 0) {
      return { success: false, message: `Chi đoàn còn ${memberCount.count} đoàn viên, hãy chuyển hoặc xóa họ trước` };
    }
    const { data, error } = await this.supabase.from('units').delete().eq('id', Number(id)).select('id');
    if (error) {
      if (error.code === '23503') return { success: false, message: 'Chi đoàn còn dữ liệu liên quan (nhiệm vụ, BCH...), không thể xóa' };
      return { success: false, message: friendlyError(error) };
    }
    return (data ?? []).length > 0 ? { success: true } : { success: false, message: 'Không tìm thấy chi đoàn hoặc bạn không có quyền' };
  }

  // ----- Đoàn viên ------------------------------------------------------
  async listMembers(filters?: {
    search?: string; unitId?: string; gender?: string; position?: string; isPartyMember?: boolean;
    isActive?: boolean; ageMin?: number; ageMax?: number; isMatured?: boolean;
  }): Promise<MemberComputed[]> {
    const table = await this.memberSource();
    const today = todayVN();
    const year = Number(today.slice(0, 4));
    const settings = await this.getYearlySettings(year);
    const unitNames = await this.unitNameMap();

    const rows = await fetchAll((f, t) => {
      let q = this.supabase.from(table).select('*').order('full_name').order('id').range(f, t);
      if (filters?.unitId) q = q.eq('unit_id', Number(filters.unitId));
      if (filters?.gender) q = q.eq('gender', filters.gender);
      if (filters?.position) q = q.eq('current_position', filters.position);
      if (filters?.isActive !== undefined) q = q.eq('is_active', filters.isActive);
      if (filters?.isPartyMember !== undefined && table === 'members') q = q.eq('is_party_member', filters.isPartyMember);
      if (filters?.ageMin !== undefined) q = q.lte('birth_date', subYears(today, filters.ageMin));
      if (filters?.ageMax !== undefined) q = q.gt('birth_date', subYears(today, filters.ageMax + 1));
      return q;
    });

    let list = rows.map((r) => {
      const member = toMember(r);
      const age = ageOn(member.birth_date, today);
      return {
        member, age, is_matured: age >= settings.matured_age,
        unit_name: unitNames.get(member.unit_id) ?? '', phone_masked: maskPhone(member.phone),
      } as MemberComputed;
    });
    if (filters?.isMatured !== undefined) list = list.filter((m) => m.is_matured === filters.isMatured);
    if (filters?.search) {
      const s = normalizeText(filters.search);
      list = list.filter((m) =>
        normalizeText(m.member.full_name).includes(s) || m.member.phone.includes(filters.search!) ||
        normalizeText(m.member.central_member_code).includes(s));
    }
    return list;
  }

  async getMember(id: string) {
    const table = await this.memberSource();
    const { data, error } = await this.supabase.from(table).select('*').eq('id', Number(id)).maybeSingle();
    if (error) fail(error);
    if (!data) return { member: null, unit: null, profile: null, committeeHistory: [], taskRegistrations: [] };
    const member = toMember(data);

    const unitRes = await this.supabase.from('units').select('*').eq('id', Number(member.unit_id)).maybeSingle();
    const profileRes = await this.supabase.from('profiles').select('id, member_id, is_active, role:roles(name)').eq('member_id', Number(id)).maybeSingle();
    const historyRes = await this.supabase.from('unit_committees').select('*').eq('member_id', Number(id)).order('term_start', { ascending: false });
    const regRes = await this.supabase.from('task_registrations').select('*').eq('member_id', Number(id));

    let profile: DbProfile | null = null;
    if (!profileRes.error && profileRes.data) {
      const p = profileRes.data as Row;
      const role = (Array.isArray(p.role) ? p.role[0] : p.role) as Row | null;
      profile = { id: p.id, member_id: String(p.member_id), role_id: (role?.name ?? 'member') as RoleId, is_active: p.is_active };
    }
    return {
      member,
      unit: unitRes.data ? toUnit(unitRes.data) : null,
      profile,
      committeeHistory: (historyRes.data ?? []).map(toCommittee),
      taskRegistrations: (regRes.data ?? []).map((r: Row) => ({
        id: String(r.id), task_id: String(r.task_id), member_id: String(r.member_id), is_joining: r.is_joining,
      })),
    };
  }

  /** Chuyển DbMember của giao diện thành payload JSON cho hàm member_add / member_update */
  private memberPayload(input: Partial<DbMember>, canEditSensitive: boolean): Row {
    const p: Row = {};
    const set = (k: string, v: unknown) => { p[k] = v; };
    if (input.full_name !== undefined) set('full_name', input.full_name);
    if (input.birth_date !== undefined) set('birth_date', input.birth_date);
    if (input.gender !== undefined) set('gender', input.gender);
    if (input.joined_date !== undefined) set('joined_date', emptyToNull(input.joined_date));
    if (input.unit_id !== undefined) set('unit_id', Number(input.unit_id));
    if (input.current_position !== undefined) set('current_position', input.current_position);
    if (input.planned_position !== undefined) set('planned_position', input.planned_position);
    if (input.education_grade !== undefined) set('education_grade', emptyToNull(input.education_grade));
    if (input.specialization !== undefined) set('specialization', emptyToNull(input.specialization));
    if (input.political_theory_level !== undefined) set('political_theory_level', input.political_theory_level);
    if (input.avatar_url !== undefined) set('avatar_url', emptyToNull(input.avatar_url));
    if (input.current_job !== undefined) set('current_job', emptyToNull(input.current_job));
    if (input.central_member_code !== undefined) set('central_member_code', emptyToNull(input.central_member_code));
    if (input.note !== undefined) set('note', emptyToNull(input.note));
    if (canEditSensitive) {
      if (input.phone !== undefined) set('phone', emptyToNull(input.phone));
      if (input.religion !== undefined) set('religion', emptyToNull(input.religion));
      if (input.is_party_member !== undefined) set('is_party_member', input.is_party_member);
      if (input.ethnicity_id !== undefined) set('ethnicity_id', emptyToNull(input.ethnicity_id));
    }
    return p;
  }

  /**
   * Thêm (không có id) hoặc sửa (có id) đoàn viên qua hàm member_add / member_update.
   * Trùng đoàn viên: trả code = 'DUPLICATE'; người dùng xác nhận thì gọi lại với { force: true }.
   * Đổi chi đoàn / trạng thái hoạt động không đi qua đây: dùng transferMember / setMemberActive.
   */
  async saveMember(input: Omit<DbMember, 'id'> & { id?: string }, options?: { force?: boolean }): Promise<SaveMemberResult> {
    const user = await this.getCurrentUser();
    const canEditSensitive = !user || user.role === 'admin' || user.role === 'super_admin';
    const payload = this.memberPayload(input, canEditSensitive);

    if (input.id) {
      delete payload.unit_id;   // đổi chi đoàn phải dùng transferMember
      const { data, error } = await this.supabase.rpc('member_update', { p_id: Number(input.id), p: payload });
      if (error) return { success: false, message: friendlyError(error), code: error.code === '42501' ? 'FORBIDDEN' : 'INVALID' };
      const r = data as Row;
      if (!r.success) return { success: false, message: r.message, code: 'INVALID' };
      const fresh = await this.getMember(input.id);
      return { success: true, member: fresh.member ?? undefined };
    }

    const { data, error } = await this.supabase.rpc('member_add', { p: payload, p_force: options?.force ?? false });
    if (error) return { success: false, message: friendlyError(error), code: error.code === '42501' ? 'FORBIDDEN' : 'INVALID' };
    const r = data as Row;
    if (!r.success) return { success: false, message: r.message, code: r.code === 'DUPLICATE' ? 'DUPLICATE' : 'INVALID' };
    const fresh = await this.getMember(String(r.id));
    return { success: true, member: fresh.member ?? undefined };
  }

  async transferMember(id: string, unitId: string): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await this.supabase.rpc('member_transfer', { p_id: Number(id), p_unit_id: Number(unitId) });
    if (error) return { success: false, message: friendlyError(error) };
    const r = data as Row;
    return r.success ? { success: true } : { success: false, message: r.message };
  }

  async setMemberActive(id: string, active: boolean): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await this.supabase.rpc('member_set_active', { p_id: Number(id), p_active: active });
    if (error) return { success: false, message: friendlyError(error) };
    const r = data as Row;
    return r.success ? { success: true } : { success: false, message: r.message };
  }

  /** Xóa hẳn chỉ làm được khi đoàn viên chưa phát sinh dữ liệu; thường nên dùng setMemberActive(false) */
  async deleteMember(id: string): Promise<{ success: boolean }> {
    const { data, error } = await this.supabase.from('members').delete().eq('id', Number(id)).select('id');
    if (error) fail(error);
    return { success: (data ?? []).length > 0 };
  }

  /** Nhập thật. Muốn xem trước (không ghi) dùng previewImportMembers. */
  async importMembers(rows: Array<Omit<DbMember, 'id'>>): Promise<ImportMembersResult> {
    return this.runImport(rows as unknown as Row[], false);
  }

  async previewImportMembers(rows: Array<Record<string, unknown>>): Promise<ImportMembersResult> {
    return this.runImport(rows, true);
  }

  private async runImport(rows: Row[], dryRun: boolean): Promise<ImportMembersResult> {
    const { data, error } = await this.supabase.rpc('members_import', { p_rows: rows, p_dry_run: dryRun });
    if (error) fail(error);
    const r = data as Row;
    return { importedCount: r.imported, errors: r.errors ?? [], ignoredColumns: r.ignored_columns ?? [], dryRun: !!r.dry_run };
  }

  // ----- Ban chấp hành -----------------------------------------------------
  async listCommittees(unitId: string | null, termStatus: 'active' | 'ended' | 'all' = 'active') {
    let q = this.supabase.from('unit_committees').select('*').order('term_start', { ascending: false });
    q = unitId === null ? q.is('unit_id', null) : q.eq('unit_id', Number(unitId));
    if (termStatus === 'active') q = q.is('term_end', null);
    if (termStatus === 'ended') q = q.not('term_end', 'is', null);
    const { data, error } = await q;
    if (error) fail(error);
    const committees = (data ?? []).map(toCommittee);
    const members = await this.fetchMembersByIds(committees.map((c) => Number(c.member_id)));
    const out: Array<{ committee: DbUnitCommittee; member: DbMember }> = [];
    for (const committee of committees) {
      const member = members.get(committee.member_id);
      if (member) out.push({ committee, member });
    }
    return out;
  }

  async addCommitteeMember(input: {
    memberId: string; unitId: string | null; position: CommitteePosition; isStanding: boolean; termStart: string;
  }): Promise<{ success: boolean; message?: string }> {
    if (input.position === 'member') return { success: false, message: 'Chức vụ trong BCH phải là Bí thư, Phó bí thư hoặc Ủy viên' };
    const { data: m, error: mErr } = await this.supabase.from('members').select('id, unit_id, is_active').eq('id', Number(input.memberId)).maybeSingle();
    if (mErr) return { success: false, message: friendlyError(mErr) };
    if (!m) return { success: false, message: 'Không tìm thấy đoàn viên' };
    if (!m.is_active) return { success: false, message: 'Đoàn viên đã ngừng hoạt động' };
    if (input.unitId !== null && String(m.unit_id) !== input.unitId) {
      return { success: false, message: 'Đoàn viên không thuộc chi đoàn này nên không thể vào BCH của chi đoàn' };
    }
    const user = await this.getCurrentUser();
    const standing = input.position === 'secretary' || input.position === 'deputy_secretary' ? true : input.isStanding;
    const { error } = await this.supabase.from('unit_committees').insert({
      unit_id: input.unitId === null ? null : Number(input.unitId), member_id: Number(input.memberId), position: input.position,
      is_standing: standing, term_start: input.termStart, created_by: user?.memberId ? Number(user.memberId) : null,
    });
    if (error) {
      if (error.code === '23505' && /one_active_(commune_)?secretary/.test(error.message)) {
        return { success: false, message: 'Đã có bí thư đang giữ chức, hãy kết thúc nhiệm kỳ của người đó trước' };
      }
      if (error.code === '23505') return { success: false, message: 'Đoàn viên đã có chức vụ trong nhiệm kỳ bắt đầu ngày này' };
      return { success: false, message: friendlyError(error) };
    }
    return { success: true };
  }

  async endCommitteeTerm(id: string, endDate?: string): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await this.supabase.from('unit_committees')
      .update({ term_end: endDate ?? todayVN() }).eq('id', Number(id)).is('term_end', null).select('id');
    if (error) {
      return { success: false, message: error.code === '23514' ? 'Ngày kết thúc phải sau ngày bắt đầu nhiệm kỳ' : friendlyError(error) };
    }
    return (data ?? []).length > 0 ? { success: true } : { success: false, message: 'Không tìm thấy nhiệm kỳ đang giữ chức hoặc bạn không có quyền' };
  }

  // ----- Báo cáo -----------------------------------------------------------
  async listReports(): Promise<DbReport[]> {
    const { data, error } = await this.supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(toReport);
  }

  async createReport(input: {
    title: string; type: ReportType; periodStart: string; periodEnd: string; unitId: string | null;
    data: Record<string, unknown>; createdBy: string;
  }): Promise<DbReport> {
    if (!DB_REPORT_TYPES.includes(input.type)) {
      throw new Error(`Loại báo cáo "${input.type}" chưa được hỗ trợ (chỉ: ${DB_REPORT_TYPES.join(', ')})`);
    }
    const user = await this.getCurrentUser();
    const createdBy = user?.memberId ?? input.createdBy;
    const { data, error } = await this.supabase.from('reports').insert({
      report_type: input.type, period_start: input.periodStart, period_end: input.periodEnd,
      unit_id: input.unitId === null ? null : Number(input.unitId),
      data: { ...input.data, title: input.title }, created_by: numOrNull(createdBy),
    }).select('*').single();
    if (error) fail(error);
    return toReport(data as Row);
  }

  // ----- Cấu hình năm, danh mục ---------------------------------------------
  async getYearlySettings(year: number): Promise<DbYearlySettings> {
    const { data, error } = await this.supabase.from('yearly_settings').select('*').eq('year', year).maybeSingle();
    if (error) fail(error);
    if (!data) {
      const empty: DbYearlySettings = {
        year, criteria_set_id: '', matured_age: 30, new_member_target: 0,
        max_photos: 3, max_files: 3, max_links: 5, require_gps: true,
      };
      this.yearlySettingsCache = empty;
      return empty;
    }
    const result: DbYearlySettings = {
      year: data.year, criteria_set_id: str(data.criteria_set_id), matured_age: data.matured_age ?? 30,
      new_member_target: data.new_member_target ?? 0,
      max_photos: data.max_photos ?? 3, max_files: data.max_files ?? 3,
      max_links: data.max_links ?? 5, require_gps: data.require_gps ?? true,
    };
    this.yearlySettingsCache = result;
    return result;
  }

  async updateYearlySettings(year: number, updates: Partial<DbYearlySettings>): Promise<{ success: boolean }> {
    const payload: Row = { year };
    if (updates.criteria_set_id !== undefined) payload.criteria_set_id = numOrNull(updates.criteria_set_id);
    if (updates.matured_age !== undefined) payload.matured_age = updates.matured_age;
    if (updates.new_member_target !== undefined) payload.new_member_target = updates.new_member_target;
    if (updates.max_photos !== undefined) payload.max_photos = updates.max_photos;
    if (updates.max_files !== undefined) payload.max_files = updates.max_files;
    if (updates.max_links !== undefined) payload.max_links = updates.max_links;
    if (updates.require_gps !== undefined) payload.require_gps = updates.require_gps;
    const { data, error } = await this.supabase.from('yearly_settings').upsert(payload, { onConflict: 'year' }).select('year');
    if (error) fail(error);
    return { success: (data ?? []).length > 0 };
  }

  async listUnitTypes(): Promise<DbUnitType[]> {
    const { data, error } = await this.supabase.from('unit_types').select('id, name').order('id');
    if (error) fail(error);
    return (data ?? []).map((r: Row) => ({ id: SLUG_BY_UNIT_TYPE_DB_ID[r.id] ?? 'other', name: r.name as string }));
  }

  async saveUnitType(id: UnitTypeId, name: string): Promise<{ success: boolean }> {
    const { data, error } = await this.supabase.from('unit_types').update({ name: name.trim() }).eq('id', DB_ID_BY_UNIT_TYPE_SLUG[id]).select('id');
    if (error) fail(error);
    return { success: (data ?? []).length > 0 };
  }

  async deleteUnitType(id: UnitTypeId): Promise<{ success: boolean; message?: string }> {
    const { data, error } = await this.supabase.from('unit_types').delete().eq('id', DB_ID_BY_UNIT_TYPE_SLUG[id]).select('id');
    if (error) {
      return { success: false, message: error.code === '23503' ? 'Loại chi đoàn đang được dùng, không thể xóa' : friendlyError(error) };
    }
    return (data ?? []).length > 0 ? { success: true } : { success: false, message: 'Không tìm thấy hoặc bạn không có quyền' };
  }

  async listEthnicities(): Promise<DbEthnicity[]> {
    const { data, error } = await this.supabase.from('ethnicities').select('id, name').order('id');
    if (error) fail(error);
    return (data ?? []).map((r: Row) => ({ id: String(r.id), name: r.name as string }));
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — TIÊU CHÍ
  // =====================================================================

  /** Đổi mảng slug loại chi đoàn -> mảng id số để ghi DB. */
  private typeIdsToDb(ids: UnitTypeId[]): number[] {
    return (ids ?? []).map((s) => DB_ID_BY_UNIT_TYPE_SLUG[s]).filter((n) => Number.isFinite(n));
  }

  /** Đổi mảng id chi đoàn (chuỗi) -> mảng số để ghi DB. */
  private unitIdsToDb(ids: string[]): number[] {
    return (ids ?? []).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  }

  async listCriteriaSets(year?: number): Promise<
    Array<{
      criteriaSet: DbCriteriaSet;
      subCriteriaCount: number;
      isFinalizedForYear: boolean;
      scoringProgress: number;
    }>
  > {
    // Bộ đã lưu trữ bị ẩn khỏi mọi danh sách chọn (trang Tiêu chí, Cấu hình, chi đoàn)
    let q = this.supabase.from('criteria_sets').select('*').is('archived_at', null).order('year', { ascending: false });
    if (year) q = q.eq('year', year);
    const { data, error } = await q;
    if (error) fail(error);
    const sets = (data ?? []).map(toCriteriaSet);

    // Đếm tiêu chí con của từng bộ (qua sections -> criteria -> sub_criteria)
    const counts = new Map<string, number>();
    if (sets.length > 0) {
      const setIdList = sets.map((s) => Number(s.id));
      const secs = await fetchAll((f, t) =>
        this.supabase.from('criteria_sections').select('id, criteria_set_id').in('criteria_set_id', setIdList).range(f, t));
      const secToSet = new Map(secs.map((r: Row) => [String(r.id), String(r.criteria_set_id)]));
      const secIds = secs.map((r: Row) => Number(r.id));
      const crits = secIds.length
        ? await fetchAll((f, t) => this.supabase.from('criteria').select('id, section_id').in('section_id', secIds).range(f, t))
        : [];
      const critToSet = new Map(crits.map((r: Row) => [String(r.id), secToSet.get(String(r.section_id)) ?? '']));
      const critIds = crits.map((r: Row) => Number(r.id));
      const subs = critIds.length
        ? await fetchAll((f, t) => this.supabase.from('sub_criteria').select('id, criterion_id').in('criterion_id', critIds).range(f, t))
        : [];
      for (const s of subs) {
        const setId = critToSet.get(String(s.criterion_id));
        if (setId) counts.set(setId, (counts.get(setId) ?? 0) + 1);
      }
    }

    const finalSetId = str(this.yearlySettingsCache?.criteria_set_id ?? '');
    return sets.map((criteriaSet) => ({
      criteriaSet,
      subCriteriaCount: counts.get(criteriaSet.id) ?? 0,
      isFinalizedForYear: finalSetId !== '' && finalSetId === criteriaSet.id,
      scoringProgress: 0,
    }));
  }

  async getCriteriaTree(criteriaSetId: string): Promise<{
    sections: DbCriteriaSection[];
    criteria: DbCriterion[];
    subCriteria: DbSubCriterion[];
    totalMaxScore: number;
    orphanCount: number;
    isValid100: boolean;
  }> {
    const sections = await fetchAll((f, t) =>
      this.supabase.from('criteria_sections').select('*').eq('criteria_set_id', Number(criteriaSetId)).order('stt').range(f, t));
    const sectionIds = sections.map((r: Row) => Number(r.id));
    const criteria = sectionIds.length
      ? await fetchAll((f, t) => this.supabase.from('criteria').select('*').in('section_id', sectionIds).order('stt').range(f, t))
      : [];
    const criterionIds = criteria.map((r: Row) => Number(r.id));
    const subCriteria = criterionIds.length
      ? await fetchAll((f, t) => this.supabase.from('sub_criteria').select('*').in('criterion_id', criterionIds).order('id').range(f, t))
      : [];

    const mappedSubs = subCriteria.map(toSubCriterion);
    const criterionIdSet = new Set(criteria.map((r: Row) => String(r.id)));
    const totalMaxScore = mappedSubs.reduce((s, x) => s + x.max_score, 0);
    const orphanCount = mappedSubs.filter((s) => !criterionIdSet.has(s.criterion_id)).length;
    return {
      sections: sections.map(toCriteriaSection),
      criteria: criteria.map(toCriterion),
      subCriteria: mappedSubs,
      totalMaxScore,
      orphanCount,
      isValid100: totalMaxScore === 100 && orphanCount === 0,
    };
  }

  async saveCriteriaNode(
    type: 'section' | 'criterion' | 'subCriterion',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<{ success: boolean; message?: string }> {
    try {
      if (action === 'delete') {
        const id = Number(data.id);
        if (!Number.isFinite(id)) return { success: false, message: 'Thiếu mã nút cần xóa' };
        // Chặn xóa nếu đã có chi đoàn chấm (cascade xuống tiêu chí con)
        const subIds = await this.collectSubIds(type, id);
        if (subIds.length > 0) {
          const { count, error } = await this.supabase
            .from('criterion_submissions').select('id', { count: 'exact', head: true }).in('sub_criterion_id', subIds);
          if (error) fail(error);
          if ((count ?? 0) > 0) return { success: false, message: `Đã có ${count} chi đoàn chấm, không thể xóa!` };
        }
        const table = type === 'section' ? 'criteria_sections' : type === 'criterion' ? 'criteria' : 'sub_criteria';
        const { error } = await this.supabase.from(table).delete().eq('id', id);
        if (error) return { success: false, message: friendlyError(error) };
        return { success: true };
      }

      if (action === 'create') {
        if (type === 'section') {
          const { error } = await this.supabase.from('criteria_sections').insert({
            criteria_set_id: Number(data.criteria_set_id), stt: Number(data.stt), name: data.name,
            note: emptyToNull(data.note),
          });
          if (error) return { success: false, message: friendlyError(error) };
          return { success: true };
        }
        if (type === 'criterion') {
          const { error } = await this.supabase.from('criteria').insert({
            section_id: Number(data.section_id), stt: Number(data.stt), name: data.name,
            note: emptyToNull(data.note),
          });
          if (error) return { success: false, message: friendlyError(error) };
          return { success: true };
        }
        // subCriterion
        const { error } = await this.supabase.from('sub_criteria').insert(this.subCriterionPayload(data));
        if (error) return { success: false, message: friendlyError(error) };
        return { success: true };
      }

      // update
      const id = Number(data.id);
      if (!Number.isFinite(id)) return { success: false, message: 'Thiếu mã nút cần sửa' };
      const table = type === 'section' ? 'criteria_sections' : type === 'criterion' ? 'criteria' : 'sub_criteria';
      const payload: Row =
        type === 'subCriterion'
          ? this.subCriterionPayload(data, true)
          : { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.stt !== undefined ? { stt: Number(data.stt) } : {}) };
      const { data: updated, error } = await this.supabase.from(table).update(payload).eq('id', id).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((updated ?? []).length === 0) return { success: false, message: 'Không tìm thấy nút hoặc bạn không có quyền' };
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Payload ghi sub_criteria; forUpdate=true thì bỏ các trường không được phép đổi. */
  private subCriterionPayload(data: any, forUpdate = false): Row {
    const p: Row = {};
    const setIf = (k: string, v: unknown) => { if (v !== undefined) p[k] = v; };
    if (!forUpdate) setIf('criterion_id', data.criterion_id !== undefined ? Number(data.criterion_id) : undefined);
    setIf('condition_text', data.condition_text);
    setIf('max_score', data.max_score !== undefined ? Number(data.max_score) : undefined);
    setIf('evaluation_method', data.evaluation_method);
    setIf('evidence_requirement', data.evidence_requirement);
    setIf('scoring_rule', data.scoring_rule);
    if (data.deadline !== undefined) p.deadline = data.deadline ? String(data.deadline).slice(0, 10) : null;
    setIf('note', data.note !== undefined ? emptyToNull(data.note) : undefined);
    // Phân công: ưu tiên mảng mới; nếu chỉ có trường đơn thì suy ra mảng
    if (data.unit_type_ids !== undefined || data.unit_type_id !== undefined) {
      const ids: UnitTypeId[] = data.unit_type_ids ?? (data.unit_type_id ? [data.unit_type_id] : []);
      p.unit_type_ids = this.typeIdsToDb(ids);
    }
    if (data.unit_ids !== undefined || data.unit_id !== undefined) {
      const ids: string[] = data.unit_ids ?? (data.unit_id ? [data.unit_id] : []);
      p.unit_ids = this.unitIdsToDb(ids);
    }
    // Cột đơn cũ (legacy) phải nhất quán với FK kép (unit_id, unit_type_id):
    //  - có unit_ids cụ thể -> để unit_type_id rỗng, unit_id = chi đoàn đầu
    //  - không có unit_ids   -> unit_type_id = loại đầu (nếu có), unit_id rỗng
    if (p.unit_ids !== undefined || p.unit_type_ids !== undefined) {
      const firstUnit = (p.unit_ids as number[] | undefined)?.[0] ?? null;
      const firstType = (p.unit_type_ids as number[] | undefined)?.[0] ?? null;
      if (firstUnit !== null) {
        p.unit_id = firstUnit;
        p.unit_type_id = null;
      } else {
        p.unit_id = null;
        p.unit_type_id = firstType;
      }
    }
    return p;
  }

  /** Thu thập id các tiêu chí con thuộc một nút (để kiểm tra ràng buộc khi xóa). */
  private async collectSubIds(type: 'section' | 'criterion' | 'subCriterion', id: number): Promise<number[]> {
    if (type === 'subCriterion') return [id];
    if (type === 'criterion') {
      const subs = await fetchAll((f, t) => this.supabase.from('sub_criteria').select('id').eq('criterion_id', id).range(f, t));
      return subs.map((r: Row) => Number(r.id));
    }
    const secs = await fetchAll((f, t) => this.supabase.from('criteria').select('id').eq('section_id', id).range(f, t));
    const critIds = secs.map((r: Row) => Number(r.id));
    if (critIds.length === 0) return [];
    const subs = await fetchAll((f, t) => this.supabase.from('sub_criteria').select('id').in('criterion_id', critIds).range(f, t));
    return subs.map((r: Row) => Number(r.id));
  }

  async reorderCriteriaNodes(
    type: 'section' | 'criterion' | 'subCriterion',
    parentId: string,
    startIndex: number,
    endIndex: number
  ): Promise<{ success: boolean }> {
    // Lấy danh sách anh em theo thứ tự stt hiện tại
    let rows: Row[] = [];
    if (type === 'section') {
      rows = await fetchAll((f, t) =>
        this.supabase.from('criteria_sections').select('id, stt').eq('criteria_set_id', Number(parentId)).order('stt').range(f, t));
    } else if (type === 'criterion') {
      rows = await fetchAll((f, t) =>
        this.supabase.from('criteria').select('id, stt').eq('section_id', Number(parentId)).order('stt').range(f, t));
    } else {
      // sub_criteria không có stt -> sắp theo id
      rows = await fetchAll((f, t) =>
        this.supabase.from('sub_criteria').select('id').eq('criterion_id', Number(parentId)).order('id').range(f, t));
    }
    if (rows.length < 2 || startIndex < 0 || endIndex < 0 || startIndex >= rows.length || endIndex >= rows.length) {
      return { success: true };
    }
    const moved = rows.splice(startIndex, 1)[0];
    rows.splice(endIndex, 0, moved);

    // sub_criteria không lưu được thứ tự -> không làm gì
    if (type === 'subCriterion') return { success: true };

    const table = type === 'section' ? 'criteria_sections' : 'criteria';
    // UNIQUE(parent, stt): đánh số tạm vùng âm rồi ghi số thật để tránh đụng
    for (let i = 0; i < rows.length; i++) {
      await this.supabase.from(table).update({ stt: -(i + 1) }).eq('id', Number(rows[i].id));
    }
    for (let i = 0; i < rows.length; i++) {
      const { error } = await this.supabase.from(table).update({ stt: i + 1 }).eq('id', Number(rows[i].id));
      if (error) fail(error);
    }
    return { success: true };
  }

  async cloneCriteriaSetFromPreviousYear(targetYear: number): Promise<{ success: boolean }> {
    // Bộ nguồn: bộ của năm nhỏ nhất < targetYear (gần nhất)
    const { data: srcSets, error } = await this.supabase
      .from('criteria_sets').select('*').lt('year', targetYear).order('year', { ascending: false }).limit(1);
    if (error) fail(error);
    const src = (srcSets ?? [])[0];
    if (!src) {
      // Không có bộ cũ -> tạo bộ rỗng
      const { error: e2 } = await this.supabase.from('criteria_sets').insert({
        year: targetYear, name: `Bộ Tiêu chí năm ${targetYear} (Nhân bản)`,
        issuing_unit: 'Ban Thường vụ Đoàn xã',
      });
      if (e2) fail(e2);
      return { success: true };
    }

    const tree = await this.getCriteriaTree(String(src.id));
    await this.insertTree(
      { year: targetYear, name: `${src.name} (Nhân bản ${targetYear})`, issuing_unit: src.issuing_unit },
      tree.sections, tree.criteria, tree.subCriteria
    );
    return { success: true };
  }

  /**
   * "Xóa" bộ tiêu chí = LƯU TRỮ (soft delete).
   * Bộ bị ẩn khỏi danh sách chọn và khỏi chi đoàn; điểm đã duyệt + minh chứng giữ nguyên.
   * Khôi phục được bất cứ lúc nào bằng restoreCriteriaSet.
   */
  async deleteCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.supabase.from('criteria_sets')
        .update({ archived_at: now })
        .eq('id', Number(criteriaSetId)).is('archived_at', null).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy bộ tiêu chí hoặc bộ đã được lưu trữ' };
      await this.writeAudit('Lưu trữ bộ tiêu chí', 'criteria_sets', criteriaSetId, { archived_at: null }, { archived_at: now });
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Khôi phục bộ tiêu chí đã lưu trữ. */
  async restoreCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data, error } = await this.supabase.from('criteria_sets')
        .update({ archived_at: null })
        .eq('id', Number(criteriaSetId)).not('archived_at', 'is', null).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy bộ tiêu chí đã lưu trữ' };
      await this.writeAudit('Khôi phục bộ tiêu chí', 'criteria_sets', criteriaSetId, { archived_at: 'set' }, { archived_at: null });
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Quy mô ảnh hưởng trước khi xóa vĩnh viễn (hiển thị ở modal xác nhận). */
  async getCriteriaSetImpact(criteriaSetId: string): Promise<{
    submissionCount: number;
    unitCount: number;
    evidenceCount: number;
    subCriteriaCount: number;
    isArchived: boolean;
  }> {
    const { data, error } = await this.supabase.rpc('criteria_set_impact', { p_set_id: Number(criteriaSetId) });
    if (error) fail(error);
    const r = (data ?? {}) as Row;
    return {
      submissionCount: Number(r.submission_count ?? 0),
      unitCount: Number(r.unit_count ?? 0),
      evidenceCount: Number(r.evidence_count ?? 0),
      subCriteriaCount: Number(r.sub_criteria_count ?? 0),
      isArchived: !!r.is_archived,
    };
  }

  /**
   * XÓA VĨNH VIỄN — không hoàn tác.
   * Trước khi xóa: chụp snapshot JSON (bộ, tiêu chí, điểm, minh chứng) vào audit_logs.
   * Sau khi xóa dòng: xóa file ảnh trong Storage để tránh file mồ côi.
   */
  async purgeCriteriaSet(criteriaSetId: string): Promise<{
    success: boolean; message?: string;
    deletedSubmissions?: number; deletedEvidences?: number; deletedFiles?: number;
  }> {
    try {
      const tree = await this.getCriteriaTree(criteriaSetId);
      const { data: setRow } = await this.supabase.from('criteria_sets').select('*').eq('id', Number(criteriaSetId)).maybeSingle();
      if (!setRow) return { success: false, message: 'Không tìm thấy bộ tiêu chí' };

      const subIds = tree.subCriteria.map((s) => Number(s.id));
      const critIds = tree.criteria.map((c) => Number(c.id));
      const secIds = tree.sections.map((s) => Number(s.id));

      // 1) Gom dữ liệu liên quan để snapshot
      const submissions = subIds.length
        ? await fetchAll((f, t) => this.supabase.from('criterion_submissions').select('*').in('sub_criterion_id', subIds).range(f, t))
        : [];
      const submissionIds = submissions.map((r: Row) => Number(r.id));
      const evidences = submissionIds.length
        ? await fetchAll((f, t) => this.supabase.from('evidences').select('*').in('submission_id', submissionIds).range(f, t))
        : [];
      const storagePaths = evidences
        .filter((e: Row) => e.storage_path && e.evidence_type !== 'link')
        .map((e: Row) => String(e.storage_path));

      // 2) Snapshot vào nhật ký TRƯỚC khi xóa
      const snapshot = {
        criteria_set: setRow,
        sections: tree.sections,
        criteria: tree.criteria,
        sub_criteria: tree.subCriteria,
        criterion_submissions: submissions,
        evidences,
      };
      await this.writeAudit(
        'Xóa vĩnh viễn bộ tiêu chí',
        'criteria_sets',
        criteriaSetId,
        null,
        JSON.stringify(snapshot),
      );

      // 3) Xóa con -> cha. task_sub_criteria tham chiếu sub_criteria nên phải xóa trước.
      if (subIds.length) {
        const { error } = await this.supabase.from('task_sub_criteria').delete().in('sub_criterion_id', subIds);
        if (error) return { success: false, message: friendlyError(error) };
        const { error: e2 } = await this.supabase.from('sub_criteria').delete().in('id', subIds);
        if (e2) return { success: false, message: friendlyError(e2) };
      }
      if (critIds.length) {
        const { error } = await this.supabase.from('criteria').delete().in('id', critIds);
        if (error) return { success: false, message: friendlyError(error) };
      }
      if (secIds.length) {
        const { error } = await this.supabase.from('criteria_sections').delete().in('id', secIds);
        if (error) return { success: false, message: friendlyError(error) };
      }
      const { error } = await this.supabase.from('criteria_sets').delete().eq('id', Number(criteriaSetId));
      if (error) return { success: false, message: friendlyError(error) };

      // 4) Xóa file trong Storage (theo lô 100 đường dẫn)
      let deletedFiles = 0;
      for (let i = 0; i < storagePaths.length; i += 100) {
        const chunk = storagePaths.slice(i, i + 100);
        const { error: stErr } = await this.supabase.storage.from('evidences').remove(chunk);
        if (!stErr) deletedFiles += chunk.length;
      }

      return {
        success: true,
        deletedSubmissions: submissions.length,
        deletedEvidences: evidences.length,
        deletedFiles,
      };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async importCriteriaTree(payload: {
    set: { name: string; year: number; issuing_unit: string };
    sections: Array<{ id: string; stt: number; name: string }>;
    criteria: Array<{ id: string; section_id: string; stt: number; name: string }>;
    subCriteria: Array<{
      id: string; criterion_id: string; condition_text: string; max_score: number;
      evaluation_method: string; evidence_requirement: string; scoring_rule: string; deadline: string;
      unit_type_id: UnitTypeId | null; unit_id: string | null;
      unit_type_ids: UnitTypeId[]; unit_ids: string[]; note?: string;
    }>;
  }): Promise<{ success: boolean; message?: string; criteriaSetId?: string }> {
    if (!payload.sections.length) return { success: false, message: 'Bộ tiêu chí rỗng, không có Phần nào để nhập' };
    try {
      const newSetId = await this.insertTree(
        payload.set,
        payload.sections.map((s) => ({ id: s.id, criteria_set_id: '', stt: s.stt, name: s.name })),
        payload.criteria.map((c) => ({ id: c.id, section_id: c.section_id, stt: c.stt, name: c.name })),
        payload.subCriteria.map((sc) => ({
          id: sc.id, criterion_id: sc.criterion_id, condition_text: sc.condition_text, max_score: sc.max_score,
          evaluation_method: sc.evaluation_method, evidence_requirement: sc.evidence_requirement,
          scoring_rule: sc.scoring_rule, deadline: sc.deadline,
          unit_type_id: sc.unit_type_id, unit_id: sc.unit_id,
          unit_type_ids: sc.unit_type_ids ?? [], unit_ids: sc.unit_ids ?? [], note: sc.note,
        }))
      );
      return { success: true, criteriaSetId: newSetId };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Chèn cả cây tiêu chí; trả về id bộ mới. Remap id cha/con qua Map. */
  private async insertTree(
    set: { name: string; year: number; issuing_unit: string },
    sections: Array<{ id: string; criteria_set_id: string; stt: number; name: string }>,
    criteria: Array<{ id: string; section_id: string; stt: number; name: string }>,
    subCriteria: Array<{
      id: string; criterion_id: string; condition_text: string; max_score: number;
      evaluation_method: string; evidence_requirement: string; scoring_rule: string; deadline: string;
      unit_type_id: UnitTypeId | null; unit_id: string | null;
      unit_type_ids: UnitTypeId[]; unit_ids: string[]; note?: string;
    }>
  ): Promise<string> {
    const { data: setRow, error: setErr } = await this.supabase
      .from('criteria_sets').insert({ name: set.name, year: set.year, issuing_unit: set.issuing_unit })
      .select('id').single();
    if (setErr) fail(setErr);
    const newSetId = String((setRow as Row).id);

    const secIdMap = new Map<string, number>();
    for (const s of sections) {
      const { data, error } = await this.supabase.from('criteria_sections')
        .insert({ criteria_set_id: Number(newSetId), stt: s.stt, name: s.name }).select('id').single();
      if (error) fail(error);
      secIdMap.set(s.id, Number((data as Row).id));
    }

    const critIdMap = new Map<string, number>();
    for (const c of criteria) {
      const { data, error } = await this.supabase.from('criteria')
        .insert({ section_id: secIdMap.get(c.section_id)!, stt: c.stt, name: c.name }).select('id').single();
      if (error) fail(error);
      critIdMap.set(c.id, Number((data as Row).id));
    }

    for (const sc of subCriteria) {
      const typeIdsDb = this.typeIdsToDb(sc.unit_type_ids ?? []);
      const unitIdsDb = this.unitIdsToDb(sc.unit_ids ?? []);
      const { error } = await this.supabase.from('sub_criteria').insert({
        criterion_id: critIdMap.get(sc.criterion_id)!,
        condition_text: sc.condition_text,
        max_score: sc.max_score,
        evaluation_method: sc.evaluation_method || 'Kiểm tra thực tế',
        evidence_requirement: sc.evidence_requirement || 'Không cần gửi minh chứng',
        scoring_rule: sc.scoring_rule || 'Đạt yêu cầu được tối đa điểm',
        deadline: sc.deadline ? String(sc.deadline).slice(0, 10) : null,
        unit_type_ids: typeIdsDb,
        unit_ids: unitIdsDb,
        // Cột đơn cũ phải nhất quán với FK kép (unit_id, unit_type_id)
        unit_id: unitIdsDb.length > 0 ? unitIdsDb[0] : null,
        unit_type_id: unitIdsDb.length > 0 ? null : (typeIdsDb.length > 0 ? typeIdsDb[0] : null),
        note: emptyToNull(sc.note),
      });
      if (error) fail(error);
    }
    return newSetId;
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — NHIỆM VỤ
  // =====================================================================

  /** Mã đoàn viên gắn tài khoản đang đăng nhập; ném lỗi rõ nếu chưa gắn. */
  private async requireMemberId(): Promise<number> {
    const user = await this.getCurrentUser();
    if (!user?.memberId) {
      throw new Error('Tài khoản chưa gắn với hồ sơ đoàn viên, không thể thực hiện thao tác này');
    }
    return Number(user.memberId);
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — TỰ PHỤC VỤ (đoàn viên sửa hồ sơ + bảng tin)
  // =====================================================================

  async updateMyProfile(updates: Partial<DbMember>): Promise<{ success: boolean; message?: string }> {
    // Chỉ gửi các trường an toàn
    const allowed = ['phone', 'religion', 'current_job', 'specialization', 'political_theory_level', 'avatar_url', 'note'] as const;
    const payload: Row = {};
    for (const k of allowed) {
      const v = (updates as Row)[k];
      if (v !== undefined) payload[k] = v;
    }
    if (Object.keys(payload).length === 0) return { success: false, message: 'Không có thông tin nào để lưu' };
    const { data, error } = await this.supabase.rpc('member_self_update', { p: payload });
    if (error) return { success: false, message: friendlyError(error) };
    const r = data as Row;
    return r?.success ? { success: true } : { success: false, message: r?.message ?? 'Không lưu được' };
  }

  async listMyFeed(): Promise<Array<{
    task: DbTask;
    myRegistration: DbTaskRegistration | null;
    joinedCount: number;
    joinedNames: string[];
    mySubmission: DbMemberSubmission | null;
  }>> {
    const user = await this.getCurrentUser();
    if (!user?.memberId) return [];
    const myUnitId = user.memberId
      ? (await this.supabase.from('members').select('unit_id').eq('id', Number(user.memberId)).maybeSingle()).data as Row | null
      : null;
    const unitId = myUnitId ? Number((myUnitId as Row).unit_id) : null;
    if (!unitId) return [];

    // Nhiệm vụ published giao cho chi đoàn mình
    const assigned = await fetchAll((f, t) => this.supabase.from('task_units').select('task_id').eq('unit_id', unitId).range(f, t));
    // Nhiệm vụ phạm vi "ai cũng tham gia" (open) hiện cho mọi đoàn viên, kể cả chi đoàn không được giao
    const openRows = await fetchAll((f, t) =>
      this.supabase.from('tasks').select('id').eq('status', 'published').eq('submit_scope', 'open').range(f, t)
    ).catch(() => [] as Row[]);
    const taskIds = Array.from(new Set([
      ...assigned.map((r: Row) => Number(r.task_id)),
      ...openRows.map((r: Row) => Number(r.id)),
    ]));
    if (taskIds.length === 0) return [];

    const taskRows = await fetchAll((f, t) =>
      this.supabase.from('tasks').select('*').in('id', taskIds).eq('status', 'published').order('due_date', { ascending: true }).range(f, t));
    const regRows = await fetchAll((f, t) =>
      this.supabase.from('task_registrations').select('*').in('task_id', taskIds).range(f, t));
    // Bài nộp cá nhân của chính tôi (bảng có thể chưa tồn tại nếu chưa chạy migration phase3)
    const mySubRows = await fetchAll((f, t) =>
      this.supabase.from('member_submissions').select('*').in('task_id', taskIds).eq('member_id', Number(user.memberId)).range(f, t)
    ).catch(() => [] as Row[]);
    const mySubByTask = new Map(mySubRows.map((r: Row) => [String(r.task_id), toMemberSubmission(r)]));
    const memberIds = Array.from(new Set(regRows.filter((r: Row) => r.is_joining).map((r: Row) => Number(r.member_id))));
    const nameRows = memberIds.length
      ? await fetchAll((f, t) => this.supabase.from('members').select('id, full_name').in('id', memberIds).range(f, t))
      : [];
    const nameById = new Map(nameRows.map((r: Row) => [String(r.id), String(r.full_name)]));

    return taskRows.map((row) => {
      const task = toTask(row);
      const regsForTask = regRows.filter((r: Row) => String(r.task_id) === task.id);
      const myReg = regsForTask.find((r: Row) => String(r.member_id) === user.memberId) ?? null;
      const joined = regsForTask.filter((r: Row) => r.is_joining);
      return {
        task,
        myRegistration: myReg ? toTaskRegistration(myReg) : null,
        joinedCount: joined.length,
        joinedNames: joined.map((r: Row) => nameById.get(String(r.member_id)) ?? '').filter(Boolean),
        mySubmission: mySubByTask.get(task.id) ?? null,
      };
    });
  }

  async setTaskRegistration(taskId: string, isJoining: boolean): Promise<{ success: boolean; message?: string }> {
    try {
      const memberId = await this.requireMemberId();
      const { data: existing } = await this.supabase.from('task_registrations')
        .select('id').eq('task_id', Number(taskId)).eq('member_id', memberId).maybeSingle();
      if (existing) {
        const { error } = await this.supabase.from('task_registrations')
          .update({ is_joining: isJoining }).eq('id', Number((existing as Row).id));
        if (error) return { success: false, message: friendlyError(error) };
      } else {
        const { error } = await this.supabase.from('task_registrations')
          .insert({ task_id: Number(taskId), member_id: memberId, is_joining: isJoining });
        if (error) return { success: false, message: friendlyError(error) };
      }
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  // =====================================================================
  // GIAI ĐOẠN 3 — NỘP MINH CHỨNG CÁ NHÂN (đoàn viên) + DUYỆT CẤP CHI ĐOÀN
  // =====================================================================

  /** Phạm vi nộp: đoàn viên (chi đoàn) này có được nộp vào nhiệm vụ không. */
  private async assertSubmitScope(taskRow: Row, unitId: number): Promise<{ ok: boolean; message?: string }> {
    if (String(taskRow.status) !== 'published') {
      return { ok: false, message: 'Nhiệm vụ chưa được phát động' };
    }
    if (String(taskRow.submit_scope ?? 'assigned') === 'open') return { ok: true };
    const { data } = await this.supabase.from('task_units')
      .select('unit_id').eq('task_id', Number(taskRow.id)).eq('unit_id', unitId).maybeSingle();
    return data
      ? { ok: true }
      : { ok: false, message: 'Nhiệm vụ này chỉ dành cho đoàn viên chi đoàn được giao' };
  }

  async submitMemberResult(input: {
    taskId: string; note?: string; lat: number | null; lng: number | null; evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; submissionId?: string }> {
    try {
      const memberId = await this.requireMemberId();
      const { data: meRow, error: meErr } = await this.supabase.from('members')
        .select('unit_id').eq('id', memberId).maybeSingle();
      if (meErr) return { success: false, message: friendlyError(meErr) };
      if (!meRow) return { success: false, message: 'Không tìm thấy hồ sơ đoàn viên của bạn' };
      const unitId = Number((meRow as Row).unit_id);

      const { data: taskRow, error: taskErr } = await this.supabase.from('tasks')
        .select('*').eq('id', Number(input.taskId)).maybeSingle();
      if (taskErr) return { success: false, message: friendlyError(taskErr) };
      if (!taskRow) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
      const scope = await this.assertSubmitScope(taskRow as Row, unitId);
      if (!scope.ok) return { success: false, message: scope.message };

      // Nộp lại: cập nhật bài cũ (tránh vi phạm UNIQUE(task_id, member_id)).
      const { data: existing } = await this.supabase.from('member_submissions')
        .select('id, status').eq('task_id', Number(input.taskId)).eq('member_id', memberId).maybeSingle();
      if (existing && String((existing as Row).status) === 'approved') {
        return { success: false, message: 'Bài nộp đã được duyệt, không sửa được nữa' };
      }

      const payload = {
        task_id: Number(input.taskId), member_id: memberId, unit_id: unitId,
        note: emptyToNull(input.note), lat: input.lat, lng: input.lng,
        status: 'pending' as const, submitted_at: new Date().toISOString(),
        reviewed_by: null, reviewed_at: null, review_note: null,
      };

      let submissionId: string;
      if (existing) {
        const { data, error } = await this.supabase.from('member_submissions')
          .update(payload).eq('id', Number((existing as Row).id)).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        submissionId = String((data as Row).id);
        // Thay bộ minh chứng cũ bằng bộ mới
        await this.supabase.from('evidences').delete().eq('member_submission_id', Number(submissionId));
      } else {
        const { data, error } = await this.supabase.from('member_submissions').insert(payload).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        submissionId = String((data as Row).id);
      }
      await this.insertEvidences(input.evidences, {
        memberSubmissionId: Number(submissionId), unitId, memberId,
      });
      return { success: true, submissionId };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async listMemberSubmissions(filters?: {
    taskId?: string; unitId?: string; memberId?: string; status?: ReviewStatus;
  }): Promise<DbMemberSubmission[]> {
    const rows = await fetchAll((f, t) => {
      let q = this.supabase.from('member_submissions').select('*').order('submitted_at', { ascending: false });
      if (filters?.taskId) q = q.eq('task_id', Number(filters.taskId));
      if (filters?.unitId) q = q.eq('unit_id', Number(filters.unitId));
      if (filters?.memberId) q = q.eq('member_id', Number(filters.memberId));
      if (filters?.status) q = q.eq('status', filters.status);
      return q.range(f, t);
    }).catch(() => [] as Row[]);
    return rows.map(toMemberSubmission);
  }

  async reviewMemberSubmission(id: string, approve: boolean, note?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const reviewer = await this.requireMemberId();
      const { data, error } = await this.supabase.from('member_submissions').update({
        status: approve ? 'approved' : 'rejected',
        reviewed_by: reviewer, reviewed_at: new Date().toISOString(),
        review_note: emptyToNull(note),
      }).eq('id', Number(id)).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy bài nộp cần duyệt' };
      await this.writeAudit(
        approve ? 'Duyệt bài nộp cá nhân' : 'Từ chối bài nộp cá nhân',
        'member_submissions', id, { status: 'pending' }, { status: approve ? 'approved' : 'rejected' }
      );
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async listMemberSubmissionEvidences(submissionId: string): Promise<DbEvidence[]> {
    const rows = await fetchAll((f, t) =>
      this.supabase.from('evidences').select('*').eq('member_submission_id', Number(submissionId)).range(f, t)
    ).catch(() => [] as Row[]);
    return rows.map(toEvidence);
  }

  /** Ai đã tham gia / đã nộp / chưa nộp trong một chi đoàn cho một nhiệm vụ. */
  async listTaskParticipants(taskId: string, unitId: string): Promise<Array<{
    member: DbMember; isJoining: boolean | null; submission: DbMemberSubmission | null;
  }>> {
    const members = await this.listMembers({ unitId, isActive: true });
    const regRows = await fetchAll((f, t) =>
      this.supabase.from('task_registrations').select('*').eq('task_id', Number(taskId)).range(f, t)
    ).catch(() => [] as Row[]);
    const subRows = await fetchAll((f, t) =>
      this.supabase.from('member_submissions').select('*').eq('task_id', Number(taskId)).eq('unit_id', Number(unitId)).range(f, t)
    ).catch(() => [] as Row[]);
    const regByMember = new Map(regRows.map((r: Row) => [String(r.member_id), !!r.is_joining]));
    const subByMember = new Map(subRows.map((r: Row) => [String(r.member_id), toMemberSubmission(r)]));
    return members.map((m) => ({
      member: m.member,
      isJoining: regByMember.has(m.member.id) ? regByMember.get(m.member.id)! : null,
      submission: subByMember.get(m.member.id) ?? null,
    }));
  }

  /**
   * Danh sách đoàn viên tham gia MỘT nhiệm vụ trên mọi chi đoàn được giao
   * (dùng cho bí thư xã theo dõi). Gồm cả người chưa đăng ký, chưa nộp.
   */
  async listTaskParticipantsAll(taskId: string): Promise<Array<{
    member: DbMember;
    unit: DbUnit | null;
    isJoining: boolean | null;
    submission: DbMemberSubmission | null;
  }>> {
    // Chi đoàn được giao (với nhiệm vụ 'open' thì lấy tất cả chi đoàn đang hoạt động)
    const { data: taskRow } = await this.supabase.from('tasks')
      .select('id, submit_scope, status').eq('id', Number(taskId)).maybeSingle();
    if (!taskRow) return [];

    let unitIds: number[] = [];
    if (String((taskRow as Row).submit_scope ?? 'assigned') === 'open') {
      const units = await fetchAll((f, t) => this.supabase.from('units').select('id').eq('is_active', true).range(f, t));
      unitIds = units.map((u: Row) => Number(u.id));
    } else {
      const rows = await fetchAll((f, t) =>
        this.supabase.from('task_units').select('unit_id').eq('task_id', Number(taskId)).range(f, t));
      unitIds = rows.map((r: Row) => Number(r.unit_id));
    }
    if (unitIds.length === 0) return [];

    // Bí thư chi đoàn bị RLS chặn đọc bảng members gốc (chỉ thấy chính mình)
    // -> dùng memberSource() để lấy view members_limited như các chỗ khác.
    const memberTable = await this.memberSource();
    const [unitRows, memberRows, regRows, subRows] = await Promise.all([
      fetchAll((f, t) => this.supabase.from('units').select('*').in('id', unitIds).range(f, t)),
      fetchAll((f, t) => this.supabase.from(memberTable).select('*').in('unit_id', unitIds).eq('is_active', true).order('full_name').range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_registrations').select('*').eq('task_id', Number(taskId)).range(f, t)).catch(() => [] as Row[]),
      fetchAll((f, t) => this.supabase.from('member_submissions').select('*').eq('task_id', Number(taskId)).range(f, t)).catch(() => [] as Row[]),
    ]);

    const unitById = new Map(unitRows.map((r: Row) => [String(r.id), toUnit(r)]));
    const regByMember = new Map(regRows.map((r: Row) => [String(r.member_id), !!r.is_joining]));
    const subByMember = new Map(subRows.map((r: Row) => [String(r.member_id), toMemberSubmission(r)]));

    return memberRows.map((r: Row) => {
      const member = toMember(r);
      return {
        member,
        unit: unitById.get(member.unit_id) ?? null,
        isJoining: regByMember.has(member.id) ? regByMember.get(member.id)! : null,
        submission: subByMember.get(member.id) ?? null,
      };
    });
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — NỘP MINH CHỨNG (phía chi đoàn)
  // =====================================================================

  async listMyTodo(unitId: string): Promise<{
    tasks: Array<{ task: DbTask; deadlineStatus: TaskDeadlineStatus; alreadySubmitted: DbTaskResult | null }>;
    subCriteria: Array<{ subCriterion: DbSubCriterion; criterionName: string; alreadySubmitted: DbCriterionSubmission | null }>;
  }> {
    const uId = Number(unitId);

    // --- Nhiệm vụ được giao cho chi đoàn này (đang published) ---
    const assignedRows = await fetchAll((f, t) => this.supabase.from('task_units').select('task_id').eq('unit_id', uId).range(f, t));
    const taskIds = assignedRows.map((r: Row) => Number(r.task_id));
    const tasks: Array<{ task: DbTask; deadlineStatus: TaskDeadlineStatus; alreadySubmitted: DbTaskResult | null }> = [];
    if (taskIds.length > 0) {
      const taskRows = await fetchAll((f, t) => this.supabase.from('tasks').select('*').in('id', taskIds).eq('status', 'published').range(f, t));
      const resultRows = await fetchAll((f, t) => this.supabase.from('task_results').select('*').eq('unit_id', uId).in('task_id', taskIds).range(f, t));
      const resultByTask = new Map(resultRows.map((r: Row) => [String(r.task_id), toTaskResult(r)]));
      const now = Date.now();
      for (const row of taskRows) {
        const task = toTask(row);
        const due = task.due_date ? new Date(task.due_date).getTime() : NaN;
        const days = Number.isFinite(due) ? Math.ceil((due - now) / 86400000) : 0;
        const deadlineStatus: TaskDeadlineStatus = days < 0
          ? { is_overdue: true, days_remaining: days, chip_color: 'rose', chip_label: `Quá hạn ${Math.abs(days)} ngày` }
          : days <= 3
          ? { is_overdue: false, days_remaining: days, chip_color: 'amber', chip_label: `Còn ${days} ngày` }
          : { is_overdue: false, days_remaining: days, chip_color: 'emerald', chip_label: `Còn ${days} ngày` };
        tasks.push({ task, deadlineStatus, alreadySubmitted: resultByTask.get(task.id) ?? null });
      }
    }

    // --- Tiêu chí áp dụng cho chi đoàn này (bộ đang chốt cho năm) ---
    const year = new Date().getFullYear();
    const settings = await this.getYearlySettings(year);
    const subCriteria: Array<{ subCriterion: DbSubCriterion; criterionName: string; alreadySubmitted: DbCriterionSubmission | null }> = [];
    // Bộ mặc định có thể đã bị lưu trữ -> chi đoàn không còn tiêu chí nào để chấm
    let criteriaSetIdForTodo = settings.criteria_set_id;
    if (criteriaSetIdForTodo) {
      const { data: setRow } = await this.supabase.from('criteria_sets')
        .select('archived_at').eq('id', Number(criteriaSetIdForTodo)).maybeSingle();
      if (setRow && (setRow as Row).archived_at) criteriaSetIdForTodo = '';
    }
    if (criteriaSetIdForTodo) {
      const tree = await this.getCriteriaTree(criteriaSetIdForTodo);
      const critNameById = new Map(tree.criteria.map((c) => [c.id, c.name]));
      const subs = await fetchAll((f, t) => this.supabase.from('criterion_submissions').select('*').eq('unit_id', uId).range(f, t));
      const subBySubId = new Map(subs.map((r: Row) => [String(r.sub_criterion_id), toCriterionSubmission(r)]));
      const unitRow = (await this.supabase.from('units').select('id, unit_type_id').eq('id', uId).maybeSingle()).data as Row | null;
      const unitTypeSlug = unitRow ? (SLUG_BY_UNIT_TYPE_DB_ID[unitRow.unit_type_id] ?? 'other') : 'other';
      for (const sc of tree.subCriteria) {
        // Lọc theo phân công (dùng hàm chung)
        const applies = isSubCriterionApplicableToUnit(sc, { id: String(uId), unit_type_id: unitTypeSlug });
        if (!applies) continue;
        subCriteria.push({
          subCriterion: sc,
          criterionName: critNameById.get(sc.criterion_id) ?? '',
          alreadySubmitted: subBySubId.get(sc.id) ?? null,
        });
      }
    }

    return { tasks, subCriteria };
  }

  async uploadEvidence(file: File, unitId: string): Promise<{ url: string; storagePath: string }> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const storagePath = `unit_${unitId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await this.supabase.storage.from('evidences').upload(storagePath, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
    });
    if (error) throw new Error(friendlyError(error));
    const { data } = this.supabase.storage.from('evidences').getPublicUrl(storagePath);
    return { url: data.publicUrl, storagePath };
  }

  async submitTaskResult(input: {
    taskId: string; unitId: string; participantCount: number; note?: string;
    lat: number | null; lng: number | null; isOverdue: boolean;
    evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; resultId?: string }> {
    try {
      const memberId = await this.requireMemberId();
      // Nộp lại (sau khi bị từ chối): cập nhật bản ghi cũ thay vì tạo mới,
      // tránh vi phạm UNIQUE(task_id, unit_id).
      const { data: existing } = await this.supabase
        .from('task_results').select('id').eq('task_id', Number(input.taskId)).eq('unit_id', Number(input.unitId)).maybeSingle();

      const payload = {
        task_id: Number(input.taskId), unit_id: Number(input.unitId),
        completed_at: new Date().toISOString(), is_overdue: input.isOverdue,
        lat: input.lat, lng: input.lng, note: emptyToNull(input.note),
        participant_count: input.participantCount, submitted_by: memberId, status: 'pending' as const,
        // Nộp lại: xóa kết quả duyệt cũ
        reviewed_by: null, reviewed_at: null, review_note: null,
      };

      let resultId: string;
      if (existing) {
        const { data, error } = await this.supabase.from('task_results')
          .update(payload).eq('id', Number((existing as Row).id)).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        resultId = String((data as Row).id);
        // Xóa minh chứng cũ của bài nộp này (bài bị từ chối) để thay bằng bộ mới
        await this.supabase.from('evidences').delete().eq('task_id', Number(input.taskId)).eq('unit_id', Number(input.unitId));
      } else {
        const { data, error } = await this.supabase.from('task_results').insert(payload).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        resultId = String((data as Row).id);
      }
      await this.insertEvidences(input.evidences, { taskId: Number(input.taskId), unitId: Number(input.unitId), memberId });
      return { success: true, resultId };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  async submitCriterionSubmission(input: {
    subCriterionId: string; unitId: string; selfScore: number; note?: string;
    evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; submissionId?: string }> {
    try {
      const memberId = await this.requireMemberId();
      // Nộp lại (sau khi bị từ chối): cập nhật bản ghi cũ, tránh UNIQUE(sub_criterion_id, unit_id).
      const { data: existing } = await this.supabase
        .from('criterion_submissions').select('id')
        .eq('sub_criterion_id', Number(input.subCriterionId)).eq('unit_id', Number(input.unitId)).maybeSingle();

      const payload = {
        sub_criterion_id: Number(input.subCriterionId), unit_id: Number(input.unitId),
        self_score: input.selfScore, status: 'pending' as const, note: emptyToNull(input.note),
        submitted_by: memberId, submitted_at: new Date().toISOString(),
        approved_score: null, reviewed_by: null, reviewed_at: null, review_note: null,
      };

      let submissionId: string;
      if (existing) {
        const { data, error } = await this.supabase.from('criterion_submissions')
          .update(payload).eq('id', Number((existing as Row).id)).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        submissionId = String((data as Row).id);
        await this.supabase.from('evidences').delete().eq('submission_id', Number(submissionId));
      } else {
        const { data, error } = await this.supabase.from('criterion_submissions').insert(payload).select('id').single();
        if (error) return { success: false, message: friendlyError(error) };
        submissionId = String((data as Row).id);
      }
      await this.insertEvidences(input.evidences, { submissionId: Number(submissionId), unitId: Number(input.unitId), memberId });
      return { success: true, submissionId };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Ghi các dòng evidences cho một bài nộp (task_id XOR submission_id). */
  private async insertEvidences(
    evidences: EvidenceInput[],
    target: { taskId?: number; submissionId?: number; memberSubmissionId?: number; unitId: number; memberId: number }
  ): Promise<void> {
    if (evidences.length === 0) return;
    const rows = evidences.map((e) => {
      const isLink = e.evidenceType === 'link';
      const isNote = e.evidenceType === 'list';
      return {
        task_id: target.taskId ?? null,
        submission_id: target.submissionId ?? null,
        member_submission_id: target.memberSubmissionId ?? null,
        member_id: target.memberId,
        unit_id: target.unitId,
        evidence_type: e.evidenceType,
        // DB: mọi loại ≠ link phải có storage_path; ghi chú dùng tiền tố note://
        storage_path: isLink ? null : (e.storagePath || (isNote ? `note://${e.fileHash}` : e.storagePath)),
        // DB: loại link phải có url
        url: isLink ? e.url : (e.url || null),
        file_name: e.fileName || null,
        captured_at: new Date().toISOString(),
        lat: e.lat,
        lng: e.lng,
        source: e.source,
        file_hash: e.fileHash,
        is_locked: false,
      };
    });
    const { error } = await this.supabase.from('evidences').insert(rows);
    if (error) throw new Error(friendlyError(error));
  }

  async listTasks(status?: 'all' | 'draft' | 'published' | 'closed'): Promise<DbTask[]> {
    let q = this.supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) fail(error);
    return (data ?? []).map(toTask);
  }

  async getTask(id: string): Promise<{
    task: DbTask | null;
    deadlineStatus: TaskDeadlineStatus;
    units: DbUnit[];
    registrations: DbTaskRegistration[];
    subCriteria: Array<{ subCriterion: DbSubCriterion; contribution_score: number }>;
    results: DbTaskResult[];
  }> {
    const { data: taskRow, error } = await this.supabase.from('tasks').select('*').eq('id', Number(id)).maybeSingle();
    if (error) fail(error);
    if (!taskRow) {
      return { task: null, deadlineStatus: { is_overdue: false, days_remaining: 0, chip_color: 'emerald', chip_label: 'Đang tiến hành' }, units: [], registrations: [], subCriteria: [], results: [] };
    }
    const task = toTask(taskRow);

    const [unitRows, regRows, tscRows, resRows] = await Promise.all([
      fetchAll((f, t) => this.supabase.from('task_units').select('*').eq('task_id', Number(id)).range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_registrations').select('*').eq('task_id', Number(id)).range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_sub_criteria').select('*').eq('task_id', Number(id)).range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_results').select('*').eq('task_id', Number(id)).range(f, t)),
    ]);

    const unitIds = unitRows.map((r: Row) => Number(r.unit_id));
    const units = unitIds.length
      ? (await fetchAll((f, t) => this.supabase.from('units').select('*').in('id', unitIds).range(f, t))).map(toUnit)
      : [];

    const tsc = tscRows.map(toTaskSubCriterion);
    const subIds = tsc.map((x) => Number(x.sub_criterion_id));
    const subRows = subIds.length
      ? await fetchAll((f, t) => this.supabase.from('sub_criteria').select('*').in('id', subIds).range(f, t))
      : [];
    const subById = new Map(subRows.map((r: Row) => [String(r.id), toSubCriterion(r)]));
    const subCriteria = tsc
      .map((x) => {
        const subCriterion = subById.get(x.sub_criterion_id);
        return subCriterion ? { subCriterion, contribution_score: x.contribution_score } : null;
      })
      .filter((x): x is { subCriterion: DbSubCriterion; contribution_score: number } => !!x);

    // Trạng thái hạn chót
    const now = Date.now();
    const due = task.due_date ? new Date(task.due_date).getTime() : NaN;
    const daysRemaining = Number.isFinite(due) ? Math.ceil((due - now) / 86400000) : 0;
    let deadlineStatus: TaskDeadlineStatus;
    if (Number.isFinite(due) && daysRemaining < 0) {
      deadlineStatus = { is_overdue: true, days_remaining: daysRemaining, chip_color: 'rose', chip_label: `Quá hạn ${Math.abs(daysRemaining)} ngày` };
    } else if (daysRemaining <= 3) {
      deadlineStatus = { is_overdue: false, days_remaining: daysRemaining, chip_color: 'amber', chip_label: `Còn ${daysRemaining} ngày` };
    } else {
      deadlineStatus = { is_overdue: false, days_remaining: daysRemaining, chip_color: 'emerald', chip_label: `Còn ${daysRemaining} ngày` };
    }

    return {
      task, deadlineStatus, units,
      registrations: regRows.map(toTaskRegistration),
      subCriteria,
      results: resRows.map(toTaskResult),
    };
  }

  async createTask(input: {
    taskData: Omit<DbTask, 'id' | 'assigned_by' | 'assigned_at'>;
    unitIds: string[];
    subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>;
  }): Promise<DbTask> {
    const assignedBy = await this.requireMemberId();
    const t = input.taskData;
    const { data, error } = await this.supabase.from('tasks').insert({
      title: t.title, content: t.content,
      due_date: t.due_date ? String(t.due_date).slice(0, 10) : null,
      assigned_by: assignedBy, status: t.status,
      reminder_days: t.reminder_days ?? [7, 3, 1],
      target: t.target ?? null,
      evaluation_criteria: t.evaluation_criteria || 'Có biên bản và hình ảnh nghiệm thu',
      max_score: Number(t.max_score) || 0,
      lat: t.lat, lng: t.lng,
      submit_scope: t.submit_scope === 'open' ? 'open' : 'assigned',
    }).select('*').single();
    if (error) fail(error);
    const task = toTask(data as Row);

    // Giao cho các chi đoàn
    if (input.unitIds.length > 0) {
      const { error: tuErr } = await this.supabase.from('task_units')
        .insert(input.unitIds.map((unit_id) => ({ task_id: Number(task.id), unit_id: Number(unit_id) })));
      if (tuErr) fail(tuErr);
    }
    // Gắn tiêu chí đóng góp
    if (input.subCriteriaContributions.length > 0) {
      const { error: tscErr } = await this.supabase.from('task_sub_criteria').insert(
        input.subCriteriaContributions.map((c) => ({
          task_id: Number(task.id), sub_criterion_id: Number(c.sub_criterion_id), contribution_score: c.contribution_score,
        }))
      );
      if (tscErr) fail(tscErr);
    }
    // Nếu đăng ngay -> thông báo cho bí thư các chi đoàn
    if (task.status === 'published') {
      await this.notifySecretaries(input.unitIds, {
        title: `Nhiệm vụ mới: ${task.title}`,
        body: `Nhiệm vụ được giao, hạn ${task.due_date}. Vui lòng triển khai.`,
        type: 'system', level: 'yellow', taskId: task.id,
      });
    }
    return task;
  }

  async publishTask(id: string): Promise<{ success: boolean; message?: string }> {
    const unitRows = await fetchAll((f, t) => this.supabase.from('task_units').select('unit_id').eq('task_id', Number(id)).range(f, t));
    if (unitRows.length === 0) return { success: false, message: 'Chặn đăng: Chưa có chi đoàn nào được gán nhiệm vụ này!' };
    const { data: taskRow } = await this.supabase.from('tasks').select('title, due_date').eq('id', Number(id)).maybeSingle();
    const { error } = await this.supabase.from('tasks').update({ status: 'published' }).eq('id', Number(id));
    if (error) return { success: false, message: friendlyError(error) };
    await this.notifySecretaries(unitRows.map((r: Row) => String(r.unit_id)), {
      title: `Phát hành nhiệm vụ: ${(taskRow as Row)?.title ?? ''}`,
      body: `Nhiệm vụ đã được phát hành, hạn ${(taskRow as Row)?.due_date ?? ''}.`,
      type: 'system', level: 'yellow', taskId: id,
    });
    return { success: true };
  }

  async closeTask(id: string): Promise<{ success: boolean; message?: string }> {
    const closedBy = await this.requireMemberId();
    const { data, error } = await this.supabase.from('tasks')
      .update({ status: 'closed', closed_by: closedBy, closed_at: new Date().toISOString() })
      .eq('id', Number(id)).select('id');
    if (error) return { success: false, message: friendlyError(error) };
    return (data ?? []).length > 0 ? { success: true } : { success: false, message: 'Không tìm thấy nhiệm vụ' };
  }

  async deleteTask(id: string): Promise<{ success: boolean; message?: string }> {
    const { data: taskRow } = await this.supabase.from('tasks').select('status').eq('id', Number(id)).maybeSingle();
    if (!taskRow) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    if ((taskRow as Row).status !== 'draft') return { success: false, message: 'Chỉ được xóa nhiệm vụ ở trạng thái Nháp!' };
    const { error } = await this.supabase.from('tasks').delete().eq('id', Number(id));
    if (error) return { success: false, message: friendlyError(error) };
    return { success: true };
  }

  /** Thay toàn bộ tiêu chí đóng góp của nhiệm vụ (xóa cũ, ghi mới). */
  async setTaskSubCriteria(taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>): Promise<{ success: boolean; message?: string }> {
    try {
      const { error: delErr } = await this.supabase.from('task_sub_criteria').delete().eq('task_id', Number(taskId));
      if (delErr) return { success: false, message: friendlyError(delErr) };
      if (items.length > 0) {
        const { error } = await this.supabase.from('task_sub_criteria').insert(
          items.map((i) => ({
            task_id: Number(taskId),
            sub_criterion_id: Number(i.sub_criterion_id),
            contribution_score: Number(i.contribution_score) || 0,
          }))
        );
        if (error) return { success: false, message: friendlyError(error) };
      }
      await this.writeAudit('Cập nhật tiêu chí nhiệm vụ', 'task_sub_criteria', taskId, null, { count: items.length });
      return { success: true };
    } catch (e) {
      return { success: false, message: friendlyError(e as any) };
    }
  }

  /** Chi đoàn được giao nhưng chưa có bài tổng hợp. */
  async countUnitsWithoutResult(taskId: string): Promise<{ assigned: number; submitted: number; missing: string[] }> {
    const assignedRows = await fetchAll((f, t) =>
      this.supabase.from('task_units').select('unit_id').eq('task_id', Number(taskId)).range(f, t));
    const unitIds = assignedRows.map((r: Row) => Number(r.unit_id));
    if (unitIds.length === 0) return { assigned: 0, submitted: 0, missing: [] };

    const [units, results] = await Promise.all([
      fetchAll((f, t) => this.supabase.from('units').select('id, name').in('id', unitIds).range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_results').select('unit_id').eq('task_id', Number(taskId)).in('unit_id', unitIds).range(f, t)),
    ]);
    const submittedSet = new Set(results.map((r: Row) => String(r.unit_id)));
    const missing = units
      .filter((u: Row) => !submittedSet.has(String(u.id)))
      .map((u: Row) => String(u.name));
    return { assigned: unitIds.length, submitted: submittedSet.size, missing };
  }

  /** Duyệt tất cả bài cá nhân đang chờ duyệt của nhiệm vụ (bỏ qua bài đã từ chối). */
  async approveAllMemberSubmissions(taskId: string): Promise<{ success: boolean; approved: number; message?: string }> {
    try {
      const reviewer = await this.requireMemberId();
      const now = new Date().toISOString();
      const { data, error } = await this.supabase.from('member_submissions')
        .update({ status: 'approved', reviewed_by: reviewer, reviewed_at: now, review_note: 'Duyệt hàng loạt' })
        .eq('task_id', Number(taskId))
        .eq('status', 'pending')
        .select('id');
      if (error) return { success: false, approved: 0, message: friendlyError(error) };
      const approved = (data ?? []).length;
      if (approved > 0) {
        await this.writeAudit('Duyệt hàng loạt bài nộp cá nhân', 'member_submissions', taskId,
          { status: 'pending' }, { status: 'approved', count: approved });
      }
      return { success: true, approved };
    } catch (e) {
      return { success: false, approved: 0, message: friendlyError(e as any) };
    }
  }

  async cloneTask(id: string): Promise<DbTask | null> {
    const src = await this.getTask(id);
    if (!src.task) return null;
    const assignedBy = await this.requireMemberId();
    const t = src.task;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const { data, error } = await this.supabase.from('tasks').insert({
      title: `${t.title} (Bản sao)`, content: t.content,
      due_date: due.toISOString().slice(0, 10),
      assigned_by: assignedBy, status: 'draft',
      reminder_days: t.reminder_days, target: t.target,
      evaluation_criteria: t.evaluation_criteria || 'Có biên bản và hình ảnh nghiệm thu',
      max_score: t.max_score, lat: t.lat, lng: t.lng,
      submit_scope: t.submit_scope,
    }).select('*').single();
    if (error) fail(error);
    const cloned = toTask(data as Row);
    if (src.units.length > 0) {
      await this.supabase.from('task_units').insert(src.units.map((u) => ({ task_id: Number(cloned.id), unit_id: Number(u.id) })));
    }
    if (src.subCriteria.length > 0) {
      await this.supabase.from('task_sub_criteria').insert(src.subCriteria.map((s) => ({
        task_id: Number(cloned.id), sub_criterion_id: Number(s.subCriterion.id), contribution_score: s.contribution_score,
      })));
    }
    return cloned;
  }

  async remindUnit(taskId: string, unitId: string): Promise<{ success: boolean }> {
    const { data: taskRow } = await this.supabase.from('tasks').select('title').eq('id', Number(taskId)).maybeSingle();
    await this.notifySecretaries([unitId], {
      title: `Nhắc nhở tiến độ: ${(taskRow as Row)?.title ?? 'Nhiệm vụ'}`,
      body: 'Đã gần đến hạn, vui lòng hoàn thành và nộp kết quả.',
      type: 'reminder', level: 'orange', taskId,
    });
    return { success: true };
  }

  async remindAllUnsubmitted(taskId: string): Promise<{ remindedCount: number }> {
    const [unitRows, resRows] = await Promise.all([
      fetchAll((f, t) => this.supabase.from('task_units').select('unit_id').eq('task_id', Number(taskId)).range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_results').select('unit_id').eq('task_id', Number(taskId)).in('status', ['pending', 'approved']).range(f, t)),
    ]);
    const submitted = new Set(resRows.map((r: Row) => String(r.unit_id)));
    const unsubmitted = unitRows.map((r: Row) => String(r.unit_id)).filter((u) => !submitted.has(u));
    if (unsubmitted.length > 0) {
      const { data: taskRow } = await this.supabase.from('tasks').select('title').eq('id', Number(taskId)).maybeSingle();
      await this.notifySecretaries(unsubmitted, {
        title: `Nhắc nhở tiến độ: ${(taskRow as Row)?.title ?? 'Nhiệm vụ'}`,
        body: 'Chi đoàn chưa nộp kết quả, vui lòng hoàn thành.',
        type: 'reminder', level: 'orange', taskId,
      });
    }
    return { remindedCount: unsubmitted.length };
  }

  /**
   * Gửi thông báo tới BÍ THƯ của các chi đoàn (notifications.recipient_id là member, không phải unit).
   * Chi đoàn không có bí thư đang hoạt động thì bỏ qua.
   */
  private async notifySecretaries(
    unitIds: string[],
    msg: { title: string; body: string; type: NotificationType; level: NotificationLevel; taskId?: string; subCriterionId?: string }
  ): Promise<void> {
    if (unitIds.length === 0) return;
    // Bí thư đang giữ chức: ưu tiên unit_committees, dự phòng members.current_position
    const secRows = await fetchAll((f, t) =>
      this.supabase.from('unit_committees').select('unit_id, member_id')
        .eq('position', 'secretary').is('term_end', null)
        .in('unit_id', unitIds.map(Number)).range(f, t));
    const secByUnit = new Map<string, number>(secRows.map((r: Row) => [String(r.unit_id), Number(r.member_id)]));

    const missing = unitIds.filter((u) => !secByUnit.has(String(u)));
    if (missing.length > 0) {
      const fallback = await fetchAll((f, t) =>
        this.supabase.from('members').select('unit_id, id')
          .eq('current_position', 'secretary').eq('is_active', true)
          .in('unit_id', missing.map(Number)).range(f, t));
      for (const r of fallback) secByUnit.set(String(r.unit_id), Number(r.id));
    }

    const rows = unitIds
      .map((u) => secByUnit.get(String(u)))
      .filter((id): id is number => !!id)
      .map((memberId) => ({
        recipient_id: memberId,
        type: msg.type,
        level: msg.level,
        title: msg.title,
        body: msg.body,
        task_id: msg.taskId ? Number(msg.taskId) : null,
        sub_criterion_id: msg.subCriterionId ? Number(msg.subCriterionId) : null,
        is_read: false,
      }));
    if (rows.length === 0) return;
    const { error } = await this.supabase.from('notifications').insert(rows);
    if (error) fail(error);
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — DUYỆT
  // =====================================================================

  async listPendingReviews(
    tab: 'all' | 'tasks' | 'criteria',
    filters?: { unitId?: string; search?: string }
  ): Promise<{ taskResults: DbTaskResult[]; criterionSubmissions: DbCriterionSubmission[] }> {
    let taskResults: DbTaskResult[] = [];
    let criterionSubmissions: DbCriterionSubmission[] = [];
    if (tab === 'all' || tab === 'tasks') {
      let q = this.supabase.from('task_results').select('*').eq('status', 'pending');
      if (filters?.unitId) q = q.eq('unit_id', Number(filters.unitId));
      const { data, error } = await q;
      if (error) fail(error);
      taskResults = (data ?? []).map(toTaskResult);
    }
    if (tab === 'all' || tab === 'criteria') {
      let q = this.supabase.from('criterion_submissions').select('*').eq('status', 'pending');
      if (filters?.unitId) q = q.eq('unit_id', Number(filters.unitId));
      const { data, error } = await q;
      if (error) fail(error);
      criterionSubmissions = (data ?? []).map(toCriterionSubmission);
    }
    return { taskResults, criterionSubmissions };
  }

  async getReviewDetail(kind: 'task' | 'criterion', id: string): Promise<{
    item: DbTaskResult | DbCriterionSubmission | null;
    unit: DbUnit | null;
    task?: DbTask | null;
    subCriterion?: DbSubCriterion | null;
    evidences: DbEvidence[];
    warnings: EvidenceAuditWarning[];
  }> {
    if (kind === 'task') {
      const { data: resRow, error } = await this.supabase.from('task_results').select('*').eq('id', Number(id)).maybeSingle();
      if (error) fail(error);
      if (!resRow) return { item: null, unit: null, evidences: [], warnings: [] };
      const item = toTaskResult(resRow);
      const { data: taskRow } = await this.supabase.from('tasks').select('*').eq('id', Number(item.task_id)).maybeSingle();
      const { data: unitRow } = await this.supabase.from('units').select('*').eq('id', Number(item.unit_id)).maybeSingle();
      const evRows = await fetchAll((f, t) => this.supabase.from('evidences').select('*').eq('task_id', Number(item.task_id)).eq('unit_id', Number(item.unit_id)).range(f, t));
      const evidences = evRows.map(toEvidence);
      return {
        item, unit: unitRow ? toUnit(unitRow) : null, task: taskRow ? toTask(taskRow) : null,
        evidences, warnings: await this.buildEvidenceWarnings(evidences, taskRow ? String((taskRow as Row).due_date) : null),
      };
    }
    const { data: subRow, error } = await this.supabase.from('criterion_submissions').select('*').eq('id', Number(id)).maybeSingle();
    if (error) fail(error);
    if (!subRow) return { item: null, unit: null, evidences: [], warnings: [] };
    const item = toCriterionSubmission(subRow);
    const { data: scRow } = await this.supabase.from('sub_criteria').select('*').eq('id', Number(item.sub_criterion_id)).maybeSingle();
    const { data: unitRow } = await this.supabase.from('units').select('*').eq('id', Number(item.unit_id)).maybeSingle();
    const evRows = await fetchAll((f, t) => this.supabase.from('evidences').select('*').eq('submission_id', Number(item.id)).range(f, t));
    const evidences = evRows.map(toEvidence);
    return {
      item, unit: unitRow ? toUnit(unitRow) : null, subCriterion: scRow ? toSubCriterion(scRow) : null,
      evidences, warnings: await this.buildEvidenceWarnings(evidences, scRow ? String((scRow as Row).deadline) : null),
    };
  }

  /** Tính cảnh báo minh chứng như mock: thiếu GPS, trùng hash, chụp sau hạn. */
  private async buildEvidenceWarnings(evidences: DbEvidence[], deadlineIso: string | null): Promise<EvidenceAuditWarning[]> {
    const allHashes = await fetchAll((f, t) => this.supabase.from('evidences').select('file_hash').range(f, t));
    const hashCount = new Map<string, number>();
    for (const r of allHashes) hashCount.set(String(r.file_hash), (hashCount.get(String(r.file_hash)) ?? 0) + 1);
    const deadline = deadlineIso ? new Date(deadlineIso).getTime() : NaN;
    return evidences.map((ev) => {
      const isMissingGps = ev.lat === null || ev.lng === null;
      const isDuplicateHash = (hashCount.get(ev.file_hash) ?? 0) > 1;
      const isLate = Number.isFinite(deadline) && new Date(ev.captured_at).getTime() > deadline;
      const parts: string[] = [];
      if (isMissingGps) parts.push('Thiếu toạ độ GPS');
      if (isDuplicateHash) parts.push('Trùng mã băm minh chứng');
      if (isLate) parts.push('Chụp sau hạn');
      return {
        evidence_id: ev.id, is_missing_gps: isMissingGps, is_duplicate_hash: isDuplicateHash,
        is_captured_after_deadline: isLate, warning_text: parts.join(' • ') || undefined,
      };
    });
  }

  async approve(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    approvedScore?: number,
    reviewNote?: string
  ): Promise<{ success: boolean; message?: string }> {
    const now = new Date().toISOString();
    const reviewer = await this.requireMemberId();
    if (kind === 'task') {
      const { data, error } = await this.supabase.from('task_results').update({
        status: 'approved', reviewed_by: reviewer, reviewed_at: now, review_note: reviewNote || 'Đạt yêu cầu',
      }).eq('id', Number(id)).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy bản ghi cần duyệt' };
      await this.writeAudit('Duyệt kết quả nhiệm vụ', 'task_results', id, { status: 'pending' }, { status: 'approved' });
      return { success: true };
    }
    // criterion: chặn điểm vượt tối đa
    const { data: subRow } = await this.supabase.from('criterion_submissions').select('self_score, sub_criterion_id').eq('id', Number(id)).maybeSingle();
    if (!subRow) return { success: false, message: 'Không tìm thấy bản ghi cần duyệt' };
    const { data: scRow } = await this.supabase.from('sub_criteria').select('max_score').eq('id', Number((subRow as Row).sub_criterion_id)).maybeSingle();
    const maxScore = Number((scRow as Row)?.max_score ?? 5);
    const score = Math.min(approvedScore ?? Number((subRow as Row).self_score ?? 0), maxScore);
    const { data, error } = await this.supabase.from('criterion_submissions').update({
      status: 'approved', approved_score: score, reviewed_by: reviewer, reviewed_at: now,
      review_note: reviewNote || 'Đã kiểm tra minh chứng hợp lệ',
    }).eq('id', Number(id)).select('id');
    if (error) return { success: false, message: friendlyError(error) };
    if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy bản ghi cần duyệt' };
    await this.writeAudit('Duyệt minh chứng tiêu chí', 'criterion_submissions', id, { status: 'pending' }, { status: 'approved' });
    return { success: true };
  }

  async reject(kind: 'task' | 'criterion', id: string, reviewerId: string, note: string): Promise<{ success: boolean; message?: string }> {
    const now = new Date().toISOString();
    const reviewer = await this.requireMemberId();
    if (kind === 'task') {
      const { data, error } = await this.supabase.from('task_results').update({
        status: 'rejected', reviewed_by: reviewer, reviewed_at: now, review_note: note,
      }).eq('id', Number(id)).select('id');
      if (error) return { success: false, message: friendlyError(error) };
      if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy mục cần từ chối' };
      await this.writeAudit('Từ chối kết quả nhiệm vụ', 'task_results', id, { status: 'pending' }, { status: 'rejected' });
      return { success: true };
    }
    const { data, error } = await this.supabase.from('criterion_submissions').update({
      status: 'rejected', approved_score: 0, reviewed_by: reviewer, reviewed_at: now, review_note: note,
    }).eq('id', Number(id)).select('id');
    if (error) return { success: false, message: friendlyError(error) };
    if ((data ?? []).length === 0) return { success: false, message: 'Không tìm thấy mục cần từ chối' };
    await this.writeAudit('Từ chối tiêu chí', 'criterion_submissions', id, { status: 'pending' }, { status: 'rejected' });
    return { success: true };
  }

  /** Ghi nhật ký kiểm toán (actor = tài khoản đang đăng nhập). */
  private async writeAudit(action: string, table: string, rowId: string, oldValue: unknown, newValue: unknown): Promise<void> {
    const user = await this.getCurrentUser();
    await this.supabase.from('audit_logs').insert({
      actor_id: user?.profileId ?? null,
      actor_role: user?.role ?? null,
      action: 'UPDATE',
      table_name: table,
      row_id: String(rowId),
      old_value: oldValue as never,
      new_value: newValue as never,
    });
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — NHẮC NHỞ & CẢNH BÁO
  // =====================================================================

  async listWarnings(tab: 'open' | 'resolved'): Promise<
    Array<{ warning: DbWarning; unit: DbUnit | null; task: DbTask | null; subCriterion: DbSubCriterion | null }>
  > {
    let q = this.supabase.from('warnings').select('*');
    q = tab === 'open' ? q.is('resolved_at', null) : q.not('resolved_at', 'is', null);
    const { data, error } = await q;
    if (error) fail(error);
    const warnings = (data ?? []).map(toWarning);
    const out: Array<{ warning: DbWarning; unit: DbUnit | null; task: DbTask | null; subCriterion: DbSubCriterion | null }> = [];
    for (const warning of warnings) {
      const [unitRes, taskRes, subRes] = await Promise.all([
        warning.unit_id ? this.supabase.from('units').select('*').eq('id', Number(warning.unit_id)).maybeSingle() : Promise.resolve({ data: null }),
        warning.task_id ? this.supabase.from('tasks').select('*').eq('id', Number(warning.task_id)).maybeSingle() : Promise.resolve({ data: null }),
        warning.sub_criterion_id ? this.supabase.from('sub_criteria').select('*').eq('id', Number(warning.sub_criterion_id)).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      out.push({
        warning,
        unit: unitRes.data ? toUnit(unitRes.data as Row) : null,
        task: taskRes.data ? toTask(taskRes.data as Row) : null,
        subCriterion: subRes.data ? toSubCriterion(subRes.data as Row) : null,
      });
    }
    return out;
  }

  async resolveWarning(warningId: string): Promise<{ success: boolean }> {
    const { data, error } = await this.supabase.from('warnings')
      .update({ resolved_at: new Date().toISOString() }).eq('id', Number(warningId)).select('id');
    if (error) fail(error);
    return { success: (data ?? []).length > 0 };
  }

  async sendNotification(input: {
    recipientType: 'unit' | 'type' | 'units' | 'member';
    unitId?: string;
    unitIds?: string[];
    memberId?: string;
    unitType?: UnitTypeId;
    title: string;
    content: string;
    level: 'yellow' | 'orange' | 'red';
    taskId?: string;
    subCriterionId?: string;
  }): Promise<{ sentCount: number; recipients: string[] }> {
    // Gửi tới 1 đoàn viên cụ thể
    if (input.recipientType === 'member' && input.memberId) {
      const { data: m } = await this.supabase.from('members').select('id, full_name').eq('id', Number(input.memberId)).maybeSingle();
      if (!m) return { sentCount: 0, recipients: [] };
      const { error } = await this.supabase.from('notifications').insert({
        recipient_id: Number((m as Row).id), type: 'reminder', level: input.level,
        title: input.title, body: input.content,
        task_id: input.taskId ? Number(input.taskId) : null,
        sub_criterion_id: input.subCriterionId ? Number(input.subCriterionId) : null,
        is_read: false,
      });
      if (error) fail(error);
      return { sentCount: 1, recipients: [String((m as Row).full_name)] };
    }

    // Xác định danh sách chi đoàn nhận
    let unitRows: Row[] = [];
    if (input.recipientType === 'unit' && input.unitId) {
      unitRows = await fetchAll((f, t) => this.supabase.from('units').select('id, name').eq('id', Number(input.unitId)).range(f, t));
    } else if (input.recipientType === 'units' && input.unitIds && input.unitIds.length > 0) {
      unitRows = await fetchAll((f, t) => this.supabase.from('units').select('id, name')
        .in('id', input.unitIds!.map(Number)).range(f, t));
    } else if (input.recipientType === 'type' && input.unitType) {
      unitRows = await fetchAll((f, t) => this.supabase.from('units').select('id, name')
        .eq('unit_type_id', DB_ID_BY_UNIT_TYPE_SLUG[input.unitType!]).eq('is_active', true).range(f, t));
    } else {
      unitRows = await fetchAll((f, t) => this.supabase.from('units').select('id, name').eq('is_active', true).range(f, t));
    }
    const unitIds = unitRows.map((r) => String(r.id));
    await this.notifySecretaries(unitIds, {
      title: input.title, body: input.content, type: 'reminder', level: input.level,
      taskId: input.taskId, subCriterionId: input.subCriterionId,
    });
    return { sentCount: unitRows.length, recipients: unitRows.map((r) => String(r.name)) };
  }

  // =====================================================================
  // GIAI ĐOẠN 2 — TÍNH ĐIỂM CHI ĐOÀN
  // =====================================================================

  async calculateUnitScores(): Promise<UnitScoreCalculation[]> {
    const units = (await fetchAll((f, t) => this.supabase.from('units').select('*').range(f, t))).map(toUnit);
    const [subs, results, memberSubs, taskUnits, taskSubs] = await Promise.all([
      fetchAll((f, t) => this.supabase.from('criterion_submissions').select('*').eq('status', 'approved').range(f, t)),
      fetchAll((f, t) => this.supabase.from('task_results').select('unit_id, task_id, status').eq('status', 'approved').range(f, t)),
      // Bảng member_submissions có thể chưa tồn tại nếu chưa chạy migration phase3
      fetchAll((f, t) => this.supabase.from('member_submissions').select('unit_id').eq('status', 'approved').range(f, t)).catch(() => [] as Row[]),
      fetchAll((f, t) => this.supabase.from('task_units').select('task_id, unit_id').range(f, t)).catch(() => [] as Row[]),
      fetchAll((f, t) => this.supabase.from('task_sub_criteria').select('task_id').range(f, t)).catch(() => [] as Row[]),
    ]);

    // Nhiệm vụ "thuộc chỉ tiêu" = có ít nhất một dòng trong task_sub_criteria
    const tasksWithCriteria = new Set(taskSubs.map((r: Row) => String(r.task_id)));

    return units.map((unit) => {
      const criteriaScore = subs
        .filter((s: Row) => String(s.unit_id) === unit.id)
        .reduce((sum, s: Row) => sum + Number(s.approved_score ?? 0), 0);

      // Chỉ đếm nhiệm vụ đã duyệt VÀ có gắn tiêu chí
      const taskCount = results.filter((r: Row) =>
        String(r.unit_id) === unit.id && tasksWithCriteria.has(String(r.task_id))
      ).length;

      // Tổng nhiệm vụ (có gắn tiêu chí) được giao cho chi đoàn
      const taskAssignedCount = taskUnits.filter((r: Row) =>
        String(r.unit_id) === unit.id && tasksWithCriteria.has(String(r.task_id))
      ).length;

      const participantCount = memberSubs.filter((r: Row) => String(r.unit_id) === unit.id).length;
      const totalScore = criteriaScore;
      const maxPossible = 100;
      return {
        unit, totalScore, maxPossible, criteriaScore, taskCount, taskAssignedCount, participantCount,
        completionRate: taskAssignedCount > 0
          ? Math.min(100, Math.round((taskCount / taskAssignedCount) * 100))
          : 0,
      };
    });
  }

  // ----- Tài khoản và quyền ----------------------------------------------------
  async listProfiles(): Promise<Array<{ profile: DbProfile; member: DbMember | null }>> {
    await this.loadRoles();
    let rows: Row[] = [];
    // Ưu tiên hàm list_profiles_admin (có email); chưa có hàm thì đọc bảng profiles (không có email)
    const rpc = await this.supabase.rpc('list_profiles_admin');
    if (!rpc.error) {
      rows = (rpc.data ?? []) as Row[];
    } else {
      const { data, error } = await this.supabase.from('profiles').select('id, member_id, role_id, is_active');
      if (error) fail(error);
      rows = (data ?? []) as Row[];
    }
    const members = await this.fetchMembersByIds(rows.filter((r) => r.member_id !== null).map((r) => Number(r.member_id)));
    return rows.map((r) => ({
      profile: {
        id: r.id, member_id: r.member_id === null ? null : String(r.member_id),
        role_id: (r.role_name ?? this.roleNameById!.get(Number(r.role_id)) ?? 'member') as RoleId,
        is_active: r.is_active, email: r.email ?? undefined,
      },
      member: r.member_id === null ? null : members.get(String(r.member_id)) ?? null,
    }));
  }

  async setProfileRole(profileId: string, roleId: RoleId): Promise<{ success: boolean }> {
    await this.loadRoles();
    const dbRoleId = this.roleIdByName!.get(roleId);
    if (!dbRoleId) throw new Error(`Không tìm thấy quyền "${roleId}"`);
    const { data, error } = await this.supabase.from('profiles').update({ role_id: dbRoleId }).eq('id', profileId).select('id');
    if (error) fail(error);
    if ((data ?? []).length === 0) throw new Error('Bạn không có quyền gán quyền này cho tài khoản đó');
    this.clearCache();
    return { success: true };
  }

  async toggleProfileActive(profileId: string): Promise<{ success: boolean }> {
    const { data: cur, error: e1 } = await this.supabase.from('profiles').select('is_active').eq('id', profileId).maybeSingle();
    if (e1) fail(e1);
    if (!cur) throw new Error('Không tìm thấy tài khoản hoặc bạn không có quyền xem');
    const { data, error } = await this.supabase.from('profiles').update({ is_active: !cur.is_active }).eq('id', profileId).select('id');
    if (error) fail(error);
    if ((data ?? []).length === 0) throw new Error('Bạn không có quyền đổi trạng thái tài khoản này');
    this.clearCache();
    return { success: true };
  }

  async linkProfileMember(profileId: string, memberId: string): Promise<{ success: boolean }> {
    const { data, error } = await this.supabase.from('profiles').update({ member_id: Number(memberId) }).eq('id', profileId).select('id');
    if (error) {
      if (error.code === '23505') throw new Error('Đoàn viên này đã được liên kết với một tài khoản khác');
      fail(error);
    }
    if ((data ?? []).length === 0) throw new Error('Bạn không có quyền liên kết tài khoản này');
    this.clearCache();
    return { success: true };
  }

  // ----- Nhật ký -----------------------------------------------------------------
  async listAuditLogs(filters?: { search?: string; action?: string; actorId?: string }) {
    let q = this.supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
    if (filters?.action) q = q.eq('action', filters.action);
    if (filters?.actorId) q = q.eq('actor_id', filters.actorId);
    const { data, error } = await q;
    if (error) fail(error);
    const rows = (data ?? []) as Row[];

    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
    const actorMember = new Map<string, DbMember>();
    if (actorIds.length > 0) {
      const profiles = await this.supabase.from('profiles').select('id, member_id').in('id', actorIds);
      const memberIds = (profiles.data ?? []).filter((p: Row) => p.member_id !== null).map((p: Row) => Number(p.member_id));
      const members = await this.fetchMembersByIds(memberIds);
      for (const p of profiles.data ?? []) {
        const m = p.member_id === null ? undefined : members.get(String(p.member_id));
        if (m) actorMember.set(p.id as string, m);
      }
    }
    const asText = (v: unknown): string | null => (v === null || v === undefined ? null : JSON.stringify(v));
    let out = rows.map((r) => {
      const log: DbAuditLog = {
        id: String(r.id), actor_id: r.actor_id ?? '', actor_role: r.actor_role ?? '', action: r.action, table_name: r.table_name,
        row_id: r.row_id ?? '', old_value: asText(r.old_value), new_value: asText(r.new_value), created_at: r.created_at,
      };
      return { log, actor: r.actor_id ? actorMember.get(r.actor_id) ?? null : null, diffSummary: { oldValue: log.old_value, newValue: log.new_value } };
    });
    if (filters?.search) {
      const s = normalizeText(filters.search);
      out = out.filter((x) => normalizeText(`${x.log.table_name} ${x.log.row_id} ${x.log.actor_role} ${x.actor?.full_name ?? ''}`).includes(s));
    }
    return out;
  }
}

/** Các hàm đoàn viên ở dạng đối tượng thường, dùng để ghép với bản mock (xem index.ts) */
export function createSupabaseGd1Methods(supabase: SupabaseClient): SupabaseGd1Repository {
  return new SupabaseGd1Repository(supabase);
}
