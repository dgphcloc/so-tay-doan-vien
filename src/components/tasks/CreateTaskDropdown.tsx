import React, { useEffect, useState } from "react";
import {
  Plus,
  ChevronDown,
  Loader2,
  Calendar,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useApp } from "../../context/AppContext";

interface Props {
  subCriterionId: string;
  subName: string;
  maxScore: number;
  unitId: string;
  /** Gọi sau khi tạo thành công để reload tiến độ */
  onCreated?: () => void;
  /**
   * Có giá trị = khoá nút, không mở form. Dùng khi:
   *   - tiêu chí chưa được Đoàn xã giao cho chi đoàn này
   *   - chi đoàn đã tạo nhiệm vụ cho tiêu chí này rồi
   */
  disabledReason?: string;
}

/**
 * Dropdown "Tạo nhiệm vụ" ngay tại chỗ, thay cho việc nhảy sang trang Nhiệm vụ.
 * Nhiệm vụ được tạo ra sẽ tự động gắn với tiêu chí nguồn (quan hệ 1-1)
 * và giao cho chính chi đoàn của bí thư.
 */
export const CreateTaskDropdown: React.FC<Props> = ({
  subCriterionId,
  subName,
  maxScore,
  unitId,
  onCreated,
  disabledReason,
}) => {
  const { createTask, getUnitById, showToast, currentMember } = useApp();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mặc định hạn chót: 30 ngày kể từ hôm nay
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().slice(0, 10));
    setTitle(subName.slice(0, 90));
    setContent("");
    setTarget("");
    setError("");
  }, [open, subName]);

  const unitName = getUnitById(unitId)?.name ?? "";
  const isLocked = !!disabledReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Vui lòng nhập tên nhiệm vụ");
      return;
    }
    if (!dueDate) {
      setError("Vui lòng chọn hạn chót");
      return;
    }
    if (!unitId) {
      setError("Tài khoản chưa gắn với chi đoàn nào");
      return;
    }

    setSaving(true);
    try {
      await createTask(
        {
          title: title.trim(),
          content: content.trim() || subName,
          due_date: new Date(dueDate).toISOString(),
          status: "published",
          reminder_days: [7, 3, 1],
          target: target.trim() || "Hoàn thành tiêu chí được Đoàn xã giao",
          evaluation_criteria: "Có minh chứng ảnh/GPS hoặc biên bản nghiệm thu",
          max_score: maxScore,
          source_sub_criterion_id: subCriterionId,
          submit_scope: "assigned",
          lat: null,
          lng: null,
        },
        [unitId],
        [{ sub_criterion_id: subCriterionId, contribution_score: maxScore }],
      );

      showToast({
        title: "Đã tạo nhiệm vụ",
        description: `Giao cho ${unitName} · gắn tiêu chí ${maxScore} điểm`,
        type: "success",
      });
      setOpen(false);
      onCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(msg);
      showToast({
        title: "Không tạo được nhiệm vụ",
        description: msg,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrink-0 relative">
      <button
        type="button"
        disabled={isLocked}
        onClick={() => {
          if (!isLocked) setOpen((v) => !v);
        }}
        title={
          isLocked
            ? disabledReason
            : "Tạo nhiệm vụ mới gắn với tiêu chí này để giao cho đoàn viên trong chi đoàn"
        }
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${
          isLocked
            ? "bg-slate-200 text-slate-500 cursor-not-allowed"
            : "bg-doan text-white hover:bg-doan-dark"
        }`}
      >
        <Plus className="w-3.5 h-3.5" /> Tạo nhiệm vụ
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Lớp phủ bắt click ra ngoài */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <form
            onSubmit={handleSubmit}
            className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-slate-200 shadow-2xl z-50 p-4 space-y-3 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900">
                Tạo nhiệm vụ từ tiêu chí
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                {subName}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Tối đa {maxScore} điểm
                </span>
                <span className="text-[10px] font-semibold text-doan bg-blue-50 px-1.5 py-0.5 rounded">
                  Giao cho {unitName || "chi đoàn"}
                </span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Tên nhiệm vụ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Tổ chức tuyên truyền phòng chống ma tuý"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-doan focus:bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Nội dung / yêu cầu
              </label>
              <textarea
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Mô tả ngắn gọn việc đoàn viên cần làm..."
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-doan focus:bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Hạn chót <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-doan"
                />
              </div>
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Chỉ tiêu
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="VD: 100% ĐV tham gia"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-doan"
                />
              </div>
            </div>

            {error && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Hủy, không tạo nhiệm vụ"
                className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                title="Phát động nhiệm vụ và gửi thông báo cho chi đoàn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {saving ? "Đang tạo…" : "Phát động ngay"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
