import clsx from "clsx";
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900",
        "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500",
        "disabled:bg-slate-50 disabled:text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900",
        "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block text-xs font-medium text-slate-600 mb-1", className)}>
      {children}
    </label>
  );
}

export function Badge({
  variant = "default",
  children,
}: {
  variant?: "default" | "success" | "warn" | "danger" | "info";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-rose-100 text-rose-800",
    info: "bg-sky-100 text-sky-800",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-slate-800 font-medium">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, "default" | "success" | "warn" | "danger" | "info"> = {
    DRAFT: "warn",
    ACTIVE: "success",
    LOCKED: "info",
  };
  return <Badge variant={map[status] ?? "default"}>{status}</Badge>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const width: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-white rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col",
          width[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
