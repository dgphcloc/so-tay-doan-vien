/**
 * Màu chủ đạo của giao diện – lưu ở trình duyệt từng người (localStorage).
 * Đặt file này tại: src/utils/theme.ts
 */
const KEY = 'so-tay-theme-color';

export const DEFAULT_COLOR = '#1F5FBF';

export interface ThemePreset {
  name: string;
  color: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Xanh Đoàn', color: '#1F5FBF' },
  { name: 'Đỏ cờ', color: '#C8102E' },
  { name: 'Xanh lá', color: '#15803D' },
  { name: 'Xanh ngọc', color: '#0E7490' },
  { name: 'Tím', color: '#7C3AED' },
  { name: 'Cam', color: '#EA580C' },
  { name: 'Hồng', color: '#DB2777' },
  { name: 'Xám than', color: '#334155' },
];

export const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgbToHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');

/** Trộn màu a với màu b theo tỉ lệ t (0 = giữ a, 1 = thành b) */
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** Độ sáng tương đối (0 = đen, 1 = trắng) – dùng để cảnh báo màu quá nhạt */
export const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Các biến CSS sẽ bị ghi đè khi đổi màu */
const SHADE_KEYS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
const ALL_VARS = [
  '--color-doan',
  '--color-doan-dark',
  '--color-doan-light',
  '--color-doan-bg',
  ...SHADE_KEYS.map(k => `--color-blue-${k}`),
];

const buildScale = (hex: string): Record<string, string> => {
  const base = hexToRgb(hex);
  return {
    '50': rgbToHex(mix(base, WHITE, 0.93)),
    '100': rgbToHex(mix(base, WHITE, 0.85)),
    '200': rgbToHex(mix(base, WHITE, 0.70)),
    '300': rgbToHex(mix(base, WHITE, 0.50)),
    '400': rgbToHex(mix(base, WHITE, 0.28)),
    '500': rgbToHex(mix(base, WHITE, 0.12)),
    '600': hex.toLowerCase(),
    '700': rgbToHex(mix(base, BLACK, 0.15)),
    '800': rgbToHex(mix(base, BLACK, 0.30)),
    '900': rgbToHex(mix(base, BLACK, 0.45)),
  };
};

/** Áp màu lên toàn web (đổi tức thì, chưa lưu) */
export const applyTheme = (hex: string): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Màu gốc: xoá ghi đè để trở về đúng bảng màu mặc định
  if (!isValidHex(hex) || hex.toLowerCase() === DEFAULT_COLOR.toLowerCase()) {
    ALL_VARS.forEach(v => root.style.removeProperty(v));
    return;
  }

  const scale = buildScale(hex);
  // Khớp với @theme trong index.css: --color-doan, --color-doan-dark, --color-doan-light, --color-doan-bg
  root.style.setProperty('--color-doan', hex);
  root.style.setProperty('--color-doan-dark', scale['700']);
  root.style.setProperty('--color-doan-light', rgbToHex(mix(hexToRgb(hex), WHITE, 0.15)));
  root.style.setProperty('--color-doan-bg', scale['50']);
  SHADE_KEYS.forEach(k => root.style.setProperty(`--color-blue-${k}`, scale[k]));
};

export const getSavedColor = (): string | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v && isValidHex(v) ? v : null;
  } catch {
    return null;
  }
};

export const saveColor = (hex: string): void => {
  try {
    localStorage.setItem(KEY, hex);
  } catch {
    /* trình duyệt chặn lưu: bỏ qua */
  }
};

export const clearSavedColor = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
};

/** Gọi 1 lần lúc mở web để dùng lại màu đã lưu */
export const applySavedTheme = (): void => {
  const c = getSavedColor();
  if (c) applyTheme(c);
};
