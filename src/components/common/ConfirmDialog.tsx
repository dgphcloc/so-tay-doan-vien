import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Loader2,
  HelpCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------
// KIỂU DỮ LIỆU
// ---------------------------------------------------------------------

type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  message: string;
  /** Dòng phụ giải thích hậu quả (tùy chọn) */
  details?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  /** Nếu có, người dùng phải gõ đúng chuỗi này mới cho xác nhận */
  requireTyping?: string;
}

interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  /** Bắt buộc nhập mới cho xác nhận */
  required?: boolean;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// ---------------------------------------------------------------------
// STYLE THEO LOẠI
// ---------------------------------------------------------------------
const VARIANTS: Record<DialogVariant, {
  icon: React.FC<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  buttonBg: string;
}> = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    buttonBg: 'bg-rose-600 hover:bg-rose-700',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-[#1F5FBF]',
    buttonBg: 'bg-[#1F5FBF] hover:bg-[#154690]',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
  },
};

// ---------------------------------------------------------------------
// PROVIDER
// ---------------------------------------------------------------------
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [typedText, setTypedText] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setTypedText('');
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(opts.defaultValue ?? '');
      setPromptState({ ...opts, resolve });
    });
  }, []);

  // Focus ô nhập khi mở prompt
  useEffect(() => {
    if (promptState) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [promptState]);

  // Đóng bằng phím Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmState) { confirmState.resolve(false); setConfirmState(null); }
      if (promptState) { promptState.resolve(null); setPromptState(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmState, promptState]);

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
    setTypedText('');
  };

  const closePrompt = (result: string | null) => {
    promptState?.resolve(result);
    setPromptState(null);
    setPromptValue('');
  };

  // ----- Render Confirm -----
  const confirmDialog = confirmState && typeof document !== 'undefined' ? createPortal((() => {
    const v = VARIANTS[confirmState.variant || 'danger'];
    const Icon = v.icon;
    const typingOk = !confirmState.requireTyping || typedText === confirmState.requireTyping;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${v.iconBg} ${v.iconColor} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{confirmState.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">{confirmState.message}</p>
              </div>
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                title="Đóng hộp thoại (Esc)"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmState.details && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                {confirmState.details}
              </div>
            )}

            {confirmState.requireTyping && (
              <div className="pt-1">
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Để xác nhận, gõ chính xác:{' '}
                  <strong className="text-rose-600 select-all font-mono">{confirmState.requireTyping}</strong>
                </label>
                <input
                  type="text"
                  value={typedText}
                  onChange={e => setTypedText(e.target.value)}
                  placeholder={confirmState.requireTyping}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                />
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closeConfirm(false)}
              title="Hủy bỏ, không thực hiện thao tác này"
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
            >
              {confirmState.cancelText || 'Hủy'}
            </button>
            <button
              type="button"
              disabled={!typingOk}
              onClick={() => closeConfirm(true)}
              title={confirmState.confirmText || 'Đồng ý thực hiện thao tác'}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                typingOk ? v.buttonBg : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {confirmState.confirmText || 'Đồng ý'}
            </button>
          </div>
        </div>
      </div>
    );
  })(), document.body) : null;

  // ----- Render Prompt -----
  const promptDialog = promptState && typeof document !== 'undefined' ? createPortal((() => {
    const v = VARIANTS[promptState.variant || 'info'];
    const Icon = v.icon;
    const isValid = !promptState.required || promptValue.trim().length > 0;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${v.iconBg} ${v.iconColor} flex items-center justify-center shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">{promptState.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{promptState.message}</p>
              </div>
              <button
                type="button"
                onClick={() => closePrompt(null)}
                title="Đóng hộp thoại (Esc)"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={promptValue}
              onChange={e => setPromptValue(e.target.value)}
              placeholder={promptState.placeholder}
              onKeyDown={e => {
                if (e.key === 'Enter' && isValid) closePrompt(promptValue.trim());
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
            />
            {promptState.required && !isValid && (
              <p className="text-[11px] text-amber-700">Ô này là bắt buộc, vui lòng nhập nội dung.</p>
            )}
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => closePrompt(null)}
              title="Hủy bỏ, không lưu thay đổi"
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
            >
              {promptState.cancelText || 'Hủy'}
            </button>
            <button
              type="button"
              disabled={!isValid}
              onClick={() => closePrompt(promptValue.trim())}
              title="Xác nhận và lưu nội dung vừa nhập"
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                isValid ? v.buttonBg : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {promptState.confirmText || 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    );
  })(), document.body) : null;

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      {confirmDialog}
      {promptDialog}
    </ConfirmContext.Provider>
  );
};

// ---------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------
export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm phải dùng bên trong <ConfirmProvider>');
  }
  return ctx;
}