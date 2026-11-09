import { Repository } from './repository';
import {
  DbRole,
  DbUnitType,
  DbEthnicity,
  DbUnit,
  DbMember,
  DbProfile,
  DbCriteriaSet,
  DbCriteriaSection,
  DbCriterion,
  DbSubCriterion,
  DbCriterionSubmission,
  DbTask,
  DbTaskUnit,
  DbTaskRegistration,
  DbTaskSubCriterion,
  DbTaskResult,
  DbMemberSubmission,
  DbUnitReport,
  DbJournalEntry,
  DbEvidence,
  DbNotification,
  DbWarning,
  DbUnitCommittee,
  DbReport,
  DbYearlySettings,
  DbAuditLog,
  DashboardStats,
  UnitScoreCalculation,
  MemberComputed,
  TaskDeadlineStatus,
  EvidenceAuditWarning,
  RoleId,
  UnitTypeId,
  CommitteePosition,
  ReportType,
  DbEvaluationPeriod,
  DbMemberRldvLevel,
  DbMemberDiscipline,
  DbMemberEvaluation,
  DbUnitEvaluation,
  DbUnionFeeSettings,
  DbUnionFeePayment,
  DbUnitFeeDistribution,
  DbScheduledNotification,
  FeePaymentMethod,
  FeePaymentStatus,
  PeriodType,
  PeriodStatus,
  RatingLevel,
  DisciplineForm,
} from './types';
import {
  computeMemberRating,
  computeUnitRating,
  percent,
  hasStrictDisciplineInPeriod,
  periodRange,
} from '../utils/evaluationRules';
import {
  mockRoles,
  mockUnitTypes,
  mockEthnicities,
  mockUnits,
  mockMembers,
  mockProfiles,
  mockCriteriaSet,
  mockCriteriaSections,
  mockCriteria,
  mockSubCriteria,
  mockTasks,
  mockTaskUnits,
  mockTaskRegistrations,
  mockTaskSubCriteria,
  mockTaskResults,
  mockCriterionSubmissions,
  mockEvidences,
  mockNotifications,
  mockWarnings,
  mockAuditLogs,
  mockUnitCommittees,
  mockReports,
  mockYearlySettings,
  keyMemberIds,
  getRelativeDate,
} from '../mock/data';

// Helper bỏ dấu tiếng Việt để tìm kiếm
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export class MockRepository implements Repository {
  private roles: DbRole[] = JSON.parse(JSON.stringify(mockRoles));
  private unitTypes: DbUnitType[] = JSON.parse(JSON.stringify(mockUnitTypes));
  private ethnicities: DbEthnicity[] = JSON.parse(JSON.stringify(mockEthnicities));
  private units: DbUnit[] = JSON.parse(JSON.stringify(mockUnits));
  private members: DbMember[] = JSON.parse(JSON.stringify(mockMembers));
  private profiles: DbProfile[] = JSON.parse(JSON.stringify(mockProfiles));
  private criteriaSets: DbCriteriaSet[] = [
    JSON.parse(JSON.stringify(mockCriteriaSet)),
    {
      id: 'set_2025',
      year: 2025,
      name: 'Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm 2025 (Niên độ trước)',
      issuing_unit: 'Huyện Đoàn & Ban Thường vụ Đoàn xã Hòa Bình',
    },
  ];
  private criteriaSections: DbCriteriaSection[] = JSON.parse(JSON.stringify(mockCriteriaSections));
  private criteria: DbCriterion[] = JSON.parse(JSON.stringify(mockCriteria));
  private subCriteria: DbSubCriterion[] = JSON.parse(JSON.stringify(mockSubCriteria));
  private criterionSubmissions: DbCriterionSubmission[] = JSON.parse(JSON.stringify(mockCriterionSubmissions));
  private tasks: DbTask[] = JSON.parse(JSON.stringify(mockTasks));
  private taskUnits: DbTaskUnit[] = JSON.parse(JSON.stringify(mockTaskUnits));
  private taskRegistrations: DbTaskRegistration[] = JSON.parse(JSON.stringify(mockTaskRegistrations));
  private taskSubCriteria: DbTaskSubCriterion[] = JSON.parse(JSON.stringify(mockTaskSubCriteria));
  private taskResults: DbTaskResult[] = JSON.parse(JSON.stringify(mockTaskResults));
  private evidences: DbEvidence[] = JSON.parse(JSON.stringify(mockEvidences));
  private notifications: DbNotification[] = JSON.parse(JSON.stringify(mockNotifications));
  private warnings: DbWarning[] = JSON.parse(JSON.stringify(mockWarnings));
  private memberSubmissions: DbMemberSubmission[] = [];
  private unitReports: DbUnitReport[] = [];
  private unitCommittees: DbUnitCommittee[] = JSON.parse(JSON.stringify(mockUnitCommittees));
  private reports: DbReport[] = JSON.parse(JSON.stringify(mockReports));
  private yearlySettings: DbYearlySettings = JSON.parse(JSON.stringify(mockYearlySettings));
  private auditLogs: DbAuditLog[] = JSON.parse(JSON.stringify(mockAuditLogs));

  // Đánh giá hằng năm (bộ nhớ tạm ở chế độ mock)
  private evaluationPeriods: DbEvaluationPeriod[] = [];
  private memberRldvLevels: DbMemberRldvLevel[] = [];
  private memberDisciplines: DbMemberDiscipline[] = [];
  private memberEvaluations: DbMemberEvaluation[] = [];
  private unitEvaluations: DbUnitEvaluation[] = [];

  // Đoàn phí (bộ nhớ tạm ở chế độ mock)
  private unionFeeSettings: DbUnionFeeSettings = {
    id: 1,
    bank_name: 'MB Bank',
    bank_code: '970422',
    account_number: '0585682707',
    account_holder: 'DUONG PHUOC LOC',
    auto_remind_day: 5,
    fee_non_salary: 2000,
    fee_has_salary: 5000,
    payos_client_id: '8ee9d939-9f65-4c50-a6bd-d0268ce14dfd',
    payos_api_key: '4e07a201-0bab-43ad-89aa-d2bcf6ca9e96',
    payos_checksum_key: '5e51534bea3712dc6d4fc59e44418e3172d2a5369675e846c2ced044b2d41363',
    payos_active: true,
    updated_at: new Date().toISOString(),
  };
  private unionFeePayments: DbUnionFeePayment[] = [];
  private unitFeeDistributions: DbUnitFeeDistribution[] = [];
  private scheduledNotifications: DbScheduledNotification[] = [];

  private seq = 1;
  private nextId(prefix: string): string {
    return `${prefix}_${Date.now()}_${this.seq++}`;
  }

  // 0. Người dùng đang đăng nhập — chế độ mock không có phiên thật
  async getCurrentUser(): Promise<{
    profileId: string;
    email: string | null;
    role: RoleId;
    memberId: string | null;
    isActive: boolean;
  } | null> {
    return null;
  }

  // 0b. Nộp minh chứng — chỉ hoạt động ở chế độ Supabase thật
  async listMyTodo(): Promise<never> {
    throw new Error('Chức năng nộp minh chứng chỉ dùng khi kết nối Supabase thật.');
  }
  async uploadEvidence(): Promise<never> {
    throw new Error('Chức năng tải minh chứng chỉ dùng khi kết nối Supabase thật.');
  }
  async submitTaskResult(): Promise<never> {
    throw new Error('Chức năng nộp kết quả nhiệm vụ chỉ dùng khi kết nối Supabase thật.');
  }
  async submitCriterionSubmission(): Promise<never> {
    throw new Error('Chức năng nộp tiêu chí chỉ dùng khi kết nối Supabase thật.');
  }

  // 0c. Tự phục vụ
  async updateMyProfile(): Promise<never> {
    throw new Error('Chức năng sửa hồ sơ cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async uploadMyAvatar(): Promise<never> {
    throw new Error('Tải ảnh đại diện chỉ dùng khi kết nối Supabase thật.');
  }
  async listMyFeed(): Promise<never> {
    throw new Error('Bảng tin chỉ dùng khi kết nối Supabase thật.');
  }
  async setTaskRegistration(): Promise<never> {
    throw new Error('Chức năng xác nhận tham gia chỉ dùng khi kết nối Supabase thật.');
  }
  async submitMemberResult(): Promise<never> {
    throw new Error('Chức năng nộp minh chứng cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async listMemberSubmissions(): Promise<DbMemberSubmission[]> {
    return this.memberSubmissions;
  }
  async reviewMemberSubmission(): Promise<never> {
    throw new Error('Chức năng duyệt bài nộp cá nhân chỉ dùng khi kết nối Supabase thật.');
  }
  async listMemberSubmissionEvidences(): Promise<DbEvidence[]> {
    return [];
  }

  // Báo cáo riêng của Bí thư chi đoàn — chỉ hoạt động khi kết nối Supabase thật
  async listUnitReports(): Promise<DbUnitReport[]> {
    return [];
  }
  async submitUnitReport(): Promise<never> {
    throw new Error('Nộp báo cáo chi đoàn chỉ dùng khi kết nối Supabase thật.');
  }
  async reviewUnitReport(): Promise<never> {
    throw new Error('Duyệt báo cáo chi đoàn chỉ dùng khi kết nối Supabase thật.');
  }
  async listUnitReportEvidences(): Promise<DbEvidence[]> {
    return [];
  }

  // Tạo tài khoản đăng nhập — cần Supabase thật (service_role ở server)
  async createMemberAccount(): Promise<never> {
    throw new Error('Tạo tài khoản đăng nhập chỉ dùng khi kết nối Supabase thật.');
  }
  async bulkCreateMemberAccounts(): Promise<never> {
    throw new Error('Tạo tài khoản đăng nhập chỉ dùng khi kết nối Supabase thật.');
  }

  async listTaskParticipantsAll(): Promise<never> {
    throw new Error('Chức năng xem danh sách tham gia chỉ dùng khi kết nối Supabase thật.');
  }
  async listTaskParticipants(): Promise<never> {
    throw new Error('Chức năng xem danh sách tham gia chỉ dùng khi kết nối Supabase thật.');
  }

  async getSignupOptions(): Promise<{
    units: Array<{ id: string; name: string; unit_type_id: UnitTypeId }>;
    ethnicities: Array<{ id: string; name: string }>;
  }> {
    return { units: [], ethnicities: [] };
  }
  async selfRegisterMember(): Promise<never> {
    throw new Error('Đăng ký tài khoản chỉ dùng khi kết nối Supabase thật.');
  }

  private journalEntries: DbJournalEntry[] = [];

  async listJournalEntries(): Promise<DbJournalEntry[]> {
    return this.journalEntries;
  }
  async saveJournalEntry(input: {
    id?: string; title: string; activity_date: string; note?: string;
    images: Array<{ storagePath: string; url: string; fileName?: string }>;
    links: Array<{ url: string; note?: string }>;
  }): Promise<{ success: boolean; message?: string; entryId?: string }> {
    const now = new Date().toISOString();
    const id = input.id ?? `journal_${Date.now()}`;
    const entry: DbJournalEntry = {
      id,
      profile_id: 'mock-profile',
      title: input.title,
      activity_date: input.activity_date,
      note: input.note,
      created_at: now,
      updated_at: now,
      images: input.images.map((i, idx) => ({
        id: `${id}_img_${idx}`, entry_id: id,
        storage_path: i.storagePath, url: i.url, file_name: i.fileName,
      })),
      links: input.links.map((l, idx) => ({
        id: `${id}_link_${idx}`, entry_id: id, url: l.url, note: l.note,
      })),
    };
    const idx = this.journalEntries.findIndex(e => e.id === id);
    if (idx >= 0) this.journalEntries[idx] = entry;
    else this.journalEntries.unshift(entry);
    return { success: true, entryId: id };
  }
  async deleteJournalEntry(id: string): Promise<{ success: boolean; message?: string }> {
    this.journalEntries = this.journalEntries.filter(e => e.id !== id);
    return { success: true };
  }
  async uploadJournalImage(): Promise<never> {
    throw new Error('Tải ảnh sổ tay chỉ dùng khi kết nối Supabase thật.');
  }

  // 1. Dashboard & Thống kê
  async getDashboard(year: number): Promise<DashboardStats> {
    const taskPending = this.taskResults.filter(r => r.status === 'pending').length;
    const critPending = this.criterionSubmissions.filter(s => s.status === 'pending').length;

    const overdueUnitsSet = new Set<string>();
    this.taskResults.forEach(r => {
      if (r.is_overdue || (r.status === 'pending' && new Date().toISOString() > '2026-10-01')) {
        overdueUnitsSet.add(r.unit_id);
      }
    });

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoonTasks = this.tasks.filter(t => {
      const due = new Date(t.due_date);
      return due >= now && due <= next7Days && t.status === 'published';
    }).length;

    const currentYear = year || 2026;
    const newMembers = this.members.filter(m => {
      try {
        return new Date(m.joined_date).getFullYear() === currentYear;
      } catch {
        return false;
      }
    }).length;

    const matured = this.members.filter(m => {
      try {
        const birthYear = new Date(m.birth_date).getFullYear();
        return currentYear - birthYear >= (this.yearlySettings.matured_age || 30);
      } catch {
        return false;
      }
    }).length;

    return {
      pendingCount: taskPending + critPending,
      taskPendingCount: taskPending,
      criteriaPendingCount: critPending,
      overdueUnitsCount: overdueUnitsSet.size,
      dueSoon7DaysCount: dueSoonTasks,
      newMembersCount: newMembers,
      maturedCount: matured,
      totalMembers: this.members.filter(m => m.is_active).length,
      totalUnits: this.units.filter(u => u.is_active).length,
    };
  }

  async calculateUnitScores(): Promise<UnitScoreCalculation[]> {
    return this.units.map(unit => {
      // 1. Điểm tiêu chí
      const approvedSubmissions = this.criterionSubmissions.filter(
        s => s.unit_id === unit.id && s.status === 'approved' && s.approved_score !== null
      );
      const critScore = approvedSubmissions.reduce((sum, s) => sum + (s.approved_score || 0), 0);

      // 2. Nhiệm vụ: chỉ đếm, không cộng điểm. Chỉ tính nhiệm vụ CÓ gắn tiêu chí.
      const tasksWithCriteria = new Set(this.taskSubCriteria.map(tsc => tsc.task_id));
      const taskCount = this.taskResults.filter(
        r => r.unit_id === unit.id && r.status === 'approved' && tasksWithCriteria.has(r.task_id)
      ).length;

      // 3. Tổng nhiệm vụ (có gắn tiêu chí) được giao cho chi đoàn
      const taskAssignedCount = this.taskUnits.filter(
        tu => tu.unit_id === unit.id && tasksWithCriteria.has(tu.task_id)
      ).length;

      const total = critScore;
      const maxPossible = 100;
      const rate = taskAssignedCount > 0
        ? Math.min(100, Math.round((taskCount / taskAssignedCount) * 100))
        : 0;

      return {
        unit,
        totalScore: total,
        maxPossible,
        criteriaScore: critScore,
        taskCount,
        taskAssignedCount,
        participantCount: 0,
        completionRate: rate,
      };
    });
  }

  // 2. Duyệt
  async listPendingReviews(
    tab: 'all' | 'tasks' | 'criteria',
    filters?: { unitId?: string; search?: string }
  ): Promise<{ taskResults: DbTaskResult[]; criterionSubmissions: DbCriterionSubmission[] }> {
    let trs = this.taskResults.filter(r => r.status === 'pending');
    let css = this.criterionSubmissions.filter(s => s.status === 'pending');

    if (filters?.unitId) {
      trs = trs.filter(r => r.unit_id === filters.unitId);
      css = css.filter(s => s.unit_id === filters.unitId);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      trs = trs.filter(r => {
        const t = this.tasks.find(tk => tk.id === r.task_id);
        const u = this.units.find(un => un.id === r.unit_id);
        return (t?.title.toLowerCase().includes(q) || u?.name.toLowerCase().includes(q));
      });
      css = css.filter(s => {
        const sc = this.subCriteria.find(c => c.id === s.sub_criterion_id);
        const u = this.units.find(un => un.id === s.unit_id);
        return (sc?.condition_text.toLowerCase().includes(q) || u?.name.toLowerCase().includes(q));
      });
    }

    if (tab === 'tasks') {
      return { taskResults: trs, criterionSubmissions: [] };
    }
    if (tab === 'criteria') {
      return { taskResults: [], criterionSubmissions: css };
    }
    return { taskResults: trs, criterionSubmissions: css };
  }

  async getReviewDetail(
    kind: 'task' | 'criterion',
    id: string
  ): Promise<{
    item: DbTaskResult | DbCriterionSubmission | null;
    unit: DbUnit | null;
    task?: DbTask | null;
    subCriterion?: DbSubCriterion | null;
    evidences: DbEvidence[];
    warnings: EvidenceAuditWarning[];
  }> {
    if (kind === 'task') {
      const item = this.taskResults.find(r => r.id === id) || null;
      const unit = item ? this.units.find(u => u.id === item.unit_id) || null : null;
      const task = item ? this.tasks.find(t => t.id === item.task_id) || null : null;
      const evs = item ? this.evidences.filter(e => e.task_id === item.task_id && e.unit_id === item.unit_id) : [];

      const warnings: EvidenceAuditWarning[] = evs.map(e => {
        const missingGps = e.lat === null || e.lng === null;
        const dupHash = this.evidences.filter(other => other.id !== e.id && other.file_hash === e.file_hash).length > 0;
        const capturedLate = task ? new Date(e.captured_at) > new Date(task.due_date) : false;

        let warning_text = '';
        if (missingGps) warning_text += 'Thiếu tọa độ GPS kiểm tra tại thực địa. ';
        if (dupHash) warning_text += 'Phát hiện trùng khớp mã băm (hash) ảnh với minh chứng khác! ';
        if (capturedLate) warning_text += 'Thời điểm chụp ảnh sau hạn chót nộp báo cáo. ';

        return {
          evidence_id: e.id,
          is_missing_gps: missingGps,
          is_duplicate_hash: dupHash,
          is_captured_after_deadline: capturedLate,
          warning_text: warning_text.trim(),
        };
      });

      return { item, unit, task, evidences: evs, warnings };
    } else {
      const item = this.criterionSubmissions.find(s => s.id === id) || null;
      const unit = item ? this.units.find(u => u.id === item.unit_id) || null : null;
      const subCriterion = item ? this.subCriteria.find(c => c.id === item.sub_criterion_id) || null : null;
      const evs = item ? this.evidences.filter(e => e.submission_id === item.id) : [];

      const warnings: EvidenceAuditWarning[] = evs.map(e => {
        const missingGps = e.lat === null || e.lng === null;
        const dupHash = this.evidences.filter(other => other.id !== e.id && other.file_hash === e.file_hash).length > 0;
        const capturedLate = subCriterion ? new Date(e.captured_at) > new Date(subCriterion.deadline) : false;

        return {
          evidence_id: e.id,
          is_missing_gps: missingGps,
          is_duplicate_hash: dupHash,
          is_captured_after_deadline: capturedLate,
          warning_text: (missingGps ? 'Thiếu GPS. ' : '') + (dupHash ? 'Trùng mã băm. ' : '') + (capturedLate ? 'Chụp sau hạn. ' : ''),
        };
      });

      return { item, unit, subCriterion, evidences: evs, warnings };
    }
  }

  async approve(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    approvedScore?: number,
    reviewNote?: string
  ): Promise<{ success: boolean; message?: string }> {
    const nowIso = new Date().toISOString();
    if (kind === 'task') {
      const idx = this.taskResults.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.taskResults[idx] = {
          ...this.taskResults[idx],
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: reviewNote || 'Đạt yêu cầu',
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Duyệt kết quả nhiệm vụ',
          table_name: 'task_results',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: approved, reviewed_by: ${reviewerId}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    } else {
      const idx = this.criterionSubmissions.findIndex(s => s.id === id);
      if (idx !== -1) {
        const sc = this.subCriteria.find(c => c.id === this.criterionSubmissions[idx].sub_criterion_id);
        const maxScore = sc?.max_score || 5;
        const score = approvedScore !== undefined ? approvedScore : this.criterionSubmissions[idx].self_score;

        this.criterionSubmissions[idx] = {
          ...this.criterionSubmissions[idx],
          status: 'approved',
          approved_score: Math.min(score, maxScore),
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: reviewNote || 'Đã kiểm tra minh chứng hợp lệ',
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Duyệt minh chứng tiêu chí',
          table_name: 'criterion_submissions',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: approved, approved_score: ${score}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    }
    return { success: false, message: 'Không tìm thấy bản ghi cần duyệt' };
  }

  async reject(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    note: string
  ): Promise<{ success: boolean; message?: string }> {
    const nowIso = new Date().toISOString();
    if (kind === 'task') {
      const idx = this.taskResults.findIndex(r => r.id === id);
      if (idx !== -1) {
        this.taskResults[idx] = {
          ...this.taskResults[idx],
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: note,
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Từ chối kết quả nhiệm vụ',
          table_name: 'task_results',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: rejected, note: ${note}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    } else {
      const idx = this.criterionSubmissions.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.criterionSubmissions[idx] = {
          ...this.criterionSubmissions[idx],
          status: 'rejected',
          approved_score: 0,
          reviewed_by: reviewerId,
          reviewed_at: nowIso,
          review_note: note,
        };
        this.auditLogs.unshift({
          id: `log_${Date.now()}`,
          actor_id: reviewerId,
          actor_role: 'admin',
          action: 'Từ chối tiêu chí',
          table_name: 'criterion_submissions',
          row_id: id,
          old_value: 'status: pending',
          new_value: `status: rejected, note: ${note}`,
          created_at: nowIso,
        });
        return { success: true };
      }
    }
    return { success: false, message: 'Không tìm thấy mục cần từ chối' };
  }

  // 3. Nhiệm vụ
  async listTasks(status?: 'all' | 'draft' | 'published' | 'closed'): Promise<DbTask[]> {
    if (!status || status === 'all') return [...this.tasks];
    return this.tasks.filter(t => t.status === status);
  }

  async getTask(id: string) {
    const task = this.tasks.find(t => t.id === id) || null;
    const taskUnitRows = this.taskUnits.filter(tu => tu.task_id === id);
    const assignedUnits = this.units.filter(u => taskUnitRows.some(tu => tu.unit_id === u.id));
    const registrations = this.taskRegistrations.filter(tr => tr.task_id === id);
    const subCriteriaRows = this.taskSubCriteria.filter(tsc => tsc.task_id === id);
    const mappedSubCriteria = subCriteriaRows
      .map(tsc => {
        const sc = this.subCriteria.find(c => c.id === tsc.sub_criterion_id);
        return sc ? { subCriterion: sc, contribution_score: tsc.contribution_score } : null;
      })
      .filter(Boolean) as Array<{ subCriterion: DbSubCriterion; contribution_score: number }>;

    const results = this.taskResults.filter(r => r.task_id === id);

    // Compute deadline status
    let is_overdue = false;
    let days_remaining = 0;
    let chip_color: 'emerald' | 'amber' | 'rose' = 'emerald';
    let chip_label = 'Đang tiến hành';

    if (task) {
      const now = new Date();
      const due = new Date(task.due_date);
      const diffMs = due.getTime() - now.getTime();
      days_remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (days_remaining < 0) {
        is_overdue = true;
        chip_color = 'rose';
        chip_label = `Quá hạn ${Math.abs(days_remaining)} ngày`;
      } else if (days_remaining <= 3) {
        chip_color = 'amber';
        chip_label = `Còn ${days_remaining} ngày`;
      } else {
        chip_color = 'emerald';
        chip_label = `Còn ${days_remaining} ngày`;
      }
    }

    return {
      task,
      deadlineStatus: { is_overdue, days_remaining, chip_color, chip_label },
      units: assignedUnits,
      registrations,
      subCriteria: mappedSubCriteria,
      results,
    };
  }

  async createTask(input: {
    taskData: Omit<DbTask, 'id' | 'assigned_by' | 'assigned_at' | 'closed_by' | 'closed_at'>;
    unitIds: string[];
    subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>;
  }): Promise<DbTask> {
    const newTask: DbTask = {
      ...input.taskData,
      id: `task_${Date.now()}`,
      assigned_by: keyMemberIds.biThuXa,
      assigned_at: new Date().toISOString(),
      closed_by: null,
      closed_at: null,
    };

    this.tasks.unshift(newTask);

    input.unitIds.forEach(uId => {
      this.taskUnits.push({ task_id: newTask.id, unit_id: uId });
    });

    input.subCriteriaContributions.forEach(sc => {
      this.taskSubCriteria.push({
        task_id: newTask.id,
        sub_criterion_id: sc.sub_criterion_id,
        contribution_score: sc.contribution_score,
      });
    });

    if (newTask.status === 'published') {
      input.unitIds.forEach(uId => {
        this.notifications.unshift({
          id: `notif_${Date.now()}_${uId}`,
          recipient_id: uId,
          type: 'system',
          level: 'yellow',
          title: `Nhiệm vụ mới: ${newTask.title}`,
          body: `BTV Đoàn xã vừa giao nhiệm vụ mới: ${newTask.title}. Hạn hoàn thành: ${newTask.due_date}`,
          task_id: newTask.id,
          sub_criterion_id: null,
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });
    }

    return newTask;
  }

  async publishTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };

    const assigned = this.taskUnits.filter(tu => tu.task_id === id);
    if (assigned.length === 0) {
      return { success: false, message: 'Chặn đăng: Chưa có chi đoàn nào được gán nhiệm vụ này!' };
    }

    task.status = 'published';
    assigned.forEach(tu => {
      this.notifications.unshift({
        id: `notif_${Date.now()}_${tu.unit_id}`,
        recipient_id: tu.unit_id,
        type: 'system',
        level: 'yellow',
        title: `Phát hành nhiệm vụ: ${task.title}`,
        body: `Nhiệm vụ đã được công bố chính thức. Đề nghị chi đoàn triển khai đúng tiến độ.`,
        task_id: task.id,
        sub_criterion_id: null,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return { success: true };
  }

  async closeTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    task.status = 'closed';
    task.closed_by = keyMemberIds.biThuXa;
    task.closed_at = new Date().toISOString();
    return { success: true };
  }

  async deleteTask(id: string): Promise<{ success: boolean; message?: string }> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    if (task.status !== 'draft') {
      return { success: false, message: 'Chỉ được xóa nhiệm vụ ở trạng thái Nháp!' };
    }
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.taskUnits = this.taskUnits.filter(tu => tu.task_id !== id);
    this.taskSubCriteria = this.taskSubCriteria.filter(tsc => tsc.task_id !== id);
    return { success: true };
  }

  async cloneTask(id: string): Promise<DbTask | null> {
    const orig = this.tasks.find(t => t.id === id);
    if (!orig) return null;
    const cloned: DbTask = {
      ...orig,
      id: `task_${Date.now()}`,
      title: `${orig.title} (Bản sao)`,
      status: 'draft',
      assigned_at: new Date().toISOString(),
      due_date: getRelativeDate(14),
    };
    this.tasks.unshift(cloned);

    // copy units & subCriteria
    const origUnits = this.taskUnits.filter(tu => tu.task_id === id);
    origUnits.forEach(tu => this.taskUnits.push({ task_id: cloned.id, unit_id: tu.unit_id }));

    const origSubCrits = this.taskSubCriteria.filter(tsc => tsc.task_id === id);
    origSubCrits.forEach(tsc =>
      this.taskSubCriteria.push({
        task_id: cloned.id,
        sub_criterion_id: tsc.sub_criterion_id,
        contribution_score: tsc.contribution_score,
      })
    );

    return cloned;
  }

  async remindUnit(taskId: string, unitId: string): Promise<{ success: boolean }> {
    const task = this.tasks.find(t => t.id === taskId);
    this.notifications.unshift({
      id: `notif_${Date.now()}`,
      recipient_id: unitId,
      type: 'reminder',
      level: 'orange',
      title: `Nhắc nhở tiến độ: ${task?.title || 'Nhiệm vụ'}`,
      body: `BTV Đoàn xã nhắc chi đoàn khẩn trương hoàn thành và nộp minh chứng nhiệm vụ.`,
      task_id: taskId,
      sub_criterion_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async remindAllUnsubmitted(taskId: string): Promise<{ remindedCount: number }> {
    const assignedUnits = this.taskUnits.filter(tu => tu.task_id === taskId).map(tu => tu.unit_id);
    const submittedUnits = this.taskResults.filter(r => r.task_id === taskId).map(r => r.unit_id);
    const unsubmitted = assignedUnits.filter(uId => !submittedUnits.includes(uId));

    unsubmitted.forEach(uId => {
      this.remindUnit(taskId, uId);
    });

    return { remindedCount: unsubmitted.length };
  }

  // 4. Chi đoàn
  async listUnits(filters?: { unitTypeId?: UnitTypeId; search?: string; isActive?: boolean }) {
    let result = this.units;
    if (filters?.unitTypeId) {
      result = result.filter(u => u.unit_type_id === filters.unitTypeId);
    }
    if (filters?.isActive !== undefined) {
      result = result.filter(u => u.is_active === filters.isActive);
    }
    if (filters?.search) {
      const q = removeVietnameseTones(filters.search);
      result = result.filter(u => removeVietnameseTones(u.name).includes(q));
    }

    return result.map(unit => {
      const secCommittee = this.unitCommittees.find(
        c => c.unit_id === unit.id && c.position === 'secretary' && !c.term_end
      );
      const currentSecretary = secCommittee
        ? this.members.find(m => m.id === secCommittee.member_id) || null
        : null;

      const actualMembers = this.members.filter(m => m.unit_id === unit.id && m.is_active).length;
      const declaredMembers = unit.union_member_count;
      const countMismatch = actualMembers !== declaredMembers;
      const openWarnings = this.warnings.filter(w => w.unit_id === unit.id && !w.resolved_at).length;

      return {
        unit,
        currentSecretary,
        hasMissingSecretary: !currentSecretary,
        actualMemberCount: actualMembers,
        declaredMemberCount: declaredMembers,
        hasCountMismatch: countMismatch,
        openWarningsCount: openWarnings,
      };
    });
  }

  async getUnit(id: string) {
    const unit = this.units.find(u => u.id === id) || null;
    const secCommittee = this.unitCommittees.find(
      c => c.unit_id === id && c.position === 'secretary' && !c.term_end
    );
    const currentSecretary = secCommittee
      ? this.members.find(m => m.id === secCommittee.member_id) || null
      : null;

    const unitMembers = this.members.filter(m => m.unit_id === id);
    const committee = this.unitCommittees.filter(c => c.unit_id === id);
    const taskResults = this.taskResults.filter(r => r.unit_id === id);
    const submissions = this.criterionSubmissions.filter(s => s.unit_id === id);

    const scores = await this.calculateUnitScores();
    const score = scores.find(s => s.unit.id === id) || null;

    return {
      unit,
      currentSecretary,
      members: unitMembers,
      committee,
      taskResults,
      submissions,
      score,
    };
  }

  async saveUnit(id: string, updates: Partial<DbUnit>): Promise<{ success: boolean }> {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx] = { ...this.units[idx], ...updates };
      return { success: true };
    }
    return { success: false };
  }

  async deactivateUnit(id: string): Promise<{ success: boolean; message?: string }> {
    const assignedTasks = this.taskUnits.filter(tu => tu.unit_id === id);
    const pendingTasks = assignedTasks.some(tu => {
      const res = this.taskResults.find(r => r.task_id === tu.task_id && r.unit_id === id);
      return !res || res.status === 'pending';
    });

    if (pendingTasks) {
      return {
        success: false,
        message: 'Chặn thao tác: Chi đoàn này vẫn còn nhiệm vụ được giao đang dở dang chưa hoàn thành!',
      };
    }

    const idx = this.units.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.units[idx].is_active = false;
      return { success: true };
    }
    return { success: false, message: 'Không tìm thấy chi đoàn' };
  }

  async createUnit(input: {
    name: string;
    unit_type_id: UnitTypeId;
    note?: string;
    union_member_count?: number;
    youth_count?: number;
  }): Promise<{ success: boolean; message?: string; unit?: DbUnit }> {
    const name = input.name.trim();
    if (!name) return { success: false, message: 'Tên chi đoàn không được để trống' };
    if (this.units.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, message: 'Đã có chi đoàn trùng tên' };
    }
    const unit: DbUnit = {
      id: `unit_${Date.now()}`,
      name,
      note: input.note,
      unit_type_id: input.unit_type_id,
      is_active: true,
      union_member_count: input.union_member_count ?? 0,
      youth_count: input.youth_count ?? 0,
    };
    this.units.push(unit);
    return { success: true, unit };
  }

  async deleteUnit(id: string): Promise<{ success: boolean; message?: string }> {
    const idx = this.units.findIndex(u => u.id === id);
    if (idx === -1) return { success: false, message: 'Không tìm thấy chi đoàn' };
    const memberCount = this.members.filter(m => m.unit_id === id).length;
    if (memberCount > 0) {
      return { success: false, message: `Chi đoàn còn ${memberCount} đoàn viên, hãy chuyển hoặc xóa họ trước` };
    }
    if (this.unitCommittees.some(c => c.unit_id === id)) {
      return { success: false, message: 'Chi đoàn còn dữ liệu Ban chấp hành, không thể xóa' };
    }
    this.units.splice(idx, 1);
    return { success: true };
  }

  // 5. Đoàn viên
  async listMembers(filters?: {
    search?: string;
    unitId?: string;
    gender?: string;
    position?: string;
    isPartyMember?: boolean;
    isActive?: boolean;
    ageMin?: number;
    ageMax?: number;
    isMatured?: boolean;
  }): Promise<MemberComputed[]> {
    const currentYear = 2026;
    const maturedAge = this.yearlySettings.matured_age || 30;

    return this.members
      .filter(m => {
        if (filters?.unitId && m.unit_id !== filters.unitId) return false;
        if (filters?.gender && m.gender !== filters.gender) return false;
        if (filters?.position && m.current_position !== filters.position) return false;
        if (filters?.isPartyMember !== undefined && m.is_party_member !== filters.isPartyMember) return false;
        if (filters?.isActive !== undefined && m.is_active !== filters.isActive) return false;

        const birthYear = new Date(m.birth_date).getFullYear();
        const age = currentYear - birthYear;
        const isMatured = age >= maturedAge;

        if (filters?.ageMin !== undefined && age < filters.ageMin) return false;
        if (filters?.ageMax !== undefined && age > filters.ageMax) return false;
        if (filters?.isMatured !== undefined && isMatured !== filters.isMatured) return false;

        if (filters?.search) {
          const q = removeVietnameseTones(filters.search);
          const nameNorm = removeVietnameseTones(m.full_name);
          const phoneNorm = m.phone;
          const codeNorm = m.central_member_code.toLowerCase();
          if (!nameNorm.includes(q) && !phoneNorm.includes(q) && !codeNorm.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .map(member => {
        const birthYear = new Date(member.birth_date).getFullYear();
        const age = currentYear - birthYear;
        const isMatured = age >= maturedAge;
        const unit = this.units.find(u => u.id === member.unit_id);
        const p = member.phone;
        const phone_masked = p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-3)}` : p;

        return {
          member,
          age,
          is_matured: isMatured,
          unit_name: unit?.name || 'Chưa rõ',
          phone_masked,
        };
      });
  }

  async getMember(id: string) {
    const member = this.members.find(m => m.id === id) || null;
    const unit = member ? this.units.find(u => u.id === member.unit_id) || null : null;
    const profile = this.profiles.find(p => p.member_id === id) || null;
    const committeeHistory = this.unitCommittees.filter(c => c.member_id === id);
    const taskRegistrations = this.taskRegistrations.filter(tr => tr.member_id === id);

    return {
      member,
      unit,
      profile,
      committeeHistory,
      taskRegistrations,
    };
  }

  async saveMember(
    input: Omit<DbMember, 'id'> & { id?: string }
  ): Promise<{ success: boolean; message?: string; member?: DbMember }> {
    // Validation
    const phoneClean = input.phone.replace(/\D/g, '');
    if (phoneClean.length < 9 || phoneClean.length > 11) {
      return { success: false, message: 'Số điện thoại phải từ 9 đến 11 chữ số' };
    }
    if (new Date(input.joined_date) < new Date(input.birth_date)) {
      return { success: false, message: 'Ngày vào Đoàn không được trước ngày sinh' };
    }

    if (input.current_position === 'secretary') {
      const existingSec = this.unitCommittees.find(
        c => c.unit_id === input.unit_id && c.position === 'secretary' && !c.term_end && c.member_id !== input.id
      );
      if (existingSec) {
        return {
          success: false,
          message: 'Chi đoàn này đã có Bí thư đang giữ chức! Vui lòng kết thúc nhiệm kỳ trước.',
        };
      }
    }

    if (input.id) {
      const idx = this.members.findIndex(m => m.id === input.id);
      if (idx !== -1) {
        this.members[idx] = { ...this.members[idx], ...input } as DbMember;
        return { success: true, member: this.members[idx] };
      }
    } else {
      const newMem: DbMember = {
        ...input,
        id: `mem_${Date.now()}`,
      };
      this.members.unshift(newMem);
      return { success: true, member: newMem };
    }

    return { success: false, message: 'Lỗi lưu đoàn viên' };
  }

  async deleteMember(id: string): Promise<{ success: boolean; message?: string }> {
    const exists = this.members.some(m => m.id === id);
    if (!exists) return { success: false, message: 'Không tìm thấy đoàn viên' };
    this.members = this.members.filter(m => m.id !== id);
    return { success: true };
  }

  async setMemberActive(id: string, active: boolean): Promise<{ success: boolean; message?: string }> {
    const m = this.members.find(x => x.id === id);
    if (!m) return { success: false, message: 'Không tìm thấy đoàn viên' };
    m.is_active = active;
    return { success: true };
  }

  async importMembers(rows: Array<Omit<DbMember, 'id'>>): Promise<{ importedCount: number }> {
    let count = 0;
    rows.forEach(r => {
      this.members.unshift({
        ...r,
        id: `mem_import_${Date.now()}_${count}`,
      });
      count++;
    });
    return { importedCount: count };
  }

  // 6. Ban Chấp hành
  async listCommittees(unitId: string | null, termStatus: 'active' | 'ended' | 'all' = 'active') {
    let list = this.unitCommittees.filter(c => c.unit_id === unitId);
    if (termStatus === 'active') {
      list = list.filter(c => !c.term_end);
    } else if (termStatus === 'ended') {
      list = list.filter(c => !!c.term_end);
    }

    return list
      .map(c => {
        const m = this.members.find(mem => mem.id === c.member_id);
        return m ? { committee: c, member: m } : null;
      })
      .filter(Boolean) as Array<{ committee: DbUnitCommittee; member: DbMember }>;
  }

  async updateCommitteeMember(input: {
    committeeId: string; position: CommitteePosition; isStanding: boolean;
  }): Promise<{ success: boolean; message?: string }> {
    const c = this.unitCommittees.find(x => x.id === input.committeeId);
    if (!c) return { success: false, message: 'Không tìm thấy nhân sự trong BCH' };

    if (input.position === 'secretary') {
      const otherSecretary = this.unitCommittees.find(
        x => x.id !== input.committeeId && x.unit_id === c.unit_id && x.position === 'secretary' && !x.term_end
      );
      if (otherSecretary) {
        return { success: false, message: 'Chi đoàn này đã có Bí thư đang giữ chức. Hãy kết thúc nhiệm kỳ của Bí thư hiện tại trước.' };
      }
    }

    c.position = input.position;
    c.is_standing = input.position === 'secretary' || input.position === 'deputy_secretary' ? true : input.isStanding;
    return { success: true };
  }

  async addCommitteeMember(input: {
    memberId: string;
    unitId: string | null;
    position: CommitteePosition;
    isStanding: boolean;
    termStart: string;
  }): Promise<{ success: boolean; message?: string }> {
    // Rule: secretary/deputy_secretary auto isStanding
    const autoStanding = input.position === 'secretary' || input.position === 'deputy_secretary' ? true : input.isStanding;

    // Rule: unique active secretary for this unit
    if (input.position === 'secretary') {
      const existingSec = this.unitCommittees.find(
        c => c.unit_id === input.unitId && c.position === 'secretary' && !c.term_end
      );
      if (existingSec) {
        return {
          success: false,
          message: 'Chi đoàn này đã có bí thư đang giữ chức! Hãy kết thúc nhiệm kỳ trước.',
        };
      }
    }

    const newComm: DbUnitCommittee = {
      id: `comm_${Date.now()}`,
      unit_id: input.unitId,
      member_id: input.memberId,
      position: input.position,
      is_standing: autoStanding,
      term_start: input.termStart,
      term_end: null,
    };
    this.unitCommittees.push(newComm);

    return { success: true };
  }

  async endCommitteeTerm(id: string, endDate?: string): Promise<{ success: boolean }> {
    const comm = this.unitCommittees.find(c => c.id === id);
    if (comm) {
      comm.term_end = endDate || new Date().toISOString().split('T')[0];
      return { success: true };
    }
    return { success: false };
  }

  // 7. Tiêu chí
  async listCriteriaSets(year?: number) {
    const targetYear = year || 2026;
    return this.criteriaSets.map(cs => {
      const subCrits = this.subCriteria;
      const isFinal = cs.id === this.yearlySettings.criteria_set_id && cs.year === targetYear;
      return {
        criteriaSet: cs,
        subCriteriaCount: cs.id === 'crit_set_2026' ? subCrits.length : 14,
        isFinalizedForYear: isFinal,
        scoringProgress: 68,
      };
    });
  }

  async getCriteriaTree(criteriaSetId: string) {
    const sections = this.criteriaSections.filter(s => s.criteria_set_id === criteriaSetId);
    const criteria = this.criteria;
    const subCriteria = this.subCriteria;
    const totalMaxScore = subCriteria.reduce((sum, sc) => sum + (sc.max_score || 0), 0);
    const orphanCount = subCriteria.filter(sc => !criteria.some(c => c.id === sc.criterion_id)).length;

    return {
      sections,
      criteria,
      subCriteria,
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
    if (action === 'delete') {
      // Check if any submission exists
      if (type === 'subCriterion') {
        const subsCount = this.criterionSubmissions.filter(s => s.sub_criterion_id === data.id).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.subCriteria = this.subCriteria.filter(sc => sc.id !== data.id);
      } else if (type === 'criterion') {
        const childSubIds = this.subCriteria.filter(sc => sc.criterion_id === data.id).map(sc => sc.id);
        const subsCount = this.criterionSubmissions.filter(s => childSubIds.includes(s.sub_criterion_id)).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.criteria = this.criteria.filter(c => c.id !== data.id);
        this.subCriteria = this.subCriteria.filter(sc => sc.criterion_id !== data.id);
      } else if (type === 'section') {
        const childCritIds = this.criteria.filter(c => c.section_id === data.id).map(c => c.id);
        const childSubIds = this.subCriteria.filter(sc => childCritIds.includes(sc.criterion_id)).map(sc => sc.id);
        const subsCount = this.criterionSubmissions.filter(s => childSubIds.includes(s.sub_criterion_id)).length;
        if (subsCount > 0) {
          return { success: false, message: `Đã có ${subsCount} chi đoàn chấm, không thể xóa!` };
        }
        this.criteriaSections = this.criteriaSections.filter(s => s.id !== data.id);
      }
      return { success: true };
    }

    if (action === 'create') {
      if (type === 'section') {
        this.criteriaSections.push({ ...data, id: `sec_${Date.now()}` });
      } else if (type === 'criterion') {
        this.criteria.push({ ...data, id: `crit_${Date.now()}` });
      } else if (type === 'subCriterion') {
        this.subCriteria.push({ ...data, id: `subcrit_${Date.now()}` });
      }
      return { success: true };
    }

    if (action === 'update') {
      if (type === 'section') {
        const idx = this.criteriaSections.findIndex(s => s.id === data.id);
        if (idx !== -1) this.criteriaSections[idx] = { ...this.criteriaSections[idx], ...data };
      } else if (type === 'criterion') {
        const idx = this.criteria.findIndex(c => c.id === data.id);
        if (idx !== -1) this.criteria[idx] = { ...this.criteria[idx], ...data };
      } else if (type === 'subCriterion') {
        const idx = this.subCriteria.findIndex(sc => sc.id === data.id);
        if (idx !== -1) this.subCriteria[idx] = { ...this.subCriteria[idx], ...data };
      }
      return { success: true };
    }

    return { success: false };
  }

  async reorderCriteriaNodes(
    type: 'section' | 'criterion' | 'subCriterion',
    parentId: string,
    startIndex: number,
    endIndex: number
  ): Promise<{ success: boolean }> {
    if (type === 'section') {
      const items = [...this.criteriaSections];
      const [removed] = items.splice(startIndex, 1);
      items.splice(endIndex, 0, removed);
      this.criteriaSections = items.map((it, idx) => ({ ...it, stt: idx + 1 }));
    }
    return { success: true };
  }

  async deleteCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    const set = this.criteriaSets.find(s => s.id === criteriaSetId);
    if (!set) return { success: false, message: 'Không tìm thấy bộ tiêu chí' };
    set.archived_at = new Date().toISOString();
    return { success: true };
  }
  async restoreCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }> {
    const set = this.criteriaSets.find(s => s.id === criteriaSetId);
    if (!set) return { success: false, message: 'Không tìm thấy bộ tiêu chí' };
    set.archived_at = null;
    return { success: true };
  }
  async getCriteriaSetImpact(): Promise<{
    submissionCount: number; unitCount: number; evidenceCount: number;
    subCriteriaCount: number; isArchived: boolean;
  }> {
    return { submissionCount: 0, unitCount: 0, evidenceCount: 0, subCriteriaCount: 0, isArchived: false };
  }
  async purgeCriteriaSet(): Promise<never> {
    throw new Error('Xóa vĩnh viễn bộ tiêu chí chỉ dùng khi kết nối Supabase thật.');
  }

  async setTaskSubCriteria(taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>): Promise<{ success: boolean; message?: string }> {
    this.taskSubCriteria = this.taskSubCriteria.filter(t => t.task_id !== taskId);
    for (const i of items) {
      this.taskSubCriteria.push({ task_id: taskId, sub_criterion_id: i.sub_criterion_id, contribution_score: i.contribution_score });
    }
    return { success: true };
  }
  async countUnitsWithoutResult(taskId: string): Promise<{ assigned: number; submitted: number; missing: string[] }> {
    const assigned = this.taskUnits.filter(tu => tu.task_id === taskId).map(tu => tu.unit_id);
    const submitted = new Set(this.taskResults.filter(r => r.task_id === taskId).map(r => r.unit_id));
    const missing = assigned
      .filter(id => !submitted.has(id))
      .map(id => this.units.find(u => u.id === id)?.name ?? id);
    return { assigned: assigned.length, submitted: submitted.size, missing };
  }
  async approveAllMemberSubmissions(taskId: string): Promise<{ success: boolean; approved: number; message?: string }> {
    const pending = this.memberSubmissions.filter(s => s.task_id === taskId && s.status === 'pending');
    for (const s of pending) s.status = 'approved';
    return { success: true, approved: pending.length };
  }

  async cloneCriteriaSetFromPreviousYear(targetYear: number): Promise<{ success: boolean }> {
    const newSet: DbCriteriaSet = {
      id: `crit_set_${targetYear}_cloned`,
      year: targetYear,
      name: `Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm ${targetYear} (Nhân bản)`,
      issuing_unit: 'Ban Thường vụ Đoàn xã Hòa Bình',
    };
    this.criteriaSets.push(newSet);
    return { success: true };
  }

  async importCriteriaTree(payload: {
    set: { name: string; year: number; issuing_unit: string };
    sections: Array<{ id: string; stt: number; name: string }>;
    criteria: Array<{ id: string; section_id: string; stt: number; name: string }>;
    subCriteria: Array<{
      id: string;
      criterion_id: string;
      condition_text: string;
      max_score: number;
      evaluation_method: string;
      evidence_requirement: string;
      scoring_rule: string;
      deadline: string;
      unit_type_id: UnitTypeId | null;
      unit_id: string | null;
      unit_type_ids: UnitTypeId[];
      unit_ids: string[];
      note?: string;
    }>;
  }): Promise<{ success: boolean; message?: string; criteriaSetId?: string }> {
    if (!payload.sections.length) {
      return { success: false, message: 'Bộ tiêu chí rỗng, không có Phần nào để nhập' };
    }
    const setId = `crit_set_${payload.set.year}_import_${this.criteriaSets.length + 1}`;
    this.criteriaSets.push({
      id: setId,
      year: payload.set.year,
      name: payload.set.name,
      issuing_unit: payload.set.issuing_unit,
    });

    // Ghi lại id cũ -> id mới để nối quan hệ cha/con đúng
    const secIdMap = new Map<string, string>();
    payload.sections.forEach((s, i) => {
      const newId = `sec_imp_${setId}_${i + 1}`;
      secIdMap.set(s.id, newId);
      this.criteriaSections.push({ id: newId, criteria_set_id: setId, stt: s.stt, name: s.name });
    });

    const critIdMap = new Map<string, string>();
    payload.criteria.forEach((c, i) => {
      const newId = `crit_imp_${setId}_${i + 1}`;
      critIdMap.set(c.id, newId);
      this.criteria.push({
        id: newId,
        section_id: secIdMap.get(c.section_id) ?? c.section_id,
        stt: c.stt,
        name: c.name,
      });
    });

    payload.subCriteria.forEach((sc, i) => {
      this.subCriteria.push({
        id: `subcrit_imp_${setId}_${i + 1}`,
        criterion_id: critIdMap.get(sc.criterion_id) ?? sc.criterion_id,
        condition_text: sc.condition_text,
        max_score: sc.max_score,
        evaluation_method: sc.evaluation_method,
        evidence_requirement: sc.evidence_requirement,
        scoring_rule: sc.scoring_rule,
        deadline: sc.deadline,
        unit_type_id: sc.unit_type_id,
        unit_id: sc.unit_id,
        unit_type_ids: sc.unit_type_ids ?? [],
        unit_ids: sc.unit_ids ?? [],
        note: sc.note,
      });
    });

    return { success: true, criteriaSetId: setId };
  }

  // 8. Nhắc nhở
  async listWarnings(tab: 'open' | 'resolved') {
    const list = this.warnings.filter(w => (tab === 'open' ? !w.resolved_at : !!w.resolved_at));
    return list.map(w => {
      const unit = this.units.find(u => u.id === w.unit_id) || null;
      const task = w.task_id ? this.tasks.find(t => t.id === w.task_id) || null : null;
      const subCriterion = w.sub_criterion_id ? this.subCriteria.find(c => c.id === w.sub_criterion_id) || null : null;
      return { warning: w, unit, task, subCriterion };
    });
  }

  async syncWarnings(): Promise<{ created: number }> {
    return { created: 0 };
  }
  async resolveWarning(warningId: string): Promise<{ success: boolean }> {
    const w = this.warnings.find(item => item.id === warningId);
    if (w) {
      w.resolved_at = new Date().toISOString();
      return { success: true };
    }
    return { success: false };
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
    const recipientUnits =
      input.recipientType === 'unit' && input.unitId
        ? this.units.filter(u => u.id === input.unitId)
        : input.recipientType === 'units' && input.unitIds
        ? this.units.filter(u => input.unitIds!.includes(u.id))
        : input.recipientType === 'type' && input.unitType
        ? this.units.filter(u => u.unit_type_id === input.unitType && u.is_active)
        : this.units.filter(u => u.is_active);

    recipientUnits.forEach(u => {
      this.notifications.unshift({
        id: `notif_${Date.now()}_${u.id}`,
        recipient_id: u.id,
        type: 'reminder',
        level: input.level,
        title: input.title,
        body: input.content,
        task_id: input.taskId || null,
        sub_criterion_id: input.subCriterionId || null,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    });

    return {
      sentCount: recipientUnits.length,
      recipients: recipientUnits.map(u => u.name),
    };
  }

  async listMyNotifications(): Promise<DbNotification[]> {
    return this.notifications;
  }

  async listAllNotifications(): Promise<DbNotification[]> {
    return this.notifications;
  }

  async markNotificationAsRead(id: string): Promise<{ success: boolean }> {
    const n = this.notifications.find(item => item.id === id);
    if (n) n.is_read = true;
    return { success: true };
  }

  async markAllNotificationsAsRead(): Promise<{ success: boolean; count?: number }> {
    let count = 0;
    this.notifications.forEach(n => {
      if (!n.is_read) {
        n.is_read = true;
        count++;
      }
    });
    return { success: true, count };
  }

  // 9. Báo cáo
  async listReports(): Promise<DbReport[]> {
    return [...this.reports];
  }

  async createReport(input: {
    title: string;
    type: ReportType;
    periodStart: string;
    periodEnd: string;
    unitId: string | null;
    data: Record<string, unknown>;
    createdBy: string;
  }): Promise<DbReport> {
    const newRep: DbReport = {
      id: `rep_${Date.now()}`,
      title: input.title,
      report_type: input.type,
      type: input.type,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      unit_id: input.unitId,
      data: JSON.parse(JSON.stringify(input.data)), // Deep clone snapshot
      created_by: input.createdBy,
      created_at: new Date().toISOString(),
    };
    this.reports.unshift(newRep);
    return newRep;
  }

  // 10. Cấu hình
  async getYearlySettings(): Promise<DbYearlySettings> {
    return { ...this.yearlySettings };
  }

  async updateYearlySettings(_year: number, updates: Partial<DbYearlySettings>): Promise<{ success: boolean }> {
    this.yearlySettings = { ...this.yearlySettings, ...updates };
    return { success: true };
  }

  async listUnitTypes(): Promise<DbUnitType[]> {
    return [...this.unitTypes];
  }

  async saveUnitType(id: UnitTypeId, name: string): Promise<{ success: boolean }> {
    const idx = this.unitTypes.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.unitTypes[idx].name = name;
    } else {
      this.unitTypes.push({ id, name });
    }
    return { success: true };
  }

  async deleteUnitType(id: UnitTypeId): Promise<{ success: boolean; message?: string }> {
    const inUse = this.units.some(u => u.unit_type_id === id);
    if (inUse) {
      return { success: false, message: 'Loại chi đoàn này đang được sử dụng, không thể xóa!' };
    }
    this.unitTypes = this.unitTypes.filter(t => t.id !== id);
    return { success: true };
  }

  async listEthnicities(): Promise<DbEthnicity[]> {
    return [...this.ethnicities];
  }

  // 11. Tài khoản & Phân quyền
  async listProfiles() {
    return this.profiles.map(p => {
      const m = this.members.find(mem => mem.id === p.member_id) || null;
      return { profile: p, member: m };
    });
  }

  async setProfileRole(profileId: string, roleId: RoleId): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.role_id = roleId;
      return { success: true };
    }
    return { success: false };
  }

  async toggleProfileActive(profileId: string): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.is_active = !prof.is_active;
      return { success: true };
    }
    return { success: false };
  }

  async linkProfileMember(profileId: string, memberId: string): Promise<{ success: boolean }> {
    const prof = this.profiles.find(p => p.id === profileId);
    if (prof) {
      prof.member_id = memberId;
      return { success: true };
    }
    return { success: false };
  }

  // 12. Nhật ký
  async listAuditLogs(filters?: { search?: string; action?: string; actorId?: string }) {
    let result = this.auditLogs;
    if (filters?.actorId && filters.actorId !== 'all') {
      result = result.filter(l => l.actor_id === filters.actorId);
    }
    if (filters?.action && filters.action !== 'all') {
      result = result.filter(l => l.action.toLowerCase().includes(filters.action!.toLowerCase()));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.table_name.toLowerCase().includes(q) ||
          (l.new_value || '').toLowerCase().includes(q)
      );
    }

    return result.map(log => {
      const actor = this.members.find(m => m.id === log.actor_id) || null;
      return {
        log,
        actor,
        diffSummary: {
          oldValue: log.old_value,
          newValue: log.new_value,
        },
      };
    });
  }

  // =====================================================================
  // ĐÁNH GIÁ, XẾP LOẠI HẰNG NĂM (chế độ mock — lưu trong bộ nhớ)
  // =====================================================================
  async listEvaluationPeriods(): Promise<DbEvaluationPeriod[]> {
    return [...this.evaluationPeriods].sort((a, b) => b.year - a.year);
  }

  async saveEvaluationPeriod(input: {
    year: number; periodType: PeriodType; name: string;
  }): Promise<{ success: boolean; message?: string; period?: DbEvaluationPeriod }> {
    const range = periodRange(input.year, input.periodType);
    const existing = this.evaluationPeriods.find(
      p => p.year === input.year && p.period_type === input.periodType
    );
    if (existing) {
      existing.name = input.name;
      existing.start_date = range.start;
      existing.end_date = range.end;
      existing.updated_at = new Date().toISOString();
      return { success: true, period: { ...existing } };
    }
    const created: DbEvaluationPeriod = {
      id: this.nextId('period'),
      year: input.year,
      name: input.name,
      period_type: input.periodType,
      start_date: range.start,
      end_date: range.end,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.evaluationPeriods.push(created);
    return { success: true, period: { ...created } };
  }

  async setEvaluationPeriodStatus(id: string, status: PeriodStatus): Promise<{ success: boolean; message?: string }> {
    const p = this.evaluationPeriods.find(x => x.id === id);
    if (!p) return { success: false, message: 'Không tìm thấy kỳ đánh giá' };
    if (status === 'open') {
      this.memberEvaluations
        .filter(e => e.period_id === id && e.status === 'finalized')
        .forEach(e => {
          e.status = 'secretary_done';
          e.admin_rating = null;
          e.admin_note = undefined;
          e.admin_id = null;
          e.admin_at = null;
        });
      this.unitEvaluations
        .filter(e => e.period_id === id && e.status === 'finalized')
        .forEach(e => {
          e.status = 'auto';
          e.final_rating = null;
          e.rated_by = null;
          e.rated_at = null;
        });
    }
    p.status = status;
    p.updated_at = new Date().toISOString();
    return { success: true };
  }

  async listMemberRldvLevels(year: number): Promise<DbMemberRldvLevel[]> {
    return this.memberRldvLevels.filter(r => r.year === year);
  }

  async saveMemberRldvLevel(input: {
    memberId: string; year: number; level: RatingLevel; note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const found = this.memberRldvLevels.find(
      r => r.member_id === input.memberId && r.year === input.year
    );
    if (found) {
      found.level = input.level;
      found.note = input.note;
      found.evaluated_at = new Date().toISOString().slice(0, 10);
    } else {
      this.memberRldvLevels.push({
        id: this.nextId('rldv'),
        member_id: input.memberId,
        year: input.year,
        level: input.level,
        note: input.note,
        evaluated_at: new Date().toISOString().slice(0, 10),
        evaluated_by: null,
      });
    }
    return { success: true };
  }

  async listMemberDisciplines(filters?: { memberId?: string; year?: number }): Promise<DbMemberDiscipline[]> {
    return this.memberDisciplines.filter(d => {
      if (filters?.memberId && d.member_id !== filters.memberId) return false;
      if (filters?.year && !d.decided_at.startsWith(String(filters.year))) return false;
      return true;
    });
  }

  async saveMemberDiscipline(input: {
    id?: string; memberId: string; decisionNo: string; form: DisciplineForm; decidedAt: string;
    effectiveFrom?: string | null; effectiveTo?: string | null; reason?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const found = input.id ? this.memberDisciplines.find(d => d.id === input.id) : undefined;
    if (found) {
      found.member_id = input.memberId;
      found.decision_no = input.decisionNo;
      found.form = input.form;
      found.decided_at = input.decidedAt;
      found.effective_from = input.effectiveFrom ?? null;
      found.effective_to = input.effectiveTo ?? null;
      found.reason = input.reason;
      return { success: true };
    }
    this.memberDisciplines.push({
      id: this.nextId('disc'),
      member_id: input.memberId,
      decision_no: input.decisionNo,
      form: input.form,
      decided_at: input.decidedAt,
      effective_from: input.effectiveFrom ?? null,
      effective_to: input.effectiveTo ?? null,
      reason: input.reason,
      created_by: null,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async deleteMemberDiscipline(id: string): Promise<{ success: boolean; message?: string }> {
    this.memberDisciplines = this.memberDisciplines.filter(d => d.id !== id);
    return { success: true };
  }

  async listMemberEvaluations(periodId: string): Promise<DbMemberEvaluation[]> {
    return this.memberEvaluations.filter(e => e.period_id === periodId);
  }

  async generateMemberEvaluations(
    periodId: string,
    options?: { recompute?: boolean }
  ): Promise<{ success: boolean; created: number; updated: number; message?: string }> {
    const period = this.evaluationPeriods.find(p => p.id === periodId);
    if (!period) return { success: false, created: 0, updated: 0, message: 'Không tìm thấy kỳ đánh giá' };

    const assignedByUnit = new Map<string, Set<string>>();
    for (const rel of this.taskUnits) {
      const task = this.tasks.find(t => t.id === rel.task_id);
      if (!task) continue;
      const due = String(task.due_date ?? '').slice(0, 10);
      if (due && (due < period.start_date || due > period.end_date)) continue;
      if (!assignedByUnit.has(rel.unit_id)) assignedByUnit.set(rel.unit_id, new Set());
      assignedByUnit.get(rel.unit_id)!.add(rel.task_id);
    }
    const completedByUnit = new Map<string, Set<string>>();
    for (const r of this.taskResults) {
      if (r.status !== 'approved') continue;
      if (!completedByUnit.has(r.unit_id)) completedByUnit.set(r.unit_id, new Set());
      completedByUnit.get(r.unit_id)!.add(r.task_id);
    }
    const approvedByMember = new Map<string, Set<string>>();
    for (const s of this.memberSubmissions) {
      if (s.status !== 'approved') continue;
      if (!approvedByMember.has(s.member_id)) approvedByMember.set(s.member_id, new Set());
      approvedByMember.get(s.member_id)!.add(s.task_id);
    }

    let created = 0;
    let updated = 0;
    for (const m of this.members.filter(x => x.is_active)) {
      const assigned = assignedByUnit.get(m.unit_id) ?? new Set<string>();
      const completedUnit = completedByUnit.get(m.unit_id) ?? new Set<string>();
      const completedMember = approvedByMember.get(m.id) ?? new Set<string>();
      let completedTasks = 0;
      for (const t of assigned) if (completedMember.has(t) || completedUnit.has(t)) completedTasks += 1;

      const rldv = this.memberRldvLevels.find(r => r.member_id === m.id && r.year === period.year) ?? null;
      const discs = this.memberDisciplines.filter(d => d.member_id === m.id);
      const result = computeMemberRating({
        totalTasks: assigned.size,
        completedTasks,
        rldvLevel: rldv?.level ?? null,
        hasStrictDiscipline: hasStrictDisciplineInPeriod(discs, period.start_date, period.end_date),
        isPartyMember: !!m.is_party_member,
        isLongAbsent: false,
      });

      const prev = this.memberEvaluations.find(e => e.period_id === periodId && e.member_id === m.id);
      const base = {
        total_tasks: assigned.size,
        completed_tasks: completedTasks,
        participation_rate: result.participationRate,
        is_party_member_block: !!m.is_party_member,
        auto_rating: result.autoRating,
        updated_at: new Date().toISOString(),
      };
      if (!prev) {
        this.memberEvaluations.push({
          id: this.nextId('meval'),
          period_id: periodId,
          member_id: m.id,
          unit_id: m.unit_id,
          is_long_absent: false,
          member_response: null,
          secretary_rating: null,
          admin_rating: null,
          status: 'auto',
          created_at: new Date().toISOString(),
          ...base,
        });
        created++;
      } else if (options?.recompute && prev.status !== 'finalized') {
        Object.assign(prev, base);
        updated++;
      }
    }
    return { success: true, created, updated };
  }

  async saveMemberEvaluationResponse(input: {
    evaluationId: string; response: 'confirmed' | 'disagreed'; feedback?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const e = this.memberEvaluations.find(x => x.id === input.evaluationId);
    if (!e) return { success: false, message: 'Không tìm thấy phiếu' };
    e.member_response = input.response;
    e.member_feedback = input.feedback;
    e.member_responded_at = new Date().toISOString();
    e.status = 'member_responded';
    return { success: true };
  }

  async reviewMemberEvaluation(input: {
    evaluationId: string; rating: RatingLevel; note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const e = this.memberEvaluations.find(x => x.id === input.evaluationId);
    if (!e) return { success: false, message: 'Không tìm thấy phiếu' };
    if (e.status === 'finalized') return { success: false, message: 'Phiếu đã chốt, hãy hủy chốt trước' };
    e.secretary_rating = input.rating;
    e.secretary_note = input.note;
    e.secretary_at = new Date().toISOString();
    e.status = 'secretary_done';
    return { success: true };
  }

  async finalizeMemberEvaluation(input: {
    evaluationId: string; rating: RatingLevel; note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const e = this.memberEvaluations.find(x => x.id === input.evaluationId);
    if (!e) return { success: false, message: 'Không tìm thấy phiếu' };
    e.admin_rating = input.rating;
    e.admin_note = input.note;
    e.admin_at = new Date().toISOString();
    e.status = 'finalized';
    return { success: true };
  }

  async listUnitEvaluations(periodId: string): Promise<DbUnitEvaluation[]> {
    return this.unitEvaluations.filter(e => e.period_id === periodId);
  }

  async generateUnitEvaluations(periodId: string): Promise<{ success: boolean; created: number; updated: number; message?: string }> {
    const period = this.evaluationPeriods.find(p => p.id === periodId);
    if (!period) return { success: false, created: 0, updated: 0, message: 'Không tìm thấy kỳ đánh giá' };
    const evals = this.memberEvaluations.filter(e => e.period_id === periodId);
    let created = 0;
    let updated = 0;
    for (const u of this.units.filter(x => x.is_active)) {
      const unitEvals = evals.filter(e => e.unit_id === u.id);
      const unitMembers = this.members.filter(m => m.is_active && m.unit_id === u.id);
      const memberTotal = unitMembers.length;
      const goodCount = unitEvals.filter(e =>
        (e.admin_rating ?? e.auto_rating) === 'excellent' || (e.admin_rating ?? e.auto_rating) === 'good'
      ).length;
      const failCount = unitEvals.filter(e => (e.admin_rating ?? e.auto_rating) === 'fail').length;
      const goodRate = percent(goodCount, memberTotal || 1);
      const assigned = this.taskUnits.filter(t => t.unit_id === u.id).length;
      const done = this.taskResults.filter(r => r.unit_id === u.id && r.status === 'approved').length;
      const taskRate = percent(done, assigned);
      const complete = unitMembers.filter(m =>
        m.full_name && m.birth_date && m.gender && m.phone && m.joined_date && m.central_member_code).length;
      const digitalRate = percent(complete, memberTotal);

      const result = computeUnitRating({
        taskCompletionRate: taskRate,
        memberGoodRate: goodRate,
        digitalRate,
        meetingOk: false,
        feeOk: false,
        hasDiscipline: failCount > 0,
      });

      const prev = this.unitEvaluations.find(e => e.period_id === periodId && e.unit_id === u.id);
      const base = {
        task_completion_rate: taskRate,
        member_good_rate: goodRate,
        member_fail_count: failCount,
        member_total: memberTotal,
        digital_rate: digitalRate,
        auto_rating: result.autoRating,
        updated_at: new Date().toISOString(),
      };
      if (!prev) {
        this.unitEvaluations.push({
          id: this.nextId('ueval'),
          period_id: periodId,
          unit_id: u.id,
          meeting_ok: false,
          fee_ok: false,
          has_discipline: failCount > 0,
          final_rating: null,
          status: 'auto',
          created_at: new Date().toISOString(),
          ...base,
        });
        created++;
      } else if (prev.status !== 'finalized') {
        Object.assign(prev, base);
        updated++;
      }
    }
    return { success: true, created, updated };
  }

  async finalizeUnitEvaluation(input: {
    unitEvaluationId: string;
    rating: RatingLevel;
    meetingOk: boolean;
    feeOk: boolean;
    hasDiscipline: boolean;
    note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const e = this.unitEvaluations.find(x => x.id === input.unitEvaluationId);
    if (!e) return { success: false, message: 'Không tìm thấy phiếu' };
    e.final_rating = input.rating;
    e.meeting_ok = input.meetingOk;
    e.fee_ok = input.feeOk;
    e.has_discipline = input.hasDiscipline;
    e.note = input.note;
    e.rated_at = new Date().toISOString();
    e.status = 'finalized';
    return { success: true };
  }

  // =====================================================================
  // GIAI ĐOẠN 9 · THU NỘP & QUẢN LÝ ĐOÀN PHÍ (HƯỚNG DẪN 39)
  // =====================================================================

  async getUnionFeeSettings(): Promise<DbUnionFeeSettings> {
    return { ...this.unionFeeSettings };
  }

  async updateUnionFeeSettings(updates: Partial<DbUnionFeeSettings>): Promise<{ success: boolean; message?: string }> {
    Object.assign(this.unionFeeSettings, updates, { updated_at: new Date().toISOString() });
    return { success: true };
  }

  async listUnionFeePayments(filters?: {
    memberId?: string;
    unitId?: string;
    year?: number;
    status?: FeePaymentStatus;
  }): Promise<DbUnionFeePayment[]> {
    return this.unionFeePayments.filter(p => {
      if (filters?.memberId && p.member_id !== filters.memberId) return false;
      if (filters?.unitId && p.unit_id !== filters.unitId) return false;
      if (filters?.year && p.year !== filters.year) return false;
      if (filters?.status && p.status !== filters.status) return false;
      return true;
    });
  }

  async createUnionFeePayment(input: {
    memberId: string;
    unitId: string;
    year: number;
    months: number[];
    amount: number;
    paymentMethod: FeePaymentMethod;
    orderCode?: number | null;
    evidenceUrl?: string;
    note?: string;
  }): Promise<{ success: boolean; message?: string; paymentId?: string }> {
    const id = this.nextId('fee');
    const payment: DbUnionFeePayment = {
      id,
      member_id: input.memberId,
      unit_id: input.unitId,
      year: input.year,
      months: [...input.months],
      amount: input.amount,
      payment_method: input.paymentMethod,
      status: input.paymentMethod === 'cash' ? 'approved' : 'pending',
      order_code: input.orderCode || null,
      evidence_url: input.evidenceUrl,
      note: input.note,
      reviewed_at: input.paymentMethod === 'cash' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.unionFeePayments.push(payment);
    return { success: true, paymentId: id };
  }

  async reviewUnionFeePayment(input: {
    paymentId: string;
    status: 'approved' | 'rejected';
    note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const p = this.unionFeePayments.find(x => x.id === input.paymentId);
    if (!p) return { success: false, message: 'Không tìm thấy phiếu nộp đoàn phí' };
    p.status = input.status;
    p.note = input.note || p.note;
    p.reviewed_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    return { success: true };
  }

  async confirmPayOsPayment(orderCode: number, amount: number): Promise<{ success: boolean; message?: string }> {
    const p = this.unionFeePayments.find(x => x.order_code === orderCode);
    if (!p) return { success: false, message: 'Không tìm thấy đơn hàng' };
    p.status = 'approved';
    p.reviewed_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    p.note = (p.note || '') + ' [Xác nhận tự động qua payOS]';

    // Thêm thông báo
    this.notifications.push({
      id: this.nextId('notif'),
      recipient_id: p.member_id,
      type: 'system',
      level: 'yellow',
      title: 'Thanh toán đoàn phí thành công',
      body: `Hệ thống đã nhận được ${amount.toLocaleString('vi-VN')}đ đoàn phí năm ${p.year} của bạn qua payOS.`,
      task_id: null,
      sub_criterion_id: null,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return { success: true };
  }

  async createPayOsPaymentLink(input: {
    orderCode: number;
    amount: number;
    description: string;
    buyerName?: string;
    buyerPhone?: string;
    expiresInMinutes?: number;
  }) {
    // Chế độ mock: không gọi mạng, trả về dữ liệu giả để UI hiển thị
    return {
      success: true,
      paymentLinkId: `mock_${input.orderCode}`,
      checkoutUrl: '',
      qrCode: '',
      bin: '970422',
      accountNumber: '0585682707',
      accountName: 'DUONG PHUOC LOC',
      amount: input.amount,
      description: input.description,
      orderCode: input.orderCode,
      expiredAt: Math.floor(Date.now() / 1000) + (input.expiresInMinutes ?? 15) * 60,
      status: 'PENDING',
      message: 'Chế độ mock — không gọi payOS thật',
    };
  }

  async checkPayOsPaymentStatus(orderCode: number) {
    const p = this.unionFeePayments.find(x => x.order_code === orderCode);
    return {
      success: true,
      status: p?.status === 'approved' ? 'PAID' : 'PENDING',
      amount: p?.amount ?? 0,
      amountPaid: p?.status === 'approved' ? p.amount : 0,
      amountRemaining: p?.status === 'approved' ? 0 : (p?.amount ?? 0),
      transactions: [],
    };
  }

  async updateMemberFeeStatus(input: {
    memberId: string;
    hasSalary?: boolean;
    exemptMonths?: number[];
    transferredOutMonth?: number | null;
  }): Promise<{ success: boolean; message?: string }> {
    const m = this.members.find(x => x.id === input.memberId);
    if (!m) return { success: false, message: 'Không tìm thấy đoàn viên' };
    if (input.hasSalary !== undefined) m.has_salary = input.hasSalary;
    if (input.exemptMonths !== undefined) m.exempt_months = input.exemptMonths;
    if (input.transferredOutMonth !== undefined) m.transferred_out_month = input.transferredOutMonth;
    return { success: true };
  }

  async listUnitFeeDistributions(year: number): Promise<DbUnitFeeDistribution[]> {
    return this.unitFeeDistributions.filter(d => d.year === year);
  }

  async generateUnitFeeDistributions(year: number): Promise<{ success: boolean; count: number; message?: string }> {
    let count = 0;
    for (const u of this.units.filter(x => x.is_active)) {
      const payments = this.unionFeePayments.filter(p => p.unit_id === u.id && p.year === year && p.status === 'approved');
      const total = payments.reduce((sum, p) => sum + p.amount, 0);
      const unitShare = Math.round((total * 2) / 3);
      const communeShare = total - unitShare;

      let prev = this.unitFeeDistributions.find(d => d.unit_id === u.id && d.year === year);
      if (!prev) {
        this.unitFeeDistributions.push({
          id: this.nextId('dist'),
          unit_id: u.id,
          year,
          period_label: 'Cả năm',
          total_collected: total,
          unit_share: unitShare,
          commune_share: communeShare,
          is_refunded: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        count++;
      } else if (!prev.is_refunded) {
        prev.total_collected = total;
        prev.unit_share = unitShare;
        prev.commune_share = communeShare;
        prev.updated_at = new Date().toISOString();
        count++;
      }
    }
    return { success: true, count };
  }

  async markFeeDistributionRefunded(input: {
    distributionId: string;
    receiptNo?: string;
    note?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const d = this.unitFeeDistributions.find(x => x.id === input.distributionId);
    if (!d) return { success: false, message: 'Không tìm thấy bản ghi trích nộp' };
    d.is_refunded = true;
    d.refunded_at = new Date().toISOString().slice(0, 10);
    d.receipt_no = input.receiptNo;
    d.note = input.note;
    d.updated_at = new Date().toISOString();
    return { success: true };
  }

  async sendUnionFeeReminder(input: {
    recipientType: 'member' | 'unit' | 'all_unpaid';
    memberId?: string;
    unitId?: string;
    year: number;
    month?: number;
  }): Promise<{ success: boolean; count: number; message?: string }> {
    const curMonth = input.month || new Date().getMonth() + 1;
    let targetMembers = this.members.filter(m => m.is_active);
    if (input.recipientType === 'member' && input.memberId) {
      targetMembers = targetMembers.filter(m => m.id === input.memberId);
    } else if (input.recipientType === 'unit' && input.unitId) {
      targetMembers = targetMembers.filter(m => m.unit_id === input.unitId);
    }

    const paidMemberMonth = new Set<string>();
    for (const p of this.unionFeePayments) {
      if (p.year === input.year && p.status === 'approved') {
        for (const m of p.months) {
          paidMemberMonth.add(`${p.member_id}_${m}`);
        }
      }
    }

    const unpaid = targetMembers.filter(m => !paidMemberMonth.has(`${m.id}_${curMonth}`));
    for (const m of unpaid) {
      this.notifications.push({
        id: this.nextId('notif'),
        recipient_id: m.id,
        type: 'reminder',
        level: 'orange',
        title: `Nhắc nộp đoàn phí tháng ${curMonth}/${input.year}`,
        body: `Đồng chí còn chưa hoàn thành đoàn phí tháng ${curMonth}/${input.year}. Vui lòng mở mục Đoàn phí để quét mã VietQR thanh toán.`,
        task_id: null,
        sub_criterion_id: null,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    return { success: true, count: unpaid.length };
  }

  // =====================================================================
  // GIAI ĐOẠN 10 · NHIỆM VỤ, LÊN LỊCH TB, ONBOARDING, KHÔI PHỤC GỐC
  // =====================================================================

  async updateTask(input: {
    taskId: string;
    taskData: Partial<DbTask>;
    unitIds?: string[];
  }): Promise<{ success: boolean; message?: string }> {
    const t = this.tasks.find(x => x.id === input.taskId);
    if (!t) return { success: false, message: 'Không tìm thấy nhiệm vụ' };
    Object.assign(t, input.taskData);

    if (input.unitIds !== undefined) {
      this.taskUnits = this.taskUnits.filter(tu => tu.task_id !== input.taskId);
      for (const uId of input.unitIds) {
        this.taskUnits.push({ task_id: input.taskId, unit_id: uId });
      }
    }
    return { success: true };
  }

  async listScheduledNotifications(): Promise<DbScheduledNotification[]> {
    return [...this.scheduledNotifications];
  }

  async createScheduledNotification(input: {
    title: string;
    content: string;
    level: 'yellow' | 'orange' | 'red';
    recipientType: 'unit' | 'member' | 'all';
    targetId?: string;
    scheduledAt: string;
  }): Promise<{ success: boolean; message?: string }> {
    this.scheduledNotifications.push({
      id: this.nextId('sched'),
      title: input.title,
      content: input.content,
      level: input.level,
      recipient_type: input.recipientType,
      target_id: input.targetId || null,
      scheduled_at: input.scheduledAt,
      is_sent: false,
      created_at: new Date().toISOString(),
    });
    return { success: true };
  }

  async deleteScheduledNotification(id: string): Promise<{ success: boolean; message?: string }> {
    this.scheduledNotifications = this.scheduledNotifications.filter(s => s.id !== id);
    return { success: true };
  }

  async dispatchScheduledNotifications(): Promise<{ count: number }> {
    const now = new Date().toISOString();
    let count = 0;
    for (const s of this.scheduledNotifications) {
      if (!s.is_sent && s.scheduled_at <= now) {
        let targetMembers = this.members.filter(m => m.is_active);
        if (s.recipient_type === 'member' && s.target_id) {
          targetMembers = targetMembers.filter(m => m.id === s.target_id);
        } else if (s.recipient_type === 'unit' && s.target_id) {
          targetMembers = targetMembers.filter(m => m.unit_id === s.target_id);
        }

        for (const m of targetMembers) {
          this.notifications.push({
            id: this.nextId('notif'),
            recipient_id: m.id,
            type: 'reminder',
            level: s.level,
            title: s.title,
            body: s.content,
            task_id: null,
            sub_criterion_id: null,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }

        s.is_sent = true;
        s.sent_at = new Date().toISOString();
        count++;
      }
    }
    return { count };
  }

  async reviewMemberRegistration(input: {
    memberId: string;
    action: 'approve' | 'reject';
    rejectionReason?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const m = this.members.find(x => x.id === input.memberId);
    if (!m) return { success: false, message: 'Không tìm thấy hồ sơ đoàn viên' };

    if (input.action === 'approve') {
      m.approval_status = 'approved';
      m.rejection_reason = undefined;
      this.auditLogs.push({
        id: this.nextId('audit'),
        actor_id: 'self',
        actor_role: 'unit_secretary',
        action: 'APPROVE_MEMBER',
        table_name: 'members',
        row_id: m.id,
        old_value: null,
        new_value: 'Bí thư chi đoàn duyệt chính thức đoàn viên tự đăng ký',
        created_at: new Date().toISOString(),
      });
      return { success: true };
    } else {
      if (!input.rejectionReason?.trim()) {
        return { success: false, message: 'Vui lòng nêu rõ lý do từ chối hồ sơ' };
      }
      this.auditLogs.push({
        id: this.nextId('audit'),
        actor_id: 'self',
        actor_role: 'unit_secretary',
        action: 'REJECT_MEMBER',
        table_name: 'members',
        row_id: m.id,
        old_value: `Từ chối với lý do: ${input.rejectionReason.trim()}`,
        new_value: null,
        created_at: new Date().toISOString(),
      });
      this.members = this.members.filter(x => x.id !== m.id);
      return { success: true };
    }
  }

  async toggleMemberNewlyAdmitted(memberId: string, isNewlyAdmitted: boolean): Promise<{ success: boolean; message?: string }> {
    const m = this.members.find(x => x.id === memberId);
    if (!m) return { success: false, message: 'Không tìm thấy đoàn viên' };
    m.is_newly_admitted = isNewlyAdmitted;
    return { success: true };
  }

  async resetFactoryData(confirmationText: string): Promise<{ success: boolean; message?: string }> {
    if (confirmationText !== 'XOA TOAN BO DU LIEU') {
      return { success: false, message: 'Cụm từ xác nhận không chính xác. Thao tác bị hủy.' };
    }

    // Xóa toàn bộ dữ liệu phát sinh (giữ lại danh mục gốc + tài khoản)
    this.journalEntries = [];
    this.evidences = [];
    this.memberSubmissions = [];
    this.taskResults = [];
    this.taskSubCriteria = [];
    this.taskRegistrations = [];
    this.taskUnits = [];
    this.tasks = [];
    this.criterionSubmissions = [];
    this.subCriteria = [];
    this.criteria = [];
    this.criteriaSections = [];
    this.criteriaSets = [];
    this.memberEvaluations = [];
    this.unitEvaluations = [];
    this.memberDisciplines = [];
    this.memberRldvLevels = [];
    this.evaluationPeriods = [];
    this.unionFeePayments = [];
    this.unitFeeDistributions = [];
    this.scheduledNotifications = [];
    this.notifications = [];
    this.warnings = [];
    this.reports = [];
    this.unitCommittees = [];
    // Giữ lại: roles, unitTypes, ethnicities, yearlySettings, profiles, members, units
    // (người dùng tự xóa thủ công từng mục nếu muốn bàn giao trắng hoàn toàn)
    return { success: true, message: 'Đã dọn sạch dữ liệu thử nghiệm ở chế độ mock.' };
  }

  async bulkApproveTaskResults(ids: string[], note?: string): Promise<{ success: boolean; approved: number; message?: string }> {
    let approved = 0;
    for (const id of ids) {
      const r = this.taskResults.find(x => x.id === id);
      if (r && r.status === 'pending') {
        r.status = 'approved';
        r.reviewed_at = new Date().toISOString();
        r.review_note = note || 'Đạt yêu cầu';
        approved++;
      }
    }
    return { success: true, approved };
  }

  async getUnitCriterionProgress(unitId: string): Promise<Array<{
    subCriterionId: string;
    criterionName: string;
    subName: string;
    maxScore: number;
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
  }>> {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return [];

    const applicable = this.subCriteria.filter(sc => {
      const unitIds = sc.unit_ids ?? [];
      if (unitIds.length > 0) return unitIds.includes(unitId);
      const typeIds = sc.unit_type_ids ?? [];
      if (typeIds.length === 0) return true;
      return typeIds.includes(unit.unit_type_id);
    });

    return applicable.map(sc => {
      const crit = this.criteria.find(c => c.id === sc.criterion_id);
      const tasks = this.tasks.filter(t => t.source_sub_criterion_id === sc.id && t.status !== 'draft');
      const results = this.taskResults.filter(r => r.unit_id === unitId);
      const done = tasks.filter(t => results.some(r => r.task_id === t.id && r.status === 'approved')).length;
      const pending = tasks.filter(t => results.some(r => r.task_id === t.id && r.status === 'pending')).length;
      return {
        subCriterionId: sc.id,
        criterionName: crit?.name ?? '',
        subName: sc.condition_text,
        maxScore: sc.max_score,
        totalTasks: tasks.length,
        doneTasks: done,
        pendingTasks: pending,
      };
    });
  }

  async listTasksBySubCriterion(subCriterionId: string): Promise<Array<{
    task: DbTask;
    results: DbTaskResult[];
    unitName: string;
  }>> {
    return this.tasks
      .filter(t => t.source_sub_criterion_id === subCriterionId)
      .map(task => {
        const results = this.taskResults.filter(r => r.task_id === task.id);
        const unit = results[0] ? this.units.find(u => u.id === results[0].unit_id) : null;
        return { task, results, unitName: unit?.name ?? '' };
      });
  }

  async getRawSnapshot() {    return {
      roles: this.roles,
      unitTypes: this.unitTypes,
      ethnicities: this.ethnicities,
      units: this.units,
      members: this.members,
      profiles: this.profiles,
      criteriaSets: this.criteriaSets,
      criteriaSections: this.criteriaSections,
      criteria: this.criteria,
      subCriteria: this.subCriteria,
      criterionSubmissions: this.criterionSubmissions,
      tasks: this.tasks,
      taskUnits: this.taskUnits,
      taskRegistrations: this.taskRegistrations,
      taskSubCriteria: this.taskSubCriteria,
      taskResults: this.taskResults,
      evidences: this.evidences,
      notifications: this.notifications,
      warnings: this.warnings,
      unitCommittees: this.unitCommittees,
      reports: this.reports,
      yearlySettings: this.yearlySettings,
      auditLogs: this.auditLogs,
      memberSubmissions: this.memberSubmissions,
      unitReports: this.unitReports,
    };
  }
}

// Singleton repository instance
export const mockRepository = new MockRepository();
