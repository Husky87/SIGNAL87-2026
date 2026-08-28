import React, { useState } from 'react';
import { FileText, Upload, MessageSquare, Moon, Sun, ChevronRight, Play, Plus, Menu, X } from 'lucide-react';

export default function Signal87App() {
  const [darkMode, setDarkMode] = useState(true);
  // Phone-only: the sidebar is a drawer below md. At md and up it is the
  // same static rail it has always been and this stays false and unused.
  const [navOpen, setNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'compare' | 'chat'>('compare');
  const [selectedDocs, setSelectedDocs] = useState<string[]>(['EIN-MHCG Inc.pdf', 'Mount_Horeb_Capital_Strategy(1).pdf']);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'user', text: 'tell me about mount horeb' },
    { role: 'assistant', text: 'The document "Mount_Horeb_Capital_Strategy(1).pdf" has been successfully parsed using robust fallback extraction.', citations: ['CIT-01', 'CIT-02'] }
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
        { role: 'assistant', text: `Here is the analysis regarding "${newMsg}" based on your active documents.`, citations: ['CIT-01'] }
      ]);
    }, 1000);
  };

  return (
    <div className={darkMode ? 'dark bg-slate-950 text-slate-100 min-h-screen font-sans flex' : 'bg-slate-50 text-slate-900 min-h-screen font-sans flex'}>
      {/* Below md the rail slides in over the content instead of sitting beside
          it: at 390px a fixed 256px rail left main just 134px, which is what
          squeezed every heading to one word per line. From md up the
          md:* classes restore exactly the previous static rail. */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          aria-hidden="true"
        />
      )}
      <aside className={`w-64 border-r flex flex-col justify-between p-4 transition-colors fixed inset-y-0 left-0 z-50 transform md:static md:z-auto md:transform-none ${navOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div>
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center font-bold text-slate-950 shadow-md">S87</div>
              <span className="font-semibold text-lg tracking-tight">Signal87 AI</span>
            </div>
            <button
              onClick={() => setNavOpen(false)}
              className={`md:hidden w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg border transition-colors ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 min-w-[44px] md:min-w-0 rounded-lg border transition-colors ${darkMode ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              title="Toggle Theme"
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
              onClick={() => { setActiveTab('compare'); setNavOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'compare' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <FileText size={18} />
              <span>Multi-Doc Compare</span>
            </button>
            <button 
              onClick={() => { setActiveTab('chat'); setNavOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <MessageSquare size={18} />
              <span>Signal87 Deep Ask</span>
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

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`h-16 border-b flex items-center justify-between px-4 md:px-6 transition-colors ${darkMode ? 'bg-slate-900/50 border-slate-800 backdrop-blur' : 'bg-white/80 border-slate-200 backdrop-blur'}`}>
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setNavOpen(true)}
              className={`md:hidden -ml-1 w-11 h-11 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${darkMode ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-500/20 truncate">
              {activeTab === 'compare' ? 'Comparative Matrix Engine' : 'Long-Context Reasoning'}
            </span>
          </div>
          <div className="flex items-center space-x-4 flex-shrink-0">
            <span className="hidden sm:inline text-sm font-medium">Michael Benezra</span>
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-white text-sm">MB</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'compare' ? (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">Multi-Document Comparison Matrix</h1>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Compare contracts, bills, or financial filings simultaneously using Signal87 long-context reasoning.
                </p>
              </div>

              <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-500">Select Documents to Compare</h3>
                  <span className="text-xs text-slate-400">{selectedDocs.length} selected</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {['110_Harvard_Street_Loan_Proposal-1.pdf', 'EIN-MHCG Inc.pdf', 'Mount_Horeb_Capital_Strategy(1).pdf', 'Elition Allen Biography.docx'].map((doc, idx) => {
                    const isSelected = selectedDocs.includes(doc);
                    return (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedDocs(selectedDocs.filter(d => d !== doc));
                          } else {
                            setSelectedDocs([...selectedDocs, doc]);
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : darkMode ? 'border-slate-800 bg-slate-800/50 hover:border-slate-700' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <FileText size={18} className="text-cyan-500 shrink-0" />
                          <span className="text-sm font-medium truncate">{doc}</span>
                        </div>
                        <input type="checkbox" checked={isSelected} readOnly className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500" />
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-5 flex justify-end">
                  <button 
                    onClick={handleRunAnalysis}
                    disabled={analyzing || selectedDocs.length < 2}
                    className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl shadow transition-all disabled:opacity-50"
                  >
                    <Play size={16} />
                    <span>{analyzing ? 'Processing Analysis...' : `Run Comparative Analysis (${selectedDocs.length} Docs)`}</span>
                  </button>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-500 mb-3">Executive Comparative Synthesis</h3>
                {analyzing ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-slate-400">Parsing document buffers safely...</p>
                  </div>
                ) : analysisDone ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                      <h4 className="font-semibold text-sm mb-2 text-emerald-400">Shared Similarities & Clauses</h4>
                      <p className="text-sm text-slate-300">Both documents successfully reference the Mt. Horeb capital allocation and legal framework parameters.</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}>
                      <h4 className="font-semibold text-sm mb-2 text-amber-400">Key Differences & Divergences</h4>
                      <p className="text-sm text-slate-300">Loan proposal targets immediate term liquidity, whereas the capital strategy focuses on long-term structural milestones.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Select documents above and click run comparative analysis.</p>
                )}
              </div>
            </div>
          ) : (
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
                  placeholder="Ask anything about your files or strategy..."
                  className="flex-1 min-w-0 bg-transparent border-none outline-none px-3 min-h-[44px] md:min-h-0 text-base md:text-sm"
                />
                <button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 p-2.5 min-w-[44px] md:min-w-0 flex items-center justify-center rounded-xl font-medium transition-all flex-shrink-0">
                  <ChevronRight size={18} />
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
