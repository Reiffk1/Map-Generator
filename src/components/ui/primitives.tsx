import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { cx } from '../../lib/utils';

export function Button({
  className,
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      className={cx(
        'ui-button',
        props.disabled && 'is-disabled',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  className,
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={cx('ui-button is-ghost', className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  className,
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={cx('ui-icon-button', className)} {...props}>
      {children}
    </button>
  );
}

export function Panel({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <section className={cx('ui-panel', className)}>{children}</section>;
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <span className={cx('ui-badge', className)}>{children}</span>;
}

export function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      className="stat-chip"
      style={
        accent
          ? ({
              ['--chip-accent' as const]: accent,
            } as CSSProperties)
          : undefined
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function TextField({
  label,
  className,
  ...props
}: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('field', className)}>
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function TextareaField({
  label,
  className,
  ...props
}: { label: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={cx('field', className)}>
      <span>{label}</span>
      <textarea {...props} />
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: PropsWithChildren<{ label: string; className?: string } & SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <label className={cx('field', className)}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function SearchField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('search-field', className)} {...props} />;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('segmented-control', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          className={cx(value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}
