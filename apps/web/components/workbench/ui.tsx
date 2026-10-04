"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, X } from "lucide-react";

/** Every status maps to an ink and a mark form, so state never depends on colour alone. */
const MARKS: Record<
  string,
  { tone: string; form: "solid" | "dashed" | "hatched" | "struck" | "ring" }
> = {
  approved: { tone: "violet", form: "solid" },
  cleared: { tone: "violet", form: "solid" },
  succeeded: { tone: "green", form: "solid" },
  accepted: { tone: "green", form: "solid" },
  matched: { tone: "green", form: "solid" },
  landed: { tone: "green", form: "solid" },
  done: { tone: "green", form: "solid" },
  rejected: { tone: "red", form: "hatched" },
  held: { tone: "red", form: "hatched" },
  failed: { tone: "red", form: "hatched" },
  mismatch: { tone: "red", form: "hatched" },
  attention: { tone: "red", form: "hatched" },
  running: { tone: "form", form: "ring" },
  draft: { tone: "amber", form: "dashed" },
  current: { tone: "form", form: "dashed" },
  waiting: { tone: "muted", form: "dashed" },
  rolled_back: { tone: "muted", form: "struck" },
  superseded: { tone: "muted", form: "struck" },
  "pre-existing": { tone: "muted", form: "dashed" },
};

export function Mark({ status, label }: { status: string; label?: string }) {
  const mark = MARKS[status] ?? { tone: "form", form: "dashed" as const };
  return (
    <span className={`mark tone-${mark.tone}`}>
      <span className={`mark-glyph form-${mark.form}`} aria-hidden="true" />
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

/** A numbered declaration box: the label is printed in form ink, the value is typed. */
export function Box({
  n,
  label,
  children,
  className = "",
}: {
  n?: number | string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`box ${className}`}>
      <span className="box-label">
        {n !== undefined && <b>{n}</b>}
        {label}
      </span>
      <div className="box-value">{children}</div>
    </div>
  );
}

/** A ruled section of the declaration with a printed head. */
export function Sheet({
  title,
  meta,
  children,
  className = "",
  id,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`sheet ${className}`} aria-labelledby={id}>
      <header className="sheet-head">
        <h2 id={id}>{title}</h2>
        {meta && <div className="sheet-meta">{meta}</div>}
      </header>
      {children}
    </section>
  );
}

export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-frame" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/** A fingerprint shown short, copied in full. */
export function Hash({
  value,
  label = "SHA-256",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="hash"
      title={value}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label={`Copy ${label} ${value}`}
    >
      <span className="hash-label">{label}</span>
      <span className="hash-value">{value.slice(0, 12)}</span>
      {copied ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <Copy size={12} aria-hidden="true" />
      )}
    </button>
  );
}

export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-sheet">
        <header className="dialog-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </dialog>
  );
}

export function Pager({
  page,
  total,
  onChange,
  size = 15,
  noun = "records",
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  size?: number;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        {total
          ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${total} ${noun}`
          : `0 ${noun}`}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pager-count">
          {page + 1} / {pages}
        </span>
        <button
          className="icon-button"
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export const fmt = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

export const time = (value: unknown) =>
  new Date(String(value)).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const words = (value: string) => value.replaceAll("_", " ");
