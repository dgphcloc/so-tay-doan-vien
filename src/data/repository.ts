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
  ReviewStatus,
  EvidenceType,
} from './types';

/** Minh chứng gửi kèm khi nộp bài. */
export interface EvidenceInput {
  /** Loại minh chứng (khớp enum DB). */
  evidenceType: EvidenceType;
  /** URL công khai (ảnh/file/link). Với ghi chú thì để rỗng. */
  url: string;
  /** Đường dẫn Storage (ảnh/file); với link/ghi chú có thể rỗng. */
  storagePath: string;
  /** Tên hiển thị: tên file, nội dung link, hoặc nội dung ghi chú. */
  fileName: string;
  fileHash: string;
  lat: number | null;
  lng: number | null;
  source: 'camera' | 'upload';
}

export interface Repository {
  // 0a. Đăng ký tự phục vụ (đăng nhập Google lần đầu)
  /** Danh sách chi đoàn + dân tộc để điền form đăng ký (không cần hồ sơ). */
  getSignupOptions(): Promise<{
    units: Array<{ id: string; name: string; unit_type_id: UnitTypeId }>;
    ethnicities: Array<{ id: string; name: string }>;
  }>;
  /** Tạo hồ sơ đoàn viên + profile (vai trò luôn là member) cho tài khoản đang đăng nhập. */
  selfRegisterMember(input: {
    full_name: string;
    birth_date: string;
    gender: string;
    unit_id: string;
    phone?: string;
    joined_date?: string;
    education_grade?: string;
    specialization?: string;
    political_theory_level?: string;
    religion?: string;
    is_party_member?: boolean;
    ethnicity_id?: string;
    avatar_url?: string;
    current_job?: string;
  }): Promise<{ success: boolean; message?: string; memberId?: string }>;

  // 0. Người dùng đang đăng nhập (null ở chế độ mock)
  getCurrentUser(force?: boolean): Promise<{
    profileId: string;
    email: string | null;
    role: RoleId;
    memberId: string | null;
    isActive: boolean;
  } | null>;

  // 0b. Nộp minh chứng (phía chi đoàn)
  /** Việc chi đoàn cần nộp: nhiệm vụ được giao chưa nộp + tiêu chí áp dụng chưa nộp. */
  listMyTodo(unitId: string): Promise<{
    tasks: Array<{
      task: DbTask;
      deadlineStatus: TaskDeadlineStatus;
      alreadySubmitted: DbTaskResult | null;
    }>;
    subCriteria: Array<{
      subCriterion: DbSubCriterion;
      criterionName: string;
      alreadySubmitted: DbCriterionSubmission | null;
    }>;
  }>;
  /** Tải 1 file minh chứng lên Storage, trả url công khai + đường dẫn lưu. */
  uploadEvidence(file: File, unitId: string): Promise<{ url: string; storagePath: string }>;
  /** Nộp kết quả nhiệm vụ kèm minh chứng. */
  submitTaskResult(input: {
    taskId: string;
    unitId: string;
    participantCount: number;
    note?: string;
    lat: number | null;
    lng: number | null;
    isOverdue: boolean;
    evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; resultId?: string }>;
  /** Nộp bài tự chấm tiêu chí kèm minh chứng. */
  submitCriterionSubmission(input: {
    subCriterionId: string;
    unitId: string;
    selfScore: number;
    note?: string;
    evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; submissionId?: string }>;

  // 0c. Tự phục vụ: đoàn viên tự sửa hồ sơ + bảng tin nhiệm vụ
  /** Đoàn viên sửa hồ sơ của mình (chỉ trường an toàn). */
  updateMyProfile(updates: Partial<DbMember>): Promise<{ success: boolean; message?: string }>;
  /**
   * Bảng tin: nhiệm vụ đang mở giao cho chi đoàn của tôi, kèm trạng thái tham gia
   * của tôi và (nếu là bí thư) số đoàn viên đã xác nhận.
   */
  listMyFeed(): Promise<Array<{
    task: DbTask;
    myRegistration: DbTaskRegistration | null;
    joinedCount: number;
    joinedNames: string[];
    /** Bài nộp cá nhân của tôi cho nhiệm vụ này (nếu có). */
    mySubmission: DbMemberSubmission | null;
  }>>;
  /** Đoàn viên xác nhận tham gia / từ chối một nhiệm vụ. */
  setTaskRegistration(taskId: string, isJoining: boolean): Promise<{ success: boolean; message?: string }>;

  // 0d. Nộp minh chứng CÁ NHÂN của đoàn viên (duyệt bởi bí thư chi đoàn)
  /** Đoàn viên nộp (hoặc nộp lại) minh chứng cá nhân cho một nhiệm vụ. */
  submitMemberResult(input: {
    taskId: string;
    note?: string;
    lat: number | null;
    lng: number | null;
    evidences: EvidenceInput[];
  }): Promise<{ success: boolean; message?: string; submissionId?: string }>;
  /** Bài nộp cá nhân; RLS tự giới hạn theo vai trò (đoàn viên: của mình, bí thư CĐ: chi đoàn mình). */
  listMemberSubmissions(filters?: {
    taskId?: string;
    unitId?: string;
    memberId?: string;
    status?: ReviewStatus;
  }): Promise<DbMemberSubmission[]>;
  /** Bí thư chi đoàn xác nhận / từ chối một bài cá nhân. */
  reviewMemberSubmission(id: string, approve: boolean, note?: string): Promise<{ success: boolean; message?: string }>;
  /** Minh chứng đính kèm của một bài nộp cá nhân. */
  listMemberSubmissionEvidences(submissionId: string): Promise<DbEvidence[]>;
  /** Ai đã tham gia / đã nộp / chưa nộp trong một chi đoàn cho một nhiệm vụ. */
  listTaskParticipants(taskId: string, unitId: string): Promise<Array<{
    member: DbMember;
    isJoining: boolean | null;
    submission: DbMemberSubmission | null;
  }>>;
  /** Danh sách tham gia của một nhiệm vụ trên MỌI chi đoàn được giao (bí thư xã theo dõi). */
  listTaskParticipantsAll(taskId: string): Promise<Array<{
    member: DbMember;
    unit: DbUnit | null;
    isJoining: boolean | null;
    submission: DbMemberSubmission | null;
  }>>;

  // 0e. Sổ tay cá nhân — riêng tư tuyệt đối, chỉ chủ sở hữu đọc/ghi
  listJournalEntries(): Promise<DbJournalEntry[]>;
  saveJournalEntry(input: {
    id?: string;
    title: string;
    activity_date: string;
    note?: string;
    images: Array<{ storagePath: string; url: string; fileName?: string }>;
    links: Array<{ url: string; note?: string }>;
  }): Promise<{ success: boolean; message?: string; entryId?: string }>;
  deleteJournalEntry(id: string): Promise<{ success: boolean; message?: string }>;
  /** Tải ảnh sổ tay lên Storage, trả url + đường dẫn. */
  uploadJournalImage(file: File): Promise<{ url: string; storagePath: string }>;

  // 1. Dashboard & Thống kê tính toán
  getDashboard(year: number): Promise<DashboardStats>;
  calculateUnitScores(year?: number): Promise<UnitScoreCalculation[]>;

  // 2. Phê duyệt (Duyệt kết quả nhiệm vụ & tiêu chí)
  listPendingReviews(
    tab: 'all' | 'tasks' | 'criteria',
    filters?: { unitId?: string; search?: string }
  ): Promise<{
    taskResults: DbTaskResult[];
    criterionSubmissions: DbCriterionSubmission[];
  }>;
  getReviewDetail(
    kind: 'task' | 'criterion',
    id: string
  ): Promise<{
    item: DbTaskResult | DbCriterionSubmission | null;
    unit: DbUnit | null;
    task?: DbTask | null;
    subCriterion?: DbSubCriterion | null;
    evidences: DbEvidence[];
    warnings: EvidenceAuditWarning[];
  }>;
  approve(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    approvedScore?: number,
    reviewNote?: string
  ): Promise<{ success: boolean; message?: string }>;
  reject(
    kind: 'task' | 'criterion',
    id: string,
    reviewerId: string,
    note: string
  ): Promise<{ success: boolean; message?: string }>;

  // 3. Nhiệm vụ (/nhiem-vu)
  listTasks(status?: 'all' | 'draft' | 'published' | 'closed'): Promise<DbTask[]>;
  getTask(id: string): Promise<{
    task: DbTask | null;
    deadlineStatus: TaskDeadlineStatus;
    units: DbUnit[];
    registrations: DbTaskRegistration[];
    subCriteria: Array<{ subCriterion: DbSubCriterion; contribution_score: number }>;
    results: DbTaskResult[];
  }>;
  createTask(input: {
    taskData: Omit<DbTask, 'id' | 'assigned_by' | 'assigned_at' | 'closed_by' | 'closed_at'>;
    unitIds: string[];
    subCriteriaContributions: Array<{ sub_criterion_id: string; contribution_score: number }>;
  }): Promise<DbTask>;
  publishTask(id: string): Promise<{ success: boolean; message?: string }>;
  closeTask(id: string): Promise<{ success: boolean; message?: string }>;
  deleteTask(id: string): Promise<{ success: boolean; message?: string }>;
  cloneTask(id: string): Promise<DbTask | null>;
  remindUnit(taskId: string, unitId: string): Promise<{ success: boolean }>;
  remindAllUnsubmitted(taskId: string): Promise<{ remindedCount: number }>;
  /** Gắn / sửa danh sách tiêu chí đóng góp của một nhiệm vụ đã tạo. */
  setTaskSubCriteria(taskId: string, items: Array<{ sub_criterion_id: string; contribution_score: number }>): Promise<{ success: boolean; message?: string }>;
  /** Số chi đoàn được giao nhưng chưa nộp bài tổng hợp (để cảnh báo khi đóng). */
  countUnitsWithoutResult(taskId: string): Promise<{ assigned: number; submitted: number; missing: string[] }>;
  /** Duyệt tất cả bài nộp cá nhân đang chờ duyệt của một nhiệm vụ. */
  approveAllMemberSubmissions(taskId: string): Promise<{ success: boolean; approved: number; message?: string }>;

  // 4. Chi đoàn (/chi-doan)
  listUnits(filters?: { unitTypeId?: UnitTypeId; search?: string; isActive?: boolean }): Promise<
    Array<{
      unit: DbUnit;
      currentSecretary: DbMember | null;
      hasMissingSecretary: boolean;
      actualMemberCount: number;
      declaredMemberCount: number;
      hasCountMismatch: boolean;
      openWarningsCount: number;
    }>
  >;
  getUnit(id: string): Promise<{
    unit: DbUnit | null;
    currentSecretary: DbMember | null;
    members: DbMember[];
    committee: DbUnitCommittee[];
    taskResults: DbTaskResult[];
    submissions: DbCriterionSubmission[];
    score: UnitScoreCalculation | null;
  }>;
  saveUnit(id: string, updates: Partial<DbUnit>): Promise<{ success: boolean }>;
  deactivateUnit(id: string): Promise<{ success: boolean; message?: string }>;
  createUnit(input: {
    name: string;
    unit_type_id: UnitTypeId;
    note?: string;
    union_member_count?: number;
    youth_count?: number;
  }): Promise<{ success: boolean; message?: string; unit?: DbUnit }>;
  deleteUnit(id: string): Promise<{ success: boolean; message?: string }>;

  // 5. Đoàn viên (/doan-vien)
  listMembers(filters?: {
    search?: string;
    unitId?: string;
    gender?: string;
    position?: string;
    isPartyMember?: boolean;
    isActive?: boolean;
    ageMin?: number;
    ageMax?: number;
    isMatured?: boolean;
  }): Promise<MemberComputed[]>;
  getMember(id: string): Promise<{
    member: DbMember | null;
    unit: DbUnit | null;
    profile: DbProfile | null;
    committeeHistory: DbUnitCommittee[];
    taskRegistrations: DbTaskRegistration[];
  }>;
  saveMember(
    input: (Omit<DbMember, 'id'> & { id?: string })
  ): Promise<{ success: boolean; message?: string; member?: DbMember }>;
  deleteMember(id: string): Promise<{ success: boolean }>;
  importMembers(rows: Array<Omit<DbMember, 'id'>>): Promise<{ importedCount: number }>;

  // 6. Ban chấp hành (/ban-chap-hanh, /bch)
  listCommittees(
    unitId: string | null,
    termStatus?: 'active' | 'ended' | 'all'
  ): Promise<
    Array<{
      committee: DbUnitCommittee;
      member: DbMember;
    }>
  >;
  addCommitteeMember(input: {
    memberId: string;
    unitId: string | null;
    position: CommitteePosition;
    isStanding: boolean;
    termStart: string;
  }): Promise<{ success: boolean; message?: string }>;
  endCommitteeTerm(id: string, endDate?: string): Promise<{ success: boolean }>;

  // 7. Tiêu chí (/tieu-chi)
  listCriteriaSets(year?: number): Promise<
    Array<{
      criteriaSet: DbCriteriaSet;
      subCriteriaCount: number;
      isFinalizedForYear: boolean;
      scoringProgress: number; // 0..100
    }>
  >;
  getCriteriaTree(criteriaSetId: string): Promise<{
    sections: DbCriteriaSection[];
    criteria: DbCriterion[];
    subCriteria: DbSubCriterion[];
    totalMaxScore: number;
    orphanCount: number;
    isValid100: boolean;
  }>;
  saveCriteriaNode(
    type: 'section' | 'criterion' | 'subCriterion',
    action: 'create' | 'update' | 'delete',
    data: any
  ): Promise<{ success: boolean; message?: string }>;
  reorderCriteriaNodes(
    type: 'section' | 'criterion' | 'subCriterion',
    parentId: string,
    startIndex: number,
    endIndex: number
  ): Promise<{ success: boolean }>;
  cloneCriteriaSetFromPreviousYear(targetYear: number): Promise<{ success: boolean }>;
  /** Lưu trữ bộ tiêu chí (soft delete): ẩn khỏi danh sách, giữ điểm + minh chứng. */
  deleteCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }>;
  /** Khôi phục bộ tiêu chí đã lưu trữ. */
  restoreCriteriaSet(criteriaSetId: string): Promise<{ success: boolean; message?: string }>;
  /** Quy mô ảnh hưởng trước khi xóa vĩnh viễn. */
  getCriteriaSetImpact(criteriaSetId: string): Promise<{
    submissionCount: number; unitCount: number; evidenceCount: number;
    subCriteriaCount: number; isArchived: boolean;
  }>;
  /** Xóa vĩnh viễn: snapshot JSON vào nhật ký trước, rồi xóa dòng + file Storage. */
  purgeCriteriaSet(criteriaSetId: string): Promise<{
    success: boolean; message?: string;
    deletedSubmissions?: number; deletedEvidences?: number; deletedFiles?: number;
  }>;
  /**
   * Nhập trọn một bộ tiêu chí (từ Excel) vào DB: tạo criteria_set mới cùng
   * sections/criteria/sub_criteria. Trả về id bộ mới để giao diện chọn ngay.
   */
  importCriteriaTree(payload: {
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
  }): Promise<{ success: boolean; message?: string; criteriaSetId?: string }>;

  // 8. Nhắc nhở & Cảnh báo (/nhac-nho)
  listWarnings(tab: 'open' | 'resolved'): Promise<
    Array<{
      warning: DbWarning;
      unit: DbUnit | null;
      task: DbTask | null;
      subCriterion: DbSubCriterion | null;
    }>
  >;
  resolveWarning(warningId: string): Promise<{ success: boolean }>;
  sendNotification(input: {
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
  }): Promise<{ sentCount: number; recipients: string[] }>;

  // 9. Báo cáo (/bao-cao)
  listReports(): Promise<DbReport[]>;
  createReport(input: {
    title: string;
    type: ReportType;
    periodStart: string;
    periodEnd: string;
    unitId: string | null;
    data: Record<string, unknown>;
    createdBy: string;
  }): Promise<DbReport>;

  // 10. Cấu hình & Danh mục (/cau-hinh)
  getYearlySettings(year: number): Promise<DbYearlySettings>;
  updateYearlySettings(year: number, updates: Partial<DbYearlySettings>): Promise<{ success: boolean }>;
  listUnitTypes(): Promise<DbUnitType[]>;
  saveUnitType(id: UnitTypeId, name: string): Promise<{ success: boolean }>;
  deleteUnitType(id: UnitTypeId): Promise<{ success: boolean; message?: string }>;
  listEthnicities(): Promise<DbEthnicity[]>;

  // 11. Tài khoản & Phân quyền (/tai-khoan)
  listProfiles(): Promise<
    Array<{
      profile: DbProfile;
      member: DbMember | null;
    }>
  >;
  setProfileRole(profileId: string, roleId: RoleId): Promise<{ success: boolean }>;
  toggleProfileActive(profileId: string): Promise<{ success: boolean }>;
  linkProfileMember(profileId: string, memberId: string): Promise<{ success: boolean }>;

  // 12. Nhật ký (/nhat-ky)
  listAuditLogs(filters?: {
    search?: string;
    action?: string;
    actorId?: string;
  }): Promise<
    Array<{
      log: DbAuditLog;
      actor: DbMember | null;
      diffSummary: {
        oldValue: string | null;
        newValue: string | null;
      };
    }>
  >;

  // Raw read access for synchronizing UI state with reactive context
  getRawSnapshot(): Promise<{
    roles: DbRole[];
    unitTypes: DbUnitType[];
    ethnicities: DbEthnicity[];
    units: DbUnit[];
    members: DbMember[];
    profiles: DbProfile[];
    criteriaSets: DbCriteriaSet[];
    criteriaSections: DbCriteriaSection[];
    criteria: DbCriterion[];
    subCriteria: DbSubCriterion[];
    criterionSubmissions: DbCriterionSubmission[];
    tasks: DbTask[];
    taskUnits: DbTaskUnit[];
    taskRegistrations: DbTaskRegistration[];
    taskSubCriteria: DbTaskSubCriterion[];
    taskResults: DbTaskResult[];
    memberSubmissions: DbMemberSubmission[];
    evidences: DbEvidence[];
    notifications: DbNotification[];
    warnings: DbWarning[];
    unitCommittees: DbUnitCommittee[];
    reports: DbReport[];
    yearlySettings: DbYearlySettings;
    auditLogs: DbAuditLog[];
  }>;
}
