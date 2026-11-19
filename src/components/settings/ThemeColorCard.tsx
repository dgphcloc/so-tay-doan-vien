import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Palette, Check, RotateCcw, Save, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_COLOR,
  THEME_PRESETS,
  applyTheme,
  clearSavedColor,
  getSavedColor,
  isValidHex,
  luminance,
  saveColor,
} from '../../utils/theme';

/**
 * Khối "Màu sắc giao diện" đặt trong trang Cấu hình.
 * Hiện lưu ở trình duyệt (localStorage). Khi làm DB: thay getSavedColor / saveColor / clearSavedColor
 * trong utils/theme.ts bằng đọc/ghi bảng cấu hình.
 */
export const ThemeColorCard: React.FC = () => {
  const { showToast } = useApp();

  const [saved, setSaved] = useState<string | null>(getSavedColor());
  const [color, setColor] = useState<string>(saved ?? DEFAULT_COLOR);
  const [hexText, setHexText] = useState<string>((saved ?? DEFAULT_COLOR).toUpperCase());

  // Xem trước trực tiếp: đổi màu toàn web ngay khi chọn
  useEffect(() => {
    applyTheme(color);
  }, [color]);

  // Rời trang mà chưa bấm Lưu -> trả về màu đã lưu (hoặc màu gốc)
  useEffect(() => {
    return () => {
      applyTheme(getSavedColor() ?? DEFAULT_COLOR);
    };
  }, []);

  const current = (saved ?? DEFAULT_COLOR).toLowerCase();
  const dirty = color.toLowerCase() !== current;
  const tooLight = luminance(color) > 0.55;

  const pick = (c: string) => {
    setColor(c);
    setHexText(c.toUpperCase());
  };

  const handleHexInput = (v: string) => {
    const t = v.startsWith('#') ? v : `#${v}`;
    setHexText(t.toUpperCase());
    if (isValidHex(t)) setColor(t);
  };

  const handleSave = () => {
    if (color.toLowerCase() === DEFAULT_COLOR.toLowerCase()) {
      clearSavedColor();
      setSaved(null);
    } else {
      saveColor(color);
      setSaved(color);
    }
    showToast({ title: 'Đã lưu màu giao diện', description: 'Hiện đang lưu trên trình duyệt này.', type: 'success' });
  };

  const handleReset = () => {
    clearSavedColor();
    setSaved(null);
    pick(DEFAULT_COLOR);
    showToast({ title: 'Đã về màu gốc', type: 'info' });
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#1F5FBF]" />
          Màu sắc giao diện
        </h2>
        {dirty && <span className="text-[11px] text-amber-700 font-semibold">Đang xem thử, chưa lưu</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        {/* Chọn màu */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {THEME_PRESETS.map(p => {
              const active = p.color.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => pick(p.color)}
                  title={`Chọn màu ${p.name}`}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    active ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center justify-center w-full h-9 rounded-lg" style={{ background: p.color }}>
                    {active && <Check className="w-4 h-4 text-white" />}
                  </span>
                  <span className="block mt-1.5 text-center text-[11px] font-semibold text-slate-700">{p.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
              Tự chọn
              <input
                type="color"
                value={color}
                onChange={e => pick(e.target.value)}
                className="w-10 h-10 rounded border border-slate-300 cursor-pointer bg-white"
              />
            </label>
            <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
              Mã màu
              <input
                type="text"
                value={hexText}
                onChange={e => handleHexInput(e.target.value)}
                maxLength={7}
                placeholder="#1F5FBF"
                className="w-28 px-2.5 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] uppercase"
              />
            </label>
          </div>

          {tooLight && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              Màu này khá nhạt, chữ trắng trên nút sẽ khó đọc. Nên chọn màu đậm hơn.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save className="w-4 h-4" /> Lưu màu
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Về màu gốc
            </button>
          </div>
        </div>

        {/* Xem trước */}
        <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Xem trước</p>
          <div className="px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'var(--color-doan, #1F5FBF)' }}>
            Mục menu đang chọn
          </div>
          <button
            type="button"
            className="w-full px-4 py-2 text-xs font-bold text-white rounded-lg"
            style={{ background: 'var(--color-doan, #1F5FBF)' }}
          >
            Nút chính
          </button>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Nhãn nhạt</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">Nhãn đậm hơn</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-2 w-2/3 rounded-full" style={{ background: 'var(--color-doan, #1F5FBF)' }} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Toàn bộ web đổi màu ngay khi chọn. Bấm <b>Lưu màu</b> để giữ lại. Hiện màu chỉ lưu trên trình duyệt này, chưa đồng bộ cho người dùng khác.
      </p>
    </div>
  );
};
