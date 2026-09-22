import React from "react";
import { Presentation, File as FileIcon, Download } from "lucide-react";
import { DocumentItem } from "../types";

type ThumbnailIconProps = React.SVGProps<SVGSVGElement> & { size?: number };

interface FilledFileIconProps extends ThumbnailIconProps {
  fillColor: string;
  foldColor: string;
  label: string;
}

const FilledFileIcon: React.FC<FilledFileIconProps> = ({
  size = 24,
  fillColor,
  foldColor,
  label,
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 38 44"
    fill="none"
    focusable="false"
    {...props}
  >
    <path d="M7 2h18l8 8v29a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill={fillColor} />
    <path d="M25 2v5a3 3 0 0 0 3 3h5z" fill={foldColor} />
    <text
      x="18.5"
      y="27"
      textAnchor="middle"
      fill="white"
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="7.2"
      fontWeight="800"
      letterSpacing="0.2"
    >
      {label}
    </text>
    <path d="M11 32h15M11 36h11" stroke="white" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const PdfFileIcon: React.FC<ThumbnailIconProps> = (props) => (
  <FilledFileIcon {...props} fillColor="#df5752" foldColor="#f7aaa4" label="PDF" />
);

const WordFileIcon: React.FC<ThumbnailIconProps> = (props) => (
  <FilledFileIcon {...props} fillColor="#3578c4" foldColor="#9fc3eb" label="DOC" />
);

const SpreadsheetFileIcon: React.FC<ThumbnailIconProps> = (props) => (
  <FilledFileIcon {...props} fillColor="#2f9b64" foldColor="#9bd1b4" label="XLS" />
);

export function getTypeMeta(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return { label: "PDF", color: "#d94b4b", Icon: PdfFileIcon, branded: true };
  if (t.includes("ppt") || t.includes("presentation")) return { label: "PowerPoint", color: "#d97735", Icon: Presentation, branded: false };
  if (t.includes("sheet") || t.includes("xls") || t.includes("csv")) return { label: "Spreadsheet", color: "#2f9b64", Icon: SpreadsheetFileIcon, branded: true };
  if (t.includes("doc") || t.includes("word")) return { label: "Word", color: "#3578c4", Icon: WordFileIcon, branded: true };
  return { label: type || "File", color: "#7c817d", Icon: FileIcon, branded: false };
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
  const docName = doc?.title || propName || "Untitled Document";
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
      <div className="relative h-[148px] overflow-hidden border-b border-[var(--rule)] bg-[var(--surface-2)] px-5 pt-5">
        {meta.branded ? (
          <div className="flex h-[123px] items-center justify-center pb-4">
            <meta.Icon size={94} className="drop-shadow-[0_8px_10px_rgba(20,33,61,0.16)]" aria-hidden="true" />
          </div>
        ) : (
          <div className="mx-auto h-[122px] max-w-[210px] rounded-t-xl border border-[var(--rule)] bg-[var(--paper)] p-4 shadow-[0_8px_22px_rgba(20,33,61,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center ${meta.branded ? "" : "rounded-lg text-white shadow-sm"}`}
                style={{ backgroundColor: meta.branded ? "transparent" : meta.color }}
              >
                <meta.Icon size={meta.branded ? 32 : 17} strokeWidth={1.9} aria-hidden="true" />
              </span>
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
        )}
      </div>

      <div className="flex min-h-[102px] flex-col justify-between p-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: meta.color }}>
            <meta.Icon size={12} aria-hidden="true" />
            <span>{meta.label}</span>
          </div>
          <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-5 text-[var(--ink)]" title={docName}>
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
