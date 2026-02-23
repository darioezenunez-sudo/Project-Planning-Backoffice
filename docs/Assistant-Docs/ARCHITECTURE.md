# Architecture: Assistant Hybrid LLM System

> **Document status (Feb 2026 — v2.2):** Alineado con código y `docs/ASSISTANT_MODULE_CONTEXT.md`. Incluye: IPC handlers (Nivel 2 audio: `send-stereo-audio`), clave de caché (SHA-256 + language), TTL sugerencias (24h), Speaker_1/Speaker_2 desde Deepgram channel_index, **Context Phase 2** (session context + stage detection), **Context Phase 3** (smart cache key: stage + normalizedTopic), **Context Phase 4** (TopicEmbeddingClusterer: nomic-embed-text, topicClusterId en smart key), **N-1 hardened** (STABLE_WINDOW_UP=3, MIN_CYCLES_IN_STAGE=2, \_cyclesInStage), **N-2** (maxOutputTokens calibrados por switch), **Phase 5** (semantic dedup via nomic-embed-text), **6-Layer Prompt Architecture** (contextSignal + outputRules + getDominantSwitch), **prompt sanitization** (\_sanitizeContext), **normalizedTopic stability** (alphabetical sort), **isModelInstalled() tag-agnostic fix**. Audio unificado: `docs/AUDIO_PLAN.md`.

## System Overview

The Assistant Hybrid LLM System is an intelligent code analysis and suggestion engine that combines:

1. **Local Models** (Ollama) for fast, free, private analysis
2. **Cloud Models** (Claude/DeepSeek) for deep, high-quality analysis
3. **Budget Management** to control cloud costs
4. **Smart Trigger** for adaptive analysis timing
5. **Dynamic Model Selection** based on context

---

## High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                     USER INTERFACE                     │
│  ┌─────────────────┐        ┌──────────────────────┐   │
│  │AssistantSettings│        │  AssistantPanel      │   │
│  │ - Budget meter  │        │  - Suggestions       │   │
│  │ - Deep Analysis │        │  - Model badges      │   │
│  └────────┬────────┘        └──────────┬───────────┘   │
└───────────┼────────────────────────────┼───────────────┘
            │                            │
            │        IPC Bridge          │
            │  (assistantBridge.js)      │
            ▼                            ▼
┌───────────────────────────────────────────────────────┐
│                   BACKEND SERVICES                    │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │            assistantService (Orchestrator)       │ │
│  │  - Manages lifecycle                             │ │
│  │  - Coordinates all components                    │ │
│  │  - Adaptive timing loop                          │ │
│  └────────┬─────────────────────────────────────────┘ │
│           │                                           │
│           ├──────────┬───────────┬────────────┐       │
│           ▼          ▼           ▼            ▼       │
│  ┌──────────────┐ ┌────────┐ ┌──────────┐ ┌────────┐  │
│  │contextAggre- │ │provider│ │intellig- │ │suggest-│  │
│  │gator         │ │Router  │ │enceEngine│ │ionMgr  │  │
│  │- Audio       │ │- Budget│ │- Ollama  │ │- Store │  │
│  │- Screen/OCR  │ │  check │ │- Claude  │ │- Emit  │  │
│  │- Flags       │ │- Model │ │- Prompt  │ │  events│  │
│  └──────────────┘ │  select│ │  build   │ └────────┘  │
│                   └────────┘ └──────────┘             │
│                      │            │                   │
│                      ▼            ▼                   │
│           ┌──────────────┐  ┌──────────────┐          │
│           │budgetService │  │Cache L1+L2   │          │
│           │- Track usage │  │- 70-80% hit  │          │
│           └──────────────┘  └──────────────┘          │
└───────────────────────────────────────────────────────┘
                      │
                      ▼
          ┌────────────────────────┐
          │   PERSISTENCE LAYER    │
          │  ┌──────────────────┐  │
          │  │assistant_budget_ │  │
          │  │usage (SQLite)    │  │
          │  └──────────────────┘  │
          │  ┌──────────────────┐  │
          │  │assistant_suggest-│  │
          │  │ions (SQLite)     │  │
          │  └──────────────────┘  │
          │  ┌──────────────────┐  │
          │  │assistant_transc- │  │
          │  │ripts (SQLite)    │  │
          │  └──────────────────┘  │
          └────────────────────────┘
```

---

## Component Descriptions

### Frontend Layer

#### AssistantSettings (UI)

- **Purpose:** Configuration panel for assistant
- **Location:** `src/ui/settings/AssistantSettings.js`
- **Features:**
  - Budget meter with progress bar
  - Deep analysis button
  - Provider selection dropdown (Claude/DeepSeek)
  - Budget alerts (80%, 90%, 100%)
  - Mode switches (debug, exercise, meeting, research, coding)
  - Context sources toggles (audio, screen, system audio)
  - Dev-only reset metrics button
- **Technology:** Lit Element (web components)
- **State Management:** Internal properties with reactive updates

#### AssistantPanel (UI)

- **Purpose:** Main panel for displaying suggestions
- **Location:** `src/ui/assistant/AssistantPanel.js`
- **Features:**
  - Suggestion list with syntax highlighting
  - Analyze Now button (triggers local analysis)
  - Deep Analysis button (forces cloud)
  - Provider/model badges
  - Empty states with helpful messages
  - Context view (audio + screenshots)
- **Technology:** Lit Element
- **Updates:** Real-time via IPC events

---

### IPC Layer

#### assistantBridge

- **Purpose:** Secure communication between renderer and main process
- **Location:** `src/features/assistant/assistantBridge.js`
- **Handlers:**
  - `assistant:initialize` → Initialize assistant service
  - `assistant:start` → Start analysis loops
  - `assistant:stop` → Stop service and cleanup
  - `assistant:analyze-now` → Trigger immediate analysis
  - `assistant:get-budget-info` → Returns budget data
  - `assistant:reset-budget-metrics` → Reset current month (dev only)
  - `assistant:trigger-deep-analysis` → Force cloud analysis
  - `assistant:get-current-provider` → Get active provider info
  - `assistant:get-suggestions` → Fetch active suggestions
  - `assistant:dismiss-suggestion` → Dismiss suggestion by ID
  - `assistant:get-context` → Get current context
  - `assistant:update-config` → Update configuration
  - `assistant:get-config` → Get current configuration
  - `assistant:get-stats` → Get performance stats
  - `assistant:send-stereo-audio` → Receive stereo audio (L=mic, R=system), single stream (Nivel 2; legacy `send-mic-audio` / `send-system-audio` commented)
  - `assistant:audio-ack` → Acknowledge audio handshake from renderer
  - `assistant:get-audio-state` → Get current audio capture state
  - `assistant:open-panel` / `assistant:close-panel` → Panel visibility
  - `assistant:toggleAssistantButton` → Toggle assistant button
  - `assistant:update-header-state` → Update header state for assistant
  - `assistant:get-desktop-sources` → Get desktop sources for screen capture
- **Events (Main → Renderer):**
  - `assistant:suggestions-updated` → New suggestions available
  - `assistant:budget-updated` → Budget changed
  - `assistant:started` → Service started
  - `assistant:stopped` → Service stopped
  - `assistant:error` → Error occurred
  - `assistant:stateUpdated` → Header/panel state updated
- **Security:** Channel whitelist, contextBridge isolation

---

### Service Layer

#### assistantService (Orchestrator)

- **Purpose:** Main service coordinating all components
- **Location:** `src/features/assistant/services/assistantService.js`
- **Responsibilities:**
  - Initialize all dependencies
  - Run adaptive analysis loop
  - Manage screen capture loop
  - Handle cleanup on shutdown
  - Track last analysis context (for incremental updates)
  - **Context Phase 2:** Own `_sessionContext` (currentTopic, stage, occurrenceCount, lastUpdate); update before each analysis; pass as `options.sessionContext` to intelligenceEngine.analyze()
  - **Context Phase 3:** `_sessionContext.normalizedTopic` = top-3 keywords alphabetically sorted for stable smart cache key
  - **Context Phase 4:** `_sessionContext.topicClusterId` enriched async before each `analyze()` via `_topicClusterer.getOrCreateClusterId(normalizedTopic)`; falls back to `null` (→ Phase 3 smart key) on error
  - **Phase 5 (20/02):** `clearEmbedCache()` called at session start to reset semantic dedup embedding cache
- **`_sessionContext` shape:**
  ```javascript
  {
    currentTopic: '',         // String of keywords from extractTopicSummary
    normalizedTopic: '',      // Phase 3: top-3 sorted keywords for cache key (alphabetical)
    topicClusterId: null,     // Phase 4: embedding cluster ID (overrides normalizedTopic in hash)
    stage: 'exploring',       // Phase 2: current confirmed stage
    occurrenceCount: 0,       // Phase 2: hysteresis counter
    _candidateStage: null,    // Phase 2: stage being tracked for stable window
    _cyclesInStage: 0,        // N-1 (20/02): cycles confirmed in current stage (MIN_CYCLES_IN_STAGE guard)
    _topicCyclesSinceUpdate: 0, // Phase 3: cycles since last topic change
    _lastTopicKeywords: new Set(), // Phase 3: Jaccard comparison set
    lastUpdate: Date.now()
  }
  ```
- **`_topicClusterer`:** Instance of `TopicEmbeddingClusterer` (from `contextCache.js`); created in `start()`, `reset()`+null in `stop()`. Session-scoped — all clusters cleared on session end.
- **Key Methods:**
  - `initialize()` → Setup all services
  - `start(sessionId)` → Begin loops, init `_sessionContext` + `_topicClusterer`
  - `stop()` → Cleanup, null `_sessionContext`, reset `_topicClusterer`
  - `analyzeNow(options)` → Force immediate analysis
  - `_performAdaptiveAnalysis()` → Smart trigger logic
  - `_hasContextChanged(newContext)` → Incremental check
  - `_scheduleNextAnalysis(contextRichness)` → Set delay based on criticality
- **Timing Logic:**
  - Critical context → 30s interval
  - Important context → 60s interval
  - Normal context → 120s interval
  - Skips analysis if context unchanged

#### contextAggregator

- **Purpose:** Collect context from audio and screen
- **Location:** `src/features/assistant/services/contextAggregator.js`
- **Responsibilities:**
  - Get audio transcripts (last 5 minutes; speakers Speaker_1/Speaker_2 from Deepgram channel_index)
  - Capture screenshots with OCR (Tesseract)
  - Detect code patterns in screenshots
  - Generate context flags (hasCode, hasErrors, hasAudio, hasScreen)
  - Calculate context hash for change detection
- **Note:** Topic summary for session context comes from `ContextAnalyzer.extractTopicSummary()` (utils), not from contextAggregator.
- **Optimizations:**
  - Perceptual hashing (dHash) to skip identical screenshots (60% reduction)
  - OCR preprocessing (resize, grayscale, contrast normalization)
  - Async operations for non-blocking execution
- **Dependencies:**
  - `audioRepository` - Audio transcripts
  - `screenCaptureService` - Screenshots
  - `tesseract.js` - OCR processing

#### providerRouter

- **Purpose:** Intelligent routing to local vs cloud
- **Location:** `src/features/assistant/services/providerRouter.js`
- **Decision Logic:**
  1. Budget exhausted → Force local (fallback)
  2. `forceCloud` option → Use cloud if budget allows
  3. Priority switch active → Prefer cloud
  4. High context richness (≥70) → Prefer cloud
  5. Default → Local (fast, free)
- **Dynamic Model Selection (Ollama):**
  - Meeting mode (no code) → `gemma3:12b` (fast, 2-3s)
  - Code context → `qwen3-coder:30b` (specialized, 5-8s)
  - Debug with errors → `deepseek-r1:8b` (reasoning, 4-6s)
  - Research mode → `gemma3:27b` (balanced, 4-6s)
  - Default → `qwen3-coder:30b`
- **Context Richness Calculation:** (see `providerRouter._calculateContextRichness`)
  - Audio: word count >100 → +30, >50 → +20, else +10 (max 30)
  - Screen: hasCode + ≥2 screens → +30, hasCode or ≥2 screens → +20, else +10 (max 30)
  - Multi-speaker: ≥3 speakers → +20, 2 speakers → +10 (max 20)
  - Critical keywords (error/uml/database): +20 or +10 if total >5 (max 20)
  - Score 0–100; richness ≥70 prefers cloud
- **Budget Integration:**
  - Checks budget before cloud routing
  - Falls back to local if budget exceeded
  - Query time: < 5ms (indexed)

#### intelligenceEngine

- **Purpose:** LLM analysis and prompt building
- **Location:** `src/features/assistant/services/intelligenceEngine.js`
- **Features:**
  - Two-tier caching (L1 memory + L2 SQLite)
  - Dynamic prompt generation based on mode switches
  - Support for Ollama and cloud providers (Claude, DeepSeek)
  - Token counting and cost estimation
  - Fallback to local on cloud failure
  - **N-2:** Dynamic `maxOutputTokens` per active switch via `_calculateMaxOutputTokens()`
  - **6-Layer Prompt Architecture (20/02):** `_buildPrompt()` fully rewritten with 6 explicit layers (see below)
  - **Prompt Sanitization (20/02):** `_sanitizeContext(text)` strips injection patterns from audio/OCR before interpolation
- **Cache Architecture:**
  - **L1 (ContextCache):** In-memory, 10 entries, 5-min TTL
  - **L2 (ContextCacheL2):** SQLite, 50 entries, 30-min TTL
  - **Hit Rate target:** ~40-60% with smart+embed key (was 10% with smart key, 0% with raw key)
  - **Key Generation (Phase 4):** `SHA-256(stage + topicClusterId + sortedSwitches + language)` when `sessionContext.stage` valid + `topicClusterId` set; falls back to `normalizedTopic` (Phase 3) or raw hash (Phase 2). Key type logged: `smart+embed`, `smart`, or `raw`.
  - **L2 write:** Always (removed `hasAudio` guard that was blocking all writes in real sessions)
- **Dynamic maxOutputTokens (N-2 — calibrated 20/02):**
  - `_calculateMaxOutputTokens(activeSwitchIds)` reads from `config.llm.maxOutputTokens` table
  - Most restrictive active switch wins (`Math.min` via reduce)
  - Applied to both Ollama (`num_predict` override) and Cloud (Anthropic `maxTokens`)
  - Ceilings: debug=800, **exercise=5000**, **coding=5000**, meeting=600, research=1400, **system-design=5500**, **tech-debate=5500**, **default=5500** (updated 20/02)
- **6-Layer Prompt Architecture (20/02):**
  ```
  Layer 1 — ROLE:           Fixed system identity
  Layer 2 — CONTEXT SIGNALS: All active switches contribute their contextSignal (additive, no conflicts)
  Layer 3 — CONTEXT SOURCE:  Adapts to audio-only / screen-only / audio+screen (3 explicit modes)
  Layer 4 — OUTPUT RULES:    Only the DOMINANT switch's outputRules applied (no contradictions)
  Layer 5 — CONTEXT DATA:    Sanitized audio transcript + sanitized OCR text + session stage/topic
  Layer 6 — RESPONSE SCHEMA: Strict JSON format
  ```

  - **getDominantSwitch(activeSwitchIds):** Precedence hierarchy: exercise(1) > coding(2) > debug(3) > system-design(4) > tech-debate(5) > research(6) > meeting(7)
  - **getContextSignals(activeSwitchIds):** Combines all active switches' contextSignal strings additively
  - **getDominantOutputRules(activeSwitchIds):** Returns outputRules of dominant switch only
  - Defined in `src/features/assistant/config/switches.config.js`
- **Prompt Sanitization (\_sanitizeContext — 20/02):**
  - Strips: code blocks (` ``` `), shell-escape sequences (`<<`, `>>`), injection phrases (`ignore previous instructions`, `you are now a...`), speaker role tokens (`SYSTEM:`, `ASSISTANT:`, `USER:`), excess whitespace
  - Applied to both audioContext and screenContext before interpolation in `_buildPrompt()`
  - Prevents prompt injection from untrusted audio/OCR sources
- **Context Source Layer — 3 modes:**
  - Audio-only: `[CONTEXT: audio transcript only — no screen capture]`
  - Screen-only: `[CONTEXT: screen capture only — no audio transcript]`
  - Audio + Screen: `[CONTEXT: audio transcript + screen capture]`
- **Prompt Structure (legacy reference, superseded by 6-layer):**
  - **Context Phase 2:** When `options.sessionContext` present and `stage !== 'unknown'`: block "CURRENT MEETING STAGE / ETAPA ACTUAL" with stage, currentTopic, anti-repetition instruction
  - ALREADY SUGGESTED (Phase 1.5: session history, last 10, includes dismissed)
- **Token Counting:**
  - Estimates tokens for budget tracking
  - Claude: Uses `usage.input_tokens` and `usage.output_tokens`
  - Ollama: Estimates via character count / 4
- **Error Handling:**
  - Cloud failure → Fallback to local
  - Parse error → Return empty suggestions
  - Timeout → Cancel and retry with local

#### budgetService

- **Purpose:** Budget management and tracking
- **Location:** `src/features/assistant/services/budgetService.js`
- **Responsibilities:**
  - Get budget info (spent/limit/percentage/breakdown)
  - Check if cloud is affordable
  - Record token usage via repository
  - Calculate monthly breakdown by provider
  - Emit budget-updated events
- **Budget Info Structure:**
  ```javascript
  {
    spent: 12.34,           // Total spent this month (USD)
    limit: 20.00,           // Monthly limit (USD)
    breakdown: {
      claude: {
        cost: 10.50,
        calls: 42
      },
      deepseek: {
        cost: 1.84,
        calls: 128
      }
    },
    monthYear: '2025-01',   // Current month
    daysRemaining: 24,
    percentageUsed: 61.7,
    canUseCloud: true,
    recordCount: 170
  }
  ```
- **Event Emitter:**
  - Emits `budget-updated` after each usage record
  - Consumed by IPC bridge for UI updates

#### suggestionManager

- **Purpose:** Manage suggestion lifecycle
- **Location:** `src/features/assistant/services/suggestionManager.js`
- **Responsibilities:**
  - Store suggestions in DB with metadata
  - Retrieve active suggestions (not dismissed, not expired)
  - Emit events on updates
  - Handle dismiss action
  - Clean up expired suggestions (DB expiry: 24h; cleanup runs use configurable maxAge, default 1h)
  - **Phase 5 (20/02):** Calls `filterDuplicatesAsync(suggestions, activeSuggestions, { ollamaService })` — async semantic dedup via nomic-embed-text before inserting
- **Suggestion Schema:**
  ```javascript
  {
    id: 'uuid',
    sessionId: 'uuid',
    suggestionType: 'insight|solution|refactor|...',
    priority: 'low|medium|high',
    title: 'Short title',
    description: 'Detailed description',
    code: 'code snippet',
    language: 'javascript',
    context: { ... },
    isDismissed: false,
    generatedAt: timestamp,
    expiresAt: timestamp
  }
  ```

---

### Utility Layer

#### contextAnalyzer

- **Purpose:** Analyze context criticality for smart trigger
- **Location:** `src/features/assistant/utils/contextAnalyzer.js`
- **Outputs:**
  ```javascript
  {
    level: 'critical|important|normal',
    delay: 30000|60000|120000,  // milliseconds
    reasons: ['error_detected', 'keyword_database'],
    keywords: {
      error: 2,
      uml: 1,
      database: 1
    },
    hasCriticalFlag: true
  }
  ```
- **Keyword Detection:**
  - **Error keywords (→ critical):** error, exception, crash, failure, null pointer, undefined, TypeError, ReferenceError, etc.
  - **UML keywords (→ important):** diagram, sequence, class diagram, ERD, entity relationship, etc.
  - **Database keywords (→ important):** schema, migration, CREATE TABLE, ALTER TABLE, foreign key, etc.
- **Priority Logic:**
  1. Critical if: error keywords > 0 OR flags.hasErrors
  2. Important if: UML/database keywords > 0 OR exercise/coding switch active
  3. Normal: Everything else
- **Context Phase 2 — extractTopicSummary(text, maxKeywords):** Static method; returns string of top keywords (unigrams by frequency), filtered for digits/hex/OCR noise; used for session context `currentTopic`.
- **normalizedTopic stability fix (20/02):** Keyword selection uses frequency-rank (determines which keywords), then final join applies `alphabetical sort` — separation of concerns ensures deterministic cache key independent of original word order in text.

#### stageDetector

- **Purpose:** Detect meeting/coding stage for session context (Context Phase 2 + N-1)
- **Location:** `src/features/assistant/utils/stageDetector.js`
- **API:** `StageDetector.detect(context, sessionContext) → { stage, occurrenceCount, _candidateStage }`
- **Stages:** exploring, implementing, testing, wrapping_up, unknown
- **API:** `StageDetector.detect(context, sessionContext) → { stage, occurrenceCount, _candidateStage, _cyclesInStage }`
- **Logic (N-1 hardened — 20/02):**
  - Keyword scoring (ES/EN) per stage with `MIN_SCORE_TO_TRANSITION = 3` (single-keyword matches cannot trigger transition)
  - **Asymmetric hysteresis:** `STABLE_WINDOW_UP = 3` (raised from 2 on 20/02 — prevents premature transitions with only ~4 min audio evidence), `STABLE_WINDOW_DOWN = 3` (conservative, avoids premature closure)
  - **MIN_CYCLES_IN_STAGE = 2 (new 20/02):** Upward transitions blocked until current stage has been confirmed for ≥2 cycles. Prevents flip-flop at session start with mixed-signal audio. Downward transitions (→ wrapping_up) exempt — must be reachable at any time.
  - **`_cyclesInStage` counter:** New field propagated in all return paths. Increments each analysis cycle. Resets to 1 on confirmed stage change.
  - **FAST_TRANSITION_GAP = 6:** When the candidate score exceeds the current stage score by ≥6, transition fires immediately bypassing the stable window — calibrated from log data (gap of 7 at correct S3 transition point, 18/02)
  - `STAGE_ORDER` map `{ exploring:0, implementing:1, testing:2, wrapping_up:3, unknown:-1 }` determines UP vs DOWN direction
  - Cleaned `wrapping_up` keywords: removed generic terms (`siguiente`, `pendiente`, `terminar`, `asignar`, `deadline`, `timeline`, `entrega`, `compromiso`, `acuerdo`) that caused false positives; kept strong closure signals only
  - Diagnostic log line per cycle: `[StageDetector] Scores: {...}, current=X, candidate=Y(score)`
- **Used by:** assistantService before each analysis to update `_sessionContext.stage`, `occurrenceCount`, `_candidateStage`, `_cyclesInStage`

#### suggestionDedup

- **Purpose:** Deduplication of new LLM suggestions against active session suggestions
- **Location:** `src/features/assistant/utils/suggestionDedup.js`
- **Phase 1 (sync):**
  - Bigram Jaccard similarity — title threshold: 0.65, description threshold: 0.70
  - MD5 code hash — exact code block dedup
  - Estimated catch rate: ~10%
- **Phase 5 — Semantic Dedup (20/02):**
  - `isDuplicateAsync(newSugg, existingSuggestions, { ollamaService })` — runs Phase 1 checks first (sync), then checks cosine similarity of `title + description` embeddings via `nomic-embed-text`
  - Similarity threshold: **0.88** (conservative — avoids false positives on similar-domain but distinct suggestions)
  - `filterDuplicatesAsync(newSuggestions, existingSuggestions, { ollamaService })` — async batch filter, used by SuggestionManager
  - `clearEmbedCache()` — resets in-session embed cache (called at session start in assistantService)
  - **In-session embed cache:** `_embedCache` (Map) — caches `text → Float64Array` to avoid re-embedding same string within a session
  - Estimated catch rate: ~35-50% (vs ~10% Phase 1 only)
  - Graceful fallback: if Ollama not running or model not installed, Phase 1 sync dedup still runs
  - Exported: `{ filterDuplicates, filterDuplicatesAsync, isDuplicateAsync, clearEmbedCache }`

#### performanceMonitor

- **Purpose:** Track system metrics
- **Location:** `src/features/assistant/utils/performanceMonitor.js`
- **Metrics:**
  - Analysis count/duration (min, max, avg)
  - Cache hit rate (L1 and L2)
  - LLM call latency by provider
  - Skipped analyses count
  - Memory usage patterns
- **Access:** `performanceMonitor.getStats()`
- **Reset:** `performanceMonitor.reset()`

---

### Data Layer

#### budgetRepository

- **Purpose:** Persist budget usage records
- **Location:** `src/features/assistant/repositories/budget/sqlite.repository.js`
- **Table:** `assistant_budget_usage`
- **Schema:**
  ```sql
  CREATE TABLE assistant_budget_usage (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    provider TEXT NOT NULL,              -- 'claude', 'deepseek', etc.
    model TEXT NOT NULL,                 -- 'claude-3-5-sonnet-20241022', etc.
    switches_active TEXT,                -- JSON array of active switches
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    monthYear TEXT NOT NULL,            -- 'YYYY-MM' format
    created_at INTEGER NOT NULL
  );
  ```
- **Indexes:**
  - `idx_budget_month` on `monthYear` (for fast monthly queries)
  - `idx_budget_provider_month` on `(provider, monthYear)` (for breakdown)
  - `idx_budget_timestamp` on `timestamp` (for time-series queries)
- **Key Methods:**
  - `recordUsage(usage)` → Insert new record
  - `getMonthlySpending(monthYear?)` → SUM(cost_usd) for month
  - `getMonthlyBreakdown(monthYear?)` → Group by provider
  - `getMonthlyRecords(monthYear?)` → All records for month

#### suggestionsRepository

- **Purpose:** Persist suggestions
- **Location:** `src/features/assistant/repositories/suggestions/sqlite.repository.js`
- **Table:** `assistant_suggestions`
- **Schema:** See existing implementation
- **Indexes:** (schema uses camelCase)
  - `idx_suggestions_active` on `(sessionId, dismissed, generatedAt DESC)`
  - `idx_suggestions_active_partial` on `(sessionId, generatedAt DESC) WHERE dismissed = 0`
  - `idx_suggestions_expires` on `expiresAt` WHERE expiresAt IS NOT NULL

#### audioRepository

- **Purpose:** Persist audio transcripts with speaker diarization (Nivel 2: Speaker_1 / Speaker_2 from channel_index)
- **Location:** `src/features/assistant/repositories/audio/sqlite.repository.js`
- **Table:** `assistant_transcripts`
- **Features:**
  - Speaker diarization support (speaker column)
  - Timestamp-based retrieval
  - TTL cleanup for old transcripts (1 hour)

---

## Data Flow

### Local Analysis Flow

```
1. User opens AssistantPanel
2. Clicks "Analyze Now"
   ↓
3. IPC: assistant:analyze-now { deepAnalysis: false }
   ↓
4. assistantService._performAdaptiveAnalysis()
   ↓
5. contextAggregator.getContext()
   - Audio: last 5 min from DB
   - Screen: last 3 screenshots via screenCaptureService
   - Flags: hasCode, hasErrors, etc.
   ↓
6. ContextAnalyzer.analyzeContext()
   - Level: normal (no errors, no special keywords)
   - Delay: 120s
   ↓
7. providerRouter.selectProvider()
   - Decision: ollama
   - Model: qwen3-coder:30b (code context detected)
   ↓
8. intelligenceEngine.analyze()
   - Check Cache L1 → Miss
   - Check Cache L2 → Miss
   - Build prompt with switch instructions
   - Call _callOllama() → POST to http://localhost:11434/api/generate
   - Parse JSON response
   - Store in L1 + L2
   ↓
9. suggestionManager.addSuggestions()
   - Store in assistant_suggestions table
   - Emit 'suggestions-updated' event
   ↓
10. IPC: assistant:suggestions-updated
    ↓
11. AssistantPanel updates UI
    - Render suggestions with "ollama" badge
    - Show model: qwen3-coder:30b
```

---

### Cloud Analysis Flow (Deep Analysis)

```
1. User clicks "Deep Analysis" button (⚡)
   ↓
2. IPC: assistant:trigger-deep-analysis
   ↓
3. assistantService.analyzeNow({ forceCloud: true })
   ↓
4. contextAggregator.getContext() (same as local)
   ↓
5. budgetService.canUseCloud()
   - Query: SELECT SUM(cost_usd) FROM assistant_budget_usage
            WHERE monthYear = '2025-01'
   - Check: spent < monthlyLimit (e.g., $15.50 < $20.00)
   - Result: true
   ↓
6. providerRouter.selectProvider({ forceCloud: true })
   - Budget OK: ✓
   - forceCloud flag: ✓
   - Decision: claude
   - Model: claude-haiku-4-5-20251001 (from assistant.config.js)
   ↓
7. intelligenceEngine._callCloud()
   - Build prompt (same structure as local)
   - Create LLM via factory (Anthropic SDK)
   - Send to Claude API
   - Receive response with token usage (usage.input_tokens, usage.output_tokens)
   ↓
8. intelligenceEngine._recordBudgetUsage()
   - Pricing (Haiku 4.5): input $0.80/MTok, output $4/MTok (config.budget.pricing.claude)
   - Calculate cost from actual usage; insert into assistant_budget_usage
   ↓
9. budgetRepository.recordUsage()
   - INSERT INTO assistant_budget_usage
   - Store: provider='claude', tokens, cost=$0.0195, monthYear='2025-01'
   ↓
10. budgetService emits 'budget-updated'
    ↓
11. IPC: assistant:budget-updated
    - New data: { spent: $15.5195, limit: $20, percentage: 77.6% }
    ↓
12. AssistantSettings updates budget meter
    - Progress bar: 75% → 77.6%
    - Text: "$15.52 / $20.00 USD"
    ↓
13. suggestionManager.addSuggestions()
    - Store with modelType: 'cloud'
    ↓
14. IPC: assistant:suggestions-updated
    ↓
15. AssistantPanel updates UI
    - Render with "claude" badge
    - Show "Generated by: Claude Sonnet 3.5"
```

---

### Smart Trigger Flow

```
1. User types code with error:
   console.log(undefined.property)
   ↓
2. Screen capture loop (every 30s in assistantService)
   - Capture screenshot via screenCaptureService
   - Run OCR with Tesseract
   - Detect text: "TypeError: Cannot read property 'property' of undefined"
   - Set flag: hasErrors = true
   ↓
3. Adaptive timing check in _performAdaptiveAnalysis():
   - Get context via contextAggregator
   - ContextAnalyzer.analyzeContext()
     - Detect: keywords.error > 0
     - Level: CRITICAL
     - Delay: 30 seconds
   ↓
4. After 30s, check if context changed:
   - _hasContextChanged(newContext) compares hashes
   - If changed → Proceed with analysis
   - If unchanged → Skip (wait another 30s)
   ↓
5. If analysis proceeds:
   - providerRouter.selectProvider()
     - Context: critical (error detected)
     - Richness: 65/100
     - Decision: Local (default, unless priority switch)
     - Model: deepseek-r1:8b (debug mode with errors)
   ↓
6. intelligenceEngine.analyze()
   - Generate debug suggestion
   - Example: "Fix TypeError by adding null check"
   ↓
7. suggestionManager stores and emits
   ↓
8. UI updates with suggestion
   ↓
9. Next analysis scheduled:
   - If error still present → 30s (still critical)
   - If error resolved → 120s (back to normal)
```

---

### Shared Services (Common)

#### ollamaService

- **Location:** `src/features/common/services/ollamaService.js`
- **isModelInstalled() fix (20/02):** Root cause: Ollama `/api/tags` returns model names with tag suffix (e.g. `nomic-embed-text:latest`) but the method compared exact strings against bare names (e.g. `nomic-embed-text`) → always `false` → Phase 4 permanently disabled.
  ```javascript
  // Fix: tag-agnostic normalise() — appends ':latest' when no ':' present
  async isModelInstalled(modelName) {
      const models = await this.getInstalledModels();
      const normalise = (name) => (name && name.includes(':') ? name : `${name}:latest`);
      const needle = normalise(modelName);
      return models.some(model => normalise(model.name) === needle);
  }
  ```
- **warmUpEmbeddingModel(model):** Verifies Ollama running, calls `isModelInstalled(model)`, probes `/api/embeddings` with `'warmup'` prompt. Called via `setTimeout` at 3000ms after app start in `src/index.js`.
- **embed(text, model):** POST `/api/embeddings`, returns `Float64Array` (768-dim for nomic-embed-text).

---

## Performance Optimizations

### 1. Two-Tier Caching + Embedding Smart Key

- **L1 (Memory):** 5-minute TTL, 10 entries max, LRU eviction
- **L2 (SQLite):** 30-minute TTL, 50 entries max, TTL-based cleanup
- **Key evolution:**
  - Phase 2 (raw): `SHA-256(audio+screen+switches+language)` → 0% hit rate with audio
  - Phase 3 (smart): `SHA-256(stage+normalizedTopic+switches+language)` → ~10% (topic rotated each cycle)
  - Phase 4 (smart+embed): `SHA-256(stage+topicClusterId+switches+language)` → target ~40-60% (semantically stable cluster ID survives surface-word variation)
- **TopicEmbeddingClusterer** (`contextCache.js`, exported): Session-scoped; uses `nomic-embed-text` via `ollamaService.embed()`; assigns cluster IDs (t0, t1…) by cosine similarity ≥ 0.82; updates centroids via running average; in-session dedup cache avoids re-embedding same string; fails silently to Phase 3 fallback
- **L2 write:** Always (removed `hasAudio` guard — was blocking all writes in meeting sessions)
- **normalizedTopic key stability (20/02):** Alphabetical sort applied after frequency-rank selection → deterministic cache key independent of word order in source text
- **Impact:** Reduces LLM calls; Phase 4 expected ~40-60% hit rate when topic is consistent across cycles

### 7. Phase 5 — Semantic Suggestion Dedup

- **Method:** `isDuplicateAsync()` in `suggestionDedup.js` — cosine similarity of `title + description` embeddings via `nomic-embed-text` (768-dim)
- **Threshold:** 0.88 cosine similarity (conservative to avoid false positives)
- **Layered checks:** Phase 1 sync checks (Jaccard bigram + MD5 code hash) run first; embedding check only if sync passes — avoids unnecessary Ollama calls
- **In-session embed cache:** `_embedCache` (Map) — avoids re-embedding the same text string within a session
- **Graceful degradation:** Falls back to Phase 1 sync-only if Ollama unavailable
- **Impact:** Estimated dedup catch rate improvement from ~10% → ~35-50%

### 2. Incremental Analysis

- **Method:** Compare context (text equality + word count delta ≥50 new words) and topic change (ContextAnalyzer Jaccard similarity) before analysis
- **Skip:** If context unchanged or topic not changed (plus anti-deadlock: force analysis after 3 skips or 5 min)
- **Impact:** Reduces unnecessary LLM calls; timer adapts (e.g. 25% reduction per skip when audio active, min 30s)

### 3. Screenshot Diffing

- **Method:** Perceptual hashing (dHash) on screenshots
- **Skip:** OCR if hash difference < 5%
- **Impact:** 60% reduction in OCR operations (Tesseract is slow)

### 4. Indexed Database Queries

- **Budget check:** < 5ms (index on `monthYear`)
- **Provider selection:** < 10ms total overhead
- **Context analysis:** < 5ms (regex + counting)

### 5. Dynamic Model Selection

- **Benefit:** Use faster models when appropriate
- **Meeting mode:** gemma3:12b (2-3s vs 5-8s with qwen3-coder)
- **Impact:** 60% faster for non-code contexts

### 6. Async Operations

- **Screen capture:** Non-blocking (runs in background loop)
- **OCR processing:** Async with Tesseract worker pool
- **LLM calls:** Async with timeout (30s)

---

## Security

### IPC Security

- **Whitelist:** Only registered channels allowed in preload.js
- **ContextBridge:** Renderer isolated from main process (Electron security)
- **No eval():** All inputs sanitized before execution
- **CORS:** Local API calls only (Ollama on localhost)

### Budget Security

- **Hard limit:** Cannot exceed monthly budget (enforced by providerRouter)
- **Validation:** All costs calculated before API call
- **Fallback:** Automatic switch to local on budget exhaustion
- **No external storage:** Budget data stored locally in SQLite

### Data Privacy

- **Local-first:** All data stored locally in SQLite database
- **No tracking:** No analytics sent to external servers
- **Optional cloud:** User explicitly enables cloud features via UI
- **API keys:** Stored securely (not in code, use environment variables)

---

## Scalability

### Concurrent Users

- **Design:** Single-user desktop application
- **Multiple sessions:** Supported via `session_id` isolation in DB

### Large Codebases

- **Screenshot limit:** Last 3 screenshots (configurable via `MAX_SCREENSHOTS`)
- **Audio limit:** Last 5 minutes (configurable via `AUDIO_WINDOW_MINUTES`)
- **Context size:** Typically 2000-5000 tokens
- **LLM limits:**
  - Ollama: ~8K context window
  - Claude: ~200K context window
  - DeepSeek: ~64K context window

### Budget Scaling

- **$20/month with Claude:** ~1000 deep analyses (typical usage: 2500 input + 800 output tokens)
- **$50/month with Claude:** ~2500 deep analyses
- **$20/month with DeepSeek:** ~10,000 deep analyses (10x cheaper than Claude)

### Database Performance

- **Suggestions table:** Thousands of records, indexed by session and timestamp
- **Budget table:** Hundreds of records per month, indexed by monthYear
- **Query performance:** < 5ms for typical queries (with indexes)

---

## Monitoring & Debugging

### Logs

- **Location:**
  - Linux/macOS: `~/.config/pickleglass/logs/assistant.log`
  - Windows: `%APPDATA%\pickleglass\logs\assistant.log`
- **Levels:** INFO, WARN, ERROR
- **Rotation:** Daily, keep last 7 days
- **Format:** `[Timestamp] [Component] Message`

### Performance Metrics

- **Access:** `performanceMonitor.getStats()`
- **Metrics:**
  ```javascript
  {
    analysisCount: 142,
    averageDuration: 3500,  // ms
    minDuration: 1200,
    maxDuration: 8900,
    cacheHitRate: 0.76,     // 76%
    llmLatency: {
      ollama: { avg: 3200, min: 1100, max: 7800 },
      claude: { avg: 2100, min: 1500, max: 3200 }
    },
    skippedAnalyses: 38     // Due to unchanged context
  }
  ```

### Debug Mode

- **Enable:** Set `DEBUG=assistant:*` environment variable
- **Output:** Detailed logs of every decision:
  - Provider routing logic
  - Budget calculations
  - Context analysis
  - Cache hits/misses
  - Token counts

### Chrome DevTools

- **Access:** F12 in Electron app
- **Console:** Shows IPC messages and UI updates
- **Network:** Shows Ollama/Claude API calls (if proxied)
- **Memory:** Profile for memory leaks (Heap Snapshot)

---

## Error Handling

### Cloud Failures

- **Scenario:** Claude API rate limit or network error
- **Response:**
  1. Log error with details
  2. Fallback to local model (qwen3-coder:30b)
  3. Show toast notification to user
  4. No budget consumed (only on success)

### Budget Exhaustion

- **Scenario:** Monthly budget reaches 100%
- **Response:**
  1. providerRouter forces local provider
  2. Deep Analysis button disabled in UI
  3. Alert shown: "Budget limit reached! Using local models only."
  4. Budget resets automatically at start of next month

### Ollama Unavailable

- **Scenario:** Ollama not running or model not installed
- **Response:**
  1. Detect error: Connection refused on localhost:11434
  2. Show error toast: "Ollama not running. Please start Ollama service."
  3. Suggestions: Empty array
  4. Service continues running (will retry on next analysis)

### OCR Failures

- **Scenario:** Tesseract crash or invalid image
- **Response:**
  1. Log warning
  2. Skip screenshot (continue with remaining screenshots)
  3. Analysis proceeds with available context

### Database Errors

- **Scenario:** SQLite locked or permissions issue
- **Response:**
  1. Retry with exponential backoff (3 attempts)
  2. If all retries fail, log critical error
  3. Service degrades gracefully (in-memory fallback for suggestions)

---

## Future Enhancements

### Short-term (Next 3-6 months)

- [ ] Persistent cache (survive app restart) - Store L1 cache to SQLite
- [ ] Configurable analysis delays in UI - Slider for 15s-300s
- [ ] Budget dashboard with graphs - Monthly spending trends
- [ ] Export suggestions to Markdown - One-click export
- [ ] Suggestion history - Browse past suggestions

### Medium-term (6-12 months)

- [ ] Multi-provider simultaneous routing - Try Claude, fallback to DeepSeek
- [ ] Custom prompts per mode - User-defined instructions
- [ ] Suggestion voting/feedback - Train on user preferences
- [ ] Team collaboration - Share suggestions across team
- [ ] VS Code extension - Native integration

### Long-term (12+ months)

- [ ] Multi-provider support - OpenAI, Gemini, Mistral
- [ ] Custom model fine-tuning - Train on your codebase
- [ ] Cloud-hosted option - SaaS version
- [ ] Mobile app - iOS/Android clients
- [ ] Real-time collaboration - Live suggestions for pair programming

---

## Configuration Reference

### Default Configuration

**Location:** `src/features/assistant/config/assistant.config.js`

```javascript
{
  enabled: false,             // Default off
  provider: 'ollama',         // 'ollama' | 'claude' | 'auto' (deprecated)

  model: {
    ollama: 'qwen3-coder:30b',
    claude: 'claude-haiku-4-5-20251001',
    deepseek: 'deepseek-v3.1'
  },

  // N-2: Dynamic output token ceilings per switch (most restrictive switch wins)
  // Derived from acceptable response latency targets, not from budget.
  // Updated 20/02: exercise, coding, system-design, tech-debate, default raised to allow
  // complete code solutions and architecture diagrams. Meeting/debug kept low for speed.
  llm: {
    maxOutputTokens: {
      'debug':          800,   // targeted fix: ~5s
      'exercise':      5000,   // code solution + Big O: ~8s (raised 20/02)
      'coding':        5000,   // clean code patch: ~6s (raised 20/02)
      'meeting':        600,   // action item / decision: ~4s
      'research':      1400,   // concept explanation: ~9s
      'system-design': 5500,   // architecture in schema form: ~13s (raised 20/02)
      'tech-debate':   5500,   // trade-offs + reasoning: ~11s (raised 20/02)
      default:         5500,   // fallback when no switch active (raised 20/02)
    }
  },

  budget: {
    enabled: true,
    monthlyLimit: 20.00,      // USD — API cost ceiling (not Claude desktop subscription)
    cloudProvider: 'claude',

    pricing: {
      claude: { input: 0.0008, output: 0.004 },   // Haiku 4.5 $/1K tokens
      deepseek: { input: 0.00027, output: 0.0011 },
      openai: { input: 0.0025, output: 0.01 }
    },

    prioritySwitches: ['exercise', 'coding', 'system-design', 'tech-debate', 'meeting'],
    warningThreshold: 0.80
  },

  screenCaptureInterval: 30000,
  contextWindow: 5 * 60 * 1000,
  analysisInterval: 2 * 60 * 1000,
  maxScreenshots: 3,
  suggestionTTL: 60 * 60 * 1000,   // 1 hour (cleanup); DB expiry for suggestions is 24h
  switches: { debug, exercise, meeting, research, coding, 'system-design', 'tech-debate' }
}
```

---

## API Reference

### IPC Methods (Renderer → Main)

#### `window.api.assistant.initialize()`

- **Returns:** `Promise<void>`
- **Description:** Initialize assistant service (call once on app start)

#### `window.api.assistant.start(sessionId)`

- **Parameters:** `sessionId` (string) - Unique session identifier
- **Returns:** `Promise<void>`
- **Description:** Start analysis loops

#### `window.api.assistant.stop()`

- **Returns:** `Promise<void>`
- **Description:** Stop service and cleanup

#### `window.api.assistant.analyzeNow(options)`

- **Parameters:**
  - `options.deepAnalysis` (boolean) - Force cloud analysis
- **Returns:** `Promise<void>`
- **Description:** Trigger immediate analysis

#### `window.api.assistant.getBudgetInfo()`

- **Returns:** `Promise<BudgetInfo>`
- **Description:** Get current month's budget information

#### `window.api.assistant.resetBudgetMetrics()`

- **Returns:** `Promise<void>`
- **Description:** Reset current month's metrics (dev only)

#### `window.api.assistant.triggerDeepAnalysis()`

- **Returns:** `Promise<void>`
- **Description:** Force cloud analysis (alias for `analyzeNow({ deepAnalysis: true })`)

#### `window.api.assistant.getCurrentProvider()`

- **Returns:** `Promise<ProviderInfo>`
- **Description:** Get active provider and model

#### `window.api.assistant.getSuggestions()`

- **Returns:** `Promise<Suggestion[]>`
- **Description:** Get active suggestions

#### `window.api.assistant.dismissSuggestion(id)`

- **Parameters:** `id` (string) - Suggestion ID
- **Returns:** `Promise<void>`
- **Description:** Dismiss suggestion by ID

#### `window.api.assistant.getContext()`

- **Returns:** `Promise<Context>`
- **Description:** Get current analysis context

#### `window.api.assistant.updateConfig(updates)`

- **Parameters:** `updates` (object) - Partial config updates
- **Returns:** `Promise<void>`
- **Description:** Update configuration

#### `window.api.assistant.getConfig()`

- **Returns:** `Promise<Config>`
- **Description:** Get current configuration

#### `window.api.assistant.getStats()`

- **Returns:** `Promise<Stats>`
- **Description:** Get performance statistics

### IPC Events (Main → Renderer)

#### `assistant:suggestions-updated`

- **Payload:** `Suggestion[]`
- **Description:** New suggestions available
- **Subscribe:** `window.api.assistant.onSuggestionsUpdated(callback)`

#### `assistant:budget-updated`

- **Payload:** `BudgetInfo`
- **Description:** Budget changed (new cloud usage recorded)
- **Subscribe:** `window.api.assistant.onBudgetUpdate(callback)`

#### `assistant:started`

- **Payload:** `{ sessionId: string }`
- **Description:** Service started successfully
- **Subscribe:** `window.api.assistant.onStarted(callback)`

#### `assistant:stopped`

- **Payload:** `{}`
- **Description:** Service stopped
- **Subscribe:** `window.api.assistant.onStopped(callback)`

#### `assistant:error`

- **Payload:** `{ message: string, error: Error }`
- **Description:** Error occurred
- **Subscribe:** `window.api.assistant.onError(callback)`

---

## Type Definitions

### BudgetInfo

```typescript
interface BudgetInfo {
  spent: number; // Total spent this month (USD)
  limit: number; // Monthly limit (USD)
  breakdown: {
    [provider: string]: {
      cost: number;
      calls: number;
    };
  };
  monthYear: string; // 'YYYY-MM'
  daysRemaining: number;
  percentageUsed: number;
  canUseCloud: boolean;
  recordCount: number;
}
```

### ProviderInfo

```typescript
interface ProviderInfo {
  provider: 'ollama' | 'claude' | 'deepseek';
  model: string;
  reason?: string;
}
```

### Suggestion

```typescript
interface Suggestion {
  id: string;
  sessionId: string;
  suggestionType: 'insight' | 'solution' | 'refactor' | 'optimization' | 'debug';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  code?: string;
  language?: string;
  context?: object;
  isDismissed: boolean;
  generatedAt: number; // Timestamp
  expiresAt: number; // Timestamp
  modelInfo?: {
    provider: string;
    model: string;
  };
}
```

### Context

```typescript
interface Context {
  audio: {
    text: string;
    speakers?: Array<{ text: string; speaker: string }>;
  };
  screen: {
    screenshots: Array<{
      ocrText: string;
      codeDetected: boolean;
      timestamp: number;
    }>;
  };
  flags: {
    hasAudio: boolean;
    hasScreen: boolean;
    hasCode: boolean;
    hasErrors: boolean;
  };
}
```

---

**Last Updated:** 2026-02-20 (N-1 hardened: STABLE_WINDOW_UP=3 + MIN_CYCLES_IN_STAGE=2 + \_cyclesInStage; Phase 5: semantic dedup via nomic-embed-text; 6-Layer Prompt Architecture: contextSignal+outputRules+getDominantSwitch; \_sanitizeContext prompt injection guard; normalizedTopic alphabetical sort; isModelInstalled() tag-agnostic fix; maxOutputTokens recalibrated; git: main @ 5f33d85)
**Version:** 2.2.0 (Hybrid LLM System + Embedding Cache + Semantic Dedup + 6-Layer Prompt)
