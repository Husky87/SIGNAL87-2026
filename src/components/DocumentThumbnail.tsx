import React from "react";
import { FileText, FileSpreadsheet, FileType, File as FileIcon } from "lucide-react";
import { DocumentItem } from "../types";

// NOTE: `color` (Tailwind classes) and `icon` (emoji) are kept as-is for
// DocumentThumbnail's own badge below. `Icon` (a real component) and
// `iconColor` (a real CSS color, not a Tailwind class) were added because
// DocumentLibraryView.tsx destructures `{ Icon, color }` and renders
// `<Icon style={{ color }} />` — with no `Icon` field, that rendered
// `<undefined />`, which is React error #130 (the blank white screen / app
// crash on load).
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

export const DocumentThumbnail: React.FC<DocumentThumbnailProps> = ({ doc, name: propName, type: propType, onClick }) => {
  const docName = doc?.name || propName || "Untitled Document";
  const docType = doc?.type || propType || "PDF";
  const meta = getTypeMeta(docType);

  return (
    <div 
      onClick={onClick}
      className="w-full h-full bg-[var(--surface)] border border-[var(--rule)] rounded-xl p-4 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span className={`px-2.5 py-1 ${meta.color} rounded-lg text-xs font-semibold uppercase flex items-center space-x-1`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </span>
      </div>

      <div className="my-auto py-2">
        <h3 className="font-medium text-[var(--text)] text-sm line-clamp-2" title={docName}>
          {docName}
        </h3>
      </div>

      <div className="text-[11px] text-[var(--muted)]">
        Ready
      </div>
    </div>
  );
};

export default DocumentThumbnail;
