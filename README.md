<!--
  Questify Project Report
  Generated: 2025-11-21
  This document synthesizes architecture, deployment, security, and product narrative.
-->

# Questify – Intelligent Assessment Generation Platform

> Elevating instructional design with multi-model AI (Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash) through a secure, teacher-focused workflow. Deployed with a decoupled architecture: backend (Netlify) + frontend (Vercel) for global scalability and rapid iteration.

---
## 1. Executive Summary
Questify transforms raw course materials (pasted text or uploaded PDFs / text files) into structured assessment questions (MCQ, short answer, long-form prompts) complete with answer keys and rubric guidance. It exposes an educator-friendly interface and abstracts complexity behind an optimized, secured API.

**Key Value Propositions**
1. Rapid assessment authoring – minutes instead of hours.
2. Pedagogical alignment – difficulty and format controls mapped to instructional goals.
3. Multi-tier AI models – productized as Questify Pro, Questify Beta X, and Questify 2.0.
4. Print-ready output – seamless export to physical or PDF distribution.
5. Secure handling of proprietary teaching materials (no client-side key leakage).

---
## 2. Product Tiers (Model Abstraction Layer)
| Tier Name          | Underlying Model            | Latency Profile | Use Case Emphasis                |
|--------------------|-----------------------------|-----------------|----------------------------------|
| Questify Pro       | `models/gemini-2.5-pro`     | Moderate        | Highest reasoning / complex rubrics |
| Questify Beta X    | `models/gemini-2.5-flash`   | Fast            | Iterative drafting / quick MCQs  |
| Questify 2.0       | `models/gemini-2.0-flash`   | Emerging / Exp  | Experimental, future-facing tasks |

The backend enforces a **strict allowlist**; unsupported or spoofed model identifiers are rejected early (defensive control against tampering).

---
## 3. High-Level Architecture
```
+-------------------+        HTTPS         +----------------------+        Google Generative AI
|    Vercel Frontend| <------------------> |  Netlify Serverless  | <----> Gemini Models (Allowlist)
|  React (Vite) UI  |   /api/generate      |  Express API         |        (2.5 Pro / Flash / 2.0)
+---------+---------+                     +----------+-----------+
          |                                            |
          |  File uploads (PDF/TXT)                    |
          v                                            v
      Client FormData ----------------> Multer (memory) -> Text Extraction -> Prompt Builder -> Schema-Enforced Generation
```

**Frontend**: React (Vite), animated modern interface, responsive grid, print overlay styling.
**Backend**: Express API (serverless-ready) handling ingestion, extraction, validation, generation, and formatting.
**Integration**: Single POST endpoint: `/api/generate` returning normalized JSON structure.

---
## 4. Detailed Data Flow (Sequence)
```
User Action
   │
   │ 1. Select difficulty, format, model, count
   │ 2. Paste text OR upload PDFs/text files
   │ 3. Submit form
   ▼
Frontend (React)
   │ Builds FormData (metadata + files)
   │ Displays loading state
   ▼
Backend (/api/generate)
   │ Validates inputs & converts model name (sanitizeModel)
   │ Extracts text (PDF via pdf-parse; raw text decoding)
   │ Concatenates & truncates (16k char safeguard)
   │ Builds structured instructional prompt
   │ Calls Gemini with JSON schema + MIME response contract
   ▼
Gemini Response
   │ Enforced by `responseSchema` -> reduces hallucination of extraneous fields
   ▼
Backend Normalization
   │ Parses JSON; attaches metadata (model, difficulty, format, counts)
   ▼
Frontend Rendering
   │ Animated list of questions
   │ Collapsible answer keys
   │ Print transformation (CSS @media print)
   ▼
Educator Output
   │ On-screen review, printable pack, optional PDF save
```

---
## 5. Backend Components (server/index.js)
| Concern                | Implementation Highlights |
|------------------------|---------------------------|
| Configuration          | `dotenv`, env vars for API key, origin, port |
| Security Surface       | Allowlist models; CORS origin; file size limits; schema-constrained LLM output |
| File Ingestion         | `multer.memoryStorage()` with caps (≤5 files, ≤12MB each) |
| Text Extraction        | Delegated to `extractTextFromFile` (PDF or text) |
| Prompt Engineering     | Difficulty & format hint infusion; deterministic JSON contract |
| Output Validation      | JSON.parse guarded; graceful fallback with raw dump on parse failure |
| Resilience             | Clear error paths (400 validation, 502 model format deviation, 500 catch-all) |
| Performance Guardrail  | `TRUNCATE_LIMIT = 16000` characters to manage token cost |
| Model Controls         | `sanitizeModel()` normalizes and rejects unapproved identifiers |

**LLM Call Strategy**: Uses `generationConfig` with `responseSchema` to align Gemini output to a stable JSON shape, reducing post-processing complexity and shielding the UI from malformation.

---
## 6. Text Extraction (server/utils/textExtractor.js)
| Feature          | Rationale |
|------------------|-----------|
| PDF Support      | Teachers frequently supply lecture decks / exported slides |
| Plain Text Set   | Accepts `.txt/.md/.csv/.json` for flexibility |
| Memory Safety    | Rejects zero-length buffers early |
| Error Semantics  | Throws on unsupported type -> caught upstream for clear UX |

Extension Path: Add `DOCX` (via `mammoth`), `PPTX` (via `pptx-parser`), image OCR (via `tesseract.js`) for future ingestion breadth.

---
## 7. Frontend Experience (client/src)
**UI Principles**
- Progressive disclosure: input panel separate from results.
- Animated micro-interactions (entry, gradient shifts, button sheen) establish polished brand identity.
- Responsive breakpoints: single-column on mobile, two-panel layout on large screens.
- Print-specific stylesheet (@media print) converts interactive UI to academic artifact format.

**Key Components**
- `App.jsx`: holistic container; manages state; orchestrates fetch lifecycle.
- Model Selector maps product tiers to internal Gemini model names.
- Dynamic question list with incremental animation; semantics preserved for accessibility.
- Answer keys hidden behind `<details>` to reduce cognitive overload until needed.

**Print System**
- Dedicated classes: `.screen-only`, `.print-only-header`, `.print-only-answer`.
- Styled counters, sanitized background removal, page-break handling, A4 sizing.

**Minor Issue Identified**: Third model option uses `model/gemini-2.0-flash` (missing `s` after `model`). This would fail allowlist matching and should be corrected to `models/gemini-2.0-flash`.

---
## 8. Security & Privacy Measures
| Control | Description | Impact |
|---------|-------------|--------|
| API Key Isolation | Stored in Netlify environment; never shipped to client | Prevents credential exfiltration |
| CORS Origin Restriction | Uses `CLIENT_ORIGIN` env – reduces browser-based cross-site abuse | Mitigates CSRF vectors |
| Model Allowlist | Rejects unapproved model names | Stops prompt injection attempts via arbitrary model selection |
| File Size & Count Limits | ≤12MB per file, max 5 files | Avoids memory exhaustion / cost spikes |
| Structured JSON Schema | `responseSchema` enforces known shape | Prevents UI crashes, filters hallucinated fields |
| Error Transparency | Granular HTTP codes | Aids debugging without leaking internals |

**Recommended Next Enhancements**:
1. Rate limiting (e.g., token bucket) per educator/session.
2. Audit logging (question generation metadata) with redaction of source texts.
3. Optional JWT-based educator auth & RBAC (roles: teacher, admin).
4. Secure storage & encryption at rest if persisting course materials.
5. Automated secret rotation via Netlify API or vault integration.

---
## 9. Performance & Scalability
| Aspect | Current Approach | Scaling Path |
|--------|------------------|--------------|
| Cold Starts | Small Express footprint | Edge/serverless function split |
| Token Consumption | Truncation at 16k chars; output limited to 2048 tokens | Adaptive chunking + streaming partial generations |
| Latency | Single synchronous LLM call | Parallel multi-format generation (fan-out) |
| Caching | None for identical requests | Introduce hash-based material cache (e.g., Redis) |
| Frontend Build | Vite optimized static assets | Code-splitting of future multi-view features |

**Growth Scenario**: Institutional adoption → add horizontal scaling via Netlify Functions sharding; implement queue-managed batch generation for large curricula.

---
## 10. Reliability & Error Handling
| Failure Mode | Mitigation |
|--------------|-----------|
| Missing API key | Early warning log + explicit error | Prevents silent failures |
| Malformed LLM JSON | 502 with raw payload attached | Debugging path for prompt tuning |
| Unsupported file type | Clear error bubble on UI | User-driven adjustment |
| Model block (policy) | Surfaced block reason | Curriculum trimming guidance |

Logging expansion could tag: `requestId`, `educatorId`, `model`, `durationMs`, `truncated` flag.

---
## 11. UX / Visual Design Accents
Highlights:
- Dynamic gradient title text & rotating radial background for brand feel.
- Staggered animation of question entries (engagement without overload).
- Microloading spinner embedded inside disabled button for spatial continuity.
- Semantic print transformation (turns interactive tags into academic numbering.)

Potential Additions:
1. Skeleton placeholders for result panel.
2. Accessibility audit (focus rings, ARIA for `<details>` summarization).
3. Dark/light mode toggle (CSS variable theming).

---
## 12. Deployment Overview
| Component | Platform | Notes |
|-----------|----------|-------|
| Backend API | Netlify | Environment variables: `GEMINI_API_KEY`, `CLIENT_ORIGIN` |
| Frontend UI | Vercel  | Static optimized build; global CDN edge delivery |
| Gemini Models | Google AI Studio | Key-scoped usage; allowlist enforced |

**Lifecycle**
1. Developer pushes to main.
2. Netlify build hooks deploy backend (function packaging).
3. Vercel build pipeline compiles React (tree-shaken + minified). 
4. DNS + HTTPS managed by respective platforms. 

---
## 13. Print Feature Deep Dive
Transforms interactive, animated interface into classic academic packet:
- Removes non-essential UI (header, footer, generation form).
- Re-maps decorative counters → semantic `Q#.` tokens.
- Enforces A4 margins, page-break avoidance for individual questions.
- Optionally apt for PDF archiving or physical distribution to learners.

---
## 14. Competitive Edge
| Dimension | Questify Advantage |
|-----------|--------------------|
| Teacher Time Savings | Streamlined ingestion + immediate output |
| Output Quality Control | Difficulty + format + schema integration |
| Secure Architecture | No client key exposure; controlled model usage |
| Extensibility | Clean separation enables rapid feature addition |
| Presentation Polish | High-fidelity animations & print fidelity |

---
## 15. Roadmap (Strategic Growth)
| Phase | Milestone | Outcome |
|-------|----------|---------|
| Q1 | User auth + persistence | Return & refine past sets |
| Q2 | LMS integrations (Canvas API) | Seamless classroom deployment |
| Q3 | Adaptive difficulty (post-response analytics) | Personalized assessment evolution |
| Q4 | Multi-lingual generation | Global teacher reach |
| Q5 | Analytics dashboard (learning objective coverage heatmaps) | Data-driven curriculum shaping |

Stretch: AI-assisted rubric builder, student answer auto-evaluation, secure on-prem model fallback for institutions.

---
## 16. Risk Assessment & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Hallucinated facts | Misaligned questions | Strict material grounding + possible semantic similarity checks |
| PII in course uploads | Data privacy | Add scanning & hashing before persistence |
| Key leakage via logs | Unauthorized usage | Redact sensitive headers; structured logging filters |
| Model policy blocks | Generation interruption | Pre-flight material size & content linting |

---
## 17. Suggested Enhancements (Incremental)
1. Fix `model/gemini-2.0-flash` typo → `models/gemini-2.0-flash`.
2. Add client-side validation of max question count & format combinations.
3. Introduce optimistic UI with partial streaming (progressive render for long sets).
4. Hook up centralized analytics (generation duration, token estimation).
5. Implement teacher tagging of learning objectives -> structured metadata for longitudinal tracking.

---
## 18. Sample API Interaction (Pseudo-Code)
```js
// Frontend snippet (already implemented conceptually)
const formData = new FormData();
formData.append('difficulty', 'medium');
formData.append('format', 'mcq');
formData.append('model', 'models/gemini-2.5-flash');
formData.append('questionCount', 5);
formData.append('textInput', 'Unit 1: Cell structure...');
// files -> formData.append('files', file)

const res = await fetch('/api/generate', { method: 'POST', body: formData });
const json = await res.json();
render(json.questions);
```

---
## 19. Prompt Engineering Rationale
Elements inserted:
- Role framing: “expert instructional designer” -> reduces meta / chatty output.
- Structured bullet expectations for fields -> aligns with schema.
- Difficulty & format semantic hints -> calibrates reasoning depth.
- JSON-only directive with explicit template -> reduces Markdown wrappers.

Potential Advanced Enhancement: Add few-shot exemplars with simplified questions to further reduce variance, cached server-side.

---

## 20. Appendix A – Key Code Fragments
```js
// Model allowlist (security gate)
const ALLOWED_MODELS = [ 'models/gemini-2.5-pro', 'models/gemini-2.5-flash', 'models/gemini-2.0-flash', ... ];

function sanitizeModel(rawModel) {
  const candidate = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;
  if (!ALLOWED_MODELS.includes(candidate)) throw new Error('Selected model is not in the approved allow list.');
  return candidate;
}
```
```js
// Response schema enforcement (stability & safety)
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 2048,
  responseMimeType: 'application/json',
  responseSchema: QUESTION_SCHEMA,
}
```
```css
/* Print transformation sample */
@media print {
  .screen-only { display: none; }
  .print-only-header { display: block; }
  .question-list li { page-break-inside: avoid; }
}
```

---
## 21. Appendix B – Future Monitoring Metrics (Proposed)
| Metric | Definition | Tooling |
|--------|------------|---------|
| Generation Latency | Time from request dispatch → response parse | APM (New Relic / OpenTelemetry) |
| Token Efficiency | Material chars ÷ output tokens | Logging + heuristic estimator |
| Model Distribution | % usage of each tier | Aggregated request logs |
| Error Rate | 4xx/5xx per 100 requests | Alert thresholds |
| Print Conversion Rate | Prints ÷ total generations | Frontend event tracking |

---
## 22. Instructor Summary (Concise Hand-off)
Questify delivers secure, schema-guided AI question generation across three productized model tiers, with polished educator UX, print fidelity, and foundational security controls (CORS, allowlists, secret isolation). Current implementation is stable and extensible; clear roadmap exists for authentication, analytics, and adaptive learning features.

---
## 23. Accreditation & Ethical Use Considerations
| Area | Consideration |
|------|---------------|
| Academic Integrity | Output used as formative assessment aids; discourage direct student answer distribution without review |
| Bias Mitigation | Encourage teacher review; future plan: bias heuristic scanning |
| Data Minimization | No persistence of raw materials (currently); adopt retention policies if storing |

---
## 24. Closing
Questify is architected not merely as a feature but as a platform foundation—cleanly separated layers, schema discipline, and clear extensibility pathways. This positions it for sustainable scaling, institutional trust, and iterative innovation.

> Ready for next phase: authentication + persistence + analytics.

---
*End of Report*
