import React, { useState } from 'react';
import { X, BookOpen, Calendar, User, ArrowRight, Sparkles, Tag } from 'lucide-react';
import { Signal87Logo } from './Signal87Logo';

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BlogPost {
  id: string;
  title: string;
  snippet: string;
  content: string;
  author: string;
  role: string;
  date: string;
  readTime: string;
  tag: string;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-1',
    title: 'Eliminating Hallucinations in Multi-Document Vector Retrieval',
    author: 'Michael Chavira',
    role: 'Co-Founder & Chief Systems Architect',
    date: 'July 18, 2026',
    readTime: '6 min read',
    tag: 'AI Engineering',
    snippet: 'How Signal87 combines structured layout parsing with strict citation verification to guarantee 100% grounded legal responses.',
    content: `When dealing with multi-million dollar commercial leases or municipal zoning ordinances, a single hallucinated date or monetary penalty can trigger massive financial liability. 

Standard RAG architectures frequently fail because they treat documents as amorphous text blocks. At Signal87, we architected a multi-stage verification pipeline:

1. Structural Section Parsing: Documents are broken down by exact article, section, and paragraph identifiers rather than arbitrary token chunks.
2. Citation Trace Enforcement: Every generated insight is cross-checked against vector source passages with confidence score thresholding.
3. Strict Grounded Synthesis: The AI engine is strictly instructed to reject unbacked assumptions and output verifiable citation references.`
  },
  {
    id: 'post-2',
    title: 'How Signal87 Powers Real-Time Citation Verification for Executive Teams',
    author: 'Michael Benezra',
    role: 'Chief Executive Officer & Co-Founder',
    date: 'June 28, 2026',
    readTime: '5 min read',
    tag: 'Legal Tech',
    snippet: 'Empowering executive leadership to query entire document repositories in seconds with instant paragraph-level evidence.',
    content: `Executive teams don’t need long, speculative summaries; they need definitive, verifiable answers. "What is our indemnification cap across all 14 active vendor agreements?" "When does the Boston affordable housing mandate take effect?"

Signal87 was built from the ground up to solve this exact problem. By combining low-latency model routing with instant Firestore persistence, legal and policy teams can collaborate in real-time on verified facts.`
  },
  {
    id: 'post-3',
    title: '2026 Boston Zoning & Municipal Ordinance AI Research Synthesis',
    author: 'Signal87 Research Team',
    role: 'Policy & Regulatory Division',
    date: 'May 14, 2026',
    readTime: '4 min read',
    tag: 'Policy Research',
    snippet: 'An in-depth case study analyzing 2025-2026 municipal affordable housing requirements across transit hubs using Signal87 Deep Research.',
    content: `Municipal zoning revisions in major metro areas require deep cross-referencing between historical ordinances and proposed amendments. 

Using Signal87's Deep Research mode, policy analysts ingested over 400 pages of Boston housing ordinances and SEC filings to instantly generate structured comparison grids highlighting mandatory inclusionary rates, density bonuses, and penalty triggers.`
  }
];

export const BlogModal: React.FC<BlogModalProps> = ({ isOpen, onClose }) => {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors cursor-pointer z-10"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="p-2.5 bg-slate-950 text-white rounded-2xl flex items-center justify-center">
            <BookOpen size={24} className="text-[#7dd3fc]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Signal87 AI Research Blog & Insights
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Engineering perspectives on legal tech, document memory, and verifiable AI architectures.
            </p>
          </div>
        </div>

        {selectedPost ? (
          /* Single Post Detail View */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedPost(null)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              ← Back to all articles
            </button>

            <div className="space-y-3">
              <span className="text-[10px] bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full font-mono font-bold uppercase">
                {selectedPost.tag}
              </span>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {selectedPost.title}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium border-y border-slate-100 py-3">
                <span className="flex items-center gap-1.5 text-slate-800 font-bold">
                  <User size={14} className="text-slate-400" /> {selectedPost.author} ({selectedPost.role})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> {selectedPost.date}
                </span>
                <span>{selectedPost.readTime}</span>
              </div>
            </div>

            <div className="whitespace-pre-line text-xs sm:text-sm text-slate-700 leading-relaxed space-y-4 font-sans">
              {selectedPost.content}
            </div>
          </div>
        ) : (
          /* Blog Post List Grid */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BLOG_POSTS.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="p-5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-2xl flex flex-col justify-between space-y-4 transition-all cursor-pointer group hover:border-slate-300"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded font-mono font-bold">
                      {post.tag}
                    </span>
                    <span className="text-slate-400 font-medium">{post.readTime}</span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug group-hover:text-[var(--teal)] transition-colors">
                    {post.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                    {post.snippet}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="text-[11px] text-slate-500">{post.author}</span>
                  <span className="flex items-center gap-1 text-slate-900 group-hover:translate-x-0.5 transition-transform">
                    Read <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Signal87 AI Engineering & Publications</span>
          <span>Updated July 2026</span>
        </div>
      </div>
    </div>
  );
};
