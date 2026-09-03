import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { generateWithFallback } from './src/lib/aiFallbackService';
// Imported rather than require()d: this file is ESM, so the previous
// require('xlsx') threw "require is not defined" and every Excel export failed
// in dev. The production bundle is CJS, which is why it only broke on one side.
import * as XLSX from 'xlsx';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// ==========================================
// API ROUTES
// ==========================================

// Health Check
app.get('/api/health', async (req, res) => {
  const { default: h } = await import('./api/health');
  return h(req as any, res as any);
});

// Transactional Welcome Email Endpoint
app.post('/api/auth/welcome-email', async (req, res) => {
  try {
    const { email, name } = req.body;
    console.log(`[Transactional Email] Firing Welcome to Signal87 AI email for ${email} (${name || 'New Executive User'})`);

    // In a production setup, this integrates Resend/SendGrid/Postmark.
    // We log and return structured delivery confirmation.
    return res.json({
      success: true,
      emailSent: true,
      recipient: email || 'user@signal87.ai',
      subject: 'Welcome to Signal87 AI — Your Document Memory & AI Workspace is Live',
      deliveredAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Welcome Email Error:', err);
    return res.status(500).json({ error: 'Failed to dispatch welcome email' });
  }
});

// AI Chat Endpoint.
//
// This used to be a second, hand-maintained copy of the Vercel handler, and it
// drifted: it never gained the grounding rules, it fed unreadable PDF bytes to
// the model as if they were text, and it still built every citation with
// Math.random(). Dev and production answered the same question differently.
// It now delegates, so there is one implementation to fix.
app.post("/api/chat", async (req, res) => {
  const { default: chatHandler } = await import("./api/chat");
  return chatHandler(req as any, res as any);
});

// Flagship Research Agent Endpoint with Fallback
app.post("/api/research", async (req, res) => {
  const { default: h } = await import("./api/research");
  return h(req as any, res as any);
});

// Multi-Document Comparison Endpoint with Fallback
app.post("/api/compare", async (req, res) => {
  const { default: h } = await import("./api/compare");
  return h(req as any, res as any);
});

// AI Document Upload & Auto-Processing Endpoint with Fallback
app.post("/api/documents/process", async (req, res) => {
  const { default: h } = await import("./api/documents/process");
  return h(req as any, res as any);
});

// Excel Export Endpoint
app.post('/api/excel/generate', async (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Valid JSON data array required for Excel generation' });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'ResearchData');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'research_export.xlsx'}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error in /api/excel/generate:', error);
    return res.status(500).json({ error: 'Excel generation failed', details: error.message });
  }
});

// AI Document Summarization Endpoint with Fallback
app.post("/api/summarize", async (req, res) => {
  const { default: h } = await import("./api/summarize");
  return h(req as any, res as any);
});

// Powerful Quantitative & Reasoning Analysis Endpoint with Fallback
app.post("/api/analyze", async (req, res) => {
  const { default: h } = await import("./api/analyze");
  return h(req as any, res as any);
});

// Knowledge Graph Entity Extraction Endpoint with Fallback
app.post('/api/knowledge-graph/extract', async (req, res) => {
  try {
    const { text } = req.body;

    const aiResult = await generateWithFallback({
      prompt: `Extract entities and relations from:\n${text}`,
      systemInstruction: `Extract entities (People, Companies, Laws, Addresses, Contracts) and relationships in JSON:
{
  "nodes": [{"id": "k1", "label": "...", "type": "Company|Person|Law|Address", "details": "..."}],
  "links": [{"source": "k1", "target": "k2", "label": "...", "strength": 80}]
}`,
      model: 'gemini-3.6-flash',
      fallbackModel: 'gpt-4o-mini',
      temperature: 0.1,
      responseMimeType: 'application/json'
    });

    return res.json(JSON.parse(aiResult.text || '{"nodes":[],"links":[]}'));
  } catch (error: any) {
    return res.status(500).json({ error: 'Extraction failed' });
  }
});

// ==========================================
// VITE MIDDLEWARE & STATIC SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Signal87 AI Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
