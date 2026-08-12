import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Download,
  Copy,
  Check,
  FileText,
  Briefcase,
  Landmark,
  TrendingUp,
  ShieldAlert,
  Loader2,
  Share2
} from 'lucide-react';
import { ReportTemplate, GeneratedReport, DocumentItem } from '../types';

interface ReportsViewProps {
  templates: ReportTemplate[];
  reports: GeneratedReport[];
  documents: DocumentItem[];
  onSaveReport: (rep: GeneratedReport) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  templates,
  reports,
  documents,
  onSaveReport
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate>(templates[0]);
  const [reportTitle, setReportTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(documents.map((d) => d.id));
  const [generating, setGenerating] = useState(false);
  const [activeReportText, setActiveReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    const activeDocs = documents.filter((d) => selectedDocIds.includes(d.id));

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reportTitle || `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
          templateName: selectedTemplate.name,
          documents: activeDocs,
          customInstructions: customPrompt
        })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error.error || error.details || 'Failed to generate report');
      }

      const data = await res.json();
      setActiveReportText(data.reportText || 'Report generated successfully.');

      const newReport: GeneratedReport = {
        id: `rep-${Date.now()}`,
        title: reportTitle || `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
        templateId: selectedTemplate.id,
        content: data.reportText || '',
        generatedAt: new Date().toISOString(),
        author: 'ceo@signal87.ai',
        sourcesCount: activeDocs.length,
        status: 'Final',
        tags: [selectedTemplate.category, 'AI Generated']
      };

      onSaveReport(newReport);
      setGenerating(false);
    } catch (err) {
      console.error('Report generation error:', err);
      alert(`Report generation failed: ${err instanceof Error ? err.message : String(err)}`);
      setGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (activeReportText) {
      navigator.clipboard.writeText(activeReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#131314] text-[#e3e3e3] min-h-screen w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#37393b]">
        <div>
          <h1 className="text-2xl font-bold text-[#e3e3e3] tracking-tight flex items-center gap-2">
            <FileSpreadsheet size={28} className="text-[#7dd3fc]" /> Automated AI Report Generator
          </h1>
          <p className="text-xs text-[#c4c7c5]">
            Synthesize entire document repositories into publication-grade executive briefs, due diligence memos, and policy analyses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Template Selection & Generation Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#e3e3e3] uppercase tracking-wider">
              1. Select Report Template
            </h2>

            <div>
              {templates.map((tpl) => {
                const isSelected = selectedTemplate.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl)}
                    className={`py-3 border-b border-[var(--rule-2)] last:border-b-0 text-[13px] cursor-pointer transition-all space-y-1 ${
                      isSelected ? 'text-[var(--ink)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={isSelected ? 'font-semibold' : 'font-medium'}>{tpl.name}</span>
                      <span className="text-[12px] text-[var(--muted)]">{tpl.category}</span>
                    </div>
                    <p className="text-[12.5px] text-[var(--muted)] line-clamp-2 leading-relaxed">{tpl.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleGenerateReport} className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#e3e3e3] uppercase tracking-wider">
              2. Custom Focus & Inputs
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">Report Title</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder={`e.g. ${selectedTemplate.name} - Q3 Board Briefing`}
                  className="w-full px-3 py-2 bg-[#131314] border border-[#37393b] rounded-xl text-xs text-[#e3e3e3] placeholder-[#c4c7c5]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#c4c7c5] mb-1">Specific Prompt / Focus</label>
                <textarea
                  rows={3}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Emphasize regulatory compliance risks, price disclosure penalties, and 90-day notice requirements..."
                  className="w-full px-3 py-2 bg-[#131314] border border-[#37393b] rounded-xl text-xs text-[#e3e3e3] placeholder-[#c4c7c5]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 bg-[var(--teal)] hover:opacity-90 disabled:opacity-50 text-white font-medium text-[13.5px] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Writing your report...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate report
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Generated Report Previewer */}
        <div className="lg:col-span-2">
          {activeReportText ? (
            <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl overflow-hidden flex flex-col h-full">
              <div className="p-4 bg-[#131314] text-[#e3e3e3] border-b border-[#37393b] flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#7dd3fc]" /> Draft Report Output
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyText}
                    className="px-3 py-1.5 bg-[#28292a] hover:bg-[#37393b] text-xs text-[#e3e3e3] rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy Text'}
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#e3e3e3] font-sans max-h-[600px] whitespace-pre-wrap">
                {activeReportText}
              </div>
            </div>
          ) : (
            <div className="bg-[#1e1f20] border border-[#37393b] rounded-2xl p-16 text-center text-[#c4c7c5] text-xs space-y-3">
              <FileSpreadsheet size={36} className="mx-auto text-[#c4c7c5]" />
              <p className="font-semibold text-[#e3e3e3]">No report generated yet.</p>
              <p>Select a template on the left, customize your focus prompt, and click Generate.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
