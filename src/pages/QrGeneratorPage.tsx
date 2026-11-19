import React, { useEffect, useRef, useState } from "react";
import QRCodeStyling, {
  type CornerDotType,
  type CornerSquareType,
  type DotType,
  type Options,
} from "qr-code-styling";
import { useApp } from "../context/AppContext";
import {
  QrCode,
  Link2,
  Upload,
  Download,
  Image as ImageIcon,
  X,
  Sparkles,
  RotateCcw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Các mẫu QR có sẵn                                                   */
/* ------------------------------------------------------------------ */
interface QrTemplate {
  id: string;
  name: string;
  dot: DotType;
  square: CornerSquareType;
  cornerDot: CornerDotType;
  fg: string;
  fg2?: string; // có giá trị = tô màu chuyển sắc fg -> fg2
  bg: string;
}

const TEMPLATES: QrTemplate[] = [
  {
    id: "classic",
    name: "Cổ điển",
    dot: "square",
    square: "square",
    cornerDot: "square",
    fg: "#000000",
    bg: "#FFFFFF",
  },
  {
    id: "doan",
    name: "Xanh Đoàn",
    dot: "rounded",
    square: "extra-rounded",
    cornerDot: "dot",
    fg: "#1F5FBF",
    bg: "#FFFFFF",
  },
  {
    id: "dots",
    name: "Chấm tròn",
    dot: "dots",
    square: "dot",
    cornerDot: "dot",
    fg: "#0F172A",
    bg: "#FFFFFF",
  },
  {
    id: "gradient",
    name: "Xanh – Tím",
    dot: "rounded",
    square: "extra-rounded",
    cornerDot: "dot",
    fg: "#1F5FBF",
    fg2: "#7C3AED",
    bg: "#FFFFFF",
  },
  {
    id: "flag",
    name: "Đỏ cờ",
    dot: "classy-rounded",
    square: "extra-rounded",
    cornerDot: "dot",
    fg: "#C8102E",
    bg: "#FFF6CC",
  },
  {
    id: "forest",
    name: "Xanh lá",
    dot: "classy",
    square: "square",
    cornerDot: "square",
    fg: "#15803D",
    bg: "#FFFFFF",
  },
];

const DOT_RADIUS: Record<string, string> = {
  square: "0",
  dots: "50%",
  rounded: "30%",
  "extra-rounded": "45%",
  classy: "0 45% 0 45%",
  "classy-rounded": "0 50% 0 50%",
};

const QR_SIZE = 800;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Link thiếu http(s):// mà trông giống tên miền (vd: doan.vn/abc) thì tự thêm https:// */
const normalizeLink = (raw: string): string => {
  const v = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v; // đã có scheme (https:, mailto:, tel:...)
  if (!/\s/.test(v) && /^[\w-]+(\.[\w-]+)+(\/|\?|#|$)/.test(v))
    return `https://${v}`;
  return v;
};

export const QrGeneratorPage: React.FC = () => {
  const { showToast } = useApp();

  const [link, setLink] = useState("");
  const [appliedData, setAppliedData] = useState(""); // nội dung đã bấm "Tạo"

  const [templateId, setTemplateId] = useState(TEMPLATES[1].id);
  const [fg, setFg] = useState(TEMPLATES[1].fg);
  const [fg2, setFg2] = useState<string | null>(TEMPLATES[1].fg2 ?? null);
  const [bg, setBg] = useState(TEMPLATES[1].bg);

  const [logo, setLogo] = useState<string | null>(null);
  const [logoName, setLogoName] = useState("");
  const [logoSize, setLogoSize] = useState(0.3);

  const boxRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const pickTemplate = (t: QrTemplate) => {
    setTemplateId(t.id);
    setFg(t.fg);
    setFg2(t.fg2 ?? null);
    setBg(t.bg);
  };

  // Vẽ lại mã QR mỗi khi nội dung / mẫu / màu / logo thay đổi (chỉ khi đã bấm Tạo)
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !appliedData) return;

    const options: Options = {
      width: QR_SIZE,
      height: QR_SIZE,
      type: "canvas",
      data: appliedData,
      margin: 12,
      qrOptions: { errorCorrectionLevel: logo ? "H" : "M" },
      dotsOptions: fg2
        ? {
            type: template.dot,
            gradient: {
              type: "linear",
              rotation: Math.PI / 4,
              colorStops: [
                { offset: 0, color: fg },
                { offset: 1, color: fg2 },
              ],
            },
          }
        : { type: template.dot, color: fg },
      cornersSquareOptions: { type: template.square, color: fg },
      cornersDotOptions: { type: template.cornerDot, color: fg },
      backgroundOptions: { color: bg },
      ...(logo
        ? {
            image: logo,
            imageOptions: {
              hideBackgroundDots: true,
              imageSize: logoSize,
              margin: 6,
              crossOrigin: "anonymous",
            },
          }
        : {}),
    };

    const qr = new QRCodeStyling(options);
    qrRef.current = qr;
    box.innerHTML = "";
    qr.append(box);
  }, [appliedData, template, fg, fg2, bg, logo, logoSize]);

  const handleCreate = () => {
    const v = link.trim();
    if (!v) {
      showToast({ title: "Vui lòng dán link cần tạo QR", type: "error" });
      return;
    }
    if (v.length > 1000) {
      showToast({
        title: "Nội dung quá dài",
        description: "Hãy dùng link rút gọn (tối đa 1000 ký tự).",
        type: "error",
      });
      return;
    }
    const data = normalizeLink(v);
    setAppliedData(data);
    if (data !== v) setLink(data);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast({
        title: "File không phải ảnh",
        description: "Chọn file PNG, JPG, SVG hoặc WEBP.",
        type: "error",
      });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast({
        title: "Ảnh quá lớn",
        description: "Chọn ảnh nhỏ hơn 2MB.",
        type: "error",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result));
      setLogoName(file.name);
    };
    reader.onerror = () =>
      showToast({ title: "Không đọc được ảnh", type: "error" });
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoName("");
  };

  const handleDownload = async (ext: "png" | "svg") => {
    if (!qrRef.current || !appliedData) return;
    try {
      await qrRef.current.download({
        name: `qr-${new Date().toISOString().slice(0, 10)}`,
        extension: ext,
      });
    } catch {
      showToast({ title: "Không tải được file", type: "error" });
    }
  };

  const resetColors = () => {
    setFg(template.fg);
    setFg2(template.fg2 ?? null);
    setBg(template.bg);
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <QrCode className="w-6 h-6 text-doan" />
          Tạo mã QR
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Dán link, chọn mẫu, thêm logo Đoàn rồi tải về dùng cho poster, banner,
          tờ rơi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* ============ CỘT TRÁI: ĐIỀU KHIỂN ============ */}
        <div className="space-y-4">
          {/* 1. Link */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-doan" /> 1. Dán link
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="https://example.com/dang-ky-hoat-dong"
                className="flex-1 px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-doan focus:bg-white"
              />
              <button
                type="button"
                onClick={handleCreate}
                title="Tạo mã QR từ link vừa dán"
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-doan hover:bg-doan-dark rounded-lg shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Tạo QR
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Link càng ngắn thì mã càng thưa, càng dễ quét. Nên dùng link rút
              gọn nếu link quá dài.
            </p>
          </section>

          {/* 2. Mẫu QR */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-doan" /> 2. Chọn mẫu QR
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TEMPLATES.map((t) => {
                const active = t.id === templateId;
                const cellBg = t.fg2
                  ? `linear-gradient(135deg, ${t.fg}, ${t.fg2})`
                  : t.fg;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTemplate(t)}
                    title={`Mẫu ${t.name}`}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? "border-doan ring-2 ring-doan/20 bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className="mx-auto w-16 h-16 rounded-lg p-2 grid grid-cols-3 gap-1 border border-slate-200"
                      style={{ background: t.bg }}
                    >
                      {Array.from({ length: 9 }).map((_, i) => (
                        <span
                          key={i}
                          className="block"
                          style={{
                            background: cellBg,
                            borderRadius: DOT_RADIUS[t.dot] ?? "0",
                          }}
                        />
                      ))}
                    </div>
                    <p
                      className={`mt-2 text-center text-xs font-semibold ${active ? "text-doan" : "text-slate-700"}`}
                    >
                      {t.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Tuỳ chỉnh màu */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                Màu mã
                <input
                  type="color"
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-white"
                />
              </label>

              {fg2 !== null && (
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  Màu chuyển
                  <input
                    type="color"
                    value={fg2}
                    onChange={(e) => setFg2(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-white"
                  />
                </label>
              )}

              <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                Màu nền
                <input
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer bg-white"
                />
              </label>

              <button
                type="button"
                onClick={resetColors}
                title="Trả màu về mặc định của mẫu đang chọn"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Màu gốc của mẫu
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Giữ màu mã đậm hơn màu nền để điện thoại quét được dễ dàng.
            </p>
          </section>

          {/* 3. Upload logo */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-doan" /> 3. Logo / ảnh ở giữa
              mã (không bắt buộc)
            </h2>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            {!logo ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full p-6 border-2 border-dashed border-slate-300 hover:border-doan hover:bg-blue-50/40 rounded-xl text-center transition-colors cursor-pointer"
              >
                <Upload className="w-6 h-6 text-doan mx-auto" />
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  Chọn ảnh từ máy
                </p>
                <p className="text-[11px] text-slate-500">
                  PNG, JPG, SVG, WEBP · tối đa 2MB
                </p>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-12 h-12 object-contain rounded bg-white border border-slate-200"
                  />
                  <p className="flex-1 min-w-0 text-xs font-semibold text-slate-800 truncate">
                    {logoName}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer"
                  >
                    Đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={removeLogo}
                    title="Xóa logo"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <label className="flex items-center gap-3 text-xs font-semibold text-slate-700">
                  Kích thước logo
                  <input
                    type="range"
                    min={0.15}
                    max={0.4}
                    step={0.01}
                    value={logoSize}
                    onChange={(e) => setLogoSize(Number(e.target.value))}
                    className="flex-1 accent-doan"
                  />
                  <span className="w-10 text-right text-slate-500">
                    {Math.round(logoSize * 100)}%
                  </span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Logo càng to thì càng khó quét. Nên để dưới 35% và thử quét
                  bằng điện thoại trước khi in.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ============ CỘT PHẢI: XEM TRƯỚC ============ */}
        <aside className="lg:sticky lg:top-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Xem trước</h2>

          <div className="relative mx-auto w-full max-w-[320px] aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div
              ref={boxRef}
              className="absolute inset-0 [&>canvas]:!w-full [&>canvas]:!h-full"
            />
            {!appliedData && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6 text-slate-400">
                <QrCode className="w-14 h-14" />
                <p className="text-xs">
                  Dán link rồi bấm <b className="text-slate-600">Tạo QR</b> để
                  xem mã ở đây.
                </p>
              </div>
            )}
          </div>

          {appliedData && (
            <p
              className="text-[11px] text-slate-500 break-all text-center line-clamp-2"
              title={appliedData}
            >
              {appliedData}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!appliedData}
              onClick={() => handleDownload("png")}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-white bg-doan hover:bg-doan-dark rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4" /> Tải PNG
            </button>
            <button
              type="button"
              disabled={!appliedData}
              onClick={() => handleDownload("svg")}
              title="SVG phóng to không vỡ nét, hợp để in khổ lớn"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4 text-doan" /> Tải SVG
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
