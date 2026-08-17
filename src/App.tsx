import React, { useState } from 'react';
import { Sparkles, ArrowRight, FileText, Upload, Settings } from 'lucide-react';

export default function Signal87Home() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSubmitted(true);
    setTimeout(() => {
      setResponse(`Analysis for: "${query}". Document processed securely against active knowledge base.`);
      setLoading(false);
    }, 1000);
  };

  const handlePresetClick = (text: string) => {
    setQuery(text);
  };

  return (
    <div className="bg-[#0b0f12] text-slate-100 min-h-screen font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <header className="w-full px-8 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.5)]">
            <Sparkles size={10} className="text-slate-950" />
          </div>
          <span className="font-medium tracking-tight text-slate-200">Signal87</span>
        </div>
        <div className="flex items-center space-x-6 text-sm text-slate-400">
          <a href="#docs" className="hover:text-slate-200 transition-colors">Docs</a>
          <a href="#api" className="hover:text-slate-200 transition-colors">API</a>
          <a href="#login" className="text-slate-200 font-medium hover:text-cyan-400 transition-colors">Log in</a>
        </div>
      </header>

      {/* Main Hero / Search Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <div className="w-full max-w-2xl mx-auto text-center space-y-8">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
            Ask anything about your documents
          </h1>

          <form onSubmit={handleSearch} className="relative w-full group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-teal-500/30 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative flex items-center bg-[#12181f] border border-slate-800 rounded-full px-6 py-4 shadow-2xl">
              <span className="text-cyan-400 font-mono text-sm mr-3">&gt;_</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your documents..."
                className="w-full bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 text-base"
              />
              <button type="submit" className="text-slate-400 hover:text-cyan-400 transition-colors ml-2">
                <ArrowRight size={18} />
              </button>
            </div>
          </form>

          {submitted ? (
            <div className="mt-8 p-6 bg-[#12181f] border border-slate-800/80 rounded-2xl text-left shadow-xl animate-fadeIn">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">Signal87 Reasoning Engine</div>
              {loading ? (
                <div className="flex items-center space-x-3 py-4 text-slate-400 text-sm">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Synthesizing document context...</span>
                </div>
              ) : (
                <p className="text-sm text-slate-300 leading-relaxed">{response}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 text-sm text-slate-500">
              <button 
                onClick={() => handlePresetClick("Summarize the latest contract")}
                className="hover:text-slate-300 transition-colors"
              >
                Summarize the latest contract
              </button>
              <button 
                onClick={() => handlePresetClick("What are the key risks mentioned?")}
                className="hover:text-slate-300 transition-colors"
              >
                What are the key risks mentioned?
              </button>
              <button 
                onClick={() => handlePresetClick("Compare clauses across versions")}
                className="hover:text-slate-300 transition-colors"
              >
                Compare clauses across versions
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-6 text-center text-xs text-slate-600">
        Signal87 AI • Cody, Wyoming
      </footer>
    </div>
  );
}
