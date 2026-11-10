import type { CSSProperties, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "gold" | "rose" | "violet";
}) {
  const colors: Record<string, CSSProperties> = {
    neutral: {
      background: "rgba(255,255,255,0.06)",
      color: "var(--cip-ink)",
      border: "1px solid var(--cip-border)",
    },
    success: {
      background: "rgba(180, 228, 160, 0.16)",
      color: "#b4e4a0",
      border: "1px solid rgba(180, 228, 160, 0.4)",
    },
    warning: {
      background: "rgba(234, 199, 140, 0.14)",
      color: "#eac78c",
      border: "1px solid rgba(234, 199, 140, 0.4)",
    },
    danger: {
      background: "var(--cip-rose-soft)",
      color: "var(--cip-danger)",
      border: "1px solid rgba(255, 89, 130, 0.42)",
    },
    info: {
      background: "var(--cip-sky)",
      color: "var(--cip-blue)",
      border: "1px solid rgba(124, 156, 255, 0.35)",
    },
    gold: {
      background: "rgba(234, 199, 140, 0.16)",
      color: "#eac78c",
      border: "1px solid rgba(234, 199, 140, 0.42)",
    },
    rose: {
      background: "rgba(255, 89, 130, 0.16)",
      color: "#ff779a",
      border: "1px solid rgba(255, 89, 130, 0.42)",
    },
    violet: {
      background: "rgba(185, 160, 255, 0.16)",
      color: "#b9a0ff",
      border: "1px solid rgba(185, 160, 255, 0.45)",
    },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
        ...colors[tone],
      }}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cip-card", className)}>
      {(title || action) && (
        <div className="cip-card__header">
          <div>
            {title && <h3 className="cip-card__title">{title}</h3>}
            {subtitle && <p className="cip-card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      className={cn("cip-btn", `cip-btn--${variant}`, props.className)}
      style={props.style}
    >
      {children}
    </button>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="cip-page-header">
      <div>
        {eyebrow && <div className="cip-page-header__eyebrow">{eyebrow}</div>}
        <h1 className="cip-page-header__title">{title}</h1>
        {description && <p className="cip-page-header__desc">{description}</p>}
      </div>
      {actions && <div className="cip-page-header__actions">{actions}</div>}
    </header>
  );
}

export function SourceMeta({
  fonte,
  dataReferencia,
  confiabilidade,
}: {
  fonte?: string | null;
  dataReferencia?: string | null;
  confiabilidade?: string | null;
}) {
  return (
    <div className="chip-row">
      {fonte && <Badge tone="info">Fonte: {fonte}</Badge>}
      {dataReferencia && (
        <Badge tone="neutral">
          Data-base: {new Date(dataReferencia).toLocaleDateString("pt-BR")}
        </Badge>
      )}
      {confiabilidade && (
        <Badge tone="gold">Confiabilidade: {confiabilidade}</Badge>
      )}
    </div>
  );
}

export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="table-scroll">{children}</div>;
}

export function EntityCard({
  title,
  meta,
  children,
  href,
}: {
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  href?: string;
}) {
  const body = (
    <article className="entity-card">
      <div className="entity-card__top">
        <strong>{title}</strong>
        {meta}
      </div>
      {children}
    </article>
  );
  if (href) {
    return (
      <a href={href} className="entity-card-link">
        {body}
      </a>
    );
  }
  return body;
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`} className="breadcrumbs__item">
          {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
          {idx < items.length - 1 && <span className="breadcrumbs__sep">/</span>}
        </span>
      ))}
    </nav>
  );
}
