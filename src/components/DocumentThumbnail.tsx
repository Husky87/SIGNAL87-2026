import React from "react";
import { FileText, FileSpreadsheet, FileType, Presentation, File as FileIcon, Download } from "lucide-react";
import { DocumentItem } from "../types";

export function getTypeMeta(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return { label: "PDF", color: "#d94b4b", icon: "", Icon: FileText, iconColor: "#d94b4b" };
  if (t.includes("ppt") || t.includes("presentation")) return { label: "PowerPoint", color: "#d97735", icon: "", Icon: Presentation, iconColor: "#d97735" };
  if (t.includes("sheet") || t.includes("xls") || t.includes("csv")) return { label: "Spreadsheet", color: "#2f9b64", icon: "", Icon: FileSpreadsheet, iconColor: "#2f9b64" };
  if (t.includes("doc") || t.includes("word")) return { label: "Word", color: "#3578c4", icon: "", Icon: FileType, iconColor: "#3578c4" };
  return { label: type || "File", color: "#7c817d", icon: "", Icon: FileIcon, iconColor: "#7c817d" };
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
      className="group w-full h-full min-h-[250px] overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--card)] transition-all duration-200 hover:border-[var(--accent)] hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      <div className="relative h-[148px] overflow-hidden border-b border-[var(--rule)] bg-[var(--paper)] px-5 pt-5">
        <div className="mx-auto h-[122px] max-w-[210px] rounded-t-lg border border-[var(--rule)] bg-[var(--paper)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <meta.Icon size={15} className="shrink-0" style={{ color: meta.color }} aria-hidden="true" />
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
            <span className="h-1.5 w-12 rounded-full bg-[var(--rule)]" />
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
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: meta.color }}>
            <meta.Icon size={12} aria-hidden="true" />
            <span>{meta.label}</span>
          </div>
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-[var(--text)]" title={docName}>
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
