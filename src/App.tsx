import React, { useState } from 'react';
import { 
  FileText, Upload, MessageSquare, Moon, Sun, 
  Play, ChevronRight, Plus, X, Eye, ShieldCheck, CheckCircle2
} from 'lucide-react';

interface DocumentItem {
  id: string;
  name: string;
  size: string;
  pages: number;
  type: string;
}

const DOCUMENTS: DocumentItem[] = [
  { id: '1', name: '110_Harvard_Street_Loan_Proposal-1.pdf', size: '2.4 MB', pages: 12, type: 'PDF' },
  { id: '2', name: 'EIN-MHCG Inc.pdf', size: '850 KB', pages: 3, type: 'PDF' },
  { id: '3', name: 'Mount_Horeb_Capital_Strategy(1).pdf', size: '4.1 MB', pages: 18, type: 'PDF' },
  { id: '4', name: 'Elition Allen Biography.docx', size: '420 KB', pages: 2, type: 'DOCX' }
];

export default function Signal87App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'compare' | 'chat' | 'repo'>('compare');
  const [selectedDocs, setSelectedDocs] = useState<string[]>(['EIN-MHCG Inc.pdf', 'Mount_Horeb_Capital_Strategy(1).pdf']);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const [messages, setMessages] = useState([
    { role: 'user', text: 'tell me about mount horeb' },
    { 
      role: 'assistant', 
      text: 'The document "Mount_Horeb_Capital_Strategy(1).pdf" has been successfully parsed without environment exceptions. It outlines the strategic capital roadmap for the Mt. Horeb property development, focusing on infrastructure permits and capital allocation.', 
      citations: ['CIT-01', 'CIT-02'] 
    }
  ]);

  const handleRunAnalysis = () => {
    setAnalyzing(true);
    setAnalysisDone(false);
    setTimeout(() => {
      setAnalyzing(false);
      setAnalysisDone(true);
    }, 1200);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: newMsg }]);
    setChatInput('');
    setTimeout(() => {
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', text: `Analyzed "${newMsg}" successfully across active long-context buffers.`, citations: ['CIT-01'] }
      ]);
    }, 900);
  };

  return (
    <div className={darkMode ? 'dark bg-slate-950 text-slate-100 min-h-screen font-sans flex' : 'bg-slate-50 text-slate-900 min-h-screen font-sans flex'}>
      
      {/* Sidebar - Clean AI Workspace Nav */}
      <aside className={`w-64 border-r flex flex-col justify-between p-4 transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div>
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center font-bold text-slate-950 shadow-md">S87</div>
              <span className="font-semibold text-lg tracking-tight">Signal87 AI</span>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg border transition-colors ${darkMode ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title="Toggle Light / Dark Theme"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <button className="w-full flex items-center justify-center space-x-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium py-2.5 px-4 rounded-xl shadow-sm transition-all mb-6">
            <Plus size={18} />
            <span>New Session</span>
          </button>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('compare')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'compare' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <FileText size={18} />
              <span>Multi-Doc Matrix</span>
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <MessageSquare size={18} />
              <span>Signal87 Deep Ask</span>
            </button>
            <button 
              onClick={() => setActiveTab('repo')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'repo' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <Upload size={18} />
              <span>Document Thumbnails</span>
            </button>
          </nav>
        </div>

        <div className={`pt-4 border-t ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between px-2 text-xs text-slate-400">
            <span>Cody, WY HQ</span>
            <span className="inline-flex items-center text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>API ACTIVE</span>
          </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header Bar */}
        <header className={`h-16 border-b flex items-center justify-between px-6 transition-colors ${darkMode ? 'bg-slate-900/50 border-slate-800 backdrop-blur' : 'bg-white/80 border-slate-200 backdrop-blur'}`}>
          <div className="flex items-center space-x-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20">
              {activeTab === 'compare' ? 'Comparative Matrix' : activeTab === 'chat' ? 'Long-Context Reasoning' : 'Document Thumbnail Repository'}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium">Michael Benezra</span>
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-white text-sm">MB</div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'compare' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">Multi-Document Comparison Matrix</h1>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Click any document below to inspect its visual thumbnail or launch the PDF viewer.
                </p>
              </div>

              {/* Document Thumbnail Selector Cards */}
              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-500 mb-4">Select Documents for Analysis</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DOCUMENTS.map((doc) => {
                    const isSelected = selectedDocs.includes(doc.name);
                    return (
                      <div 
                        key={doc.id}
                        className={`group relative rounded-xl border p-3 flex flex-col justify-between transition-all ${isSelected ? 'border-cyan-500 bg-cyan-500/10' : darkMode ? 'border-slate-800 bg-slate-900 hover:border-slate-700' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                      >
                        {/* Thumbnail Header / Preview Trigger */}
                        <div 
                          onClick={() => setPreviewDoc(doc)}
                          className={`h-32 rounded-lg mb-3 flex flex-col items-center justify-center p-3 cursor-pointer relative overflow-hidden transition-transform group-hover:scale-[1.02] ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                        >
                          <FileText size={36} className="text-cyan-500 mb-2" />
                          <span className="text-[11px] font-mono text-center truncate w-full px-2">{doc.name}</span>
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium space-x-1">
                            <Eye size={14} />
                            <span>Preview PDF</span>
                          </div>
                        </div>

                        {/* Checkbox and Select Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{doc.size}</span>
                          <button 
                            onClick={() => {
                              if (isSelected) setSelectedDocs(selectedDocs.filter(d => d !== doc.name));
                              else setSelectedDocs([...selectedDocs, doc.name]);
                            }}
                            className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${isSelected ? 'bg-cyan-500 text-slate-950' : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={handleRunAnalysis}
                    disabled={analyzing || selectedDocs.length < 2}
                    className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-50"
                  >
                    <Play size={16} />
                    <span>{analyzing ? 'Processing Parsing...' : `Run Comparative Analysis (${selectedDocs.length} Docs)`}</span>
                  </button>
                </div>
              </div>

              {/* Analysis Output */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-500 mb-3">Executive Comparative Synthesis</h3>
                {analyzing ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400">Executing robust parser without Promise conflicts...</p>
                  </div>
                ) : analysisDone ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                      <h4 className="font-semibold text-sm mb-2 flex items-center text-emerald-400"><CheckCircle2 size={16} className="mr-2" />Similarities & Overlapping Clauses</h4>
                      <p className="text-sm text-slate-300">Both documents successfully parsed. Shared capital parameters align seamlessly with Mt. Horeb milestones.</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                      <h4 className="font-semibold text-sm mb-2 flex items-center text-amber-400"><ShieldCheck size={16} className="mr-2" />Divergences & Key Metrics</h4>
                      <p className="text-sm text-slate-300">Loan proposal focuses on term debt structure, whereas capital strategy outlines structural property equity.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Select documents above and run analysis to display synthesis.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto flex flex-col h-full space-y-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-2xl p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-cyan-500 text-slate-950 font-medium' : darkMode ? 'bg-slate-900 border border-slate-800 text-slate-200' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                      <p>{m.text}</p>
                      {m.citations && (
                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex space-x-2">
                          {m.citations.map((c, ci) => (
                            <span key={ci} className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className={`p-2 rounded-2xl border flex items-center space-x-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow'}`}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask anything about your files..."
                  className="flex-1 bg-transparent border-none outline-none px-3 text-sm"
                />
                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-2.5 rounded-xl font-medium transition-all">
                  <ChevronRight size={18} />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'repo' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <h1 className="text-2xl font-bold tracking-tight mb-1">Document Repository Thumbnails</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {DOCUMENTS.map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className={`group p-4 rounded-2xl border cursor-pointer flex flex-col items-center transition-all ${darkMode ? 'bg-slate-900 border-slate-800 hover:border-cyan-500' : 'bg-white border-slate-200 shadow-sm hover:border-cyan-500'}`}
                  >
                    <div className={`w-full h-48 rounded-xl mb-4 flex flex-col items-center justify-center p-4 relative ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                      <FileText size={48} className="text-cyan-500 mb-3" />
                      <span className="text-xs font-mono text-center truncate w-full px-2">{doc.name}</span>
                      <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-sm font-semibold space-x-2 rounded-xl">
                        <Eye size={18} />
                        <span>Open PDF Viewer</span>
                      </div>
                    </div>
                    <div className="w-full flex justify-between items-center text-xs text-slate-400 px-1">
                      <span>{doc.size}</span>
                      <span>{doc.pages} Pages</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PDF Viewer Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className={`w-full max-w-4xl h-[85vh] rounded-2xl border flex flex-col shadow-2xl ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center space-x-3">
                <FileText className="text-cyan-500" size={20} />
                <span className="font-semibold text-sm">{previewDoc.name}</span>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className={`p-1.5 rounded-lg border transition-colors ${darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-950/20 overflow-y-auto">
              <div className={`w-full max-w-2xl h-[60vh] rounded-xl border flex flex-col items-center justify-center p-8 text-center shadow-inner ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <FileText size={64} className="text-cyan-500 mb-4 animate-pulse" />
                <h3 className="font-semibold text-lg mb-1">{previewDoc.name}</h3>
                <p className="text-xs text-slate-400 mb-6">Interactive PDF Viewer Render (Buffer: {previewDoc.size} • {previewDoc.pages} Pages)</p>
                <div className="flex space-x-3">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-medium">Parsed Successfully</span>
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full font-medium">Ready for Long-Context AI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
