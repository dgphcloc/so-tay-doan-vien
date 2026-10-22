/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** 'supabase' để dùng dữ liệu thật; mặc định (trống) là dùng mock. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'supabase';
  /**
   * Tên miền công khai của app (ví dụ https://so-tay-doan-vien.vercel.app).
   * Dùng để sinh link trong mã QR; QR tạo trên máy dev sẽ trỏ về tên miền này
   * thay vì localhost. Bỏ trống thì dùng máy hiện tại.
   */
  readonly VITE_PUBLIC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: { width?: number; margin?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }
  ): Promise<string>;
}
