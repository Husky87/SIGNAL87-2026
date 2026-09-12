import React from "react";
import { FileText, FileSpreadsheet, FileType, File as FileIcon, Download } from "lucide-react";
import { DocumentItem } from "../types";

export function getTypeMeta(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return { label: "PDF", color: "bg-red-50 text-red-600", icon: "📄", Icon: FileText, iconColor: "#dc2626" };
  if (t.includes("sheet") || t.includes("xls") || t.includes("csv")) return { label: "Sheet", color: "bg-green-50 text-green-600", icon: "📊", Icon: FileSpreadsheet, iconColor: "#16a34a" };
  if (t.includes("doc") || t.includes("word")) return { label: "Doc", color: "bg-blue-50 text-blue-600", icon: "📝", Icon: FileType, iconColor: "#2563eb" };
  return { label: type || "File", color: "bg-gray-50 text-gray-600", icon: "📁", Icon: FileIcon, iconColor: "#4b5563" };
}

interface DocumentThumbnailProps {
  doc?: DocumentItem;
  name?: string;
  type?: string;
  onClick?: () => void;
}

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes < 1) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value?: string) => {
  if (!value) return "Recently added";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({ doc, name: propName, type: propType, onClick }) => {
  const docName = doc?.title || doc?.name || propName || "Untitled Document";
  const docType = doc?.type || propType || "PDF";
  const meta = getTypeMeta(docType);
  const Icon = meta.Icon;
  const previewText = (doc?.contentPreview || doc?.summary || "").replace(/\s+/g, " ").trim();
  const previewLines = previewText
    ? previewText.slice(0, 145).match(/.{1,42}(?:\s|$)/g)?.slice(0, 4) || []
    : [];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className="group w-full h-full min-h-[250px] overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--card)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      <div className="relative h-[148px] overflow-hidden border-b border-[var(--rule)] bg-gradient-to-br from-[var(--paper)] via-[var(--card)] to-[var(--raised)] px-5 pt-5">
        <div className="absolute right-4 top-4 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-[var(--card)]/90 p-1.5 text-[var(--muted)] shadow-sm" title="Open document">
            <Icon size={14} style={{ color: meta.iconColor }} />
          </span>
        </div>
        <div className="mx-auto h-[122px] max-w-[210px] rounded-t-lg border border-[var(--rule)] bg-[var(--paper)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Icon size={17} style={{ color: meta.iconColor }} />
            <div className="h-2 w-20 rounded-full bg-[var(--rule)]" />
          </div>
          {previewLines.length > 0 ? (
            <div className="space-y-2">
              {previewLines.map((line, index) => (
                <div key={`${line}-${index}`} className="h-1.5 rounded-full bg-[var(--rule)]" style={{ width: `${92 - index * 11}%` }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-1.5 w-[92%] rounded-full bg-[var(--rule)]" />
              <div className="h-1.5 w-[78%] rounded-full bg-[var(--rule)]" />
              <div className="h-1.5 w-[86%] rounded-full bg-[var(--rule)]" />
              <div className="h-1.5 w-[58%] rounded-full bg-[var(--rule)]" />
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-[102px] flex-col justify-between p-4">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
          </span>
          <h3 className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-5 text-[var(--text)]" title={docName}>
            {docName}
          </h3>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span className="truncate">{formatBytes(doc?.sizeBytes)} · {formatDate(doc?.uploadDate)}</span>
          <Download size={13} className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </div>
  );
};

export default DocumentThumbnail;
