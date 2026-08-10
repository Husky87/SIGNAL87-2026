import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Key,
  Calendar,
  DollarSign,
  FileText,
  Search,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Zap,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { DocumentItem } from '../types';

interface QuickAIAgentWidgetProps {
  documents: DocumentItem[];
  selectedModel: string;
  onSelectDocument: (doc: DocumentItem) => void;
}

interface QuickMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Array<{
    docId: string;
    docTitle: string;
    paragraphRef?: string;
    snippet?: string;
  }>;
  timestamp: string;
}

export const QuickAIAgentWidget: React.FC<QuickAIAgentWidgetProps> = ({
  documents,
  selectedModel,
  onSelectDocument
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<QuickMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I am your Instant Signal87 Quick Agent. Ask me anything about your documents—such as finding a password, key, contract term, valuation, or date—from anywhere on the platform.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || query;
    if (!textToSend.trim() || loading) return;

    const userMsg: QuickMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          documents: documents,
          model: selectedModel
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();

      const assistantMsg: QuickMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.text || 'No answer generated.',
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Quick AI Agent Error:', err);
      const errorMsg: QuickMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: 'Sorry, I encountered an issue retrieving that from the documents repository. Please try rephrasing your quick query.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts = [
    { label: 'Passwords & Keys', prompt: 'Search documents for any passwords, API keys, access credentials, or security passcodes.', icon: Key },
    { label: 'Effective Dates', prompt: 'Find the effective dates, execution dates, or expiration terms across all contracts.', icon: Calendar },
    { label: 'Valuation & Terms', prompt: 'What are the valuation numbers, financing amounts, and liquidation preferences in the term sheet?', icon: DollarSign },
    { label: 'Zoning Ordinance', prompt: 'What are the zoning density and FAR limits in the transit residential ordinance?', icon: FileText }
  ];

  return (
    <>
      {/* Floating Widget Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center gap-2.5 transition-all duration-300 hover:scale-105 group cursor-pointer"
          title="Instant AI Document Assistant (Cmd + K)"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping"></span>
            <div className="w-8 h-8 rounded-full bg-[var(--teal)] flex items-center justify-center text-white font-bold shadow-md">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-extrabold text-white leading-none flex items-center gap-1">
              Instant AI Agent <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1 rounded font-mono">⌘K</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Ask passwords, dates & terms</span>
          </div>
        </button>
      )}

      {/* Floating Agent Drawer / Window */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[440px] sm:h-[620px] bg-slate-950 text-slate-100 sm:rounded-3xl border border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[var(--teal)] flex items-center justify-center text-white font-bold shadow-md">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  Signal87 Quick Agent
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Ready
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck size={11} className="text-sky-400" />
                  {documents.length} docs indexed in memory
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/60 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                } space-y-1`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sky-500 text-slate-950 font-semibold rounded-br-none shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Citations / Matching Documents */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider block">
                        Source Citations Found:
                      </span>
                      {msg.citations.map((c) => {
                        const matchedDoc = documents.find((d) => d.id === c.docId || d.title === c.docTitle);
                        return (
                          <div
                            key={c.docId || c.docTitle}
                            className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-slate-200 truncate">
                                📄 {c.docTitle}
                              </p>
                              {c.paragraphRef && (
                                <p className="text-[10px] font-mono text-slate-400">
                                  {c.paragraphRef}
                                </p>
                              )}
                            </div>
                            {matchedDoc && (
                              <button
                                onClick={() => {
                                  onSelectDocument(matchedDoc);
                                }}
                                className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0"
                              >
                                View Doc <ExternalLink size={10} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Copy Button for Assistant responses */}
                  {msg.role === 'assistant' && msg.id !== 'welcome' && (
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                      <span>{msg.timestamp}</span>
                      <button
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        className="flex items-center gap-1 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy answer</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl w-fit text-xs text-sky-400 animate-pulse">
                <RefreshCw size={14} className="animate-spin" />
                <span>Scanning 12 documents for answer...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Quick Starter Prompts */}
          <div className="p-2.5 bg-slate-900/60 border-t border-slate-800/80 overflow-x-auto scrollbar-none flex gap-1.5">
            {quickPrompts.map((p, idx) => {
              const Icon = p.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(p.prompt)}
                  disabled={loading}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer flex-shrink-0"
                >
                  <Icon size={12} className="text-sky-400" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))'
            }}
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask quick query (e.g. password, date, term)..."
                className="w-full bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-full py-2.5 pl-4 pr-10 text-xs focus:outline-none focus:border-sky-500 transition-colors"
                disabled={loading}
              />
              <Search
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
