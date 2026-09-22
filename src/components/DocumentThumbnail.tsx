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
    width={(size * 38) / 44}
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

/** The large preview glyph: the file-type silhouette drawn in the type's colour, with no filled shape behind it. */
const OutlineFileIcon: React.FC<ThumbnailIconProps & { color: string; label: string }> = ({
  size = 24,
  color,
  label,
  ...props
}) => (
  <svg
    width={size}
    height={(size * 44) / 38}
    viewBox="0 0 38 44"
    fill="none"
    focusable="false"
    {...props}
  >
    <path d="M7 2h18l8 8v29a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M25 2v5a3 3 0 0 0 3 3h5" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    <text
      x="18.5"
      y="27"
      textAnchor="middle"
      fill={color}
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="7.2"
      fontWeight="800"
      letterSpacing="0.2"
    >
      {label}
    </text>
    <path d="M11 32h15M11 36h11" stroke={color} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const previewLabel = (type: string, label: string) => {
  if (label === "PDF") return "PDF";
  if (label === "PowerPoint") return "PPT";
  if (label === "Spreadsheet") return "XLS";
  if (label === "Word") return "DOC";
  const ext = type.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4);
  return ext || "FILE";
};

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
  variant?: "card" | "preview";
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

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({ doc, name: propName, type: propType, onClick, variant = "card" }) => {
  const docName = doc?.title || propName || "Untitled Document";
  const docType = doc?.type || propType || "PDF";
  const meta = getTypeMeta(docType);

  if (variant === "preview") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {meta.branded ? (
          <meta.Icon size={52} aria-hidden="true" className="drop-shadow-sm transition-transform duration-200 group-hover:scale-105" />
        ) : (
          <FilledFileIcon
            size={52}
            fillColor={meta.color}
            foldColor="#d9dcda"
            label={previewLabel(docType, meta.label)}
            aria-hidden="true"
            className="drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
          />
        )}
      </div>
    );
  }

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
        {/* Anchored to the bottom: the Files grid crops this thumbnail from the
            middle, so only roughly the lower 100px of this 148px area shows. */}
        <div className="flex h-full items-end justify-center pb-6">
          <OutlineFileIcon size={46} color={meta.color} label={previewLabel(docType, meta.label)} aria-hidden="true" />
        </div>
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
