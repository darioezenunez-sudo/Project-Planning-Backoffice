# Assistant Module — Complete Architectural Context Document

> **Purpose**: This document serves as the complete knowledge transfer for any new Claude Code session working on the Assistant module. It contains every architectural detail, data flow, file map, current state, known issues, and the roadmap for context/memory architecture redesign.

---

## Table of Contents

1. [Role & Engagement Rules](#1-role--engagement-rules)
2. [Application Overview](#2-application-overview)
3. [Assistant Module Architecture](#3-assistant-module-architecture)
4. [File Map & Responsibilities](#4-file-map--responsibilities)
5. [Data Flow — End to End](#5-data-flow--end-to-end)
6. [Database Schema](#6-database-schema)
7. [Cache Architecture](#7-cache-architecture)
8. [Provider Routing & Budget System](#8-provider-routing--budget-system)
9. [Switch System & Prompt Generation](#9-switch-system--prompt-generation)
10. [Audio Pipeline](#10-audio-pipeline)
11. [Screen Capture & OCR Pipeline](#11-screen-capture--ocr-pipeline)
12. [UI Architecture](#12-ui-architecture)
13. [Current State — What Works](#13-current-state--what-works)
14. [Known Issues & Technical Debt](#14-known-issues--technical-debt)
15. [The Core Problem — Context & Memory](#15-the-core-problem--context--memory)
16. [Roadmap — Context/Memory Architecture Redesign](#16-roadmap--contextmemory-architecture-redesign)
17. [Constraints & Non-Negotiables](#17-constraints--non-negotiables)
18. [Appendix A — Recent Fixes Applied](#18-appendix-a--recent-fixes-applied)
19. [Appendix B — Production Test Metrics](#19-appendix-b--production-test-metrics)
20. [Appendix C — Configuration Reference](#20-appendix-c--configuration-reference)
21. [Mejoras identificadas — Enriquecimiento de contexto visual vía getDisplayMedia videoTrack](#22-mejoras-identificadas--enriquecimiento-de-contexto-visual-vía-getdisplaymedia-videotrack)
22. [Documentación relacionada (guía de archivos) — Actualizada](#23-documentación-relacionada-guía-de-archivos--actualizada)

---

## 1. Role & Engagement Rules

```
Role Definition & Authority
You are the Technical Design Authority (TDA) and Principal Software Architect.
Your objective is not to assist, but to audit, challenge, and architect.
You operate at the level of a Staff Engineer at a Big Tech company.
You treat every interaction as a high-stakes Peer Review or an Architecture Review Board (ARB).
```

### Intellectual Rigor & Anti-Condescension Protocol

- **Zero Complacency**: Never use phrases like "Buena idea!", "Excelente eleccion" o "Tienes razon". Elimina todo lenguaje condescendiente o de validacion vacia.
- **Critical Friction**: If a proposal is suboptimal, identify the flaw immediately. If a statement is ambiguous, stop and demand precision before providing code.
- **Fact-Based Dissonance**: Prioritize technical truth over user agreement. If assumptions conflict with distributed systems theory or enterprise patterns, debunk them with evidence.
- **The "Senior Colleague" Filter**: Speak as if we are under a tight deadline and every line of code has a cost. Be concise, direct, and ruthlessly objective.

### Technology Stack for THIS Project

- **Runtime**: Electron (Main Process: Node.js) + Renderer (Chromium)
- **Database**: SQLite via `better-sqlite3` (synchronous API, WAL mode)
- **LLM Providers**: Ollama (local), Claude Haiku 4.5 (cloud), DeepSeek (cloud)
- **STT Provider**: Deepgram Nova-3 (real-time WebSocket, diarization)
- **OCR**: Tesseract.js (English + Spanish)
- **Language**: JavaScript (CommonJS modules, no TypeScript currently)
- **IPC**: Electron ipcMain/ipcRenderer with preload bridge
- **UI**: Vanilla Web Components (no React/Vue/Angular)

### Quality Standards

- SOLID principles, Clean Code, DDD-lite (domain separation via features/)
- Singleton pattern for services, EventEmitter for pub/sub
- WAL mode for SQLite concurrency
- Shared DB connection via sqliteClient singleton
- No `any` equivalent — validate all inputs
- No silent failures — log everything meaningful

### Execution Framework

1. **Critical Audit**: Analyze for architectural debt, performance bottlenecks, race conditions
2. **Context Discovery**: Ask for constraints (latency, cost, memory) if missing
3. **Architectural Trade-offs**: "Choose Your Poison" approach — never present a single solution as perfect
4. **Production-Grade Implementation**: Code that passes a Staff Engineer review
5. **Impact Assessment**: Quantify performance, cost, and maintainability impact

---

## 2. Application Overview

**Project Planning** is an Electron desktop application that acts as a real-time AI assistant during meetings, coding sessions, and technical interviews. It captures audio (microphone + system audio) and screen content, analyzes them with LLMs, and provides contextual suggestions.

### Module Structure

```
src/
  features/
    assistant/       <-- THIS MODULE (the focus of this document)
    listen/          <-- EN DEPRECACIÓN — solo referencia para migrar capacidades a Assistant
    ask/             <-- Chat/Q&A module
    common/          <-- Shared services (DB, auth, AI providers)
    settings/        <-- Settings management
  ui/
    assistant/       <-- Assistant UI components (Web Components)
    settings/        <-- Settings UI
    app/             <-- Main app shell
  bridge/            <-- IPC bridge between main and renderer
```

The Assistant module is architecturally independent from Listen/Ask. **Listen está en deprecación** — se mantiene en el repo solo como referencia de implementación hasta que Assistant absorba todas sus capacidades de captura de audio o las supere. Las decisiones arquitectónicas aplican únicamente a Assistant.

Assistant has its own:

- Audio capture pipeline (V2: getDisplayMedia + Deepgram multichannel stereo)
- Database tables (assistant_transcripts, assistant_suggestions, cache_l2, assistant_budget_usage)
- Analysis engine (IntelligenceEngine + ProviderRouter)
- UI panel (AssistantPanel + AssistantBadge + AssistantSettings)

---

## 3. Assistant Module Architecture

### High-Level Component Diagram

```
+-------------------+     +-------------------+     +-------------------+
|   UI Layer        |     |   Bridge Layer    |     |   Service Layer   |
|                   |     |                   |     |                   |
| AssistantPanel    |<--->| assistantBridge   |<--->| AssistantService  |
| AssistantBadge    |     | (IPC handlers +   |     | (Orchestrator)    |
| AssistantSettings |     |  event forwarding)|     |                   |
+-------------------+     +-------------------+     +--------+----------+
                                                             |
                          +----------------------------------+----------------------------------+
                          |                    |                    |                    |
                +---------v--------+ +---------v--------+ +--------v---------+ +--------v---------+
                | ContextAggregator| | IntelligenceEngine| | SuggestionManager| | AudioCapture V2  |
                | (audio + screen) | | (LLM analysis)   | | (CRUD + events)  | | (Deepgram STT)   |
                +--------+---------+ +--------+---------+ +--------+---------+ +--------+---------+
                         |                    |                    |                    |
                +--------v--------+  +--------v--------+  +-------v--------+  +--------v---------+
                | AudioRepository |  | ProviderRouter  |  | SuggestionsRepo|  | DeepgramSession  |
                | ImageProcessing |  | Cache L1 + L2   |  | (SQLite CRUD)  |  | AudioStateMachine|
                | OCR (Tesseract) |  | BudgetRepository|  |                |  | AudioFilter      |
                +-----------------+  +-----------------+  +----------------+  +------------------+
                         |                    |                    |                    |
                         +--------------------+--------------------+--------------------+
                                              |
                                    +---------v---------+
                                    |   sqliteClient    |
                                    | (shared singleton)|
                                    |  better-sqlite3   |
                                    |  WAL mode         |
                                    +-------------------+
```

### Key Design Patterns

| Pattern            | Where                                             | Purpose                                  |
| ------------------ | ------------------------------------------------- | ---------------------------------------- |
| Singleton          | All services, repositories                        | Single instance per process              |
| EventEmitter       | AssistantService, SuggestionManager, AudioCapture | Pub/sub decoupling                       |
| State Machine      | AudioStateMachine                                 | Enforce valid audio pipeline transitions |
| Dual-Layer Cache   | L1 (Map) + L2 (SQLite)                            | Avoid redundant LLM calls                |
| Promise Coalescing | assistantBridge.loadServices()                    | Prevent duplicate async imports          |
| Shared Connection  | sqliteClient.getDb()                              | Single DB connection across all repos    |
| Lazy Init          | BudgetRepository.\_getDb()                        | Safe access before explicit init         |
| Adaptive Timing    | AssistantService analysis loop                    | Context-aware analysis intervals         |

---

## 4. File Map & Responsibilities

### Service Layer (`src/features/assistant/services/`)

| File                       | Lines | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assistantService.js`      | ~950  | **Main orchestrator**. Start/stop lifecycle, adaptive analysis loop with anti-deadlock (Issue 3) + topic detection (Issue 2), config updates, screen capture timer, audio init, stereo audio IPC (Nivel 2); **Context Phase 2:** \_sessionContext (currentTopic, stage, occurrenceCount, lastUpdate, normalizedTopic) creado en start(), actualizado antes de cada análisis; **Context Phase 4 (N-4):** \_topicClusterer (TopicEmbeddingClusterer) init en start(), enriquecimiento async de topicClusterId antes de intelligenceEngine.analyze(), cleanup en stop(); **Phase 5 (20/02):** `clearEmbedCache()` llamado en start() para resetear caché de embeddings de dedup semántico; `_sessionContext._cyclesInStage: 0` inicializado en start() para guard N-1                                                                                                                                                                                                                         |
| `intelligenceEngine.js`    | ~780  | **LLM orchestrator**. Provider calling (Ollama/Cloud), response parsing, cost tracking, dual-cache integration; **N-2 (18/02):** `_calculateMaxOutputTokens(activeSwitchIds)` aplica Math.min sobre `config.llm.maxOutputTokens` keyed por switchId — Ollama: `num_predict`, Cloud: `maxTokens`; **Context Phase 4:** key type `smart+embed` cuando `sessionContext.topicClusterId` presente; L2 write sin guard `hasAudio` (removido); **6-Layer Prompt Architecture (20/02):** `_buildPrompt()` completamente reescrito (Layer 1: ROLE, Layer 2: CONTEXT SIGNALS additive, Layer 3: CONTEXT SOURCE audio-only/screen-only/both, Layer 4: OUTPUT RULES dominant switch only, Layer 5: CONTEXT DATA sanitizado, Layer 6: RESPONSE SCHEMA); **\_sanitizeContext(text) (20/02):** strips code blocks, injection phrases ('ignore previous instructions', 'you are now a...'), speaker role tokens (SYSTEM/ASSISTANT/USER), excess whitespace — aplicado a audio y OCR antes de interpolación |
| `providerRouter.js`        | ~394  | **Routing decision engine**. Context richness scoring, budget checking, priority switch detection, Ollama model selection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `contextAggregator.js`     | ~451  | **Context collection**. Audio transcript retrieval, screenshot capture, OCR execution, image diffing, context formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `suggestionManager.js`     | ~250  | **Suggestion lifecycle**. Batch insert with dedup filtering (Phase 1), dismiss, load, cleanup, event emission, `getRecentSummaries()` for prompt injection, `reloadSuggestions()` for session cleanup (Phase 1.5), `getSessionHistory()` for dismissal-resilient prompt injection (Phase 1.5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `assistantAudioCapture.js` | ~570  | **Audio capture V2**. Deepgram session, stereo sendStereoAudioContent, speaker from channel_index (Nivel 2: Speaker_1/Speaker_2), transcription handling, debouncing, save to DB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `audioStateMachine.js`     | ~460  | **State machine**. OFF/INITIALIZING/READY/STREAMING/RECONNECTING/ERROR transitions with guards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `deepgramSession.js`       | ~550  | **WebSocket wrapper**. Deepgram connection, keepalive, reconnection with exponential backoff + jitter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `budgetService.js`         | ~112  | **Budget abstraction**. Formatted budget info for UI, cloud affordability checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Cache Layer (`src/features/assistant/services/cache/`)

| File                | Responsibility                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contextCache.js`   | **L1 in-memory LRU cache**. 10 entries, 5min TTL, SHA-256 keys including switches+language. **Context Phase 3:** smart key `hash(stage+normalizedTopic+switches+language)` cuando sessionContext tiene stage válido. **Context Phase 4 (N-4):** smart+embed key cuando `sessionContext.topicClusterId` presente (overrides normalizedTopic). Exporta `TopicEmbeddingClusterer` class. |
| `contextCacheL2.js` | **L2 persistent SQLite cache**. 50 entries, 30min TTL, shared sqliteClient connection                                                                                                                                                                                                                                                                                                 |

### Repository Layer (`src/features/assistant/repositories/`)

| File                               | Table                    | Responsibility                                                                                                                                                                        |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio/sqlite.repository.js`       | `assistant_transcripts`  | Transcript CRUD with TTL (1 hour)                                                                                                                                                     |
| `suggestions/sqlite.repository.js` | `assistant_suggestions`  | Suggestion CRUD with batch insert, 24h expiry, `dismissOtherSessions()` for stale cleanup (Phase 1.5), `getSessionHistory()` for full session history including dismissed (Phase 1.5) |
| `budget/sqlite.repository.js`      | `assistant_budget_usage` | Usage recording, monthly spending queries, cleanup                                                                                                                                    |

### Config Layer (`src/features/assistant/config/`)

| File                  | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assistant.config.js` | Runtime config: intervals, providers, budget limits, Ollama params, switches state. **maxOutputTokens recalibrated (20/02):** exercise=5000, coding=5000, system-design=5500, tech-debate=5500, default=5500.                                                                                                                                                                                                                                                                                                                                                                                            |
| `switches.config.js`  | 7 switch definitions with keywords, prompts (en/es), priorities, weights. Exercise: Type A/B auto-detection. **6-Layer Prompt Architecture (20/02):** each switch has `contextSignal` (en/es) — additive description of context, no output prescription; `outputRules` (en/es) — precise format rules applied only when switch is dominant. New functions: `getDominantSwitch(activeSwitchIds)` (precedence: exercise>coding>debug>system-design>tech-debate>research>meeting), `getContextSignals(activeSwitchIds)` (additive — all active), `getDominantOutputRules(activeSwitchIds)` (dominant only). |
| `prompts.config.js`   | Bilingual prompt templates, JSON schema for suggestions, context formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Utils Layer (`src/features/assistant/utils/`)

| File                    | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performanceMonitor.js` | Tracks OCR/Cache/LLM/DB metrics with formatted console output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `imageProcessing.js`    | Perceptual hashing (dHash), change detection, OCR preprocessing, compression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `audioFilter.js`        | Noise detection, filler word filtering, repetition detection, text cleaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `suggestionDedup.js`    | **Phase 1**: Bigram Jaccard similarity (title 0.65, desc 0.70) + MD5 code hash dedup. **Phase 5 (20/02)**: `isDuplicateAsync()` + `filterDuplicatesAsync()` — semantic dedup via nomic-embed-text cosine similarity (threshold 0.88); in-session `_embedCache` (Map); `clearEmbedCache()` called at session start. Expected catch rate: ~35-50% (was ~10%).                                                                                                                                                                                                                                                                                                                                                |
| `contextAnalyzer.js`    | Context scoring, keyword extraction (unigrams+bigrams), extractTopicSummary(text, maxKeywords) (Context Phase 2), topic change detection (Jaccard), switch-based delay caps, multi-speaker detection. **normalizedTopic stability fix (20/02):** alphabetical sort applied after frequency-rank selection → deterministic cache key.                                                                                                                                                                                                                                                                                                                                                                       |
| `stageDetector.js`      | **Context Phase 2:** StageDetector.detect(context, sessionCtx) → `{ stage, occurrenceCount, _candidateStage, _cyclesInStage }` — scoring por keywords es/en, histéresis asimétrica, fast-path, MIN_SCORE_TO_TRANSITION=3, STAGE_ORDER, keywords wrapping_up limpiados. **N-1 (18/02):** STABLE_WINDOW_UP=2, STABLE_WINDOW_DOWN=3. **N-1 hardened (20/02):** STABLE_WINDOW_UP raised 2→3 (previene transiciones prematuras con ~4 min de evidencia de audio); nuevo MIN_CYCLES_IN_STAGE=2 — bloquea transiciones hacia arriba hasta que la etapa actual tenga ≥2 ciclos confirmados (downward exempto); `_cyclesInStage` counter en todos los return paths; resetea a 1 en cada cambio de etapa confirmado. |

### Bridge & UI (`src/features/assistant/` + `src/ui/assistant/`)

| File                                    | Responsibility                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assistantBridge.js`                    | **IPC bridge**. 15+ handlers, event forwarding, promise coalescing for lazy service loading                                                                                                       |
| `ui/assistant/AssistantPanel.js`        | Main suggestion display panel with Insights/Context views, code rendering, Mermaid diagrams                                                                                                       |
| `ui/assistant/AssistantBadge.js`        | Floating badge with suggestion count                                                                                                                                                              |
| `ui/assistant/AssistantSettings.js`     | Settings UI: toggles, switches, budget meter, stats display                                                                                                                                       |
| `ui/assistant/ContentRenderer.js`       | Code/Mermaid rendering orchestrator                                                                                                                                                               |
| `ui/assistant/MermaidRenderer.js`       | Mermaid diagram rendering with dark theme                                                                                                                                                         |
| `ui/assistant/CodeHighlighter.js`       | DISABLED — syntax highlighting (has HTML escaping bugs)                                                                                                                                           |
| `ui/assistant/assistantAudioCapture.js` | Frontend audio capture: Nivel 2 stereo (ChannelMerger → single processor, sendStereoAudio), handshake protocol. System audio vía `getDisplayMedia` + `setDisplayMediaRequestHandler` (Parte III). |

### Shared Services (`src/features/common/services/`)

| File                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sqliteClient.js`        | **Central DB singleton**. connect/getDb (with auto-reconnect)/close, schema sync                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `databaseInitializer.js` | DB lifecycle: create/ensure/validate/reset, runs sqliteClient.connect()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `modelStateService.js`   | AI model/provider state management, auto-selection, API key handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `localAIManager.js`      | Ollama + Whisper service monitoring, periodic state sync (30s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ollamaService.js`       | Ollama lifecycle: install/start/stop/sync, model management. **N-4 (18/02):** `embed(text, model)` — POST `/api/embeddings`, retorna `Float64Array` (768-dim para nomic-embed-text). `warmUpEmbeddingModel(model)` — carga el modelo en memoria con string vacío. **isModelInstalled() fix (20/02):** Ollama `/api/tags` retorna nombres con tag suffix (e.g. `nomic-embed-text:latest`); el método comparaba strings exactos sin tag → siempre `false` → Phase 4 permanentemente deshabilitado. Fix: función `normalise(name)` — append `:latest` cuando no hay `:` — comparación tag-agnostic. |

---

## 5. Data Flow — End to End

### 5.1 Audio Flow (Nivel 2: Stereo + Deepgram multichannel)

```
[Microphone] (Frontend)                    [System Audio] (Frontend)
    |                                           |
    getUserMedia({audio:true})                  getDisplayMedia({audio:true, video:false})
    |                                           + setDisplayMediaRequestHandler (auto-select)
    v                                           v
[ChannelMerger(2)]  <- mic → channel 0 (L), system → channel 1 (R)
    |
    v
[ScriptProcessor 2in/2out] -- interleaved Float32 L-R → Int16 → base64
    |
    v  (IPC: assistant:send-stereo-audio)
[assistantBridge.js] → assistantService.sendStereoAudioContent()
    |
    v
[assistantAudioCapture.sendStereoAudioContent()] → deepgramSession.send(payload)
    |
    v
[WebSocket wss://api.deepgram.com?channels=2&multichannel=true&sample_rate=24000] -->
    |
    v
[Deepgram Nova-3] -- transcription JSON with channel_index: [0,2] or [1,2] -->
    |
    v
[deepgramSession._handleTranscription()] -- passes channelIndex in transcriptionData
    |
    v
[assistantAudioCapture._handleTranscription()] -- speaker = channel_index[0]===1 ? "Speaker_2" : "Speaker_1"
    |
    v
[audioFilter.validate() + audioFilter.clean()] --> debounce 2s -->
    |
    v
[assistantAudioRepository.addTranscript()] -- SQLite INSERT -->
    |
    v
[assistant_transcripts table] (TTL: 1 hour)
```

**Nivel 2**: Frontend uses a single ChannelMergerNode (L=mic, R=system), one ScriptProcessor, one IPC stream. Deepgram receives stereo at **24 kHz**; response includes `channel_index`. Backend attributes speaker from channel index (0=Speaker*1, 1=Speaker*2). No timing heuristics; agnostic to IPC order.

**Windows (actual):** ~~`desktopCapturer` + `getUserMedia({chromeMediaSource: 'desktop'})`~~ — **sustituido por `getDisplayMedia` + `setDisplayMediaRequestHandler`** (auto-selección silenciosa, sin diálogo). Ver `docs/AUDIO_PLAN.md (Parte III)`.

**macOS:** el canal de sistema puede ir vacío (sin loopback nativo); diseño para captura compartida en macOS: `docs/AUDIO_PLAN.md (Parte II)` (pendiente de implementar).

### 5.2 Screen Capture Flow

```
[Screen] -- every 30s (configurable) -->
    |
    v
[assistantService._startScreenCapture()] -- setInterval -->
    |
    v
[contextAggregator.captureScreenshot()] -->
    |
    v
[Electron desktopCapturer / macOS screencapture] -- PNG buffer -->
    |
    v
[imageProcessing.calculateHash()] -- dHash (9x8 perceptual) -->
    |
    v
[imageProcessing.hasSignificantChange()] -- Hamming distance > 2? -->
    |
    YES                              NO
    |                                |
    v                                v
[contextAggregator._performOCR()]   [Skip OCR, reuse last text]
    |
    v
[Tesseract.js (en+es)] -- recognition -->
    |
    v
[Screenshot stored in memory history] (max 10 screenshots)
    |
    v
[contextAggregator._detectCode(text)] -- pattern matching -->
    |
    v
[Screenshot metadata: { ocrText, confidence, hasCode, timestamp }]
```

### 5.3 Analysis Flow (The Critical Path)

```
[AssistantService adaptive loop] -- every 30s-120s depending on context score -->
    |
    v
[contextAggregator.getContext()] -- retrieves audio (last 5min) + screen (last 3) -->
    |
    v
[_hasContextChanged()] -- text equality + word count delta (>=50 new words) -->
    |
    v
[ContextAnalyzer.detectTopicChange()] -- Issue 2: keyword Jaccard similarity -->
    |   Extracts unigrams+bigrams, filters stopwords (ES/EN)
    |   Topic changed if: similarity < 0.40 OR 50+ new unique words
    |   Phase 1.5: Also checks screen OCR text when no audio topic change detected
    |
    v
[Anti-deadlock checks] -- Issue 3 + Phase 1.5 FIX 2/3:
    |   - _skippedCycles >= 3? -> force analysis (no audio dependency)
    |   - 5 min since last analysis? -> force analysis (no audio dependency)
    |   - Timer decay: 25% reduction per skip when audio active (min 30s)
    |   - Phase 1.5: Force conditions fire regardless of audio state
    |
    SHOULD ANALYZE? (shouldForce = shouldForceByTimer || shouldForceByCycles)
    |
    YES
    |
    v
[_analyzeIncremental(forceAnalysis)] -- Phase 1.5 FIX 3: force flag bypasses inner gates -->
    |
    v
[Phase 1.5 FIX 2: hasNewScreen] -- compares OCR text content (not just screen count) -->
    |   Screen count change OR OCR content change = new screen
    |   forceThrough fires regardless of audio state
    |   forceAnalysis=true skips all context change checks
    |
    v
[Context scoring] -- score 0-100 based on:
    - hasCode (from screenshots)
    - hasErrors (error patterns in OCR/audio)
    - multipleSpeakers (Speaker_1 + Speaker_2 detected, Nivel 2 channel_index)
    - keyword density (error, uml, database)
    |
    v
[Score determines base interval]:
    score < 40  -> 120s (normal)
    score 40-60 -> 60s  (important)
    score > 60  -> 60s  (important)
    |
    v
[Issue 2: Delay capped by active switches]:
    meeting/tech-debate/exercise -> max 60s
    other switches with audio    -> max 90s
    no audio                     -> max 120s
    |
    v
[Context Phase 2: Update _sessionContext] -- before LLM call:
    currentTopic = ContextAnalyzer.extractTopicSummary(audio+screen, 10)
    stage = StageDetector.detect(context, _sessionContext); update occurrenceCount, lastUpdate
    options.sessionContext = _sessionContext
    |
    v
[intelligenceEngine.analyze(context, activeSwitchIds, provider, { suggestionHistory, sessionContext })] -->
    |
    v
[Cache L1 check] -- SHA-256(audio + screen + switches + language) -->
    |
    HIT? -> return cached suggestions
    MISS?
    |
    v
[Cache L2 check] -- same hash, SQLite lookup -->
    |
    HIT? -> return cached, promote to L1
    MISS?
    |
    v
[providerRouter.selectProvider(context, switches)] -->
    |
    v
[Decision tree]:
    1. forceCloud/forceLocal? -> use forced
    2. Budget exceeded? -> use Ollama
    3. Priority switch active? (exercise, coding, system-design, tech-debate) -> use Claude
    4. Context richness > 60? -> consider Claude
    5. Default -> Ollama
    |
    v
[_buildPrompt()] -- assembles:
    - System role prompt (from switches.config.js)
    - Language instruction (es/en)
    - Positive/negative instructions per switch
    - **Context Phase 2:** CURRENT MEETING STAGE / ETAPA ACTUAL (stage + currentTopic + instrucción anti-repetición) — solo si sessionContext.stage !== 'unknown'
    - ALREADY SUGGESTED section (Phase 1.5: last 10 session history items, includes dismissed)
    - Audio context (last 5 min transcripts, speaker-tagged: Speaker_1/Speaker_2)
    - Screen context (last 3 screenshots OCR)
    - Priority order
    - JSON output schema
    |
    v
[LLM Call] -- Ollama HTTP or Claude API -->
    |
    v
[_parseSuggestions(response)] -- JSON extraction, enrichment:
    - Type classification (debug/action/answer/insight/solution)
    - Priority assignment (low/medium/high)
    - Code extraction with language detection
    - Mermaid diagram detection
    - HTML tag stripping
    |
    v
[Cache SET] -- store in L1 + L2 -->
    |
    v
[Phase 1: filterDuplicates()] -- Bigram Jaccard + MD5 code hash dedup -->
    |
    v
[suggestionManager.addSuggestions()] -- batch INSERT transaction -->
    |
    v
[Event: suggestions-updated] -- { count, new } -->
    |
    v
[assistantBridge broadcasts to all windows] -->
    |
    v
[AssistantPanel renders new suggestions]
```

---

## 6. Database Schema

### Assistant-Specific Tables (Migration 001_schema_init.js)

```sql
-- Audio transcriptions from Deepgram
CREATE TABLE assistant_transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT NOT NULL,
    speaker TEXT DEFAULT 'Unknown',
    text TEXT NOT NULL,
    startAt INTEGER NOT NULL,        -- milliseconds (Date.now())
    ttl INTEGER,                      -- expiration timestamp in ms
    UNIQUE(sessionId, startAt, speaker)
);
CREATE INDEX idx_transcripts_session_time ON assistant_transcripts(sessionId, startAt);
CREATE INDEX idx_transcripts_ttl ON assistant_transcripts(ttl);

-- LLM-generated suggestions
CREATE TABLE assistant_suggestions (
    id TEXT PRIMARY KEY,              -- UUID v4
    sessionId TEXT NOT NULL,
    generatedAt INTEGER NOT NULL,     -- milliseconds
    suggestionType TEXT NOT NULL,      -- debug|action|answer|insight|solution
    priority TEXT DEFAULT 'medium',   -- low|medium|high
    title TEXT NOT NULL,
    description TEXT,
    code TEXT,                        -- optional code block
    language TEXT,                     -- javascript|typescript|python|sql|mermaid|pseudocode
    contextAudio TEXT,                -- audio context snapshot
    contextScreen TEXT,               -- screen context snapshot
    switchesActive TEXT,              -- JSON array of active switch IDs
    modelUsed TEXT,                   -- which LLM model generated this
    dismissed INTEGER DEFAULT 0,      -- 0=active, 1=dismissed
    expiresAt INTEGER                 -- milliseconds (24h from generation)
);
CREATE INDEX idx_suggestions_active ON assistant_suggestions(sessionId, dismissed, generatedAt);

-- Persistent LLM analysis cache (L2)
CREATE TABLE cache_l2 (
    contextHash TEXT PRIMARY KEY,     -- SHA-256 hash (first 32 hex chars)
    suggestionsJson TEXT NOT NULL,    -- JSON array of suggestions
    createdAt INTEGER NOT NULL,       -- milliseconds
    expiresAt INTEGER NOT NULL,       -- milliseconds (30min TTL)
    accessCount INTEGER DEFAULT 1,
    lastAccessed INTEGER
);
CREATE INDEX idx_cache_l2_expires ON cache_l2(expiresAt);

-- Cloud LLM usage tracking for budget management
CREATE TABLE assistant_budget_usage (
    id TEXT PRIMARY KEY,              -- UUID v4
    timestamp INTEGER NOT NULL,       -- milliseconds
    provider TEXT NOT NULL,           -- claude|deepseek|openai
    model TEXT NOT NULL,
    switchesActive TEXT,              -- JSON array
    inputTokens INTEGER NOT NULL,
    outputTokens INTEGER NOT NULL,
    costUsd REAL NOT NULL,
    monthYear TEXT NOT NULL,          -- 'YYYY-MM' for monthly aggregation
    createdAt INTEGER NOT NULL        -- milliseconds
);
CREATE INDEX idx_budget_month ON assistant_budget_usage(monthYear);
CREATE INDEX idx_budget_provider_month ON assistant_budget_usage(provider, monthYear);
```

### Shared Tables Used by Assistant

```sql
-- provider_settings: API keys, selected models, active providers
-- Used by: modelStateService, providerRouter, intelligenceEngine
provider_settings (
    provider TEXT PRIMARY KEY,
    api_key TEXT,
    selected_llm_model TEXT,
    selected_stt_model TEXT,
    is_active_llm INTEGER,
    is_active_stt INTEGER,
    whisper_language TEXT DEFAULT 'es'
)
```

### Convention: All timestamps are MILLISECONDS (Date.now()), all column names camelCase.

---

## 7. Cache Architecture

### Dual-Layer Strategy

```
Request: analyze(context, switches)
    |
    v
+---[L1: In-Memory Map]---+
| Key: SHA-256 hash        |
| (audio+screen+switches   |
|  +language) -> 32 hex    |
| MaxSize: 10 entries      |
| TTL: 5 minutes           |
| Eviction: LRU            |
+------+-------------------+
       |
       HIT -> return immediately (0ms)
       MISS
       |
       v
+---[L2: SQLite cache_l2]--+
| Key: same hash            |
| MaxSize: 50 entries       |
| TTL: 30 minutes           |
| Eviction: LRU by          |
|   lastAccessed timestamp  |
| Tracks: accessCount       |
+------+--------------------+
       |
       HIT -> promote to L1, return (~1ms)
       MISS -> call LLM, store in L1+L2
```

### Hash Generation — Three modes (Phase 2 → Phase 3 → Phase 4)

```javascript
_generateHash(context, activeSwitchIds = [], language = 'en', sessionContext = null) {
    const useSmartKey = sessionContext?.stage && sessionContext.stage !== 'unknown';

    if (useSmartKey) {
        // Phase 4 (smart+embed): topicClusterId presente → usa cluster ID estable
        // Phase 3 (smart):       normalizedTopic → top-3 keywords sorted
        const topicKey = sessionContext.topicClusterId || sessionContext.normalizedTopic || '';
        const keyType = sessionContext.topicClusterId ? 'smart+embed' : 'smart';
        const content = JSON.stringify({
            stage: sessionContext.stage,
            topic: topicKey,
            switches: [...activeSwitchIds].sort(),
            language
        });
        const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
        console.log(`[ContextCache] Hash (${keyType}): ${hash} — topic="${topicKey}", stage=${sessionContext.stage}`);
        return hash;
    }

    // Phase 2 (raw): full audio+screen content
    const content = JSON.stringify({
        audio: context.audio?.text || '',
        screen: context.screen?.screenshots?.map(s => s.ocrText).join('') || '',
        switches: [...activeSwitchIds].sort(),
        language
    });
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
}
```

### TopicEmbeddingClusterer (Context Phase 4 — N-4)

Clase session-scoped que mapea `normalizedTopic` → cluster ID estable usando embeddings de `nomic-embed-text` (768 dimensiones, cosine similarity).

```
normalizedTopic ("microservicios kafka")
    |
    v  embed() → Float64Array[768]
    |
    v  cosineSimilarity vs centroids existentes
    |
    threshold 0.82?
    YES → retorna clusterId existente ("t0") + actualiza centroide (running average)
    NO  → crea nuevo cluster ("t1"), guarda centroide
    |
    v  _embedCache.set(topicText, clusterId)  ← in-session dedup
    |
    v  sessionContext.topicClusterId = "t0"
    |
    v  _generateHash() usa "t0" en vez de "microservicios kafka"
```

**Graceful fallback chain**: `topicClusterId` → `normalizedTopic` → raw hash (backward compatible).

**Parámetros**:

- `similarityThreshold`: 0.82 (calibrado para reuniones en español)
- `embeddingModel`: `nomic-embed-text` (debe estar instalado: `ollama pull nomic-embed-text`)

### Cache hit rate — historial

| Sesión              | Fecha      | Hit Rate     | Causa                                     |
| ------------------- | ---------- | ------------ | ----------------------------------------- |
| exercise 28min      | pre-Phase3 | 0%           | raw key con audio acumulativo             |
| tech-debate 30min   | pre-Phase3 | 0%           | raw key, 0 L2 writes (hasAudio guard)     |
| tech-debate 32min   | 18/02/2026 | 10.3% (3/29) | smart key pero normalizedTopic inestable  |
| **objetivo Phase4** | —          | ~40-60%      | topicClusterId estable + nomic-embed-text |

---

## 8. Provider Routing & Budget System

### Decision Tree (providerRouter.selectProvider)

```
Input: context, activeSwitchIds, options
    |
    v
1. forceCloud=true? ----YES----> Claude (forced)
2. forceLocal=true? ----YES----> Ollama (forced)
3. Budget exceeded? ----YES----> Ollama (budget limit)
4. Priority switch?  ----YES----> Claude (priority: exercise, coding, system-design, tech-debate)
5. Context richness > 60? --YES-> Claude (rich context)
6. Default ----------------------> Ollama (cost-free local)
```

### Budget Configuration

```javascript
budget: {
    enabled: true,
    monthlyLimit: 20,           // $20 USD/month
    cloudProvider: 'claude',
    pricing: {
        claude: { input: 0.0008, output: 0.004 },    // per 1K tokens
        deepseek: { input: 0.00027, output: 0.0011 },
        openai: { input: 0.0025, output: 0.01 }
    },
    prioritySwitches: ['exercise', 'coding', 'system-design', 'tech-debate'],
    warningThreshold: 0.80
}
```

### Ollama Model Selection

```
meeting (no code)     -> gemma3:12b    (8GB, general)
code/exercise/UML     -> qwen3-coder:30b (18GB, code-specialized)
debug with errors     -> deepseek-r1:8b  (reasoning)
research              -> gemma3:27b      (large context)
default               -> qwen3-coder:30b
```

### Cost Tracking

Every cloud call records to `assistant_budget_usage`:

- Provider + model + active switches
- Input/output tokens
- Cost in USD
- Month (YYYY-MM) for aggregation

---

## 9. Switch System & Prompt Generation

### 7 Available Switches

| ID              | Priority | Cloud? | requiresCodeOutput | Key Behavior                                                                                        |
| --------------- | -------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| `debug`         | 1        | No     | No                 | Detect code smells, SOLID violations, error patterns                                                |
| `exercise`      | 2        | YES    | Yes                | **Two modes**: Type A (code solutions, Big O) + Type B (output prediction, event loop step-by-step) |
| `meeting`       | 3        | No     | No                 | Track decisions, action items, blockers                                                             |
| `research`      | 4        | No     | No                 | Explain docs/concepts, no code output                                                               |
| `coding`        | 5        | YES    | Yes                | Code writing/review on real codebases, Mermaid diagrams                                             |
| `system-design` | 6        | YES    | Yes                | Architecture diagrams, trade-off analysis, max 3 suggestions                                        |
| `tech-debate`   | 7        | YES    | No                 | Technical discussions, theory, comparisons (audioWeight: 2.0)                                       |

### Exercise Switch — Type A vs Type B (Auto-detected)

|              | Type A — Code Solution                              | Type B — Output Prediction                                                             |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Trigger**  | "implementa", "solve", algorithm problems           | Code with `console.log` + "what is the output?"                                        |
| **Output**   | Complete solution + Big O analysis                  | Exact output line-by-line + step-by-step execution order                               |
| **Concepts** | Algorithms, DS, LeetCode easy/medium/hard           | Event Loop, microtasks vs macrotasks, hoisting, closures, `this`, prototypes, coercion |
| **Keywords** | leetcode, algorithm, implement, solve, dp, bfs, dfs | console.log, output, event loop, setTimeout, Promise, hoisting, closure, this          |

### Switch Segmentation Strategy

- **`exercise`**: Isolated challenges (LeetCode, interviews, output prediction) — no repo context needed
- **`coding`**: Development on real codebases — needs screen/audio context of the full repository (future: will leverage repo-aware context when audio pipeline is stable)

### Prompt Assembly Pipeline

```
1. getActivePrompts(activeSwitchIds, language)
   -> Returns sorted prompts by priority with language extraction

2. detectDominantContext(audioText, screenText, activeSwitchIds)
   -> Keyword detection with configurable weights per switch
   -> Returns priority-ordered switch IDs

3. buildPrompt({ language, systemPrompts, instructions, context, switches })
   -> Assembles:
      - Role: "You are Assistant, an AI helping with software engineering tasks."
      - Language: "IMPORTANTE: Debes responder SIEMPRE en espanol."
      - Per-switch system prompts (sorted by priority)
      - Per-switch positive instructions
      - Per-switch negative instructions (things to avoid)
      - Priority order header
      - Audio context (speaker-labeled, last 5 min)
      - Screen context (OCR text, code detection flags)
      - JSON output schema (strict format)

4. Output Schema:
   {
     "suggestions": [{
       "type": "debug|action|answer|insight|solution",
       "priority": "low|medium|high",
       "title": "<50 chars",
       "description": "brief explanation",
       "code": "optional, use \\n for newlines",
       "language": "javascript|typescript|python|sql|mermaid|pseudocode"
     }]
   }
```

### Keyword Detection

Each switch has multilingual keyword arrays. `exercise` now has 60+ keywords covering:

- Challenge platforms: leetcode, codewars, hackerrank, challenge, interview
- Output prediction: console.log, output, execution order, predict
- Event Loop & async: microtask, macrotask, setTimeout, Promise, async/await, process.nextTick
- Hoisting & scope: hoisting, var, let, const, TDZ, closure, lexical scope
- this & prototypes: this, bind, call, apply, arrow function, prototype
- Coercion: truthy, falsy, typeof, instanceof, NaN
- Data structures: big o, complexity, linked list, tree, graph, binary search, dp, bfs, dfs

`tech-debate` has 400+ keywords organized by category (architecture, protocols, frontend, backend, AWS, databases, DevOps, security).

---

## 10. Audio Pipeline

### State Machine (AudioStateMachine)

```
OFF ──enable()──> INITIALIZING ──onSttReady()──> READY ──onFrontendAck()──> STREAMING
 ^                    |                            ^                           |
 |                    | (timeout 30s)              |                           |
 |                    v                            |                           |
 |                  ERROR                    RECONNECTING <──onWsClose()───────+
 |                    |                       (backoff)
 +────disable()───────+──────────────────────────+
```

### Handshake Protocol

```
Backend: OFF -> INITIALIZING -> creates DeepgramSession (24kHz) -> WebSocket connected -> READY
    |
    v  (emits audio:ready to frontend via IPC)
Frontend: receives audio:ready -> acquires mic (getUserMedia) + system (getDisplayMedia) -> sends audio:ack
    |
    v  (IPC: assistant:audio-ack)
Backend: READY -> STREAMING (stereo chunks via assistant:send-stereo-audio)
```

### System Audio Capture (Windows)

```
Main process: setDisplayMediaRequestHandler registrado en app.whenReady()
    -> auto-selecciona pantalla principal + audio: 'loopback'
    -> NO muestra diálogo al usuario

Frontend captureSystemAudio():
    navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })
    -> handler intercepta, devuelve loopback audio
    -> audioTrack se conecta a ChannelMerger canal 1 (R)
```

**Decisión**: Auto-selección silenciosa. El usuario consiente al activar el toggle de audio en settings. `audio: 'loopback'` captura TODO el audio del sistema (Meet, Teams, Zoom). Ver `docs/AUDIO_PLAN.md (Parte III)` para detalles de implementación.

### Speaker Identification (Nivel 2: channel_index)

```
Frontend: ChannelMergerNode outputs stereo (L=mic, R=system). Single IPC sendStereoAudio.
Deepgram: URL includes channels=2&multichannel=true&sample_rate=24000. Response has channel_index: [0,2] or [1,2].
Backend:  speaker = (channel_index[0] === 1) ? "Speaker_2" : "Speaker_1". No timing/heuristics.
```

### Reconnection Strategy

- Exponential backoff: 1s -> 2s -> 4s -> 8s max
- Jitter: +/-20% randomization
- Max attempts: 3
- Reconnectable codes: 1001, 1006, 1011
- Non-reconnectable codes: 4000 (auth), 4001

### Audio Filtering (audioFilter.js)

Filters before DB save:

- Empty/whitespace text
- Filler words (uh, um, ah, hmm)
- Whisper markers [BLANK_AUDIO]
- Parenthetical sounds (laugh), (cough)
- Very short phrases (< 3 chars or < 2 words)
- Repetitions (circular buffer detection)

---

## 11. Screen Capture & OCR Pipeline

### Image Processing (imageProcessing.js)

1. **Capture**: Electron desktopCapturer (Windows/Linux) or macOS screencapture
2. **Hash**: Difference hash (dHash) — resize to 9x8, compare adjacent pixels, 64-bit hash
3. **Change Detection**: Hamming distance between current and previous hash. Threshold: 2 bits
4. **OCR**: Tesseract.js with English + Spanish, preprocessed (grayscale, normalize, sharpen)
5. **Code Detection**: Pattern matching for `function`, `const`, `class`, `import`, `=>`, `{`, etc.

### Optimization

```
OCR skip rate in production: 60-70%
Only runs OCR when screen content changes (Hamming distance > 2)
Avg OCR latency: ~4 seconds
Max screenshots in context: 3 (most recent)
OCR text limit per screenshot: 1000 chars
```

---

## 12. UI Architecture

### Component Hierarchy

```
SettingsView
  └── AssistantSettings (Web Component)
       ├── Main Enable/Disable Toggle
       ├── Context Sources (Audio + Screen toggles)
       ├── Mode Switches Grid (7 switches with icons)
       ├── Stats Section (analysis count, suggestions, screenshots)
       └── Budget Meter (progress bar, breakdown, provider selector)

AssistantBadge (Floating, bottom-right)
  └── Suggestion count indicator with pulse animation

AssistantPanel (Draggable overlay)
  ├── Header
  │    ├── "Analyze Now" button
  │    ├── "Deep Analysis" button (force cloud)
  │    ├── Provider badge (shows current LLM)
  │    └── View toggle (Insights / Context)
  ├── Insights View
  │    └── Suggestion Cards
  │         ├── Type badge (color-coded: debug=red, action=blue, solution=yellow, insight=purple, answer=green)
  │         ├── Title
  │         ├── Description
  │         ├── Code block (via textContent, XSS-safe)
  │         ├── Copy code button
  │         ├── Expand button (opens modal for Mermaid)
  │         └── Dismiss button
  ├── Context View
  │    ├── Audio transcript display
  │    ├── Screen capture info
  │    └── Active switches list
  └── Expanded Code Modal (zoom controls for Mermaid diagrams)
```

### Rendering Strategy

- **Regular code**: Direct `textContent` assignment (XSS-safe, no innerHTML)
- **Mermaid diagrams**: ContentRenderer -> MermaidRenderer -> SVG (safe generated content)
- **CodeHighlighter**: DISABLED (has HTML escaping bugs, can be replaced with Prism.js)

### Design System

- Dark theme: `rgba(0,0,0,0.85)` with backdrop blur
- Gradient buttons: `#6366f1` (indigo) to `#a855f7` (purple)
- Custom scrollbars, smooth transitions
- Fully draggable panel

---

## 13. Current State — What Works

After six rounds of fixes (9 DB + 5 performance + Phase 1 context + 3 meeting issues + exercise enhancement + Phase 1.5 pipeline fixes), the system is **stable and significantly improved**:

| Component                                                  | Status                     | Notes                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB connection                                              | STABLE                     | Auto-reconnect via sqliteClient, clearCaches() preserves connections                                                                                                                                                                                                                                                         |
| Audio capture                                              | **IMPLEMENTADO**           | Deepgram V2 with state machine, stereo + multichannel (Nivel 2). Sample rate 24 kHz end-to-end. **System audio Windows**: `getDisplayMedia` + `setDisplayMediaRequestHandler` (Parte III implementada). **macOS**: pendiente (Parte II).                                                                                     |
| Speaker ID                                                 | **IMPLEMENTADO (Windows)** | Speaker_1 (channel 0 / mic) + Speaker_2 (channel 1 / system) via `channel_index`. En Windows, `getDisplayMedia` loopback captura audio de Meet/Teams/Zoom. En macOS, Speaker_2 pendiente (Parte II).                                                                                                                         |
| Screen capture                                             | STABLE                     | dHash change detection, 60-70% OCR skip rate                                                                                                                                                                                                                                                                                 |
| LLM analysis                                               | IMPROVED                   | Anti-deadlock (Issue 3) + topic detection (Issue 2) + delay caps + **Phase 1.5**: screen-only context change, force-through without audio dependency, double-gate bypass                                                                                                                                                     |
| Suggestion dedup                                           | NEW                        | Phase 1: Bigram Jaccard + MD5 code hash filtering before INSERT                                                                                                                                                                                                                                                              |
| Prompt history                                             | IMPROVED                   | **Phase 1.5**: Session history injection (includes dismissed suggestions), resilient to user dismissals                                                                                                                                                                                                                      |
| Session cleanup                                            | NEW                        | **Phase 1.5**: `dismissOtherSessions()` clears stale suggestions on startup                                                                                                                                                                                                                                                  |
| Screen context detection                                   | NEW                        | **Phase 1.5**: OCR text comparison detects screen-only topic changes (works without audio)                                                                                                                                                                                                                                   |
| Force analysis                                             | FIXED                      | **Phase 1.5**: Force timer/cycles bypass both outer AND inner gates (`forceAnalysis` flag)                                                                                                                                                                                                                                   |
| Cache L1+L2                                                | FUNCTIONAL                 | Works but 0% hit rate with audio (by design — Context Phase 3 will fix)                                                                                                                                                                                                                                                      |
| Budget tracking                                            | STABLE                     | $0.03 per 30-min session (tech-debate), well within $20/month                                                                                                                                                                                                                                                                |
| Switch toggles                                             | FIXED                      | Backend config synced to frontend on load                                                                                                                                                                                                                                                                                    |
| Budget meter                                               | FIXED                      | Correct property access for breakdown objects                                                                                                                                                                                                                                                                                |
| Exercise switch                                            | ENHANCED                   | Type A (code solution + Big O) + Type B (output prediction + event loop)                                                                                                                                                                                                                                                     |
| Adaptive timing                                            | IMPROVED                   | Max 60s for conversation switches, 90s for others with audio, force after 3 skips or 5 min, **no audio dependency for force**                                                                                                                                                                                                |
| Batch inserts                                              | WORKING                    | Single transaction per batch instead of N individual inserts                                                                                                                                                                                                                                                                 |
| Event forwarding                                           | FIXED                      | Single broadcast path (no more duplicates)                                                                                                                                                                                                                                                                                   |
| Shutdown                                                   | CLEAN                      | Graceful shutdown with proper resource cleanup                                                                                                                                                                                                                                                                               |
| **Session context (Context Phase 2)**                      | IMPLEMENTED                | \_sessionContext (currentTopic, stage, occurrenceCount, lastUpdate, normalizedTopic, \_cyclesInStage); extractTopicSummary; StageDetector; prompt block stage/topic cuando stage !== 'unknown'; tests en context-phase2.test.js                                                                                              |
| **Stage detection (N-1 hardened — 20/02/2026)**            | IMPROVED                   | STABLE_WINDOW_UP raised 2→3 (20/02); MIN_CYCLES_IN_STAGE=2 nuevo guard (bloquea up-transitions hasta ≥2 ciclos en etapa actual); \_cyclesInStage counter en \_sessionContext; STABLE_WINDOW_DOWN=3; FAST_TRANSITION_GAP=6; MIN_SCORE_TO_TRANSITION=3. 101/104 tests pasando (3 pre-existing failures no introducidas hoy).   |
| **Dynamic maxOutputTokens (N-2 recalibrado — 20/02/2026)** | IMPLEMENTED                | `_calculateMaxOutputTokens(activeSwitchIds)` en intelligenceEngine. Config `llm.maxOutputTokens` por switch: debug=800, exercise=5000, coding=5000, meeting=600, research=1400, system-design=5500, tech-debate=5500, default=5500 (actualizado 20/02 para permitir soluciones completas y diagramas de arquitectura).       |
| **Topic embedding clustering (N-4 — 18/02/2026)**          | IMPLEMENTED                | `TopicEmbeddingClusterer` en contextCache.js. Warmup paralelo en index.js. **isModelInstalled() fix (20/02):** tag-agnostic normalise() — Phase 4 estaba permanentemente deshabilitado porque la comparación exacta con 'nomic-embed-text' nunca matcheaba 'nomic-embed-text:latest' retornado por Ollama /api/tags.         |
| **Phase 5 — Semantic Dedup (20/02/2026)**                  | NEW                        | `isDuplicateAsync()` + `filterDuplicatesAsync()` en suggestionDedup.js. Cosine similarity de embeddings nomic-embed-text (threshold 0.88). In-session `_embedCache`. `clearEmbedCache()` en session start. Dedup catch rate: ~10% → ~35-50%. Graceful fallback a Phase 1 sync si Ollama unavailable.                         |
| **6-Layer Prompt Architecture (20/02/2026)**               | NEW                        | `_buildPrompt()` reescrito. ROLE → CONTEXT SIGNALS (additive, todos los switches) → CONTEXT SOURCE (audio-only/screen-only/audio+screen) → OUTPUT RULES (solo switch dominante) → CONTEXT DATA (sanitizado) → RESPONSE SCHEMA. Elimina contradicciones entre switches combinados (ej. exercise+meeting, coding+tech-debate). |
| **Prompt sanitization (20/02/2026)**                       | NEW                        | `_sanitizeContext(text)` en intelligenceEngine. Strips: code blocks, injection phrases, speaker tokens, excess whitespace. Aplicado a audio transcript y OCR antes de interpolación en el prompt.                                                                                                                            |
| **normalizedTopic stability (20/02/2026)**                 | FIXED                      | contextAnalyzer.extractTopicSummary: alphabetical sort aplicado después de frequency-rank selection → cache key determinístico independiente del orden de palabras en el texto fuente.                                                                                                                                       |

---

## 14. Known Issues & Technical Debt

### Resolved in Recent Sessions

| Issue                                        | Resolution                                                                                                                                                                                                                                                                                                                                                | Commit/Phase |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| ~~Duplicate suggestions~~                    | **Phase 1 implemented**: Bigram Jaccard dedup + suggestion history injected into LLM prompt                                                                                                                                                                                                                                                               | `8e02c16`    |
| ~~Speaker diarization all "Speaker 1"~~      | **Nivel 2**: Stereo + Deepgram multichannel, speaker from channel_index Speaker_1/Speaker_2 (supersedes Issue 1)                                                                                                                                                                                                                                          | Nivel 2      |
| ~~Sample rate mismatch (24kHz vs 16kHz)~~    | **Fix aplicado**: Frontend AudioContext=24kHz pero backend abría Deepgram a 16kHz (fallbacks `\|\| 16000`). Corregido en `deepgramSession.js` + `assistantAudioCapture.js` (backend). Todos los fallbacks ahora `\|\| 24000`.                                                                                                                             | Audio debug  |
| ~~System audio muerto en Windows~~           | **Parte III implementada**: `desktopCapturer` loopback no capturaba audio de Meet/Teams/Zoom (R channel RMS=0.000007). Migrado a `getDisplayMedia` + `setDisplayMediaRequestHandler` con `audio: 'loopback'`. Handler en `index.js`, frontend usa `getDisplayMedia({audio:true, video:false})`. IPC `get-desktop-sources` eliminado. Logs DIAG removidos. | Parte III    |
| ~~8-20 min analysis gaps~~                   | **Issue 3**: Anti-deadlock with skip counter, 5-min force timer, decay timer                                                                                                                                                                                                                                                                              | `ca8e464`    |
| ~~Context change detection too strict~~      | **Issue 2**: Keyword Jaccard topic detection, 50-word threshold, delay caps (60s for conversations)                                                                                                                                                                                                                                                       | `988038b`    |
| ~~Switch toggles not working~~               | `_loadConfig()` now syncs switches from backend config                                                                                                                                                                                                                                                                                                    | `8e02c16`    |
| ~~Budget meter crash~~                       | `breakdown.claude?.cost` instead of `breakdown.claude?.toFixed`                                                                                                                                                                                                                                                                                           | `8e02c16`    |
| ~~Stale suggestions on startup~~             | **Phase 1.5 FIX 1**: `dismissOtherSessions(sessionId)` clears undismissed suggestions from prior sessions on `start()`                                                                                                                                                                                                                                    | Phase 1.5    |
| ~~Screen-only changes ignored~~              | **Phase 1.5 FIX 2**: OCR text comparison for screen change detection, force conditions fire without audio, screen-based topic detection via `ContextAnalyzer.detectTopicChange()`                                                                                                                                                                         | Phase 1.5    |
| ~~Force-analysis double-gating~~             | **Phase 1.5 FIX 3**: `_analyzeIncremental(forceAnalysis)` accepts force flag that bypasses inner context change checks                                                                                                                                                                                                                                    | Phase 1.5    |
| ~~History injection fails after dismissals~~ | **Phase 1.5 FIX 4**: `getSessionHistory()` returns both active AND dismissed suggestions for prompt injection                                                                                                                                                                                                                                             | Phase 1.5    |

### Remaining — Medium (Affects UX/Performance)

| Issue                                   | Impact                                                              | Root Cause / Status                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cache hit rate — pending validation** | N-4+normalizedTopic fix should improve; not yet measured post-20/02 | isModelInstalled() fix + normalizedTopic stability should now enable Phase 4 to actually run. First real measurement pending (RRHH meeting 20/02). |
| **Stage detection accuracy**            | Transiciones erróneas contaminan cache key                          | N-1 hardened (STABLE_WINDOW_UP=3, MIN_CYCLES_IN_STAGE=2) — pending validation with real meeting logs.                                              |
| **3 StageDetector test failures**       | Cannot fully validate stage detection changes                       | Pre-existing test failures (not introduced 20/02). Pending fix in next session.                                                                    |
| **System audio 0 transcripciones**      | Speaker_2 = silencio total en sesiones reales                       | `getDisplayMedia({video:false})` posiblemente rechazado por Chromium. Fix propuesto en plan auditoría Fase 5.                                      |
| **Stopwords rioplatenses en topics**    | Topics contaminados: "che herramienta vos servicio"                 | contextAnalyzer stopwords sin muletillas rioplatenses. Fix pendiente.                                                                              |
| **CodeHighlighter disabled**            | No syntax highlighting in suggestion code blocks                    | HTML escaping bugs in the highlighter                                                                                                              |
| **Audio transcription noise**           | Fragments like "sprol distintos orden ok" reach LLM                 | Deepgram confidence not checked, only basic filtering                                                                                              |

### Remaining — Low (Cosmetic/Minor)

| Issue                                            | Impact                                                          | Root Cause                                                       |
| ------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| Frontend sends duplicate ACK                     | Second ACK rejected by state machine (handled)                  | Frontend listener fires twice                                    |
| Performance stats show 0 for LLM/DB              | Stats counters not wired to actual operations                   | Missing `performanceMonitor.recordLLM/recordQuery` calls         |
| `state-updated` still emits on every state check | ModelStateService emits event even when skipping auto-selection | The `this.emit('state-updated', ...)` call happens on every path |

---

## 15. The Core Problem — Context & Memory

This is the #1 architectural challenge. Here's the detailed breakdown:

### Problem Statement

In a 28-minute coding session (exercise mode, anagramas problem):

- **8 LLM calls** were made to Claude Haiku 4.5
- **5 analysis cycles** produced suggestions
- All 5 cycles produced **nearly identical suggestions** (same anagram solution, same SOLID insight, same tests)
- **27 total suggestions**, of which ~5 were unique ideas repeated 5 times each
- **$0.0557 wasted** on redundant analysis (80% of cost was wasted)
- User had to **disable screen capture** because the repetition was annoying

### Why It Happens

1. **Stateless LLM calls**: Each `intelligenceEngine.analyze()` builds a fresh prompt with NO knowledge of previous suggestions. The LLM sees the same exercise + same audio and produces the same answer.

2. **Cache doesn't help**: The cache key is `SHA-256(audio_text + screen_ocr + switches + language)`. Since audio accumulates, the hash changes every cycle, causing 100% cache misses.

3. **No deduplication**: `suggestionManager.addSuggestions()` blindly inserts whatever the LLM returns. There's no similarity check against existing suggestions.

4. **No progression detection**: The system can't tell that the user has moved from "thinking about the problem" to "writing code" to "testing". It treats every cycle as the first time seeing the exercise.

### Impact

- **Cost**: 80% of cloud API spend is wasted on redundant suggestions
- **UX**: User is overwhelmed by 27 near-identical cards
- **Trust**: User loses confidence in the tool when it keeps repeating itself
- **Utility**: The tool fails to provide progressive assistance (hints -> solution -> optimization -> tests)

---

## 16. Roadmap — Context/Memory Architecture Redesign

### The Goal

Transform the Assistant from a **stateless analyzer** into a **contextually-aware agent** that:

1. Remembers what it already suggested
2. Detects when the user has progressed
3. Provides **progressive** assistance (evolving suggestions over time)
4. Avoids repeating itself
5. Adapts to the conversation's evolution (e.g., user moved from "solving" to "optimizing")

### Design Options (Choose Your Poison)

#### Option A: Suggestion History in Prompt ("Stuffing")

**Mechanism**: Include a summary of previous suggestions in each LLM prompt.

```
ALREADY SUGGESTED (do NOT repeat):
- "Solucion completa: Agrupar Anagramas" (solution, code provided)
- "Principios SOLID aplicados" (insight)
- "Tests unitarios" (action)

NOW: Based on the CURRENT context, provide NEW and DIFFERENT suggestions.
```

**Pros**:

- Simple to implement (modify `_buildPrompt()`)
- No new infrastructure
- Works immediately

**Cons**:

- Increases token count per call (more expensive)
- Limited by context window (can't stuff 100 previous suggestions)
- LLM may still produce similar suggestions with different wording
- Doesn't solve cache invalidation

**Cost impact**: +500-1000 tokens/call input (+$0.0004-0.0008/call)

#### Option B: Semantic Deduplication Layer

**Mechanism**: Before inserting new suggestions, compare them against existing ones using text similarity. Drop duplicates.

**Approaches**:

- **Title fuzzy match**: Levenshtein distance or Jaccard similarity on titles
- **Code hash**: Hash the code content and compare
- **Embedding similarity**: Use a small embedding model to compare suggestion vectors (costly)

**Pros**:

- Solves the UI clutter problem directly
- Can be implemented without changing the LLM prompt
- Works with any LLM provider

**Cons**:

- Doesn't reduce LLM API costs (still generates duplicates, just doesn't show them)
- Title matching can be fooled by rewording
- Embedding approach adds latency + cost

#### Option C: Sliding Window Context with Progression Detection

**Mechanism**: Maintain a "session state" that tracks:

1. What exercise/topic is being discussed
2. What stage the user is at (reading -> thinking -> coding -> testing -> optimizing)
3. What suggestions have been given and accepted/dismissed
4. What the user is currently doing (based on screen + audio delta)

**Implementation**:

```javascript
class SessionContext {
    currentTopic: string;           // "anagram grouping exercise"
    stage: 'exploring' | 'implementing' | 'testing' | 'optimizing';
    suggestionsGiven: Map<string, { title, type, timestamp, dismissed }>;
    userActions: Array<{ timestamp, action, data }>;  // screen/audio deltas
    contextFingerprint: string;     // hash of current state for cache
}
```

**Pros**:

- Solves ALL three problems (repetition, progression, cost)
- Enables truly intelligent assistance
- Cache can key on `stage + topic` instead of raw content
- LLM prompt is focused: "User is now testing, suggest debugging tips"

**Cons**:

- Highest complexity to implement
- Stage detection requires its own analysis (meta-analysis)
- Risk of misclassifying stage
- More moving parts = more bugs

#### Option D: Hybrid (Chosen Strategy — In Progress)

**Phase 1**: Option A (suggestion history stuffing) + basic dedup by title similarity — **DONE** ✅

- `suggestionDedup.js`: Bigram Jaccard similarity (0.65 title, 0.70 description) + MD5 code hash
- `intelligenceEngine._buildPrompt()`: Injects "ALREADY SUGGESTED" section (last 10 summaries)
- `suggestionManager.addSuggestions()`: Calls `filterDuplicates()` before INSERT
- Tested in real 66-min meeting: 1 duplicate filtered
- Committed: `8e02c16`

**Phase 1.5**: Analysis pipeline reliability fixes — **DONE** ✅
Discovered during production log analysis of a 30-min tech-debate session where only 4 of ~30 analysis cycles executed an LLM call, `timeSinceLast` reached 1534s without analysis, and 13 stale suggestions appeared on startup.

- **FIX 1 — Stale suggestions on startup**: `dismissOtherSessions(sessionId)` in repository + `reloadSuggestions()` in manager, called from `start()`. New sessions start clean.
- **FIX 2 — Screen-only context change detection**: `hasNewScreen` now compares OCR text content (not just capped `screen.count`). Force conditions (`shouldForceByTimer`, `shouldForceByCycles`, `forceThrough`) fire regardless of audio state. Screen-based topic detection via `ContextAnalyzer.detectTopicChange()` on OCR text.
- **FIX 3 — Force-analysis that actually forces**: `_analyzeIncremental(forceAnalysis = false)` accepts force flag from `_performAdaptiveAnalysis()`. When `forceAnalysis=true`, all inner context change checks are bypassed. Eliminates double-gating where outer force passed but inner gates blocked.
- **FIX 4 — History injection resilient to dismissals**: `getSessionHistory(sessionId, limit)` returns both active AND dismissed suggestions. Prompt injection no longer fails when user dismisses all active suggestions.
- Files modified: `sqlite.repository.js`, `suggestionManager.js`, `assistantService.js`
- `lastAnalysis` object now tracks `lastScreenOcrText` for screen content change detection

**Context Phase 2**: Option C (session context with stage detection) — **DONE**

- Implementado: \_sessionContext en assistantService, extractTopicSummary en contextAnalyzer, StageDetector (stableWindow=2), bloque stage/topic en prompt.
- Plan y diseño de la solución: `docs/SESSION_CONTEXT_PHASE2_PLAN.md` (§5 Diseño de la solución implementada).

**Context Phase 3**: Smart cache keying based on session context — **DONE** ✅

- Cache key = smart key `hash(stage + normalizedTopic + switches + language)` when sessionContext has valid stage; else raw hash (backward compatible).
- ~~L2 write skipped when `context.flags.hasAudio`~~ — **guard eliminado**: L2 write siempre ejecuta (el guard bloqueaba todas las sesiones con audio, resultando en 0 L2 entries). Fixed en misma sesión.
- `normalizedTopic` = top-3 keywords sorted (corrección: spec decía top-5, se implementó top-3 para más estabilidad).
- Plan y fases: `docs/SESSION_CONTEXT_PLAN.md` §6.
- **Métrica real (18/02/2026)**: 10.3% hit rate (3/29 ciclos). normalizedTopic rotó en 33/35 ciclos — inestabilidad persiste.

**Context Phase 4**: Embedding-based topic clustering (N-4 — 18/02/2026) — **DONE** ✅

- `TopicEmbeddingClusterer` en `contextCache.js`: cosine similarity sobre embeddings `nomic-embed-text` (768-dim), threshold 0.82, online k-means centroid (running average). Cluster IDs: t0, t1, t2…
- `embed(text, model)` + `warmUpEmbeddingModel(model)` en `ollamaService.js`.
- Warmup paralelo `nomic-embed-text` en `index.js` junto al LLM warmup.
- Enrichment async en `assistantService.js`: obtiene `topicClusterId` antes de `intelligenceEngine.analyze()`.
- Cache key tipo `smart+embed`: `hash(stage + clusterId + switches + language)`.
- In-session dedup: `_embedCache` Map evita re-embedding del mismo `normalizedTopic`.
- Fallback: `topicClusterId` → `normalizedTopic` → raw hash (backward compatible en 3 niveles).
- 47/47 tests pasando. 14 tests nuevos en `context-phase2.test.js`.
- Plan completo: `docs/SESSION_CONTEXT_PLAN.md` §10.

**N-1 Stage detection improvements** (18/02/2026) + **N-1 hardened** (20/02/2026) — **DONE** ✅

- Histéresis asimétrica: `STABLE_WINDOW_UP=3` (raised 2→3 on 20/02), `STABLE_WINDOW_DOWN=3`.
- `FAST_TRANSITION_GAP=6`: score gap ≥ 6 → transición inmediata. Calibrado log 18/02.
- `MIN_SCORE_TO_TRANSITION=3`: evita transiciones por keyword único.
- `MIN_CYCLES_IN_STAGE=2` (nuevo 20/02): bloquea up-transitions hasta ≥2 ciclos en etapa actual. Downward exento.
- `_cyclesInStage` counter en `_sessionContext` (nuevo 20/02).
- Keywords wrapping_up depurados.
- Log diagnóstico `[StageDetector] Scores: {...}` por ciclo.

**N-2 Dynamic maxOutputTokens** (18/02/2026, recalibrado 20/02/2026) — **DONE** ✅

- `_calculateMaxOutputTokens(activeSwitchIds)` en `intelligenceEngine.js`.
- Config `llm.maxOutputTokens` en `assistant.config.js` por switch (ver §14 Round 8 para valores actuales).
- Aplica `Math.min` sobre todos los switches activos → más restrictivo gana.
- Ollama: `ollamaOptions.num_predict` sobreescrito. Cloud: `maxTokens` sobreescrito.

**Phase 5 — Semantic Suggestion Dedup** (20/02/2026) — **DONE** ✅

- `isDuplicateAsync()` + `filterDuplicatesAsync()` + `clearEmbedCache()` en `suggestionDedup.js`.
- Threshold cosine 0.88 vía `nomic-embed-text` (768-dim).
- In-session `_embedCache` (Map) evita re-embedding.
- Catch rate: ~10% → ~35-50%.

**6-Layer Prompt Architecture** (20/02/2026) — **DONE** ✅

- `_buildPrompt()` reescrito en `intelligenceEngine.js`.
- `contextSignal` + `outputRules` + `getDominantSwitch()` en `switches.config.js`.
- 3 context-source modes en `_buildContextSourceLayer()`.
- Elimina contradicciones entre switches combinados.

### Impact on Existing Components

| Component                          | Phase 1 Impact                  | Phase 1.5 Impact                                                                     | Context Phase 2 Impact                                               | Phase 3+4+N-1+N-2 (18/02)                                                  | Round 8 (20/02)                                                                                          |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `intelligenceEngine.js`            | Add history to prompt           | No change                                                                            | **Done:** sessionContext in options, prompt block stage/topic        | N-2: `_calculateMaxOutputTokens()`; Phase 4: smart+embed; L2 guard removed | 6-Layer prompt rewrite; `_sanitizeContext()`; `_buildContextSourceLayer()`                               |
| `suggestionManager.js`             | Add dedup before insert         | `reloadSuggestions()`, `getSessionHistory()`                                         | Track accepted/dismissed                                             | No change                                                                  | Phase 5: `filterDuplicatesAsync()`                                                                       |
| `suggestionDedup.js`               | Bigram Jaccard + MD5            | No change                                                                            | No change                                                            | No change                                                                  | Phase 5: `isDuplicateAsync()`, `filterDuplicatesAsync()`, `clearEmbedCache()`, `_embedCache`             |
| `suggestions/sqlite.repository.js` | No change                       | `dismissOtherSessions()`, `getSessionHistory()`                                      | No change                                                            | No change                                                                  | No change                                                                                                |
| `contextCache.js`                  | No change                       | No change                                                                            | No change                                                            | Phase 3: smart key; Phase 4: smart+embed + `TopicEmbeddingClusterer`       | No change                                                                                                |
| `contextCacheL2.js`                | No change                       | No change                                                                            | No change                                                            | No change (L2 guard removed)                                               | No change                                                                                                |
| `assistantService.js`              | Pass history to engine          | Screen OCR tracking, force-analysis bypass, session cleanup, audio-independent force | **Done:** \_sessionContext lifecycle, pass sessionContext to analyze | N-4: `_topicClusterer` lifecycle, async topicClusterId enrichment          | `_cyclesInStage: 0` in \_sessionContext init; `clearEmbedCache()` at session start                       |
| `contextAnalyzer.js`               | No change                       | No change                                                                            | `extractTopicSummary()`                                              | No change                                                                  | alphabetical sort for normalizedTopic stability                                                          |
| `stageDetector.js`                 | No change                       | No change                                                                            | **Done:** StageDetector con stableWindow=2                           | N-1: asym. hysteresis, FAST_TRANSITION_GAP, MIN_SCORE, keyword cleanup     | N-1 hardened: STABLE_WINDOW_UP 2→3, MIN_CYCLES_IN_STAGE=2, `_cyclesInStage` in all return paths          |
| `ollamaService.js`                 | No change                       | No change                                                                            | No change                                                            | N-4: `embed()`, `warmUpEmbeddingModel()`                                   | `isModelInstalled()` tag-agnostic fix (normalise())                                                      |
| `index.js`                         | No change                       | No change                                                                            | No change                                                            | N-4: warmup paralelo `nomic-embed-text`                                    | No change                                                                                                |
| `assistant.config.js`              | Ollama params                   | No change                                                                            | No change                                                            | N-2: `llm.maxOutputTokens` block                                           | maxOutputTokens recalibrated (exercise/coding→5000, system-design/tech-debate/default→5500)              |
| `switches.config.js`               | No change                       | No change                                                                            | Stage-aware prompts                                                  | No change                                                                  | `contextSignal`, `outputRules`, `getDominantSwitch()`, `getContextSignals()`, `getDominantOutputRules()` |
| `prompts.config.js`                | Add "already suggested" section | No change                                                                            | Stage-specific instructions                                          | No change                                                                  | No change                                                                                                |
| DB schema                          | No change                       | No change (uses existing tables)                                                     | No change                                                            | No change                                                                  | No change                                                                                                |
| UI                                 | No change                       | No change                                                                            | No change                                                            | No change                                                                  | No change                                                                                                |

### Agents/Providers Affected

When implementing the context redesign, these agents/providers will need consideration:

| Agent/Provider                            | Current Role                            | Future Role                                                      |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| **Claude Haiku 4.5**                      | Primary cloud LLM for priority switches | Same, but with context-aware prompts + lower call frequency      |
| **Ollama (gemma3:12b / qwen3-coder:30b)** | Default local LLM                       | Could handle meta-analysis (stage detection) to save cloud costs |
| **Deepgram Nova-3**                       | Real-time STT with diarization          | No change (feeds context)                                        |
| **Tesseract.js**                          | OCR for screen content                  | No change (feeds context)                                        |
| **Potential: Embedding model**            | N/A                                     | Could provide semantic similarity for dedup (Option B/C)         |
| **Potential: Lightweight classifier**     | N/A                                     | Could classify user stage locally (Option C)                     |

---

## 17. Constraints & Non-Negotiables

1. **Budget**: $20/month for cloud APIs. Any solution must not significantly increase per-call costs.
2. **Latency**: Analysis should not take longer than 15s. Current: ~10s for Claude Haiku.
3. **Memory**: Electron app. Must not leak memory. Cache must have bounded size.
4. **DB stability**: sqliteClient singleton pattern must be preserved. No new DB connections.
5. **Backward compatibility**: Existing switches, prompts, and UI must continue working.
6. **Language**: Spanish is the primary user language. All suggestions in Spanish.
7. **No breaking changes**: The 9 DB fixes + 5 performance fixes must not be reverted.
8. **Test coverage**: 6 passing test suites must remain passing.
9. **Offline capability**: Must work with Ollama when internet is unavailable.
10. **Privacy**: Audio/screen data stays local (SQLite). Only LLM prompts go to cloud (no raw audio).

---

## 18. Appendix A — Recent Fixes Applied

### Round 1: DB & Infrastructure (9 fixes)

1. **sqliteClient auto-reconnect**: `getDb()` reconnects using stored `dbPath` if DB was closed
2. **clearCaches() vs destroy()**: `stop()` now calls `clearCaches()` (preserves DB) instead of `destroy()`
3. **Cache key with switches**: Hash includes `activeSwitchIds` + `language` for proper differentiation
4. **Unified hash length**: Both L1 and L2 use 32-char hex hashes
5. **Shared DB connection**: AudioRepository and CacheL2 use `sqliteClient.getDb()` with fallback
6. **Batch suggestion insert**: `addSuggestionsBatch()` wraps inserts in single transaction
7. **Duplicate listener guard**: `_suggestionsListenerRegistered` flag prevents accumulation
8. **Promise coalescing**: `loadServices()` prevents concurrent duplicate imports
9. **Vacuum via sqliteClient**: `_vacuumIfNeeded()` uses shared connection

### Round 2: Performance & Bugs (5 fixes)

1. **ModelStateService dedup**: `localAIManager.updateServiceState()` compares JSON before emitting; `handleLocalAIStateChange()` logs concisely
2. **BudgetRepository lazy init**: `_getDb()` method ensures DB available even before explicit `initialize()`
3. **Screen toggle without restart**: Toggling `useScreen` starts/stops timer directly, no full service restart
4. **Audio:ready dedup**: Removed redundant EventEmitter listeners in bridge (single broadcast via `setIPCSender`)
5. **reset-budget-metrics via repository**: New `resetCurrentMonth()` method, bridge delegates instead of direct DB access

### Round 3: Phase 1 Context Memory + Bug Fixes (commit `8e02c16`)

1. **Suggestion dedup** (`suggestionDedup.js`): Bigram Jaccard similarity (0.65 title, 0.70 description) + MD5 code hash dedup
2. **Prompt history injection**: `intelligenceEngine._buildPrompt()` adds "ALREADY SUGGESTED" section from last 10 suggestion summaries
3. **Switch toggle fix**: `AssistantSettings._loadConfig()` now syncs switches from backend with `{ ...this.switches, ...config.switches }`
4. **Budget meter crash fix**: `breakdown.claude?.cost` instead of `breakdown.claude?.toFixed` (breakdown.claude is `{cost,calls,inputTokens,outputTokens}`, not a number)
5. **Ollama params**: `num_ctx` 3072→4096, `num_predict` 1000→1024
6. **Claude maxTokens**: 8192→16384

### Round 4: Real Meeting Issues (3 fixes from 66-min tech-debate session)

**Issue 3 — Timer deadlock** (commit `ca8e464`):

- Root cause: `transcriptCount` from 5-min window can DECREASE when old transcripts expire, causing `transcriptCount > lastAnalysis.audioCount` to be perpetually false
- Fix: Anti-deadlock with 3 mechanisms: skip cycle counter (force after 3 skips), 5-min max interval safety net, timer decay (25% per skip, min 30s), count change detection (any change, not just increase)
- New state: `_skippedCycles`, `_maxSkippedCycles`, `_forceAnalysisInterval`, `_lastSuccessfulAnalysis`, `_totalAudioSeen`

**Issue 2 — Context change detection too strict** (commit `988038b`):

- Root cause: Only exact text equality triggered re-analysis; missed rapid topic changes in conversations
- Fix in `contextAnalyzer.js`: `extractKeywords()` (unigrams+bigrams, stopwords ES/EN), `detectTopicChange()` (Jaccard similarity < 0.40 or 50+ new words), `getMaxDelayForSwitches()` (60s for conversation switches)
- Fix in `assistantService.js`: `_performAdaptiveAnalysis()` detects topic shifts, `_hasContextChanged()` checks 50-word threshold, delay capped by active switches

**Issue 1 — Speaker diarization** (commit `7896930`): Dual-stream + timing heuristics (superseded by Nivel 2).

**Nivel 2 — Stereo + Deepgram multichannel** (replaces Issue 1 hot-fix):

- Frontend: ChannelMergerNode (L=mic, R=system), single ScriptProcessor, single IPC `assistant:send-stereo-audio`
- Provider: Deepgram URL `channels=2&multichannel=true` when sessionType=assistant
- Backend: speaker from `channel_index` (0=Speaker_1, 1=Speaker_2); removed \_lastAudioSource / \_getSpeakerFromSource
- See docs/AUDIO_PLAN.md (Parte I)

### Round 5: Exercise Switch Enhancement (commit `2f0eaa1`)

- Exercise switch now auto-detects Type A (code solution) vs Type B (output prediction)
- Type B covers: Event Loop (microtask/macrotask), hoisting (var/let/const/TDZ), closures, `this` keyword, prototypes, coercion
- Keywords expanded from 11 to 60+ covering interview challenge concepts
- Negative prompt prevents confusing microtasks with macrotasks

### Round 6: Phase 1.5 — Analysis Pipeline Reliability (4 fixes)

Discovered by analyzing production logs from a 30-min tech-debate session. The analysis pipeline failed catastrophically: only 4 of ~30 scheduled cycles executed an LLM call, `timeSinceLast` reached 1534 seconds, and 13 stale suggestions from prior sessions appeared on startup.

**FIX 1 — Stale suggestions on startup**:

- Root cause: `getRecentSuggestions()` queries `WHERE dismissed = 0` with no session filter. New sessions inherit old undismissed suggestions.
- Fix: `dismissOtherSessions(currentSessionId)` in `sqlite.repository.js` — single UPDATE: `SET dismissed = 1 WHERE sessionId != ? AND dismissed = 0`
- `reloadSuggestions()` in `suggestionManager.js` — public wrapper around `_loadActiveSuggestions()`
- Called in `assistantService.start()` after `currentSessionId` assignment, wrapped in try/catch (non-critical)

**FIX 2 — Screen-only context change detection**:

- Root cause (4 interconnected gates blocking screen-only analysis):
  1. `hasNewScreen` compared `screen.count` which caps at `maxScreenshots` (3) — always false once filled
  2. `forceThrough` required `hasAudio && currentAudioCount > 0` — always false with no audio
  3. `shouldForceByTimer`/`shouldForceByCycles` required `hasActiveAudio` — dead with no audio
  4. Topic detection only checked audio text, never screen OCR
- Fix: `hasNewScreen` now compares latest screenshot's `ocrText` against `lastAnalysis.lastScreenOcrText`. Force conditions fire regardless of audio state. Added screen-based topic detection using `ContextAnalyzer.detectTopicChange()` on concatenated OCR text. `lastAnalysis` object extended with `lastScreenOcrText` tracking.

**FIX 3 — Force-analysis that actually forces (double-gate elimination)**:

- Root cause: `_performAdaptiveAnalysis()` logs "Forcing analysis" then calls `_analyzeIncremental()` which has its own independent gates that veto execution. Outer force passes but inner gates block.
- Fix: `_analyzeIncremental(forceAnalysis = false)` accepts force flag. Gate check: `if (!forceAnalysis && !hasNewAudio && !hasNewScreen && !forceThrough)`. `_performAdaptiveAnalysis()` computes `shouldForce = shouldForceByTimer || shouldForceByCycles` and passes it through.

**FIX 4 — History injection resilient to dismissals**:

- Root cause: `getRecentSummaries()` reads from `activeSuggestions` (dismissed=0 only). User dismisses all → history empty → LLM re-suggests same topics.
- Fix: `getSessionHistory(sessionId, limit)` in repository — queries `WHERE sessionId = ?` with no `dismissed = 0` filter, returns both active and dismissed. `getSessionHistory()` in manager maps to `{ title, type, hasCode, dismissed }`. `_performAnalysis()` now uses `getSessionHistory()` instead of `getRecentSummaries()`.

Files modified: `sqlite.repository.js`, `suggestionManager.js`, `assistantService.js`

### Round 7: N-1, N-2, N-4 — Audit-driven improvements (18/02/2026)

Triggered by log analysis of a 32-min meeting session (17/02/2026 13hs). 6 defects identified with concrete metrics. Implemented N-1, N-2, N-4 in this session.

**N-1 — Stage detection accuracy 50%** (stageDetector.js):

- Root cause: `stableWindow=2` (simétrico) para todas las transiciones. Keyword 'siguiente' y 'pendiente' triggeraban `wrapping_up` en etapas de exploración. Sin umbral mínimo de score.
- Fix: Histéresis asimétrica (`STABLE_WINDOW_UP=2`, `STABLE_WINDOW_DOWN=3`). `FAST_TRANSITION_GAP=6` para gaps ≥ 6 (bypass inmediato). `MIN_SCORE_TO_TRANSITION=3`. Keywords wrapping_up depurados. Log `[StageDetector] Scores: {...}` por ciclo.
- Tests: 2 tests existentes corregidos, 0 regresiones.

**N-2 — token output descontrolado** (intelligenceEngine.js + assistant.config.js):

- Root cause: `num_predict`/`maxTokens` fijos sin considerar switch activo → outliers de 27-35s en system-design.
- Fix: `_calculateMaxOutputTokens(activeSwitchIds)` — aplica `Math.min` sobre `config.llm.maxOutputTokens` por switch. Initial config defaults (18/02): meeting:512, research:600, debug:700, tech-debate:800, coding:1200, exercise:1400, system-design:1500, default:1024.

**N-4 — Cache L1 hit rate 10.3%** / topic key inestable (contextCache.js + assistantService.js + ollamaService.js + index.js):

- Root cause: `normalizedTopic` = keywords extraídos de transcripciones en tiempo real → rota en 33/35 ciclos. L2 nunca recibía writes (guard `hasAudio` bloqueaba).
- Fix: `TopicEmbeddingClusterer` — mapea `normalizedTopic` → cluster ID estable via `nomic-embed-text` embeddings (cosine ≥ 0.82). L2 guard eliminado. Running-average centroid para estabilidad online.
- Files: `contextCache.js` (TopicEmbeddingClusterer + export), `assistantService.js` (lifecycle + async enrichment), `ollamaService.js` (embed() + warmUpEmbeddingModel()), `index.js` (parallel warmup).
- Tests: 14 nuevos en `context-phase2.test.js`. 47/47 pasando.

### Round 8: nomic-embed-text fix + N-1 hardening + Phase 5 + 6-Layer Prompt (20/02/2026)

Triggered by log analysis of 18/02 sessions (Session 2 + Session 3) and RRHH meeting preparation.

**isModelInstalled() tag-agnostic fix** (ollamaService.js):

- Root cause: Ollama `/api/tags` retorna `nomic-embed-text:latest`; `isModelInstalled('nomic-embed-text')` hacía comparación exacta de strings → siempre `false` → Phase 4 (TopicEmbeddingClusterer) permanentemente deshabilitado en producción.
- Fix: función `normalise(name)` — append `:latest` si no hay `:` en el nombre. Comparación normalise(needle) vs normalise(model.name). Validado contra API Ollama en vivo.

**N-1 hardening** (stageDetector.js + assistantService.js):

- STABLE_WINDOW_UP: 2→3 (log analysis 19/02: transición disparó en ciclo 2 con solo ~4 min de evidencia de audio — demasiado agresivo).
- MIN_CYCLES_IN_STAGE=2 (nuevo): bloquea up-transitions hasta que la etapa actual tenga ≥2 ciclos confirmados. Downward transitions (→ wrapping_up) exentas.
- `_cyclesInStage: 0` añadido a `_sessionContext` en assistantService.start(). Propagado en todos los return paths de StageDetector.detect(). Reset a 1 en cada cambio de etapa confirmado.

**Phase 5 — Semantic Suggestion Dedup** (suggestionDedup.js + suggestionManager.js):

- Root cause: Phase 1 Jaccard dedup tenía ~10% catch rate; mismo tema semántico con distinto framing no era detectado.
- Fix: `isDuplicateAsync()` — corre Phase 1 sync primero (Jaccard + MD5); si pasa, computa cosine similarity de embeddings `nomic-embed-text` de `title + description` (threshold 0.88).
- `filterDuplicatesAsync()` — wrapper async, usado por SuggestionManager.
- `clearEmbedCache()` — resetea `_embedCache` al inicio de sesión (llamado desde assistantService.start()).
- SuggestionManager actualizado: import `filterDuplicatesAsync`, import `ollamaService`, llama `await filterDuplicatesAsync(suggestions, this.activeSuggestions, { ollamaService })`.
- Expected catch rate: ~10% → ~35-50%.

**6-Layer Prompt Architecture** (switches.config.js + intelligenceEngine.js):

- Problema raíz: switches combinados generaban instrucciones contradictorias en el prompt (coding+tech-debate: "genera código" vs "no generes código"; exercise+meeting: formatos opuestos).
- Fix: arquitectura de 6 capas — contextSignal (todos los switches, additive) + outputRules (solo switch dominante). Precedencia: exercise(1) > coding(2) > debug(3) > system-design(4) > tech-debate(5) > research(6) > meeting(7).
- \_buildContextSourceLayer() en intelligenceEngine — maneja 3 modos explícitamente: audio-only, screen-only, audio+screen.
- Tests: 101/104 pasando (3 pre-existing StageDetector failures no introducidas en esta sesión).

**maxOutputTokens recalibración** (assistant.config.js):

- exercise: 1200→5000, coding: 900→5000, system-design: 1800→5500, tech-debate: 1600→5500, default: 1000→5500.
- Decisión de negocio deliberada: permite soluciones de código completas y diagramas de arquitectura sin truncamiento. Latencia aceptable calibrada con uso real.

**normalizedTopic stability** (contextAnalyzer.js):

- Separación de responsabilidades: selección de keywords por frequency-rank (determina cuáles) → join con sort alfabético (determina orden para cache key).
- Garantiza que mismas keywords en distinto orden de aparición produzcan el mismo cache key.

**Git state:** main @ `5f33d85` | commits: `895b3db` (Phase 4+N-1+N-2 consolidation) → `e49afe0` (isModelInstalled fix) → `14634b2` (stage hardening + Phase 5 + sanitization + normalizedTopic) → `5f33d85` (6-layer prompt + switch dominance)

---

## 19. Appendix B — Production Test Metrics

### Session: 28-min meet real (exercise mode, anagramas, audio+screen)

```
Duration:           37 min total (28 min active)
LLM Calls:          8 (all Claude Haiku 4.5)
Total Cost:         $0.0557
Avg Cost/Call:      $0.0070
Input Tokens:       13,577
Output Tokens:      11,218
Suggestions:        27 total (5 analysis cycles)
Unique Ideas:       ~5 (repeated across cycles)

OCR:
  Executed:         9 (30%)
  Skipped:          21 (70%)
  Avg Latency:      4,069ms

Cache:
  Hits:             0
  Misses:           8
  Hit Rate:         0.0%

DB:
  Zero crashes
  Zero reconnects needed
  Batch inserts: 5 transactions (not 27 individual)

Audio:
  Transcripts saved: 26
  Filtered (too_short): 3
  Speakers detected: 1 (Speaker 1) -- FIXED: Issue 1 now tags "Yo"/"Interlocutor"

Context Scoring:
  Normal (score 35):    initial idle periods
  Important (score 55): multiple speakers detected
  Important (score 65): code + multiple speakers
  Important (score 80): rich code context + speakers

Adaptive Intervals:
  120s when idle/normal
  60s when important context detected
  10s initial delay on fresh start
```

---

## 20. Appendix C — Configuration Reference

### assistant.config.js Defaults

```javascript
{
    enabled: false,
    contextWindow: 5 * 60 * 1000,        // 5 minutes of audio context
    analysisInterval: 2 * 60 * 1000,      // 2 minutes between analyses
    screenCaptureInterval: 30 * 1000,     // 30 seconds between screenshots
    maxScreenshots: 3,                     // Keep last 3 in context
    maxAudioLines: 50,                     // Max transcript lines in prompt
    provider: 'ollama',
    model: {
        ollama: 'qwen3-coder:30b',
        claude: 'claude-haiku-4-5-20251001',
        deepseek: 'deepseek-v3.1-250127'
    },
    budget: {
        enabled: true,
        monthlyLimit: 20,
        cloudProvider: 'claude',
        warningThreshold: 0.80
    },
    llm: {
        // N-2 (18/02/2026): max output tokens per switch — Math.min(active switches) wins
        maxOutputTokens: {
            meeting:       512,
            research:      600,
            debug:         700,
            'tech-debate': 800,
            coding:        1200,
            exercise:      1400,
            'system-design': 1500,
            default:       1024   // fallback when no switch active or unknown switch
        }
    },
    ollamaOptions: {
        temperature: 0.3,
        top_p: 0.8,
        top_k: 40,
        num_ctx: 4096,        // was 3072, increased in Phase 1
        num_predict: 1024,     // was 1000, increased in Phase 1 — overridden by N-2 per switch
        repeat_penalty: 1.15,
        num_batch: 512,
        num_thread: 4
    },
    switches: {
        debug: false,
        exercise: false,
        meeting: false,
        research: false,
        coding: false,
        'system-design': false,
        'tech-debate': false
    },
    useAudio: true,
    useScreen: true
}
```

### Installed Ollama Models (from logs)

| Model            | Size    | Use Case                                                |
| ---------------- | ------- | ------------------------------------------------------- |
| gemma3:12b       | 8.1 GB  | General/meeting                                         |
| qwen3-coder:30b  | 18.5 GB | Code/exercise/system-design                             |
| qwen2.5:3b       | 1.9 GB  | Lightweight fallback                                    |
| nomic-embed-text | ~274 MB | Embedding model (N-4 topic clustering, Context Phase 4) |

### Installed Whisper Models

| Model          | Size | Installed |
| -------------- | ---- | --------- |
| whisper-tiny   | 39M  | Yes       |
| whisper-small  | 244M | Yes       |
| whisper-medium | 769M | Yes       |
| whisper-base   | 74M  | No        |

### Session: 30-min tech-debate (screen only, tech-debate switch) — PRE Phase 1.5

```
Duration:           30 min active
LLM Calls:          4 (all Claude Haiku 4.5)
Total Cost:         $0.0307
Suggestions:        15 total (4+3+3+5 per cycle)
Cache Hits:         0 (0% hit rate)
Dedup Filtered:     1 duplicate caught

History Injection:  1/4 calls (25%) — failed when user dismissed all active suggestions
Stale Suggestions:  13 from previous sessions appeared on startup (all dismissed manually)

Critical Pipeline Failures:
  timeSinceLast reached 1534s without analysis despite screen changes
  Only 4 of ~30 scheduled analysis cycles executed an LLM call
  hasNewScreen: always false (screen.count capped at 3)
  forceThrough: always false (requires audio, session had 0 audio)
  shouldForceByTimer: always false (requires hasActiveAudio)
  shouldForceByCycles: always false (requires hasActiveAudio)
  Topic detection: audio-only (never checked screen OCR)

Bugs Identified -> Phase 1.5:
  FIX 1: Stale suggestions from prior sessions on startup
  FIX 2: Screen-only context changes completely ignored
  FIX 3: Force-analysis double-gated (outer passes, inner blocks)
  FIX 4: History injection fragile to user dismissals
```

### Session: 66-min tech-debate real interview (audio only, tech-debate switch)

```
Duration:           66 min
LLM Calls:          12 (all Claude Haiku 4.5)
Suggestions:        12 total
Speakers detected:  1 (all "Speaker 1") -- FIXED by Issue 1

Analysis gaps identified:
  8 min gap:  Timer reset loop (Issue 3)
  13 min gap: Context "unchanged" despite new topics (Issue 2)
  20 min gap: Deadlock - transcriptCount decreased from window expiry (Issue 3)
  Total dead time: ~48 min (73% of session)

Transcripts extracted: 73 from 3 sessions
  All said "Speaker 1" despite 2 participants -- Root cause: mono mixed audio (Issue 1)

Issues identified and fixed:
  Issue 3 (ca8e464): Anti-deadlock counters, force analysis, timer decay
  Issue 2 (988038b): Topic change detection, word threshold, delay caps
  Issue 1 (7896930): Dual-stream speaker tagging ("Yo"/"Interlocutor")
```

### Session: 32-min meeting real (17/02/2026 13hs) — POST Context Phase 3, PRE N-1/N-2/N-4

```
Duration:           32 min active
Switch:             meeting
LLM Calls:          ~29 ciclos analizados
Cache:
  L1 hits:          3 / 29 = 10.3%
  L2 hits:          0 (guard hasAudio bloqueaba writes — FIXED en misma sesión)
  normalizedTopic stability: cambió en 33/35 ciclos (muy inestable)

Audio:
  Speaker_1 (mic):  transcripciones activas
  Speaker_2 (system audio): 0 transcripciones — canal R = silencio total
  Root cause hipótesis: getDisplayMedia({video:false}) rechazado por Chromium

Stage detection:
  6 transiciones totales
  3 correctas / 3 incorrectas = 50% accuracy
  Falso positivo: exploring → wrapping_up en ciclo ~8 (keywords 'siguiente', 'pendiente')
  → FIXED por N-1 (keyword cleanup + MIN_SCORE_TO_TRANSITION)

Suggestions:
  82 sugerencias totales en 32 min (objetivo: < 50)
  3+ clusters de 3-7 sugerencias sobre mismo tema (ownership, severidad, retiro cash)
  Topics contaminados: "che herramienta servicio vos", "aprovechando breve calor cámara"
  → PENDING: Fase 1 (stopwords rioplatenses) + Fase 4 (dedup semántico)

Ollama warmup:
  gemma3:12b calentado en startup → nunca usado por priority switch → descargado por inactividad
  → FIXED por N-2 (warmup condicional + dynamic maxOutputTokens)

Defects identified → Plan auditoría 18/02 (6 fases):
  P0-A: System audio silencioso (Fase 5 — pendiente)
  P0-B: Cache hit rate 10.3% (N-4 — implementado)
  P1-A: Repetición semántica 82 sugerencias (Fase 4 — pendiente)
  P1-B: Topics contaminados con muletillas (Fase 1 — pendiente)
  P2-A: Stage accuracy 50% (N-1 — implementado)
  P2-B: Ollama warmup desperdiciado (N-2 — implementado)
```

---

## 22. Mejoras identificadas — Enriquecimiento de contexto visual vía `getDisplayMedia` videoTrack

> **Estado: Análisis completado, implementación no iniciada.** Este análisis documenta una mejora potencial al pipeline de screen capture. No es bloqueante para ninguna funcionalidad actual.

### Contexto

Con la implementación de Parte III (`getDisplayMedia` + `setDisplayMediaRequestHandler`), el sistema ya obtiene un `MediaStream` del display para capturar audio. `getDisplayMedia` también puede retornar un **videoTrack** del mismo stream, lo que abre la posibilidad de reemplazar o complementar el pipeline actual de screen capture (`desktopCapturer.getSources()` snapshots cada 30s).

### Pipeline actual de screen capture

```
desktopCapturer.getSources({types: ['screen']}) → thumbnail (1920×1080) → scale 720p
    → dHash (9×8 perceptual, 64-bit) → Hamming distance ≤ 2 = sin cambios
    → Si cambió: Tesseract.js OCR (en+es) → texto + hasCode flag
    → Últimas 3 capturas en contexto LLM
```

**Limitaciones**: Snapshot estático cada 30s; pierde cambios entre capturas; `desktopCapturer.getSources()` enumera TODAS las fuentes cada vez (overhead); captura todo el desktop (toolbars, notificaciones, ruido visual).

### Qué aportaría `getDisplayMedia` videoTrack

| Aspecto                 | `desktopCapturer` (actual)                        | `getDisplayMedia` videoTrack                                                |
| ----------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| **Tipo de dato**        | Snapshot estático (NativeImage)                   | Stream de video continuo (MediaStream)                                      |
| **Frecuencia**          | Cada 30s (configurable)                           | Frame-rate nativo; captura bajo demanda vía `ImageCapture.grabFrame()`      |
| **Selección de fuente** | Pantalla completa obligatoria                     | Puede capturar ventana específica o pantalla completa                       |
| **Overhead**            | `getSources()` enumera todas las fuentes cada vez | Un solo stream abierto; `grabFrame()` es lightweight                        |
| **Con audio activo**    | Pipeline independiente (dos APIs distintas)       | **Mismo stream** que audio — una sola autorización, cero overhead adicional |

### Comportamiento según configuración del usuario

El usuario puede activar: solo audio, solo pantalla, o ambos. Cada combinación enriquece un contexto distinto que se envía al LLM.

| useAudio | useScreen | `getDisplayMedia` params        | Tracks usados                                                                                     |
| -------- | --------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| ✅       | ❌        | `{ audio: true, video: false }` | Solo audioTrack → stereo pipeline (implementado hoy)                                              |
| ❌       | ✅        | `{ audio: false, video: true }` | Solo videoTrack → frame sampler → OCR                                                             |
| ✅       | ✅        | `{ audio: true, video: true }`  | Ambos tracks de un solo stream — una autorización, dos funciones                                  |
| ❌       | ❌        | No se llama `getDisplayMedia`   | Sin captura del display; el assistant trabaja solo con mic si está activo, o sin contexto externo |

### Caso de uso: usuario sin reunión

El assistant no asume que el usuario está en una videoconferencia. Un usuario puede encender la app para:

- Analizar código en pantalla mientras piensa en voz alta (audio: monólogo → Speaker_1 only, screen: IDE visible)
- Revisar documentación técnica y pedir sugerencias (screen only, sin audio)
- Estudiar con un video tutorial (audio: captura del video vía system audio, screen: contenido del tutorial)
- Pair programming remoto (audio: ambos speakers, screen: IDE compartido)

En todos estos escenarios, el pipeline funciona sin modificación:

- **Sin audio de sistema (usuario solo)**: Canal R del ChannelMerger recibe silencio — Deepgram solo transcribe canal L (mic). El sistema ya maneja esto (audioFilter filtra el silencio, Speaker_2 simplemente no aparece en las transcripciones).
- **Sin pantalla**: El contextAggregator retorna `hasScreen: false` y el LLM trabaja solo con contexto de audio. Phase 1.5 ya desacopló audio y screen — ambos son fuentes independientes de contexto.
- **Sin nada**: El assistant puede operar con switches activos y force-analysis (Phase 1.5 fix 3) para generar sugerencias genéricas basadas solo en los switches seleccionados.

### Beneficios concretos de la migración

1. **Cuando audio + screen están activos**: Un solo `getDisplayMedia({audio: true, video: true})` entrega ambos tracks. No hay dos pipelines separados (`desktopCapturer` para screen + `getDisplayMedia` para audio). Reduce puntos de falla y overhead.

2. **Frame sampling bajo demanda**: `ImageCapture.grabFrame()` sobre el videoTrack es significativamente más liviano que `desktopCapturer.getSources()` que enumera todas las fuentes cada invocación.

3. **Ventana específica vs desktop completo**: Con `setDisplayMediaRequestHandler`, se puede seleccionar la ventana de la app de videoconferencia (o el IDE, o el browser). OCR sobre contenido relevante, no sobre todo el desktop.

4. **Pipeline post-captura intacto**: El dHash, OCR (Tesseract.js), y contexto LLM no cambian. Solo cambia el **origen** del frame: de `desktopCapturer snapshot` a `ImageCapture.grabFrame()`.

### Riesgos y consideraciones

- **`video: false` no entrega videoTrack**: Si el usuario solo quiere audio, el handler retorna `audio: 'loopback'` sin video. Para screen-only sin audio, se necesita una llamada `getDisplayMedia({video: true, audio: false})` separada — el handler debe manejar este caso.
- **Resolución del videoTrack**: Se puede limitar con constraints (`width: {ideal: 1280}, height: {ideal: 720}, frameRate: {ideal: 1}`) para minimizar consumo de GPU/CPU.
- **macOS**: `getDisplayMedia` en macOS tiene restricciones distintas para video; evaluar compatibilidad cuando se aborde Parte II.
- **Complejidad del handler**: `setDisplayMediaRequestHandler` debe diferenciar solicitudes (audio-only, video-only, audio+video) y responder correctamente a cada una. Esto requiere lógica condicional basada en `request.videoRequested` / `request.audioRequested`.

### Decisión pendiente

Esta mejora se implementará cuando se valide que la Parte III (audio) funciona correctamente en producción. La prioridad es confirmar que Speaker_2 produce transcripciones útiles con `getDisplayMedia` audio antes de expandir el uso del videoTrack para screen capture.

---

## 23. Documentación relacionada (guía de archivos) — Actualizada

| Archivo                            | Rol                                                                                                             | Estado / Qué hacer                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ARCHITECTURE.md**                | Base de arquitectura del sistema (componentes, flujos, persistencia).                                           | Mantener como referencia principal.                                                                                                                                                           |
| **ASSISTANT_MODULE_CONTEXT.md**    | Contexto completo del módulo Assistant (este doc): flujos, estado, roadmap, fixes.                              | Fuente de verdad del módulo; actualizado con Parte III (audio Windows), deprecación Listen, análisis screen capture vía videoTrack.                                                           |
| **AUDIO_PLAN.md**                  | Plan unificado: Parte I Nivel 2 (completado), Parte II macOS (pendiente), **Parte III Windows (implementado)**. | Referencia única para audio en Assistant. Listen en deprecación — no se requiere consistencia.                                                                                                |
| **SESSION_CONTEXT_PHASE2_PLAN.md** | Plan y diseño de Context Phase 2: session context + stage detection.                                            | **Implementado.** Incluye §5 Diseño de la solución implementada.                                                                                                                              |
| **SESSION_CONTEXT_PLAN.md**        | Plan evolucionado de Context Phases 3+4: cache key estable, topic embedding clustering.                         | §6: Phase 3 (implementado). §7: audit metrics 18/02. §8-9: N-1/N-2 diseños. §10: Context Phase 4 / TopicEmbeddingClusterer diseño completo. Fuente de verdad para historia de implementación. |
| **logs_test_meet_real_hhrr.md**    | Logs y análisis de una prueba real (meeting 36 min): métricas, problemas, debate contexto, respuestas.          | **Opcional conservar** como evidencia. Mover a `docs/archive/` o resumir conclusiones si se quiere reducir ruido.                                                                             |

---

_Document generated: 2026-02-09_
_Last updated: 2026-02-18_
_Rounds of fixes: 6 + Nivel 2 + Parte III (getDisplayMedia Windows) + N-1/N-2/N-4 (auditoría 18/02)_
_Total commits this session: `8e02c16`, `ca8e464`, `988038b`, `7896930`, `2f0eaa1`_
_Audio: docs/AUDIO_PLAN.md (Parte I completado, Parte II macOS pendiente, Parte III Windows implementado)._
_Context Phase 2: implementado (SESSION_CONTEXT_PHASE2_PLAN.md §5). Context Phase 3: implementado. Context Phase 4 (N-4): implementado._
_N-1 (stage detection): implementado. N-2 (dynamic maxOutputTokens): implementado. Listen: en deprecación._
_Pending: Fase 1 stopwords rioplatenses, Fase 4 dedup semántico, Fase 5 system audio fix, Fase 6 Ollama warmup condicional (ver eager-imagining-penguin.md plan)._
