import React, { useMemo, useState } from 'react';

// ---------------------------------------------------------------------
// BẢNG MÀU CỐ ĐỊNH — chọn màu đậm vừa để chữ trắng đọc rõ
// ---------------------------------------------------------------------
const PALETTE: ReadonlyArray<string> = [
  '#1F5FBF', // xanh dương đậm
  '#0F766E', // teal
  '#7C3AED', // tím
  '#B45309', // hổ phách đậm
  '#BE123C', // đỏ thẫm
  '#15803D', // xanh lá đậm
  '#1E40AF', // xanh navy
  '#9D174D', // hồng đậm
  '#4338CA', // indigo
  '#A16207', // vàng nâu
  '#0E7490', // cyan đậm
  '#7E22CE', // purple đậm
];

/** Hash ổn định (djb2) — cùng input luôn ra cùng số, mọi thiết bị. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Lấy 2 chữ cái đầu: chữ đầu của từ đầu + chữ đầu của từ cuối.
 * "Dương Phước Lộc" -> "DL"; "An" -> "A"; "" -> "?"
 * Giữ nguyên dấu tiếng Việt.
 */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

/** Màu nền ổn định theo id (ưu tiên) hoặc tên. */
export function getAvatarColor(seed?: string | null): string {
  const key = seed && seed.trim() ? seed.trim() : '?';
  return PALETTE[hashString(key) % PALETTE.length];
}

// ---------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------
export interface AvatarProps {
  /** URL ảnh thật. Nếu rỗng hoặc tải lỗi -> dùng avatar chữ cái. */
  src?: string | null;
  /** Tên để lấy chữ cái đầu. */
  name?: string | null;
  /** Khoá hash màu — nên truyền member.id. Không có thì hash theo name. */
  seed?: string | null;
  /** Đường kính (px). Mặc định 40. */
  size?: number;
  className?: string;
  /** Viền bao quanh. */
  ring?: boolean;
  /** Chế độ tròn hay vuông bo góc. */
  shape?: 'circle' | 'rounded';
  title?: string;
}

/**
 * Avatar dùng chung toàn hệ thống.
 * - Có ảnh thật -> hiện ảnh.
 * - Không có / ảnh lỗi -> hiện chữ cái đầu trên nền màu ổn định.
 * Không gọi dịch vụ ngoài, không lưu file.
 */
export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  seed,
  size = 40,
  className = '',
  ring = false,
  shape = 'circle',
  title,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset trạng thái lỗi khi đổi src
  React.useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const initials = useMemo(() => getInitials(name), [name]);
  const bg = useMemo(() => getAvatarColor(seed ?? name), [seed, name]);

  const fontSize = Math.max(8, Math.round(size * 0.4));
  const radius = shape === 'circle' ? '9999px' : `${Math.round(size * 0.22)}px`;

  const wrapperStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
  };

  const hasImage = !!src && src.trim().length > 0 && !imgFailed;

  if (hasImage) {
    return (
      <div
        className={`overflow-hidden ${ring ? 'ring-2 ring-white' : ''} ${className}`}
        style={wrapperStyle}
      >
        <img
          src={src as string}
          alt={name || 'Ảnh đại diện'}
          title={title ?? name ?? undefined}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
          style={{ borderRadius: radius }}
          loading="lazy"
        />
      </div>
    );
  }

  // Avatar chữ cái
  return (
    <div
      className={`inline-flex items-center justify-center select-none overflow-hidden ${
        ring ? 'ring-2 ring-white' : ''
      } ${className}`}
      style={{
        ...wrapperStyle,
        backgroundColor: bg,
      }}
      title={title ?? name ?? 'Chưa có ảnh đại diện'}
      aria-label={name ? `Ảnh đại diện của ${name}` : 'Chưa có ảnh đại diện'}
      role="img"
    >
      <span
        style={{
          color: '#ffffff',
          fontWeight: 700,
          fontSize,
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        {initials}
      </span>
    </div>
  );
};