import {
  Role,
  UnitType,
  Ethnicity,
  Unit,
  Member,
  Profile,
  CriteriaSet,
  CriteriaSection,
  Criterion,
  SubCriterion,
  CriterionSubmission,
  Task,
  TaskUnit,
  TaskRegistration,
  TaskSubCriterion,
  TaskResult,
  Evidence,
  Notification,
  Warning,
  UnitCommittee,
  YearlySettings,
  AuditLog,
  Report,
} from '../types';

// Helper tạo ngày tương đối so với thời điểm hiện tại
const now = new Date();

export function getRelativeDate(days: number, hours: number = 0, minutes: number = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours, d.getMinutes() + minutes, 0, 0);
  return d.toISOString();
}

export function formatDateVN(isoString: string): string {
  try {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return isoString;
  }
}

export function formatDateTimeVN(isoString: string): string {
  try {
    const d = new Date(isoString);
    const date = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return `${time} ${date}`;
  } catch {
    return isoString;
  }
}

// 1. Roles
export const mockRoles: Role[] = [
  { id: 'super_admin', name: 'Quản trị viên tối cao', note: 'Toàn quyền điều hành hệ thống' },
  { id: 'admin', name: 'Quản trị viên Đoàn xã', note: 'Bí thư/Phó Bí thư quản trị công việc, chi đoàn, duyệt minh chứng' },
  { id: 'staff', name: 'Cán bộ theo dõi', note: 'Chuyên viên Đoàn xem danh sách, chỉ đọc, báo cáo' },
  { id: 'unit_secretary', name: 'Bí thư Chi đoàn', note: 'Nộp báo cáo, gửi minh chứng chi đoàn cơ sở' },
  { id: 'member', name: 'Đoàn viên', note: 'Đoàn viên thanh niên cơ sở' },
];

// 2. Unit Types
export const mockUnitTypes: UnitType[] = [
  { id: 'residential', name: 'Dân cư' },
  { id: 'school', name: 'Trường học' },
  { id: 'health', name: 'Y tế' },
  { id: 'police', name: 'Công an' },
  { id: 'other', name: 'Khác' },
];

// 3. Ethnicities
export const mockEthnicities: Ethnicity[] = [
  { id: 'kinh', name: 'Kinh' },
  { id: 'tay', name: 'Tày' },
  { id: 'thai', name: 'Thái' },
  { id: 'khmer', name: 'Khmer' },
  { id: 'hoa', name: 'Hoa' },
  { id: 'cham', name: 'Chăm' },
  { id: 'muong', name: 'Mường' },
  { id: 'nung', name: 'Nùng' },
];

// 4. Units (31 chi đoàn: 25 ấp + 3 trường + 2 y tế + 1 công an)
export const mockUnits: Unit[] = [
  // 25 chi đoàn ấp
  ...Array.from({ length: 25 }, (_, i) => {
    const num = i + 1;
    const memberCount = 7 + ((num * 3) % 11); // 7 to 17 đoàn viên
    const youthCount = memberCount + 12 + ((num * 5) % 25);
    return {
      id: `unit_ap_${num}`,
      name: `Chi đoàn Ấp ${num}`,
      note: `Địa bàn ấp ${num}, xã Tân Phú`,
      unit_type_id: 'residential' as const,
      is_active: true,
      union_member_count: memberCount,
      youth_count: youthCount,
    };
  }),
  // 3 trường học
  {
    id: 'unit_school_thcs',
    name: 'Chi đoàn THCS Tân Phú',
    note: 'Chi đoàn Giáo viên - Trường THCS Tân Phú',
    unit_type_id: 'school',
    is_active: true,
    union_member_count: 18,
    youth_count: 24,
  },
  {
    id: 'unit_school_thpt',
    name: 'Chi đoàn THPT Nguyễn Du',
    note: 'Đoàn trường THPT Nguyễn Du',
    unit_type_id: 'school',
    is_active: true,
    union_member_count: 28,
    youth_count: 42,
  },
  {
    id: 'unit_school_th',
    name: 'Chi đoàn Tiểu học An Hoà',
    note: 'Chi đoàn Giáo viên Tiểu học An Hoà',
    unit_type_id: 'school',
    is_active: true,
    union_member_count: 12,
    youth_count: 16,
  },
  // 2 y tế
  {
    id: 'unit_health_tramyte',
    name: 'Chi đoàn Trạm Y tế xã',
    note: 'Cán bộ nhân viên y tế trẻ xã Tân Phú',
    unit_type_id: 'health',
    is_active: true,
    union_member_count: 11,
    youth_count: 15,
  },
  {
    id: 'unit_health_phongkham',
    name: 'Chi đoàn PKĐK Khu Vực',
    note: 'Phòng khám Đa khoa khu vực liên xã',
    unit_type_id: 'health',
    is_active: true,
    union_member_count: 14,
    youth_count: 20,
  },
  // 1 công an
  {
    id: 'unit_police_xano',
    name: 'Chi đoàn Công an xã Tân Phú',
    note: 'Chi đoàn Lực lượng Công an chính quy xã',
    unit_type_id: 'police',
    is_active: true,
    union_member_count: 9,
    youth_count: 10,
  },
];

// 5. Members (~320 đoàn viên)
const sampleFirstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const sampleMiddleNames = ['Văn', 'Thị', 'Minh', 'Hồng', 'Thành', 'Hữu', 'Ngọc', 'Quốc', 'Đức', 'Phương', 'Bảo', 'Kim', 'Trọng', 'Thanh'];
const sampleLastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Hậu', 'Hoà', 'Huy', 'Khoa', 'Lâm', 'Linh', 'Long', 'Mai', 'Nam', 'Nghĩa', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thắng', 'Thảo', 'Trang', 'Trung', 'Tuấn', 'Tùng', 'Vinh', 'Vy', 'Yến'];
const sampleJobs = ['Nông dân trẻ', 'Cán bộ bán chuyên trách', 'Giáo viên', 'Công an viên', 'Bác sĩ trẻ', 'Kinh doanh tự do', 'Công nhân viên', 'Thợ cơ khí', 'Sinh viên', 'Dược sĩ'];

// Tạo danh sách đoàn viên
export const mockMembers: Member[] = [];

// Ban Thường vụ / Bí thư xã
export const keyMemberIds = {
  biThuXa: 'mem_bch_1',
  phoBiThu1: 'mem_bch_2',
  phoBiThu2: 'mem_bch_3',
  uyVienBTV1: 'mem_bch_4',
  uyVienBTV2: 'mem_bch_5',
  uyVienBCH1: 'mem_bch_6',
  uyVienBCH2: 'mem_bch_7',
  uyVienBCH3: 'mem_bch_8',
};

// Khởi tạo các ủy viên BCH Đoàn xã trước
const bchInitData: Array<{
  id: string;
  name: string;
  gender: 'male' | 'female';
  unit_id: string;
  pos: 'secretary' | 'deputy_secretary' | 'member';
  role: string;
  is_party: boolean;
  phone: string;
  job: string;
}> = [
  { id: keyMemberIds.biThuXa, name: 'Nguyễn Văn Hùng', gender: 'male', unit_id: 'unit_ap_1', pos: 'secretary', role: 'Bí thư Đoàn xã', is_party: true, phone: '0918342111', job: 'Bí thư Đoàn xã chuyên trách' },
  { id: keyMemberIds.phoBiThu1, name: 'Trần Thị Mai Phương', gender: 'female', unit_id: 'unit_school_thcs', pos: 'deputy_secretary', role: 'Phó Bí thư kiêm Chủ tịch Hội LHTN', is_party: true, phone: '0977234882', job: 'Phó Bí thư Đoàn xã' },
  { id: keyMemberIds.phoBiThu2, name: 'Lê Hoàng Nam', gender: 'male', unit_id: 'unit_police_xano', pos: 'deputy_secretary', role: 'Phó Bí thư Đoàn xã', is_party: true, phone: '0903889123', job: 'Công an viên' },
  { id: keyMemberIds.uyVienBTV1, name: 'Phạm Minh Trí', gender: 'male', unit_id: 'unit_ap_3', pos: 'member', role: 'UV BTV - Phụ trách Tuyên giáo', is_party: true, phone: '0945112334', job: 'Cán bộ Văn hoá xã' },
  { id: keyMemberIds.uyVienBTV2, name: 'Đỗ Hồng Hạnh', gender: 'female', unit_id: 'unit_health_tramyte', pos: 'member', role: 'UV BTV - Phụ trách Kiểm tra', is_party: true, phone: '0939556778', job: 'Y sĩ đa khoa' },
  { id: keyMemberIds.uyVienBCH1, name: 'Vũ Quốc Bảo', gender: 'male', unit_id: 'unit_ap_7', pos: 'member', role: 'UV BCH Đoàn xã', is_party: false, phone: '0981223445', job: 'Chủ cơ sở chăn nuôi' },
  { id: keyMemberIds.uyVienBCH2, name: 'Ngô Thanh Sơn', gender: 'male', unit_id: 'unit_school_thpt', pos: 'member', role: 'UV BCH Đoàn xã', is_party: true, phone: '0912776889', job: 'Giáo viên THPT' },
  { id: keyMemberIds.uyVienBCH3, name: 'Huỳnh Kim Ngân', gender: 'female', unit_id: 'unit_ap_12', pos: 'member', role: 'UV BCH Đoàn xã', is_party: false, phone: '0909443552', job: 'Cán bộ Bưu điện xã' },
];

bchInitData.forEach((b, idx) => {
  mockMembers.push({
    id: b.id,
    full_name: b.name,
    birth_date: `199${4 + (idx % 5)}-0${(idx % 9) + 1}-15`,
    gender: b.gender,
    phone: b.phone,
    joined_date: `201${2 + (idx % 6)}-03-26`,
    unit_id: b.unit_id,
    current_position: b.pos,
    planned_position: 'Cấp ủy chi bộ nhiệm kỳ tới',
    education_grade: '12/12',
    specialization: idx % 2 === 0 ? 'Cử nhân Quản trị & Xây dựng Đảng' : 'Cử nhân Sư phạm / Y khoa',
    political_theory_level: idx < 4 ? 'intermediate' : 'elementary',
    is_active: true,
    religion: 'Không',
    is_party_member: b.is_party,
    ethnicity_id: 'kinh',
    avatar_url: `https://i.pravatar.cc/80?u=${b.id}`,
    current_job: b.job,
    central_member_code: `DNVN-2026-000${idx + 1}`,
    note: b.role,
  });
});

// Sinh đoàn viên cho các chi đoàn (tổng cộng ~320 đoàn viên)
let memberCounter = 9;

mockUnits.forEach((unit) => {
  const targetCount = unit.union_member_count;
  // Kiểm tra xem đã có người trong unit này chưa
  const existingInUnit = mockMembers.filter(m => m.unit_id === unit.id);
  const remainingCount = targetCount - existingInUnit.length;

  // Quyết định xem chi đoàn có bí thư chưa
  // Cố ý khuyết bí thư ở Ấp 14 (unit_ap_14) và Ấp 22 (unit_ap_22)
  const isVacantSecretary = unit.id === 'unit_ap_14' || unit.id === 'unit_ap_22';

  for (let k = 0; k < remainingCount; k++) {
    const memId = `mem_${unit.id}_${k + 1}`;
    const isMale = (memberCounter * 7) % 2 === 0;
    const fName = sampleFirstNames[(memberCounter * 3) % sampleFirstNames.length];
    const mName = isMale ? sampleMiddleNames[(memberCounter * 2) % 7] : sampleMiddleNames[1];
    const lName = sampleLastNames[memberCounter % sampleLastNames.length];
    const fullName = `${fName} ${mName} ${lName}`;
    
    // Nếu là người đầu tiên của chi đoàn và không bị khuyết, chỉ định Bí thư chi đoàn
    let pos: 'secretary' | 'deputy_secretary' | 'member' = 'member';
    if (k === 0 && !isVacantSecretary && existingInUnit.length === 0) {
      pos = 'secretary';
    } else if (k === 1 && !isVacantSecretary) {
      pos = 'deputy_secretary';
    }

    const birthYear = 1996 + (memberCounter % 11); // 16 - 30 tuổi
    const birthMonth = ((memberCounter % 12) + 1).toString().padStart(2, '0');
    const birthDay = ((memberCounter % 28) + 1).toString().padStart(2, '0');
    const isParty = (memberCounter % 7 === 0);
    const ethIdx = memberCounter % 15 === 0 ? 3 : (memberCounter % 20 === 0 ? 4 : 0); // đa số Kinh, xen kẽ Khmer, Hoa

    mockMembers.push({
      id: memId,
      full_name: fullName,
      birth_date: `${birthYear}-${birthMonth}-${birthDay}`,
      gender: isMale ? 'male' : 'female',
      phone: `09${(10000000 + (memberCounter * 38219) % 89999999).toString()}`,
      joined_date: `${birthYear + 15}-03-26`,
      unit_id: unit.id,
      current_position: pos,
      planned_position: pos === 'secretary' ? 'Quy hoạch cấp uỷ cơ sở' : undefined,
      education_grade: '12/12',
      specialization: sampleJobs[memberCounter % sampleJobs.length],
      political_theory_level: pos === 'secretary' ? 'elementary' : 'other',
      is_active: true,
      religion: memberCounter % 11 === 0 ? 'Phật giáo' : 'Không',
      is_party_member: isParty,
      ethnicity_id: mockEthnicities[ethIdx].id,
      avatar_url: `https://i.pravatar.cc/80?u=${memId}`,
      current_job: sampleJobs[memberCounter % sampleJobs.length],
      central_member_code: `DNVN-2026-${(memberCounter * 17).toString().padStart(5, '0')}`,
      note: pos === 'secretary' ? `Bí thư ${unit.name}` : undefined,
    });

    memberCounter++;
  }
});

// 6. Ban chấp hành Đoàn xã & Ban Chấp hành Chi đoàn
export const mockUnitCommittees: UnitCommittee[] = [
  // BCH Đoàn xã (unit_id = null)
  { id: 'comm_xa_1', unit_id: null, member_id: keyMemberIds.biThuXa, position: 'secretary', is_standing: true, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_2', unit_id: null, member_id: keyMemberIds.phoBiThu1, position: 'deputy_secretary', is_standing: true, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_3', unit_id: null, member_id: keyMemberIds.phoBiThu2, position: 'deputy_secretary', is_standing: true, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_4', unit_id: null, member_id: keyMemberIds.uyVienBTV1, position: 'committee_member', is_standing: true, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_5', unit_id: null, member_id: keyMemberIds.uyVienBTV2, position: 'committee_member', is_standing: true, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_6', unit_id: null, member_id: keyMemberIds.uyVienBCH1, position: 'committee_member', is_standing: false, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_7', unit_id: null, member_id: keyMemberIds.uyVienBCH2, position: 'committee_member', is_standing: false, term_start: '2022-08-15', term_end: null },
  { id: 'comm_xa_8', unit_id: null, member_id: keyMemberIds.uyVienBCH3, position: 'committee_member', is_standing: false, term_start: '2022-08-15', term_end: null },
];

// 7. Yearly Settings (2026)
export const mockYearlySettings: YearlySettings = {
  year: 2026,
  criteria_set_id: 'set_2026',
  matured_age: 30,
  new_member_target: 40,
  max_photos: 3,
  max_files: 3,
  max_links: 5,
  require_gps: true,
};

// 8. Profiles (Tài khoản phân quyền cho các thành viên chính)
export const mockProfiles: Profile[] = [
  { id: 'prof_1', member_id: keyMemberIds.biThuXa, role_id: 'super_admin', is_active: true, email: 'hung.doanxa@tanphu.gov.vn' },
  { id: 'prof_2', member_id: keyMemberIds.phoBiThu1, role_id: 'admin', is_active: true, email: 'phuong.pbt@tanphu.gov.vn' },
  { id: 'prof_3', member_id: keyMemberIds.uyVienBTV1, role_id: 'staff', is_active: true, email: 'tri.tuyengiao@tanphu.gov.vn' },
  { id: 'prof_4', member_id: keyMemberIds.uyVienBTV2, role_id: 'admin', is_active: true, email: 'hanh.kiemtra@tanphu.gov.vn' },
  { id: 'prof_5', member_id: keyMemberIds.uyVienBCH1, role_id: 'unit_secretary', is_active: true, email: 'bao.ap7@tanphu.gov.vn' },
  // Hàng đợi: tài khoản chưa liên kết đoàn viên để demo ghép thủ công
  { id: 'prof_unlinked_1', member_id: null, role_id: 'staff', is_active: true, email: 'canbo.tapsu@tanphu.gov.vn' },
  { id: 'prof_unlinked_2', member_id: null, role_id: 'unit_secretary', is_active: false, email: 'bithu.moi@tanphu.gov.vn' },
];

// 9. Criteria Sets, Sections, Criteria, Sub-Criteria
export const mockCriteriaSet: CriteriaSet = {
  id: 'set_2026',
  year: 2026,
  name: 'Bộ Tiêu chí Đánh giá Chất lượng Hoạt động Đoàn Cơ sở năm 2026',
  issuing_unit: 'Huyện Đoàn & Ban Thường vụ Đoàn xã Hòa Bình',
};

export const mockCriteriaSections: CriteriaSection[] = [
  { id: 'sec_1', criteria_set_id: 'set_2026', stt: 1, name: 'Phần I: Công tác Tuyên giáo và Học tập Lý luận' },
  { id: 'sec_2', criteria_set_id: 'set_2026', stt: 2, name: 'Phần II: Phong trào Thanh niên Tình nguyện & Xung kích' },
  { id: 'sec_3', criteria_set_id: 'set_2026', stt: 3, name: 'Phần III: Công tác Xây dựng Tổ chức Đoàn & Giới thiệu Đoàn viên vào Đảng' },
];

export const mockCriteria: Criterion[] = [
  // Phần I
  { id: 'crit_1', section_id: 'sec_1', stt: 1, name: 'Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh' },
  { id: 'crit_2', section_id: 'sec_1', stt: 2, name: 'Tuyên truyền đường lối của Đảng, pháp luật của Nhà nước và phòng chống tội phạm' },
  // Phần II
  { id: 'crit_3', section_id: 'sec_2', stt: 3, name: 'Xây dựng Nông thôn mới nâng cao và Bảo vệ môi trường' },
  { id: 'crit_4', section_id: 'sec_2', stt: 4, name: 'Chuyển đổi số cộng đồng và Ứng dụng công nghệ' },
  { id: 'crit_5', section_id: 'sec_2', stt: 5, name: 'Đồng hành với thanh niên trong khởi nghiệp, lập nghiệp và an sinh xã hội' },
  // Phần III
  { id: 'crit_6', section_id: 'sec_3', stt: 6, name: 'Công tác phát triển đoàn viên mới và quản lý đoàn viên trên phần mềm' },
  { id: 'crit_7', section_id: 'sec_3', stt: 7, name: 'Sinh hoạt Chi đoàn định kỳ và thực hiện Ngày Đoàn viên' },
  { id: 'crit_8', section_id: 'sec_3', stt: 8, name: 'Công tác giới thiệu đoàn viên ưu tú cho Đảng xem xét kết nạp' },
];

export const mockSubCriteria: SubCriterion[] = [
  // Tiêu chí 1
  {
    id: 'sub_crit_1_1',
    criterion_id: 'crit_1',
    condition_text: '100% đoàn viên đăng ký và hoàn thành Chuyên đề học tập Bác năm 2026',
    max_score: 5,
    evaluation_method: 'Kiểm tra sổ đăng ký và bài thu hoạch',
    evidence_requirement: 'Danh sách ký cam kết kèm ít nhất 3 bài thu hoạch tiêu biểu',
    scoring_rule: 'Đạt 100%: 5 điểm; Đạt từ 80-99%: 3 điểm; Dưới 80%: 0 điểm',
    deadline: getRelativeDate(18),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  {
    id: 'sub_crit_1_2',
    criterion_id: 'crit_1',
    condition_text: 'Tổ chức ít nhất 01 buổi toạ đàm hoặc sinh hoạt chuyên đề kỷ niệm ngày thành lập Đoàn 26/3',
    max_score: 4,
    evaluation_method: 'Hình ảnh sinh hoạt và biên bản cuộc họp',
    evidence_requirement: 'Biên bản sinh hoạt có xác nhận cấp uỷ ấp + 3 ảnh hoạt động',
    scoring_rule: 'Có tổ chức đúng quy cách: 4 điểm',
    deadline: getRelativeDate(25),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 2
  {
    id: 'sub_crit_2_1',
    criterion_id: 'crit_2',
    condition_text: 'Tuyên truyền Luật Nghĩa vụ quân sự và không có đoàn viên vi phạm pháp luật',
    max_score: 6,
    evaluation_method: 'Báo cáo rà soát phối hợp Quân sự - Công an',
    evidence_requirement: 'Văn bản ký kết liên tịch hoặc biên bản họp ấp',
    scoring_rule: 'Không có đoàn viên vi phạm: 6 điểm; có 1 đoàn viên vi phạm: trừ 3 điểm',
    deadline: getRelativeDate(30),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 3 (Môi trường)
  {
    id: 'sub_crit_3_1',
    criterion_id: 'crit_3',
    condition_text: 'Thực hiện ít nhất 02 công trình/phần việc thanh niên bảo vệ môi trường, dọn dẹp kênh rạch hoặc trồng cây',
    max_score: 8,
    evaluation_method: 'Nghiệm thu thực tế và hồ sơ ảnh chụp GPS',
    evidence_requirement: 'Ảnh chụp trước/sau công trình có toạ độ GPS và xác nhận của Ban nhân dân ấp',
    scoring_rule: '2 công trình: 8 điểm; 1 công trình: 4 điểm',
    deadline: getRelativeDate(7), // Gần hạn
    unit_type_id: 'residential',
    unit_id: null,
    unit_type_ids: ['residential'],
    unit_ids: [],
  },
  {
    id: 'sub_crit_3_2',
    criterion_id: 'crit_3',
    condition_text: 'Tổ chức phong trào Cổng trường an toàn giao thông và Trường học không khói thuốc',
    max_score: 8,
    evaluation_method: 'Biên bản kiểm tra liên ngành xã - trường',
    evidence_requirement: 'Kế hoạch đội cờ đỏ xung kích + ảnh duy trì',
    scoring_rule: 'Duy trì tốt cả học kỳ: 8 điểm',
    deadline: getRelativeDate(14),
    unit_type_id: 'school',
    unit_id: null,
    unit_type_ids: ['school'],
    unit_ids: [],
  },
  // Tiêu chí 4 (Chuyển đổi số)
  {
    id: 'sub_crit_4_1',
    criterion_id: 'crit_4',
    condition_text: 'Tổ công nghệ số cộng đồng hướng dẫn người dân kích hoạt VNeID mức 2 đạt chỉ tiêu giao',
    max_score: 10,
    evaluation_method: 'Số liệu đối soát từ Công an xã',
    evidence_requirement: 'Bảng thống kê số lượt kích hoạt có xác nhận Trưởng Công an xã',
    scoring_rule: 'Đạt từ 95% chỉ tiêu: 10 điểm; Đạt từ 80-94%: 7 điểm; dưới 80%: 4 điểm',
    deadline: getRelativeDate(3), // Rất gấp (cam)
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  {
    id: 'sub_crit_4_2',
    criterion_id: 'crit_4',
    condition_text: '100% đoàn viên tham gia cài đặt và sử dụng App Sổ tay Đoàn viên điện tử',
    max_score: 6,
    evaluation_method: 'Trích xuất hệ thống quản trị Trung ương Đoàn',
    evidence_requirement: 'Ảnh chụp màn hình danh sách đoàn viên đã đồng bộ CCCD',
    scoring_rule: '100%: 6 điểm; 90-99%: 4 điểm; dưới 90%: 0 điểm',
    deadline: getRelativeDate(1), // Hạn trong 1 ngày (đỏ)
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 5
  {
    id: 'sub_crit_5_1',
    criterion_id: 'crit_5',
    condition_text: 'Vận động trao tặng ít nhất 05 suất quà cho học sinh có hoàn cảnh khó khăn hoặc gia đình chính sách',
    max_score: 5,
    evaluation_method: 'Danh sách ký nhận quà và hình ảnh trao tặng',
    evidence_requirement: 'Biên bản bàn giao quà + ảnh trao thực tế',
    scoring_rule: '>= 5 suất: 5 điểm; < 5 suất: 1 điểm/suất',
    deadline: getRelativeDate(20),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 6
  {
    id: 'sub_crit_6_1',
    criterion_id: 'crit_6',
    condition_text: 'Hoàn thành chỉ tiêu kết nạp đoàn viên mới theo chỉ tiêu Đoàn xã giao năm 2026',
    max_score: 8,
    evaluation_method: 'Hồ sơ kết nạp và Nghị quyết kết nạp',
    evidence_requirement: 'Bản sao Nghị quyết kết nạp đoàn viên mới + Sổ đoàn viên',
    scoring_rule: 'Đạt 100% chỉ tiêu: 8 điểm; Đạt 70-99%: 5 điểm',
    deadline: getRelativeDate(45),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 7
  {
    id: 'sub_crit_7_1',
    criterion_id: 'crit_7',
    condition_text: 'Duy trì sinh hoạt Chi đoàn định kỳ hàng tháng đầy đủ (tối thiểu 10 kỳ/năm)',
    max_score: 6,
    evaluation_method: 'Kiểm tra sổ Nghị quyết chi đoàn và nhật ký điện tử',
    evidence_requirement: 'Sổ biên bản họp chi đoàn có chữ ký chủ tọa, thư ký',
    scoring_rule: 'Đầy đủ hàng tháng: 6 điểm; thiếu 1 tháng: trừ 1 điểm',
    deadline: getRelativeDate(55),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
  // Tiêu chí 8
  {
    id: 'sub_crit_8_1',
    criterion_id: 'crit_8',
    condition_text: 'Giới thiệu ít nhất 01 đoàn viên ưu tú cho Chi bộ xem xét kết nạp Đảng',
    max_score: 8,
    evaluation_method: 'Biên bản giới thiệu đoàn viên ưu tú và danh sách tiếp nhận của Cấp uỷ',
    evidence_requirement: 'Nghị quyết giới thiệu của Chi đoàn + ý kiến nhận xét của Chi bộ',
    scoring_rule: 'Có kết nạp được Đảng viên mới: 8 điểm; Đã học cảm tình Đảng: 5 điểm',
    deadline: getRelativeDate(50),
    unit_type_id: null,
    unit_id: null,
    unit_type_ids: [],
    unit_ids: [],
  },
];

// 10. Tasks (5 nhiệm vụ)
// 3 "published" (due +2 days, +9 days, -3 days)
// 1 "draft" (+15 days)
// 1 "closed" (-14 days)
export const mockTasks: Task[] = [
  {
    id: 'task_1',
    title: 'Chiến dịch Ra quân Chuyển đổi số & Cài đặt VNeID đợt cao điểm',
    content: 'Đoàn xã phát động đợt cao điểm tuyên truyền, hỗ trợ kích hoạt tài khoản định danh điện tử VNeID mức 2 cho các hộ dân và người cao tuổi trên địa bàn xã. Yêu cầu lập tổ hỗ trợ lưu động đến từng nhà.',
    due_date: getRelativeDate(2), // Còn 2 ngày (cam)
    assigned_by: keyMemberIds.biThuXa,
    assigned_at: getRelativeDate(-5),
    status: 'published',
    reminder_days: [7, 3, 1],
    target: 'Mỗi chi đoàn hỗ trợ tối thiểu 30 người dân hoàn tất kích hoạt tài khoản VNeID',
    evaluation_criteria: 'Số lượt kích hoạt có đối soát danh sách; hình ảnh hoạt động có ghim GPS tại địa bàn ấp.',
    max_score: 10,
    lat: 9.1824,
    lng: 105.1528,
    closed_by: null,
    closed_at: null,
    submit_scope: 'assigned',
  },
  {
    id: 'task_2',
    title: 'Ngày Thứ Bảy Tình Nguyện: Dọn vệ sinh môi trường tuyến kênh chính',
    content: 'Toàn bộ chi đoàn đồng loạt ra quân dọn sạch bèo, rác thải nhựa tại tuyến kênh nội đồng trung tâm xã, thu gom tiêu hủy đúng nơi quy định, khơi thông dòng chảy phục vụ sản xuất.',
    due_date: getRelativeDate(-3), // Quá hạn 3 ngày (đỏ)
    assigned_by: keyMemberIds.phoBiThu1,
    assigned_at: getRelativeDate(-10),
    status: 'published',
    reminder_days: [7, 3, 1],
    target: 'Mỗi chi đoàn đảm nhận ít nhất 200m bờ kênh hoặc trục đường liên ấp',
    evaluation_criteria: 'Hình ảnh trước và sau khi dọn rác; số lượng đoàn viên tham gia thực tế.',
    max_score: 8,
    lat: 9.1852,
    lng: 105.1565,
    closed_by: null,
    closed_at: null,
    submit_scope: 'assigned',
  },
  {
    id: 'task_3',
    title: 'Ngày hội Thanh niên các Dân tộc Tân Phú & Giao lưu Thể thao',
    content: 'Tổ chức giải bóng chuyền thanh niên, giao lưu văn nghệ truyền thống nhân kỷ niệm ngày truyền thống Hội LHTN Việt Nam và thắt chặt tinh thần đoàn kết thanh niên các tôn giáo, dân tộc.',
    due_date: getRelativeDate(9), // Còn 9 ngày
    assigned_by: keyMemberIds.phoBiThu1,
    assigned_at: getRelativeDate(-2),
    status: 'published',
    reminder_days: [7, 3, 1],
    target: '100% chi đoàn cử đội vận động viên và đoàn viên cổ vũ tham gia',
    evaluation_criteria: 'Có lập danh sách đội hình; nộp ảnh chụp khai mạc và thi đấu.',
    max_score: 6,
    lat: 9.1798,
    lng: 105.1492,
    closed_by: null,
    closed_at: null,
    submit_scope: 'assigned',
  },
  {
    id: 'task_4',
    title: 'Tập huấn Kỹ năng sinh hoạt hè và phòng chống tai nạn đuối nước trẻ em',
    content: 'Biên soạn tài liệu và chuẩn bị đội ngũ cán bộ Đoàn - Đội phụ trách thiếu nhi tại các ấp, phối hợp trường học tổ chức các lớp dạy bơi miễn phí cho học sinh vùng sông nước.',
    due_date: getRelativeDate(15),
    assigned_by: keyMemberIds.phoBiThu2,
    assigned_at: getRelativeDate(-1),
    status: 'draft',
    reminder_days: [7, 3, 1],
    target: 'Chuẩn bị kế hoạch chi tiết trước khi công bố ra các chi đoàn',
    max_score: 5,
    lat: 9.1811,
    lng: 105.1519,
    closed_by: null,
    closed_at: null,
    submit_scope: 'assigned',
  },
  {
    id: 'task_5',
    title: 'Công trình Thanh niên "Thắp sáng đường quê" tuyến Ấp 1 - Ấp 4',
    content: 'Thi công lắp đặt 40 bóng đèn năng lượng mặt trời dọc trục đường dân sinh liên ấp, kinh phí xã hội hóa từ đoàn viên và bà con nhân dân đóng góp.',
    due_date: getRelativeDate(-14),
    assigned_by: keyMemberIds.biThuXa,
    assigned_at: getRelativeDate(-28),
    status: 'closed',
    reminder_days: [7, 3, 1],
    target: 'Hoàn thành và bàn giao cho Ban nhân dân ấp quản lý',
    max_score: 10,
    lat: 9.1876,
    lng: 105.1611,
    closed_by: null,
    closed_at: null,
    submit_scope: 'assigned',
  },
];

// Giao nhiệm vụ cho các chi đoàn (task_units)
// Task 1: giao cho 31 chi đoàn toàn xã
// Task 2: giao cho 25 chi đoàn ấp (dân cư)
// Task 3: giao cho 31 chi đoàn
// Task 4: draft
// Task 5: giao cho 4 chi đoàn: unit_ap_1, unit_ap_2, unit_ap_3, unit_ap_4
export const mockTaskUnits: TaskUnit[] = [
  ...mockUnits.map(u => ({ task_id: 'task_1', unit_id: u.id })),
  ...mockUnits.filter(u => u.unit_type_id === 'residential').map(u => ({ task_id: 'task_2', unit_id: u.id })),
  ...mockUnits.map(u => ({ task_id: 'task_3', unit_id: u.id })),
  { task_id: 'task_5', unit_id: 'unit_ap_1' },
  { task_id: 'task_5', unit_id: 'unit_ap_2' },
  { task_id: 'task_5', unit_id: 'unit_ap_3' },
  { task_id: 'task_5', unit_id: 'unit_ap_4' },
];

// Bảng nối task_sub_criteria (tự cộng điểm):
// Task 1 gắn 2 tiêu chí con: sub_crit_4_1 (+5đ) và sub_crit_4_2 (+3đ)
// Task 2 cố ý KHÔNG GẮN TIÊU CHÍ NÀO theo yêu cầu đề bài!
// Task 3 gắn 1 tiêu chí: sub_crit_1_2 (+3đ)
export const mockTaskSubCriteria: TaskSubCriterion[] = [
  { task_id: 'task_1', sub_criterion_id: 'sub_crit_4_1', contribution_score: 5 },
  { task_id: 'task_1', sub_criterion_id: 'sub_crit_4_2', contribution_score: 3 },
  { task_id: 'task_3', sub_criterion_id: 'sub_crit_1_2', contribution_score: 3 },
];

// Bảng đăng ký tham gia nhiệm vụ của đoàn viên (task_registrations)
export const mockTaskRegistrations: TaskRegistration[] = [
  // Task 1: Ra quân VNeID
  { id: 'reg_1_1', task_id: 'task_1', member_id: keyMemberIds.biThuXa, is_joining: true },
  { id: 'reg_1_2', task_id: 'task_1', member_id: 'mem_unit_ap_1_1', is_joining: true },
  { id: 'reg_1_3', task_id: 'task_1', member_id: 'mem_unit_ap_1_2', is_joining: true },
  { id: 'reg_1_4', task_id: 'task_1', member_id: 'mem_unit_ap_2_1', is_joining: true },
  { id: 'reg_1_5', task_id: 'task_1', member_id: 'mem_unit_ap_2_2', is_joining: false },
  { id: 'reg_1_6', task_id: 'task_1', member_id: 'mem_unit_ap_3_1', is_joining: true },
  { id: 'reg_1_7', task_id: 'task_1', member_id: 'mem_unit_ap_3_2', is_joining: true },
  { id: 'reg_1_8', task_id: 'task_1', member_id: 'mem_unit_school_thcs_1', is_joining: true },
  { id: 'reg_1_9', task_id: 'task_1', member_id: keyMemberIds.phoBiThu2, is_joining: true },
  // Task 3: Ngày hội Thể thao
  { id: 'reg_3_1', task_id: 'task_3', member_id: keyMemberIds.phoBiThu1, is_joining: true },
  { id: 'reg_3_2', task_id: 'task_3', member_id: 'mem_unit_ap_4_1', is_joining: true },
  { id: 'reg_3_3', task_id: 'task_3', member_id: keyMemberIds.uyVienBCH2, is_joining: true },
  { id: 'reg_3_4', task_id: 'task_3', member_id: 'mem_unit_ap_5_1', is_joining: false },
  { id: 'reg_3_5', task_id: 'task_3', member_id: 'mem_unit_health_tramyte_1', is_joining: true },
];

// 11. Task Results & Criterion Submissions
// Các tình huống cố ý để test:
// - ~7 mục chờ duyệt (4 kết quả nhiệm vụ pending + 3 điểm tự chấm pending)
// - 1 kết quả bị từ chối kèm lý do (rejected)
// - 1 minh chứng thiếu GPS
// - 2 minh chứng trùng file_hash
// - 1 minh chứng chụp sau hạn
// - Chi đoàn nộp đủ (Ấp 1, Ấp 2)
// - Chi đoàn còn 3 ngày chưa nộp (Ấp 5)
// - Chi đoàn trễ 2 ngày (Ấp 8)

export const mockTaskResults: TaskResult[] = [
  // 1. Pending result - Chi đoàn Ấp 3 (Task 1) -> TEST CASE: Minh chứng trùng ảnh với mục khác
  {
    id: 'res_task1_ap3',
    task_id: 'task_1',
    unit_id: 'unit_ap_3',
    completed_at: getRelativeDate(-1, -2),
    is_overdue: false,
    lat: 9.1829,
    lng: 105.1534,
    note: 'Chi đoàn đã triển khai tổ công nghệ số đi từng hộ gia đình ấp 3, kích hoạt được 36 tài khoản VNeID mức 2.',
    participant_count: 12,
    submitted_by: 'mem_unit_ap_3_1',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  },
  // 2. Pending result - Chi đoàn Trường THCS Tân Phú (Task 1) -> TEST CASE: Thiếu GPS trên 1 ảnh
  {
    id: 'res_task1_thcs',
    task_id: 'task_1',
    unit_id: 'unit_school_thcs',
    completed_at: getRelativeDate(0, -4),
    is_overdue: false,
    lat: 9.1815,
    lng: 105.1512,
    note: 'Các thầy cô đoàn viên phối hợp hướng dẫn phụ huynh học sinh cài đặt ứng dụng trong buổi họp.',
    participant_count: 16,
    submitted_by: 'mem_unit_school_thcs_1',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  },
  // 3. Pending result - Chi đoàn Ấp 6 (Task 2) -> TEST CASE: Chụp sau hạn (deadline was -3 days, chụp lúc -1 day)
  {
    id: 'res_task2_ap6',
    task_id: 'task_2',
    unit_id: 'unit_ap_6',
    completed_at: getRelativeDate(-1),
    is_overdue: true, // Nộp trễ so với hạn task 2 (-3 days)
    lat: 9.186,
    lng: 105.1578,
    note: 'Chi đoàn ra quân muộn do vướng lịch thu hoạch lúa của bà con. Đã vớt rác tuyến kênh 250m.',
    participant_count: 8,
    submitted_by: 'mem_unit_ap_6_1',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  },
  // 4. Pending result - Chi đoàn Công an xã (Task 1)
  {
    id: 'res_task1_police',
    task_id: 'task_1',
    unit_id: 'unit_police_xano',
    completed_at: getRelativeDate(-1, -6),
    is_overdue: false,
    lat: 9.1832,
    lng: 105.1541,
    note: 'Đội hình thanh niên Công an xã trực tiếp hướng dẫn tại bộ phận một cửa và lưu động ban đêm.',
    participant_count: 9,
    submitted_by: keyMemberIds.phoBiThu2,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
  },
  // 5. Approved result - Chi đoàn Ấp 1 (Task 1) -> Đã duyệt
  {
    id: 'res_task1_ap1',
    task_id: 'task_1',
    unit_id: 'unit_ap_1',
    completed_at: getRelativeDate(-3),
    is_overdue: false,
    lat: 9.1822,
    lng: 105.1525,
    note: 'Hoàn thành xuất sắc chỉ tiêu 45 lượt cài đặt tại nhà văn hoá ấp 1.',
    participant_count: 14,
    submitted_by: keyMemberIds.biThuXa,
    status: 'approved',
    reviewed_by: keyMemberIds.phoBiThu1,
    reviewed_at: getRelativeDate(-2),
    review_note: 'Hồ sơ đầy đủ, đối soát khớp với Công an xã. Khen ngợi tinh thần xung kích.',
  },
  // 6. Rejected result - Chi đoàn Ấp 7 (Task 2) -> TEST CASE: Đã bị từ chối kèm lý do
  {
    id: 'res_task2_ap7',
    task_id: 'task_2',
    unit_id: 'unit_ap_7',
    completed_at: getRelativeDate(-2),
    is_overdue: true,
    lat: 9.187,
    lng: 105.159,
    note: 'Đã hoàn thành dọn vệ sinh đoạn cầu Ấp 7.',
    participant_count: 5,
    submitted_by: keyMemberIds.uyVienBCH1,
    status: 'rejected',
    reviewed_by: keyMemberIds.phoBiThu1,
    reviewed_at: getRelativeDate(-1),
    review_note: 'Ảnh minh chứng không rõ mặt đoàn viên tham gia và không có biên bản xác nhận của Ban nhân dân ấp. Yêu cầu nộp bổ sung!',
  },
  // 7. Approved result - Chi đoàn Ấp 2 (Task 1)
  {
    id: 'res_task1_ap2',
    task_id: 'task_1',
    unit_id: 'unit_ap_2',
    completed_at: getRelativeDate(-3, -1),
    is_overdue: false,
    lat: 9.1825,
    lng: 105.153,
    note: 'Đã kích hoạt 38 tài khoản VNeID.',
    participant_count: 11,
    submitted_by: 'mem_unit_ap_2_1',
    status: 'approved',
    reviewed_by: keyMemberIds.phoBiThu1,
    reviewed_at: getRelativeDate(-2),
    review_note: 'Đạt yêu cầu.',
  },
];

// 12. Criterion Submissions (Điểm tự chấm từ các Chi đoàn)
export const mockCriterionSubmissions: CriterionSubmission[] = [
  // 1. Pending - Chi đoàn Ấp 4 tự chấm sub_crit_3_1 (Công trình môi trường, max 8đ)
  {
    id: 'subm_ap4_crit3_1',
    sub_criterion_id: 'sub_crit_3_1',
    unit_id: 'unit_ap_4',
    self_score: 8,
    approved_score: null,
    status: 'pending',
    note: 'Chi đoàn đã hoàn thành 02 đợt ra quân trồng 100 cây hoàng yến và nạo vét tuyến mương dài 300m.',
    submitted_by: 'mem_unit_ap_4_1',
    submitted_at: getRelativeDate(-1, -5),
    reviewed_by: null,
    reviewed_at: null,
  },
  // 2. Pending - Chi đoàn THPT Nguyễn Du tự chấm sub_crit_3_2 (Trường học an toàn, max 8đ)
  {
    id: 'subm_thpt_crit3_2',
    sub_criterion_id: 'sub_crit_3_2',
    unit_id: 'unit_school_thpt',
    self_score: 8,
    approved_score: null,
    status: 'pending',
    note: 'Đội thanh niên tình nguyện duy trì chốt trực an toàn giao thông trước cổng trường 5 ngày/tuần.',
    submitted_by: keyMemberIds.uyVienBCH2,
    submitted_at: getRelativeDate(0, -3),
    reviewed_by: null,
    reviewed_at: null,
  },
  // 3. Pending - Chi đoàn Trạm Y tế tự chấm sub_crit_1_1 (Học tập Bác, max 5đ)
  {
    id: 'subm_yte_crit1_1',
    sub_criterion_id: 'sub_crit_1_1',
    unit_id: 'unit_health_tramyte',
    self_score: 5,
    approved_score: null,
    status: 'pending',
    note: '11/11 đoàn viên y tế hoàn thành sổ đăng ký tu dưỡng đạo đức và bài thu hoạch chuyên đề năm 2026.',
    submitted_by: keyMemberIds.uyVienBTV2,
    submitted_at: getRelativeDate(-2, -1),
    reviewed_by: null,
    reviewed_at: null,
  },
  // 4. Approved - Chi đoàn Ấp 1 tự chấm sub_crit_1_1 (Đã duyệt 5đ)
  {
    id: 'subm_ap1_crit1_1',
    sub_criterion_id: 'sub_crit_1_1',
    unit_id: 'unit_ap_1',
    self_score: 5,
    approved_score: 5,
    status: 'approved',
    note: 'Nộp đầy đủ hồ sơ cam kết và bài viết chất lượng cao.',
    submitted_by: keyMemberIds.biThuXa,
    submitted_at: getRelativeDate(-6),
    reviewed_by: keyMemberIds.phoBiThu1,
    reviewed_at: getRelativeDate(-4),
    review_note: 'Đã kiểm tra đối chiếu sổ sách, duyệt tối đa 5 điểm.',
  },
];

// 13. Evidences (Minh chứng)
// ĐÚNG MỘT trong task_id hoặc submission_id CÓ GIÁ TRỊ!
// Test cases:
// - 1 ảnh thiếu GPS (lat: null, lng: null) -> ev_thcs_2
// - 2 ảnh trùng file_hash ("hash_dupl_sha256_99x") -> ev_ap3_1 và ev_ap4_subm_2
// - 1 ảnh chụp sau hạn -> ev_ap6_1
export const mockEvidences: Evidence[] = [
  // Gắn với res_task1_ap3 (Chi đoàn Ấp 3 - task 1)
  {
    id: 'ev_ap3_1',
    task_id: 'task_1',
    submission_id: null,
    member_id: 'mem_unit_ap_3_1',
    unit_id: 'unit_ap_3',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/task1_ap3_01.jpg',
    url: 'https://picsum.photos/seed/task1_ap3_01/640/480',
    file_name: 'vneid_ho_dan_ap3_01.jpg',
    captured_at: getRelativeDate(-1, -3),
    uploaded_at: getRelativeDate(-1, -2),
    lat: 9.1829,
    lng: 105.1534,
    source: 'camera',
    file_hash: 'hash_dupl_sha256_99x', // TRÙNG FILE HASH VỚI MINH CHỨNG KHÁC!
    is_locked: false,
  },
  {
    id: 'ev_ap3_2',
    task_id: 'task_1',
    submission_id: null,
    member_id: 'mem_unit_ap_3_1',
    unit_id: 'unit_ap_3',
    evidence_type: 'report',
    storage_path: '/evidences/2026/task1_ap3_danhsach.pdf',
    url: 'https://picsum.photos/seed/task1_ap3_doc/640/480',
    file_name: 'Danh_sach_36_ho_dan_kich_hoat.pdf',
    captured_at: getRelativeDate(-1, -4),
    uploaded_at: getRelativeDate(-1, -2),
    lat: 9.183,
    lng: 105.1535,
    source: 'upload',
    file_hash: 'hash_sha256_ap3_doc8821',
    is_locked: false,
  },

  // Gắn với res_task1_thcs (THCS Tân Phú)
  {
    id: 'ev_thcs_1',
    task_id: 'task_1',
    submission_id: null,
    member_id: 'mem_unit_school_thcs_1',
    unit_id: 'unit_school_thcs',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/task1_thcs_01.jpg',
    url: 'https://picsum.photos/seed/task1_thcs_01/640/480',
    file_name: 'huong_dan_phu_huynh_cai_dat.jpg',
    captured_at: getRelativeDate(0, -5),
    uploaded_at: getRelativeDate(0, -4),
    lat: 9.1815,
    lng: 105.1512,
    source: 'camera',
    file_hash: 'hash_sha256_thcs_9941',
    is_locked: false,
  },
  {
    id: 'ev_thcs_2',
    task_id: 'task_1',
    submission_id: null,
    member_id: 'mem_unit_school_thcs_1',
    unit_id: 'unit_school_thcs',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/task1_thcs_02.jpg',
    url: 'https://picsum.photos/seed/task1_thcs_02/640/480',
    file_name: 'hoat_dong_doi_hinh_ao_xanh.jpg',
    captured_at: getRelativeDate(0, -5),
    uploaded_at: getRelativeDate(0, -4),
    lat: null, // THIẾU GPS CỐ Ý!
    lng: null, // THIẾU GPS CỐ Ý!
    source: 'upload',
    file_hash: 'hash_sha256_thcs_8822_nogps',
    is_locked: false,
  },

  // Gắn với res_task2_ap6 (Chi đoàn Ấp 6 - Task 2)
  // Deadline của task 2 là getRelativeDate(-3). Minh chứng này chụp lúc getRelativeDate(-1) -> CHỤP SAU HẠN!
  {
    id: 'ev_ap6_1',
    task_id: 'task_2',
    submission_id: null,
    member_id: 'mem_unit_ap_6_1',
    unit_id: 'unit_ap_6',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/task2_ap6_01.jpg',
    url: 'https://picsum.photos/seed/task2_ap6_01/640/480',
    file_name: 'vot_beo_tuyen_kenh_ap6.jpg',
    captured_at: getRelativeDate(-1, -3), // CHỤP SAU HẠN CHÓT CỦA NHIỆM VỤ!
    uploaded_at: getRelativeDate(-1),
    lat: 9.186,
    lng: 105.1578,
    source: 'camera',
    file_hash: 'hash_sha256_ap6_late774',
    is_locked: false,
  },

  // Gắn với res_task1_police (Chi đoàn Công an)
  {
    id: 'ev_police_1',
    task_id: 'task_1',
    submission_id: null,
    member_id: keyMemberIds.phoBiThu2,
    unit_id: 'unit_police_xano',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/task1_police_01.jpg',
    url: 'https://picsum.photos/seed/task1_police_01/640/480',
    file_name: 'bo_phan_mot_cua_huong_dan_vneid.jpg',
    captured_at: getRelativeDate(-1, -7),
    uploaded_at: getRelativeDate(-1, -6),
    lat: 9.1832,
    lng: 105.1541,
    source: 'camera',
    file_hash: 'hash_sha256_police_3321',
    is_locked: false,
  },

  // Gắn với điểm tự chấm subm_ap4_crit3_1 (Ấp 4 tự chấm tiêu chí môi trường)
  {
    id: 'ev_ap4_subm_1',
    task_id: null,
    submission_id: 'subm_ap4_crit3_1',
    member_id: 'mem_unit_ap_4_1',
    unit_id: 'unit_ap_4',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/subm_ap4_cay_xanh.jpg',
    url: 'https://picsum.photos/seed/subm_ap4_cay_xanh/640/480',
    file_name: 'tuyen_duong_cay_hoang_yen_ap4.jpg',
    captured_at: getRelativeDate(-2, -6),
    uploaded_at: getRelativeDate(-1, -5),
    lat: 9.184,
    lng: 105.1555,
    source: 'camera',
    file_hash: 'hash_sha256_ap4_tree411',
    is_locked: false,
  },
  {
    id: 'ev_ap4_subm_2',
    task_id: null,
    submission_id: 'subm_ap4_crit3_1',
    member_id: 'mem_unit_ap_4_1',
    unit_id: 'unit_ap_4',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/subm_ap4_muong.jpg',
    url: 'https://picsum.photos/seed/subm_ap4_muong/640/480',
    file_name: 'nao_vet_kenh_ap4.jpg',
    captured_at: getRelativeDate(-2, -5),
    uploaded_at: getRelativeDate(-1, -5),
    lat: 9.1842,
    lng: 105.1558,
    source: 'camera',
    file_hash: 'hash_dupl_sha256_99x', // TRÙNG FILE HASH VỚI MINH CHỨNG ev_ap3_1 CỐ Ý!
    is_locked: false,
  },

  // Gắn với điểm tự chấm subm_thpt_crit3_2 (THPT Nguyễn Du)
  {
    id: 'ev_thpt_subm_1',
    task_id: null,
    submission_id: 'subm_thpt_crit3_2',
    member_id: keyMemberIds.uyVienBCH2,
    unit_id: 'unit_school_thpt',
    evidence_type: 'photo',
    storage_path: '/evidences/2026/subm_thpt_atgt.jpg',
    url: 'https://picsum.photos/seed/subm_thpt_atgt/640/480',
    file_name: 'doi_co_do_chot_cong_truong.jpg',
    captured_at: getRelativeDate(0, -4),
    uploaded_at: getRelativeDate(0, -3),
    lat: 9.1802,
    lng: 105.1488,
    source: 'camera',
    file_hash: 'hash_sha256_thpt_unique993',
    is_locked: false,
  },

  // Gắn với điểm tự chấm subm_yte_crit1_1 (Trạm Y tế)
  {
    id: 'ev_yte_subm_1',
    task_id: null,
    submission_id: 'subm_yte_crit1_1',
    member_id: keyMemberIds.uyVienBTV2,
    unit_id: 'unit_health_tramyte',
    evidence_type: 'report',
    storage_path: '/evidences/2026/subm_yte_chuyende.pdf',
    url: 'https://picsum.photos/seed/subm_yte_chuyende/640/480',
    file_name: 'Bao_cao_hoc_tap_Bac_tram_y_te.pdf',
    captured_at: getRelativeDate(-2, -3),
    uploaded_at: getRelativeDate(-2, -1),
    lat: 9.1827,
    lng: 105.1539,
    source: 'upload',
    file_hash: 'hash_sha256_yte_pdf7711',
    is_locked: false,
  },
];

// 14. Notifications
export const mockNotifications: Notification[] = [
  {
    id: 'notif_1',
    recipient_id: keyMemberIds.biThuXa,
    type: 'review_request',
    level: 'yellow',
    title: 'Minh chứng mới cần duyệt',
    body: 'Chi đoàn Ấp 3 vừa gửi kết quả thực hiện nhiệm vụ Ra quân Chuyển đổi số VNeID.',
    task_id: 'task_1',
    sub_criterion_id: null,
    is_read: false,
    created_at: getRelativeDate(-1, -2),
  },
  {
    id: 'notif_2',
    recipient_id: keyMemberIds.biThuXa,
    type: 'overdue',
    level: 'red',
    title: 'Cảnh báo quá hạn nhiệm vụ',
    body: 'Nhiệm vụ "Ngày Thứ Bảy Tình Nguyện" đã hết hạn 3 ngày. Hiện còn 19 chi đoàn chưa nộp báo cáo.',
    task_id: 'task_2',
    sub_criterion_id: null,
    is_read: false,
    created_at: getRelativeDate(-1, -8),
  },
  {
    id: 'notif_3',
    recipient_id: keyMemberIds.biThuXa,
    type: 'reminder',
    level: 'orange',
    title: 'Sắp đến hạn nhiệm vụ (còn 2 ngày)',
    body: 'Nhiệm vụ "Chiến dịch Ra quân Chuyển đổi số" sẽ đóng tiếp nhận vào 23:59 ngày mai.',
    task_id: 'task_1',
    sub_criterion_id: null,
    is_read: true,
    created_at: getRelativeDate(-2),
  },
  {
    id: 'notif_4',
    recipient_id: keyMemberIds.biThuXa,
    type: 'review_request',
    level: 'yellow',
    title: 'Hồ sơ tự chấm điểm mới',
    body: 'Chi đoàn Ấp 4 đã gửi hồ sơ tự chấm cho Tiêu chí con 3.1 (Công trình môi trường).',
    task_id: null,
    sub_criterion_id: 'sub_crit_3_1',
    is_read: false,
    created_at: getRelativeDate(-1, -5),
  },
  {
    id: 'notif_5',
    recipient_id: keyMemberIds.biThuXa,
    type: 'system',
    level: 'yellow',
    title: 'Cập nhật hệ thống',
    body: 'Phiên bản quản trị Đoàn xã 2026 đã đồng bộ dữ liệu chỉ tiêu kết nạp Đoàn viên mới.',
    task_id: null,
    sub_criterion_id: null,
    is_read: true,
    created_at: getRelativeDate(-4),
  },
];

// 15. Warnings (Cảnh báo chi đoàn)
export const mockWarnings: Warning[] = [
  {
    id: 'warn_1',
    unit_id: 'unit_ap_8',
    task_id: 'task_2',
    sub_criterion_id: null,
    codes: ['OVERDUE'],
    level: 'red',
    message: 'Chi đoàn Ấp 8 chưa gửi kết quả nhiệm vụ Ngày Thứ Bảy Tình Nguyện (trễ 3 ngày)',
    is_read: false,
    resolved_at: null,
  },
  {
    id: 'warn_2',
    unit_id: 'unit_ap_9',
    task_id: 'task_2',
    sub_criterion_id: null,
    codes: ['OVERDUE'],
    level: 'red',
    message: 'Chi đoàn Ấp 9 chưa gửi kết quả nhiệm vụ Ngày Thứ Bảy Tình Nguyện (trễ 3 ngày)',
    is_read: false,
    resolved_at: null,
  },
  {
    id: 'warn_3',
    unit_id: 'unit_ap_5',
    task_id: 'task_1',
    sub_criterion_id: null,
    codes: ['DUE_SOON'],
    level: 'orange',
    message: 'Chi đoàn Ấp 5 còn 2 ngày để hoàn thành chỉ tiêu Chuyển đổi số VNeID',
    is_read: false,
    resolved_at: null,
  },
  {
    id: 'warn_4',
    unit_id: 'unit_ap_10',
    task_id: 'task_1',
    sub_criterion_id: null,
    codes: ['DUE_SOON'],
    level: 'orange',
    message: 'Chi đoàn Ấp 10 còn 2 ngày để hoàn thành chỉ tiêu Chuyển đổi số VNeID',
    is_read: false,
    resolved_at: null,
  },
  {
    id: 'warn_5',
    unit_id: 'unit_ap_11',
    task_id: null,
    sub_criterion_id: 'sub_crit_4_2',
    codes: ['DUE_SOON'],
    level: 'red',
    message: 'Chi đoàn Ấp 11 còn ≤1 ngày đến hạn chỉ tiêu Đoàn viên cài App Sổ tay Đoàn viên',
    is_read: false,
    resolved_at: null,
  },
  {
    id: 'warn_6',
    unit_id: 'unit_ap_12',
    task_id: null,
    sub_criterion_id: 'sub_crit_3_1',
    codes: ['DUE_SOON'],
    level: 'yellow',
    message: 'Chi đoàn Ấp 12 còn 7 ngày đến hạn báo cáo Công trình Thanh niên môi trường',
    is_read: true,
    resolved_at: null,
  },
];

// 16. Audit Logs (Nhật ký thao tác)
export const mockAuditLogs: AuditLog[] = [
  {
    id: 'log_1',
    actor_id: keyMemberIds.phoBiThu1,
    actor_role: 'admin',
    action: 'Duyệt kết quả nhiệm vụ',
    table_name: 'task_results',
    row_id: 'res_task1_ap1',
    old_value: 'status: pending',
    new_value: 'status: approved, reviewed_by: mem_bch_2',
    created_at: getRelativeDate(-2),
  },
  {
    id: 'log_2',
    actor_id: keyMemberIds.phoBiThu1,
    actor_role: 'admin',
    action: 'Từ chối kết quả nhiệm vụ',
    table_name: 'task_results',
    row_id: 'res_task2_ap7',
    old_value: 'status: pending',
    new_value: 'status: rejected, review_note: Ảnh không rõ mặt đoàn viên',
    created_at: getRelativeDate(-1),
  },
  {
    id: 'log_3',
    actor_id: keyMemberIds.biThuXa,
    actor_role: 'super_admin',
    action: 'Ban hành nhiệm vụ mới',
    table_name: 'tasks',
    row_id: 'task_3',
    old_value: 'status: draft',
    new_value: 'status: published',
    created_at: getRelativeDate(-2, -3),
  },
  {
    id: 'log_4',
    actor_id: keyMemberIds.phoBiThu1,
    actor_role: 'admin',
    action: 'Duyệt điểm tự chấm tiêu chí',
    table_name: 'criterion_submissions',
    row_id: 'subm_ap1_crit1_1',
    old_value: 'status: pending, approved_score: null',
    new_value: 'status: approved, approved_score: 5',
    created_at: getRelativeDate(-4),
  },
  {
    id: 'log_5',
    actor_id: keyMemberIds.biThuXa,
    actor_role: 'super_admin',
    action: 'Cập nhật chỉ tiêu năm',
    table_name: 'yearly_settings',
    row_id: '2026',
    old_value: 'new_member_target: 35',
    new_value: 'new_member_target: 40',
    created_at: getRelativeDate(-8),
  },
];

// 17. Reports (Bản chụp báo cáo thống kê)
export const mockReports: Report[] = [
  {
    id: 'rep_1',
    title: 'Báo cáo Thống kê Dữ liệu Đoàn viên năm 2026',
    report_type: 'member_stats',
    type: 'yearly',
    period_start: '2026-01-01',
    period_end: '2026-10-01',
    unit_id: null,
    data: {
      totalMembers: 320,
      partyMembers: 42,
      maleCount: 182,
      femaleCount: 138,
      ageGroup16_20: 85,
      ageGroup21_25: 140,
      ageGroup26_30: 95,
      maturedCount: 28,
    },
    created_by: keyMemberIds.biThuXa,
    created_at: getRelativeDate(-5),
  },
  {
    id: 'rep_2',
    title: 'Báo cáo Tổng kết Nhiệm vụ & Chiến dịch Quý III/2026',
    report_type: 'task_summary',
    type: 'quarterly',
    period_start: '2026-06-01',
    period_end: '2026-09-30',
    unit_id: null,
    data: {
      totalTasks: 5,
      submittedTasksCount: 42,
      approvedCount: 38,
      overdueCount: 4,
    },
    created_by: keyMemberIds.phoBiThu1,
    created_at: getRelativeDate(-12),
  },
  {
    id: 'rep_3',
    title: 'Báo cáo Điểm số Bộ tiêu chí Thi đua Cơ sở năm 2026',
    report_type: 'criteria_summary',
    type: 'yearly',
    period_start: '2026-01-01',
    period_end: '2026-10-09',
    unit_id: null,
    data: {
      totalSubCriteria: 16,
      highestScoreUnit: 'Chi đoàn Ấp 1',
      averageScore: 44.5,
    },
    created_by: keyMemberIds.biThuXa,
    created_at: getRelativeDate(-15),
  },
];
