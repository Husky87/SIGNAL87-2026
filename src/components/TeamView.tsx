import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Linkedin,
  Twitter,
  Mail,
  Building2,
  Award,
  Globe,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Cpu,
  BookOpen,
  Calendar,
  Search,
  FileText
} from 'lucide-react';

export const TeamView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leadership' | 'mission' | 'milestones'>('leadership');
  const [searchTerm, setSearchTerm] = useState('');

  // Structured JSON-LD for Search Engines (Schema.org Organization & Person)
  const jsonLdData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Signal87',
    url: 'https://signal87.ai',
    logo: 'https://signal87.ai/logo.png',
    description: 'Signal87 is the enterprise document memory and legal AI research platform engineered for real-time verification and citation synthesis.',
    founders: [
      {
        '@type': 'Person',
        name: 'Michael Benezra',
        jobTitle: 'Chief Executive Officer & Co-Founder',
        worksFor: { '@type': 'Organization', name: 'Signal87' },
        knowsAbout: ['Legal AI Memory', 'Document Intelligence', 'Natural Language Processing', 'Enterprise Software'],
        sameAs: ['https://linkedin.com/in/michaelbenezra', 'https://twitter.com/michaelbenezra']
      },
      {
        '@type': 'Person',
        name: 'Michael Chavira',
        jobTitle: 'Co-Founder',
        worksFor: { '@type': 'Organization', name: 'Signal87' },
        knowsAbout: ['Distributed Knowledge Systems', 'AI Infrastructure', 'Vector Memory', 'Enterprise Security'],
        sameAs: ['https://linkedin.com/in/michaelchavira', 'https://twitter.com/michaelchavira']
      }
    ]
  };

  const milestonesSequence = [
    {
      year: '2024 - Q3',
      milestone: 'Signal87 Foundation',
      leader: 'Michael Benezra & Michael Chavira',
      impact: 'Co-founded Signal87 to solve hallucination and memory loss in long-context legal and regulatory AI.',
      status: 'Completed'
    },
    {
      year: '2025 - Q1',
      milestone: 'Verifiable Memory Architecture v1',
      leader: 'Michael Chavira',
      impact: 'Engineered real-time citation tracing and multi-document vector index with strict zero-hallucination guardrails.',
      status: 'Completed'
    },
    {
      year: '2025 - Q3',
      milestone: 'Enterprise Beta Launch',
      leader: 'Michael Benezra',
      impact: 'Deployed Signal87 to top legal firms, municipal authorities, and healthcare policy research institutions.',
      status: 'Completed'
    },
    {
      year: '2026 - Q1',
      milestone: 'FedRAMP High & Multi-Doc Engine',
      leader: 'Executive Leadership',
      impact: 'Expanded infrastructure for 50+ simultaneous contract comparisons and automated executive brief generation.',
      status: 'Active'
    }
  ];

  return (
    <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 bg-[#131314] text-[#e3e3e3] font-sans min-h-[100dvh] w-full max-w-full overflow-x-hidden">
      {/* Inject JSON-LD Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      {/* Hero Header - SEO Optimized */}
      <header className="bg-[#1e1f20] border border-[#37393b] rounded-3xl p-6 sm:p-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#37393b] pb-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
              <Sparkles size={14} />
              <span>Signal87 Team</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#e3e3e3] tracking-tight leading-tight">
              Meet the Visionaries Engineering Verifiable Legal AI & Enterprise Memory
            </h1>
            <p className="text-sm sm:text-base text-[#c4c7c5] leading-relaxed font-normal">
              Signal87 is spearheaded by <strong className="text-[#e3e3e3] font-semibold">Michael Benezra</strong> (CEO & Co-Founder) and <strong className="text-[#e3e3e3] font-semibold">Michael Chavira</strong> (Co-Founder). Together, they lead a world-class team building secure, citation-backed document research systems for enterprise governance.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#131314] p-1.5 rounded-2xl border border-[#37393b] overflow-x-auto scrollbar-none w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('leadership')}
              className={`px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'leadership' ? 'bg-[var(--raised)] text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Executive Team
            </button>
            <button
              onClick={() => setActiveTab('mission')}
              className={`px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'mission' ? 'bg-[var(--raised)] text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Company Mission
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'milestones' ? 'bg-[var(--raised)] text-[var(--ink)] font-semibold' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Leadership Timeline
            </button>
          </div>
        </div>

        {/* SEO Keywords Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-[#c4c7c5] font-medium">
          <span className="text-[var(--ink)] font-medium">Focus areas:</span>
          <span>Legal AI Memory</span>
          <span>·</span>
          <span>Enterprise Research Engine</span>
          <span>·</span>
          <span>Regulatory Compliance</span>
          <span>·</span>
          <span>Citation Grounding</span>
          <span>·</span>
          <span>Document Intelligence</span>
        </div>
      </header>

      {/* Main Tab Content */}
      {activeTab === 'leadership' && (
        <section aria-labelledby="executive-leadership-heading" className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 id="executive-leadership-heading" className="text-xl font-bold text-[#e3e3e3] flex items-center gap-2">
              <Users size={22} className="text-[#c4c7c5]" /> Signal87 Co-Founders & Executive Leaders
            </h2>
            <span className="text-xs text-[#c4c7c5] font-medium hidden sm:inline">
              San Francisco, CA • Washington, D.C.
            </span>
          </div>

          {/* Key Executive Profile Cards with Schema Microdata */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Michael Benezra Profile Card */}
            <article
              itemScope
              itemType="https://schema.org/Person"
              className="bg-[#1e1f20] border border-[#37393b] rounded-3xl p-6 sm:p-8 hover:border-[#1a73e8] transition-all space-y-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-start gap-4 sm:gap-6">
                  <div className="relative">
                    <img
                      src="/assets/michael_benezra.jpg"
                      alt="Michael Benezra - Chief Executive Officer & Co-Founder Signal87"
                      itemProp="image"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-[#37393b]"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-[#1e1f20]" title="Verified Founder">
                      <ShieldCheck size={12} />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 itemProp="name" className="text-xl sm:text-2xl font-bold text-[#e3e3e3]">
                        Michael Benezra
                      </h3>
                      <span className="text-[12px] text-[var(--muted)]">
                        Co-Founder
                      </span>
                    </div>
                    <p itemProp="jobTitle" className="text-sm font-semibold text-[#c4c7c5]">
                      Chief Executive Officer & Co-Founder
                    </p>
                    <p className="text-xs text-[#c4c7c5] flex items-center gap-1 font-medium">
                      <Building2 size={12} className="text-[#c4c7c5]" />
                      <span itemProp="worksFor">Signal87 AI Memory Platforms</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#c4c7c5]">Executive Biography</h4>
                  <p itemProp="description" className="text-xs sm:text-sm text-[#e3e3e3] leading-relaxed">
                    Michael Benezra is the Chief Executive Officer and Co-Founder of Signal87. Under his leadership, Signal87 has pioneered verifiable document research memory for high-stakes legal, legislative, and enterprise policy teams. Michael brings a relentless focus on enterprise product design, legal tech innovation, and strategic AI alignment.
                  </p>
                </div>

                {/* Core Competencies */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#c4c7c5]">Key Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['Legal AI Strategy', 'Enterprise Document Memory', 'AI Governance', 'Product Vision', 'Municipal Tech'].map((skill, idx) => (
                      <span key={idx} className="text-[11px] font-medium bg-[#28292a] text-[#e3e3e3] px-2.5 py-1 rounded-lg border border-[#37393b]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Publications & Thought Leadership */}
                <div className="bg-[#131314] border border-[#37393b] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#e3e3e3]">
                    <BookOpen size={14} className="text-[#7dd3fc]" /> Key Insights & Publications
                  </div>
                  <ul className="text-xs text-[#c4c7c5] space-y-1 list-disc pl-4">
                    <li>"Eliminating Hallucinations in Municipal Ordinance Analysis" (2025)</li>
                    <li>"The Future of Citation-Backed Legal AI Systems" (2026 Keynote)</li>
                  </ul>
                </div>
              </div>

              {/* Contact / Social Links */}
              <div className="pt-4 border-t border-[#37393b] flex items-center justify-between text-xs">
                <span className="text-[#c4c7c5] font-medium">Contact & Media:</span>
                <div className="flex items-center gap-3">
                  <a
                    href="mailto:ceo@signal87.ai"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#e3e3e3] rounded-xl transition-colors cursor-pointer"
                    title="Email Michael Benezra"
                  >
                    <Mail size={16} />
                  </a>
                  <a
                    href="https://linkedin.com/in/michaelbenezra"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#7dd3fc] rounded-xl transition-colors cursor-pointer"
                    title="LinkedIn Profile"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href="https://twitter.com/michaelbenezra"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#7dd3fc] rounded-xl transition-colors cursor-pointer"
                    title="Twitter / X Profile"
                  >
                    <Twitter size={16} />
                  </a>
                </div>
              </div>
            </article>

            {/* Michael Chavira Profile Card */}
            <article
              itemScope
              itemType="https://schema.org/Person"
              className="bg-[#1e1f20] border border-[#37393b] rounded-3xl p-6 sm:p-8 hover:border-[#1a73e8] transition-all space-y-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-start gap-4 sm:gap-6">
                  <div className="relative">
                    <img
                      src="/assets/michael_chavira.jpg"
                      alt="Michael Chavira - Co-Founder Signal87"
                      itemProp="image"
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-[#37393b]"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-[var(--teal)] text-white p-1 rounded-full border-2 border-[#1e1f20]" title="Verified Founder">
                      <ShieldCheck size={12} />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 itemProp="name" className="text-xl sm:text-2xl font-bold text-[#e3e3e3]">
                        Michael Chavira
                      </h3>
                      <span className="text-[12px] text-[var(--muted)]">
                        Co-Founder
                      </span>
                    </div>
                    <p itemProp="jobTitle" className="text-sm font-semibold text-[#c4c7c5]">
                      Co-Founder & Chief Systems Architect
                    </p>
                    <p className="text-xs text-[#c4c7c5] flex items-center gap-1 font-medium">
                      <Building2 size={12} className="text-[#c4c7c5]" />
                      <span itemProp="worksFor">Signal87 Systems Architecture</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#c4c7c5]">Executive Biography</h4>
                  <p itemProp="description" className="text-xs sm:text-sm text-[#e3e3e3] leading-relaxed">
                    Michael Chavira is Co-Founder and Chief Systems Architect at Signal87. Michael architects Signal87's ultra-low latency vector pipelines, long-context memory stores, and distributed document parsing nodes. His engineering principles ensure sub-second citation verification with zero data leakage.
                  </p>
                </div>

                {/* Core Competencies */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#c4c7c5]">Key Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['Distributed Systems', 'Vector Search Infrastructure', 'Real-Time Citations', 'FedRAMP Security', 'Graph Indexing'].map((skill, idx) => (
                      <span key={idx} className="text-[11px] font-medium bg-[#28292a] text-[#e3e3e3] px-2.5 py-1 rounded-lg border border-[#37393b]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Technical Accomplishments */}
                <div className="bg-[#131314] border border-[#37393b] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#e3e3e3]">
                    <Cpu size={14} className="text-[#7dd3fc]" /> Core Engineering Architecture
                  </div>
                  <ul className="text-xs text-[#c4c7c5] space-y-1 list-disc pl-4">
                    <li>Designed Signal87's sub-second multi-document vector alignment engine</li>
                    <li>Pioneered immutable evidence tracking for legal auditability</li>
                  </ul>
                </div>
              </div>

              {/* Contact / Social Links */}
              <div className="pt-4 border-t border-[#37393b] flex items-center justify-between text-xs">
                <span className="text-[#c4c7c5] font-medium">Contact & Media:</span>
                <div className="flex items-center gap-3">
                  <a
                    href="mailto:michael.chavira@signal87.ai"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#e3e3e3] rounded-xl transition-colors cursor-pointer"
                    title="Email Michael Chavira"
                  >
                    <Mail size={16} />
                  </a>
                  <a
                    href="https://linkedin.com/in/michaelchavira"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#7dd3fc] rounded-xl transition-colors cursor-pointer"
                    title="LinkedIn Profile"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href="https://twitter.com/michaelchavira"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-[#28292a] hover:bg-[#37393b] text-[#7dd3fc] rounded-xl transition-colors cursor-pointer"
                    title="Twitter / X Profile"
                  >
                    <Twitter size={16} />
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      {/* Mission Section */}
      {activeTab === 'mission' && (
        <section className="bg-[#1e1f20] border border-[#37393b] rounded-3xl p-6 sm:p-10 space-y-6">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-2xl font-bold text-[#e3e3e3]">The Signal87 Mission & Core Values</h2>
            <p className="text-sm text-[#c4c7c5] leading-relaxed">
              Founded by Michael Benezra and Michael Chavira, Signal87 was built on a single uncompromising thesis: <strong className="text-[#e3e3e3]">Enterprise research AI must be completely verifiable, citation-backed, and immune to memory loss.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="p-5 bg-[#131314] border border-[#37393b] rounded-2xl space-y-2">
              <CheckCircle2 size={22} className="text-[var(--ok)]" />
              <h3 className="font-bold text-[#e3e3e3] text-sm">Verifiable Grounding</h3>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Every insight, summary, and comparison links directly to verbatim source clauses with page and line citations.
              </p>
            </div>

            <div className="p-5 bg-[#131314] border border-[#37393b] rounded-2xl space-y-2">
              <ShieldCheck size={22} className="text-[#7dd3fc]" />
              <h3 className="font-bold text-[#e3e3e3] text-sm">Zero Data Compromise</h3>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Enterprise documents remain securely within isolated, client-owned vaults protected by FedRAMP High standards.
              </p>
            </div>

            <div className="p-5 bg-[#131314] border border-[#37393b] rounded-2xl space-y-2">
              <Cpu size={22} className="text-amber-400" />
              <h3 className="font-bold text-[#e3e3e3] text-sm">Persistent Memory</h3>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Research threads, notes, and vector indices synchronize in real-time across teams via Firebase Firestore.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Leadership Timeline Section */}
      {activeTab === 'milestones' && (
        <section className="bg-[#1e1f20] border border-[#37393b] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#e3e3e3]">Signal87 Executive Leadership Timeline</h2>
            <p className="text-xs text-[#c4c7c5]">
              Clean tabular breakdown of executive milestones led by Michael Benezra and Michael Chavira.
            </p>
          </div>

          <div className="overflow-x-auto border border-[#37393b] rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#131314] border-b border-[#37393b] text-[#c4c7c5] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Strategic Milestone</th>
                  <th className="py-3 px-4">Leadership Lead</th>
                  <th className="py-3 px-4">Operational Impact</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#37393b] bg-[#1e1f20]">
                {milestonesSequence.map((m, idx) => (
                  <tr key={idx} className="hover:bg-[#28292a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#e3e3e3] whitespace-nowrap">
                      {m.year}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#e3e3e3]">
                      {m.milestone}
                    </td>
                    <td className="py-3.5 px-4 text-[#c4c7c5] font-semibold">
                      {m.leader}
                    </td>
                    <td className="py-3.5 px-4 text-[#c4c7c5] leading-relaxed">
                      {m.impact}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
 m.status === 'Completed'
 ? 'bg-[var(--ok)]/10 text-[var(--ok)] border border-[var(--ok)]/30'
 : 'bg-[var(--warn)]/10 text-[var(--warn)] border border-[var(--warn)]/30 animate-pulse'
 }`}
                      >
                        <CheckCircle2 size={11} /> {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Footer Contact Call to Action */}
      <footer className="bg-[#1e1f20] border border-[#37393b] text-[#e3e3e3] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base font-bold">Contact Signal87 Executive Office</h3>
          <p className="text-xs text-[#c4c7c5]">
            For investor relations, press queries, or executive briefings with Michael Benezra or Michael Chavira.
          </p>
        </div>
        <a
          href="mailto:ceo@signal87.ai"
          className="px-5 py-2.5 bg-[#1a73e8] text-white hover:bg-[#1557b0] font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer flex-shrink-0"
        >
          <Mail size={15} /> Request Executive Briefing
        </a>
      </footer>
    </main>
  );
};
