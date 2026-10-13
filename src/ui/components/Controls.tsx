import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Vec3 } from '../../core/schema';
import { Icon, type IconName } from '../Icons';
export function Button({
  icon,
  children,
  active = false,
  ...rest
}: {
  icon?: IconName;
  children?: ReactNode;
  active?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${rest.className ?? ''} ${active ? 'active' : ''}`}>
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function Field({
  label,
  value,
  onCommit,
  type = 'text',
  step,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: string | number;
  onCommit: (v: string) => void;
  type?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={draft}
        type={type}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false;
            return;
          }
          if (draft !== String(value)) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            setDraft(String(value));
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export function Vector({
  label,
  value,
  onCommit,
  disabled = false,
}: {
  label: string;
  value: Vec3;
  onCommit: (v: Vec3) => void;
  disabled?: boolean;
}) {
  return (
    <div className="vector">
      <label>{label}</label>
      <div>
        {value.map((v, i) => (
          <Field
            key={i}
            label={`${label} ${'XYZ'[i]}`}
            value={Math.round(v * 1000) / 1000}
            type="number"
            step={0.1}
            disabled={disabled}
            onCommit={(s) => {
              const next = [...value] as Vec3;
              next[i] = Number(s);
              onCommit(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
export function ModalShell({
  title,
  kicker,
  children,
  onClose,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = document.activeElement as HTMLElement;
    ref.current?.focus();
    return () => last?.focus();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const items = ref.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]',
            );
            if (!items?.length) return;
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <Button aria-label="关闭窗口" icon="close" onClick={onClose} />
        </header>
        {children}
      </div>
    </div>
  );
}
