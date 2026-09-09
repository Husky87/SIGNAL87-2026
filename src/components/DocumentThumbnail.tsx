import React from "react";
import { DocumentItem } from "../types";

export function getTypeMeta(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return { label: "PDF", color: "bg-red-50 text-red-600", icon: "📄" };
  if (t.includes("sheet") || t.includes("xls") || t.includes("csv")) return { label: "Sheet", color: "bg-green-50 text-green-600", icon: "📊" };
  if (t.includes("doc") || t.includes("word")) return { label: "Doc", color: "bg-blue-50 text-blue-600", icon: "📝" };
  return { label: type || "File", color: "bg-gray-50 text-gray-600", icon: "📁" };
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
