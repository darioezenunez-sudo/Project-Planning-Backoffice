# Context Phase 2 — Session context + stage detection

> Plan de diseño e implementación para que el asistente mantenga contexto de sesión y detecte etapas de la reunión, evitando sugerencias repetidas (mismo tema, distinto título). Respeta arquitectura, convenciones y patrones del módulo Assistant.

**Referencias:** `ASSISTANT_MODULE_CONTEXT.md` (sección 15–16), `ARCHITECTURE.md`. Audio: `docs/AUDIO_PLAN.md` (Parte I Nivel 2 completado). Aquí "Phase 2" = Context Phase 2.

---

## 1. Debate y alcance

### 1.1 Objetivo

En reuniones reales (~45 min) hoy ocurre:

- Cada análisis envía al LLM **solo los últimos 5 minutos** de audio (+ pantalla).
- Se inyectan **títulos** de sugerencias recientes (history injection) para no repetir el mismo título, pero el LLM sigue generando el **mismo tema** con otro título (ej. "Documentar requisitos…" vs "Definir criterios técnicos…").
- No hay noción de **etapa** de la reunión (presentación → requisitos → compensación → próximos pasos), ni de "temas ya cubiertos".

**Context Phase 2** debe:

1. Mantener un **contexto de sesión** (topic actual, etapa, temas/sugerencias ya ofrecidos) más allá del lote de 5 min.
2. **Detectar etapa** (stage) de la conversación para adaptar el tipo de sugerencias.
3. Reducir **repetición temática**: no sugerir de nuevo lo que ya se cubrió, aunque el título sea distinto (sin depender solo de Jaccard en títulos).

### 1.2 Restricciones (del ASSISTANT_MODULE_CONTEXT)

- Presupuesto: ~$20/mes en cloud; no subir coste por llamada de forma significativa.
- Latencia: análisis &lt; 15 s.
- Sin nuevas conexiones DB; usar sqliteClient singleton.
- Compatibilidad con switches, prompts y UI actuales.
- Lenguaje: español como principal.
- Tests existentes deben seguir pasando.

### 1.3 Opciones de diseño (resumen del doc)

| Enfoque                        | Qué hace                                                                 | Pros                                                      | Contras                                                |
| ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| **A. History stuffing**        | Ya implementado (Phase 1): títulos en el prompt                          | Simple, ya está                                           | No evita mismo tema con otro título                    |
| **B. Dedup semántico**         | Embeddings o similitud sobre títulos/descripciones                       | Reduce ruido en UI                                        | No baja coste LLM; embeddings añaden complejidad/coste |
| **C. Session context + stage** | Estado de sesión (topic, stage, sugerencias dadas) + detección de etapa  | Resuelve repetición, progresión y permite cache (Phase 3) | Más complejidad; stage puede fallar                    |
| **Híbrido (elegido)**          | A ya hecho + C (Context Phase 2) + luego Phase 3 (cache por stage+topic) | Equilibrio coste/valor                                    | Implementación por fases                               |

Context Phase 2 implementa la **opción C** dentro del híbrido.

---

## 2. Limpieza previa (nomenclatura y archivos)

### 2.1 Nomenclatura (hecho en docs)

- **AUDIO_NIVEL2_IMPLEMENTATION_PLAN.md:** Estado **COMPLETADO**; fases nombradas "Nivel 2 — Phase 1" … "Nivel 2 — Phase 6". "Phase 2" sin prefijo en el resto de la documentación = Context Phase 2.
- **ASSISTANT_MODULE_CONTEXT.md:** Roadmap usa "Context Phase 2" y "Context Phase 3" para sesión/cache; tabla de impacto actualizada.

### 2.2 Archivos a revisar (no eliminar sin criterio)

| Archivo                                             | Uso actual                                                                                          | Acción recomendada                                                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assistantAudioCapture_V1.js` (backend)             | No referenciado por assistantService ni bridge; el módulo usa `assistantAudioCapture.js` (Nivel 2). | Dejar por ahora; opcional: JSDoc `@deprecated` y comentar que el flujo activo es Nivel 2. No borrar hasta confirmar que ningún test o flag usa V1. |
| `assistantAudioCapture_V1.js` (UI)                  | Puede existir en `ui/assistant/`; el flujo estéreo está en `assistantAudioCapture.js`.              | Misma línea: revisar referencias; si no se usa, marcar deprecated.                                                                                 |
| Tests `phase1.test.js` … `phase9.test.js`           | Nombrados por fases de cache/integración/trigger, **no** por el plan de audio.                      | No renombrar; no hay conflicto con "Context Phase 2".                                                                                              |
| Docs eliminados (CONVENTIONS, OPTIMIZATION_SUMMARY) | Ya borrados (git).                                                                                  | Nada.                                                                                                                                              |

No se eliminan archivos en este plan; solo se deja claro qué es "Context Phase 2" y se documenta el estado del audio (Nivel 2 completado).

---

## 3. Diseño técnico — Context Phase 2

### 3.1 SessionContext (estado en memoria) — Menos es más

Objeto **plano en memoria** que mantiene el orquestador (`assistantService`). No hay SessionContextService ni módulo dedicado; un objeto en Electron/Node es suficiente. La única fuente de verdad para "qué ya se sugirió" es **getSessionHistory()** (DB); no se duplica en SessionContext para evitar desincronización.

**Contrato (JSDoc) — no convertir en "basurero" de variables:**

```javascript
/**
 * @typedef {'exploring'|'implementing'|'testing'|'wrapping_up'|'unknown'} Stage
 *
 * @typedef {Object} SessionContext
 * @property {string} currentTopic   - String de keywords (salida de extractTopicSummary)
 * @property {Stage} stage          - Etapa actual estimada
 * @property {number} occurrenceCount - Histéresis: cuántas veces seguidas se detectó el mismo stage
 * @property {number} lastUpdate    - Timestamp (Date.now())
 */
```

**Estado inicial en `assistantService.start()`:**

```javascript
this._sessionContext = {
  currentTopic: '',
  stage: 'exploring',
  occurrenceCount: 0,
  lastUpdate: Date.now(),
};
```

En `stop()`: `this._sessionContext = null`.

- **currentTopic:** Salida de `ContextAnalyzer.extractTopicSummary(audioText + screenText, maxKeywords)`; string de keywords separados por espacios. Sin LLM extra.
- **stage:** Salida de `StageDetector.detect(context, this._sessionContext)` con reglas de histéresis (ver 3.2).
- **occurrenceCount:** Usado por el stage detector para no cambiar de etapa por un solo ciclo (flip-flop).
- **No se incluye suggestionTitlesGiven:** La historia ya se obtiene vía `getSessionHistory(sessionId, 10)` para el prompt; duplicarla en memoria añade riesgo de desincronización si una inserción en DB falla.

Persistencia: **MVP sin tabla nueva.** SessionContext se crea en `start()` y se descarta en `stop()`. Opcional posterior: tabla `session_context` para recuperar tras reinicio.

### 3.2 Stage (etapa) e histéresis

Valores (genéricos para meeting/coding/exercise):

```text
Stage:
  'exploring'     // Presentación, descubrimiento del tema (default inicial)
  'implementing'  // Requisitos, diseño, implementación
  'testing'       // Pruebas, validación
  'wrapping_up'   // Cierres, próximos pasos, follow-ups
  'unknown'       // Fallback
```

**Detección (MVP):** Módulo `utils/stageDetector.js` con heurísticas por keywords (es + en). Listas por etapa, p. ej. wrapping_up: "próximos pasos", "siguiente", "resumen", "cierre", "next steps", "wrap up"; testing: "prueba", "test", "validar", "QA"; implementing: "requisitos", "stack", "implementar", "diseño"; etc. Scoring por coincidencias; no cambiar por una sola palabra.

**Histéresis (evitar flip-flop):** No cambiar de stage de inmediato cuando el detector devuelve otro. Implementar al menos una de:

- **confidenceThreshold:** Solo cambiar si `newStageScore > currentStageScore + 2` (el nuevo stage debe ser sustancialmente más fuerte).
- **stableWindow:** El nuevo stage debe ser el mismo en **2 ciclos de análisis consecutivos** antes de actualizar `_sessionContext.stage`; si en el siguiente ciclo se detecta otro stage, se resetea el candidato.

Ambas son válidas; stableWindow es más simple de implementar (contador por stage candidato) y no depende de magnitudes de score.

**API sugerida:** `StageDetector.detect(context, currentSessionContext) → { stage: Stage }`. Internamente usa `currentSessionContext.stage` y `occurrenceCount` (o un candidato estable) para aplicar la regla de histéresis.

**Futuro:** Meta-análisis con Ollama para reducir falsos positivos; MVP solo heurísticas.

### 3.3 Flujo de datos (respetando patrones actuales)

1. **assistantService.start()**
   - Crear `this._sessionContext = { currentTopic: '', stage: 'exploring', occurrenceCount: 0, lastUpdate: Date.now() }`.
   - No duplicar datos de getSessionHistory; la DB es la única fuente de verdad para lo ya sugerido.

2. **Antes de cada \_performAnalysis()** (tras tener `context` de contextAggregator)
   - Actualizar `_sessionContext`:
     - **currentTopic:** `ContextAnalyzer.extractTopicSummary(audioText + screenText, 10)` (string de keywords; filtrar números y códigos de error/OCR para que sea legible en el prompt).
     - **stage** (con histéresis): `StageDetector.detect(context, this._sessionContext)` → actualizar `this._sessionContext.stage`, `occurrenceCount`, `lastUpdate`.
   - Pasar `sessionContext: this._sessionContext` en `options` a `intelligenceEngine.analyze(..., { suggestionHistory, sessionContext })`. `suggestionHistory` sigue viniendo de `getSessionHistory(sessionId, 10)` como hoy.

3. **intelligenceEngine.analyze()**
   - En `options` aceptar `sessionContext` (opcional).
   - En `_buildPrompt()`: mantener bloque "ALREADY SUGGESTED" (Phase 1). Añadir **antes o junto a ese bloque**:
     - Línea de etapa y temas: `Current meeting stage: {stage}. Main topics: {currentTopic}.`
     - Instrucción tajante: `IMPORTANT: You have already suggested the topics above. Do not pivot back to previous topics unless new technical blockers have emerged. Focus your insights on the current stage.`
   - No cambiar aún la clave de cache (Context Phase 3).

4. **Después de addSuggestions()**
   - No actualizar ningún estado de SessionContext con títulos; el siguiente ciclo vuelve a leer historia vía getSessionHistory().

### 3.4 Dónde vive cada pieza (convenciones)

| Pieza                      | Ubicación                                                             | Motivo                                                                   |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| SessionContext (objeto)    | **Solo** en `assistantService.js` como `this._sessionContext`         | Sin módulo extra; evitar fragmentación. Objeto plano con contrato JSDoc. |
| Stage detection            | `utils/stageDetector.js` (nuevo)                                      | Responsabilidad única; no sobrecargar contextAnalyzer.                   |
| Topic summary              | `utils/contextAnalyzer.js` → `extractTopicSummary(text, maxKeywords)` | Reutiliza extractKeywords; consistencia con topic change.                |
| Integración en prompt      | `intelligenceEngine.js` (`_buildPrompt`)                              | Añadir bloque stage + topic + instrucción negativa.                      |
| Lifecycle \_sessionContext | `assistantService.js` (start/stop y antes de analyze)                 | Orquestador posee el estado; detector y analyzer son stateless.          |

- **Patrón:** JavaScript CommonJS, validación de entradas, logs significativos, sin fallos silenciosos.
- **Tests:** Unitarios para `extractTopicSummary` y `StageDetector.detect`; integración: prompt incluye "Current meeting stage" y "Main topics".

**extractTopicSummary (detalle):** `ContextAnalyzer.extractTopicSummary(text, maxKeywords = 10)` debe devolver un string de hasta `maxKeywords` keywords unidas por espacios. Reutilizar la extracción de keywords existente (unigrams + bigrams, sin stopwords). **Filtros adicionales para legibilidad en el prompt:** excluir tokens que sean solo dígitos, y opcionalmente patrones de código/error muy específicos típicos de OCR (p. ej. cadenas tipo `0x...`, códigos de error hex). Objetivo: que "Main topics" en el prompt sea legible y semántico, no ruido de pantalla.

### 3.5 Switches y prompts

- **switches.config.js:** Opcionalmente, por switch (meeting, coding, exercise), definir `stages: ['exploring', 'implementing', ...]` o textos de ayuda para el prompt. MVP puede usar stages genéricos sin tocar switches.
- **prompts.config.js:** Si existe sección "already suggested", ampliarla con "stage and topic" en Context Phase 2; si todo está en intelligenceEngine, solo se añade el bloque de stage/topic en `_buildPrompt()`.

### 3.6 Base de datos

- **MVP:** Sin nueva tabla. SessionContext en memoria.
- **Fase posterior (opcional):** Tabla `session_context` (sessionId, currentTopic, stage, updatedAt) para persistir entre reinicios; migrations en `migrations/` como el resto.

### 3.7 Orden de implementación (refinado)

Orden lógico para testing incremental (cada paso es testeable antes del siguiente):

1. **extractTopicSummary** en `contextAnalyzer.js`: función pura `extractTopicSummary(text, maxKeywords = 10)`; filtrar números y ruido OCR; devolver string de keywords. Tests unitarios.
2. **StageDetector** en `utils/stageDetector.js`: `detect(context, currentSessionContext)` con listas es/en, scoring e histéresis (confidenceThreshold o stableWindow). Tests con mocks de texto.
3. **Integración en assistantService:** En `start()` crear `this._sessionContext` (estado inicial). Antes de cada `_performAnalysis()`, actualizar `currentTopic` y `stage`; pasar `sessionContext` en options a `analyze()`. En `stop()` poner `this._sessionContext = null`.
4. **Prompt en intelligenceEngine:** Aceptar `options.sessionContext` en `analyze()`; en `_buildPrompt()` añadir bloque "Current meeting stage: {stage}. Main topics: {currentTopic}. IMPORTANT: You have already suggested the topics above. Do not pivot back to previous topics unless new technical blockers have emerged. Focus your insights on the current stage."
5. **Tests:** Unitarios ya en pasos 1–2; test de integración que verifique que el prompt generado incluye stage y topic cuando sessionContext está presente.
6. **(Opcional)** Tabla `session_context` y persistencia para recuperar estado tras reinicio.

### 3.8 Convenciones de código del repo (obligatorias)

Al implementar, respetar el patrón de escritura y nomenclatura ya usados en el módulo Assistant:

| Ámbito                            | Convención                                                                          | Ejemplo en el repo                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Nombres de archivo**            | camelCase                                                                           | `contextAnalyzer.js`, `stageDetector.js`, `suggestionDedup.js`                                                  |
| **Variables y propiedades**       | camelCase                                                                           | `currentTopic`, `occurrenceCount`, `lastUpdate`, `sessionId`                                                    |
| **Estado “privado” en servicios** | Prefijo `_` en la propiedad                                                         | `this._sessionContext`, `this._skippedCycles`, `this._lastAnalysisKeywords`                                     |
| **Utils con API estática**        | Clase con métodos estáticos + export nombrado                                       | `contextAnalyzer.js`: `class ContextAnalyzer { static ... }` → `module.exports = { ContextAnalyzer }`           |
| **Require de utils**              | Desestructuración del nombre de clase/función                                       | `const { ContextAnalyzer } = require('../utils/contextAnalyzer');` → `ContextAnalyzer.extractTopicSummary(...)` |
| **StageDetector (nuevo)**         | Mismo patrón que ContextAnalyzer                                                    | `class StageDetector { static detect(context, sessionContext) { ... } }` → `module.exports = { StageDetector }` |
| **Timestamps**                    | Siempre milisegundos (`Date.now()`)                                                 | `lastUpdate: Date.now()`; en DB igual (convención en repos: camelCase + ms)                                     |
| **JSDoc**                         | Bloque al inicio del archivo (propósito); en métodos `@param`, `@returns` con tipos | Ver `contextAnalyzer.js`, `suggestionDedup.js`, `sqlite.repository.js`                                          |
| **Logs**                          | Prefijo `[ComponentName]`; mensajes significativos                                  | `console.log('[AssistantService] ...');`                                                                        |
| **Errores**                       | No fallos silenciosos; validar entradas; registrar errores                          | Try/catch con `console.error('[Component]', error)` donde corresponda                                           |
| **Tests**                         | En `__tests__/` del feature; mismo estilo que `phaseN.test.js`                      | `require` desde rutas relativas al feature                                                                      |

**Base de datos (si en el futuro se añade tabla):** Nombres de columnas en camelCase; timestamps en milisegundos (ver comentario en `repositories/suggestions/sqlite.repository.js`).

---

## 4. Resumen

- **Objetivo:** Context Phase 2 = session context + stage detection para que el LLM no repita sugerencias por tema (más allá del título) y adapte a la etapa de la reunión. Al introducir stage y topic se le da al LLM una **memoria a largo plazo** (sesión) que complementa la memoria a corto plazo (buffer 5 min), reduciendo sugerencias cíclicas sin ampliar la ventana de contexto ni el coste.
- **Nomenclatura:** "Phase 2" = Context Phase 2; audio Nivel 2 está completado.
- **Diseño refinado:** Objeto `_sessionContext` en assistantService solo (currentTopic, stage, occurrenceCount, lastUpdate); sin SessionContextService ni `suggestionTitlesGiven`; getSessionHistory() es la única fuente de verdad para lo ya sugerido. StageDetector en `utils/stageDetector.js` con histéresis (confidenceThreshold o stableWindow). Topic vía extractTopicSummary (keywords, filtro números/OCR).
- **Prompt:** Instrucción tajante: no volver a temas anteriores salvo nuevos bloqueos técnicos; foco en la etapa actual.
- **Orden:** extractTopicSummary → StageDetector → wiring en assistantService → prompt en intelligenceEngine → tests.

Cuando bajes a código, seguir el orden de 3.7 permite integrar de forma incremental y con tests en cada paso.

---

## 5. Diseño de la solución implementada

Resumen de lo construido (4 archivos modificados, 1 nuevo, 1 test file). Todos los puntos del plan §3.7 cubiertos.

### 5.1 Cambios por archivo

| Archivo                                    | Cambio                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/contextAnalyzer.js`                 | Nuevo método estático **extractTopicSummary(text, maxKeywords)** — extrae unigrams frecuentes, filtra dígitos puros y ruido hex/OCR, ordena por frecuencia; devuelve string de keywords separados por espacios.                                                                                                        |
| `utils/stageDetector.js` (nuevo)           | Clase **StageDetector** con **detect(context, sessionCtx)** — scoring por keywords es/en en 4 stages (exploring, implementing, testing, wrapping_up); histéresis **stableWindow=2** con tracking explícito de `_candidateStage` y `occurrenceCount` para ciclos consecutivos del candidato.                            |
| `services/assistantService.js`             | **\_sessionContext** inicializado en `start()` (currentTopic, stage, occurrenceCount, lastUpdate), nulled en `stop()`; actualizado en `_performAnalysis()` antes del LLM call (topic vía extractTopicSummary, stage vía StageDetector.detect); se pasa como `options.sessionContext` a `intelligenceEngine.analyze()`. |
| `services/intelligenceEngine.js`           | **\_buildPrompt()** acepta `sessionContext` (6º parámetro); genera bloque **CURRENT MEETING STAGE / ETAPA ACTUAL DE LA REUNIÓN** con topic + instrucción anti-repetición; solo se emite si `stage !== 'unknown'`.                                                                                                      |
| `__tests__/context-phase2.test.js` (nuevo) | 21 tests: 7 para extractTopicSummary, 10 para StageDetector.detect (incl. 4 de histéresis), 4 para integración de prompt.                                                                                                                                                                                              |

### 5.2 Decisiones de diseño clave

- **occurrenceCount:** Cuenta ciclos consecutivos del **candidato** diferente al stage actual, no del stage actual. Se complementa con **\_candidateStage** para saber qué candidato se está trackeando; al llegar a 2, se confirma el cambio de stage (stableWindow).
- **Sin tabla nueva en DB:** \_sessionContext vive en memoria y se destruye en `stop()`. Alineado con MVP del plan.
- **getSessionHistory()** sigue siendo la única fuente de verdad para lo ya sugerido; no se duplica en \_sessionContext.
- **Coste LLM:** Las líneas adicionales en el prompt son ~50 tokens; cero llamadas LLM adicionales.

---

## 6. Context Phase 3 — Plan de implementación (Smart Cache Keying)

Objetivo: sustituir la clave de caché basada en contenido crudo (audio + screen → 0% hit con audio) por una clave estable derivada de estado de sesión (stage + normalizedTopic + switches + language), con skip de L2 cuando hay audio activo.

### 6.1 Contrato técnico (cerrado con TL)

| Decisión        | Regla                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Key             | Si `sessionContext?.stage` válido (no vacío/unknown) → `SHA-256(JSON.stringify({ stage, topic: normalizedTopic, switches: sorted, language }))`. Si no → hash actual (audio + screen + switches + language). |
| normalizedTopic | Top-5 keywords del topic, ordenados alfabéticamente. Ya calculado en assistantService y expuesto como `_sessionContext.normalizedTopic`.                                                                     |
| Topic sticky    | Ya implementado en assistantService (Jaccard > 0.70, máx 3 ciclos, ruptura < 0.40). No tocar.                                                                                                                |
| L2 con audio    | No escribir en L2 cuando `context.flags.hasAudio === true`. L1 siempre se escribe.                                                                                                                           |
| API cache       | Añadir 4º parámetro opcional `sessionContext` a get/set en L1 y L2; backward-compatible (tests sin sessionContext siguen con hash raw).                                                                      |

### 6.2 Fases de implementación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 1 — ContextCache (L1)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1.1 _generateHash(context, activeSwitchIds, language, sessionContext?)        │
│     • Si sessionContext?.stage existe y no es 'unknown' → smart key:          │
│       content = { stage, topic: sessionContext.normalizedTopic || '',        │
│                   switches: sorted, language }                              │
│     • Sino → contenido actual (audio, screen, switches, language)             │
│ 1.2 get(context, activeSwitchIds, language, sessionContext?)                 │
│     • Pasar sessionContext a _generateHash                                    │
│ 1.3 set(context, value, activeSwitchIds, language, sessionContext?)          │
│     • Pasar sessionContext a _generateHash                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 2 — ContextCacheL2 (L2)                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2.1 _generateHash(context, activeSwitchIds, language, sessionContext?)       │
│     • Misma lógica que L1 (smart key vs raw)                                 │
│ 2.2 get(context, activeSwitchIds, language, sessionContext?)                 │
│ 2.3 set(context, suggestions, activeSwitchIds, language, sessionContext?)    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FASE 3 — IntelligenceEngine.analyze()                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3.1 Obtener sessionContext de options al inicio (ya existe en L123)         │
│ 3.2 cache.get(context, activeSwitchIds, language, sessionContext)             │
│ 3.3 cacheL2.get(context, activeSwitchIds, language, sessionContext)          │
│ 3.4 Promoción L2→L1: cache.set(..., sessionContext)                          │
│ 3.5 Tras LLM: cache.set(context, suggestions, activeSwitchIds, language,     │
│               sessionContext) siempre                                        │
│ 3.6 cacheL2.set(...) solo si !context.flags?.hasAudio                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Archivos afectados

| Archivo                            | Cambios                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `services/cache/contextCache.js`   | \_generateHash con sessionContext; get/set con 4º param opcional                  |
| `services/cache/contextCacheL2.js` | Idem                                                                              |
| `services/intelligenceEngine.js`   | Pasar sessionContext en todas las llamadas cache; condicional L2.set por hasAudio |

### 6.4 Criterio de éxito

- Tests existentes (phase2, phase5, integration) siguen pasando (llamadas sin sessionContext → hash raw).
- Con sesión activa y sessionContext con stage + normalizedTopic, la clave es estable entre ciclos con mismo tema/etapa → hit en L1.
- Con audio activo no se escribe en L2 (menos I/O y sin entradas inútiles).

### 6.5 Estado de implementación

**COMPLETADO** — Implementado y testeado. Ver sección §8 para el estado real de hit rate (10.3% — topicKey rotó en casi todos los ciclos) y la causa raíz que motivó Phase 4.

**Correcciones post-auditoría incluidas:**

- `normalizedTopic`: top-3 keywords (no 5) para reducir rotación de la clave
- L2 guard `hasAudio` **eliminado** — bloqueaba todas las escrituras en sesiones con audio (que son la mayoría)
- Log `[ContextCache] Hash (smart): hash — topic="X", stage=Y` para diagnóstico

---

## 7. Auditoría de logs reales — Sesión 18/02/2026 (Session 2 + Session 3)

> Análisis de `docs/logs_Test_18_02_2025_15hs.md` con metodología de la auditoría anterior (17/02).

### 7.1 Métricas observadas

| Métrica             | Session 2 (LeetCode, 59 min)         | Session 3 (System Design, ≥20 min)             | Anterior (17/02) |
| ------------------- | ------------------------------------ | ---------------------------------------------- | ---------------- |
| Cache L1 hit rate   | 0% (topic cambió c/ ciclo)           | 62.5% (topic "ado edit real" estable 6 ciclos) | 10.3%            |
| Stage accuracy      | 50%                                  | 75%                                            | 50% (anterior)   |
| Speaker attribution | ✅ Speaker_1 + Speaker_2 funcionando | ✅                                             | ✅ (resuelto)    |
| Latencia outlier    | Call #7: 34.7s (5053 tokens)         | Call #8: 27.3s (4344 tokens)                   | N/A              |
| Causa latencia      | `maxTokens: 16384` hardcoded         | Idem                                           | N/A              |

### 7.2 Defectos identificados (N-1 a N-5)

| ID      | Descripción                                                                                  | Severidad | Estado                                               |
| ------- | -------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| **N-1** | Stage transition: latencia 180s en contenido estable (3 ciclos × 60s con STABLE_WINDOW fijo) | P1        | ✅ RESUELTO (§8)                                     |
| **N-2** | `maxTokens: 16384` hardcoded → outliers de 27-35s; coste no diferenciado por switch          | P1        | ✅ RESUELTO (§9)                                     |
| **N-3** | OCR en pantalla compartida: calidad baja cuando se comparte ventana externa                  | P2        | 🔲 Pendiente — requiere investigación video approach |
| **N-4** | Cache L1 hit rate 0% en Session 2 — topicKey (string de keywords) rota cada ciclo            | P1        | ✅ RESUELTO (§10)                                    |
| **N-5** | Budget visibility: usuario sin visibilidad del coste acumulado por sesión                    | P2        | 🔲 Pendiente — ir al Context/Insights modal panel    |

---

## 8. N-1 — Stage transition: hysteresis asimétrica + fast-path

**Archivo**: `src/features/assistant/utils/stageDetector.js`

### 8.1 Diagnóstico

- `STABLE_WINDOW=2` simétrico → 2 ciclos × 60s = 120s para cualquier transición
- En Session 3 se detectó transición correcta pero con 180s de delay
- En Session 2 se detectó falso positivo `exploring → wrapping_up` (palabras genéricas "siguiente", "pendiente")

### 8.2 Cambios implementados (18/02/2026)

```javascript
const STABLE_WINDOW_UP = 2; // (luego subido a 3 el 20/02 — ver §11)
const STABLE_WINDOW_DOWN = 3; // implementing→wrapping_up: conservador

const FAST_TRANSITION_GAP = 6; // Si score_candidato - score_actual >= 6 → transición inmediata
const MIN_SCORE_TO_TRANSITION = 3;
const STAGE_ORDER = { exploring: 0, implementing: 1, testing: 2, wrapping_up: 3, unknown: -1 };
```

**Keywords limpiados en `wrapping_up`**: removidos `siguiente`, `pendiente`, `terminar`, `asignar`, `responsable`, `deadline`, `timeline`, `entrega`, `compromiso`, `acuerdo`.

**Flujo de decisión (18/02):**

1. Score < `MIN_SCORE_TO_TRANSITION` → no transición
2. Gap vs actual ≥ `FAST_TRANSITION_GAP` → transición inmediata
3. UP → requiere `STABLE_WINDOW_UP` ciclos consecutivos
4. DOWN → requiere `STABLE_WINDOW_DOWN` ciclos consecutivos

**Ver §11 para N-1 hardened (20/02): STABLE_WINDOW_UP 2→3, MIN_CYCLES_IN_STAGE=2, \_cyclesInStage counter.**

### 8.3 Tests

Tests actualizados en `context-phase2.test.js`:

- `should NOT switch stage on first detection when score gap < FAST_TRANSITION_GAP`
- `should fast-transition immediately when score gap >= FAST_TRANSITION_GAP (6)`
- `should reset candidate tracking when a third stage appears`

Post-20/02: 101/104 tests pasando (3 pre-existing failures).

---

## 9. N-2 — maxOutputTokens dinámico por switch

**Archivos**: `assistant.config.js`, `intelligenceEngine.js`

### 9.1 Diagnóstico

- `maxTokens: 16384` hardcoded en `_callCloud()` → system-design generó 5053 tokens, 34.7s de latencia
- Coste no diferenciado: meeting (valor bajo, respuesta corta) = mismo techo que system-design (alta complejidad)
- Ollama: `num_predict` en config global, no por switch

### 9.2 Cambios implementados (18/02/2026, recalibrados 20/02/2026)

**`assistant.config.js`** — Bloque `llm.maxOutputTokens` (valores actuales tras recalibración 20/02):

```javascript
llm: {
  maxOutputTokens: {
    'debug':          800,   // targeted fix: 5s target latency
    'exercise':      5000,   // code solution + Big O: 8s target (raised 20/02)
    'coding':        5000,   // clean code patch: 6s target (raised 20/02)
    'meeting':        600,   // action item / decision: 4s target
    'research':      1400,   // concept explanation: 9s target
    'system-design': 5500,   // architecture in schema form: 13s target (raised 20/02)
    'tech-debate':   5500,   // trade-offs + reasoning: 11s target (raised 20/02)
    default:         5500,   // fallback when no switch active (raised 20/02)
  }
}
```

> **Nota recalibración 20/02:** Los valores iniciales (exercise:1200, coding:900, system-design:1800) eran demasiado restrictivos — soluciones de código completas y diagramas de arquitectura requieren más tokens. La decisión es deliberada (business decision) y será validada con logs reales de la reunión RRHH 20/02.

**`intelligenceEngine.js`** — Método `_calculateMaxOutputTokens(activeSwitchIds)`:

```javascript
// La restricción más severa del conjunto de switches activos gana (Math.min via reduce)
// Aplica a Ollama (num_predict override) y Cloud (Anthropic maxTokens)
// Mínimo absoluto: 400 tokens (no dejar respuestas truncadas)
```

### 9.3 Criterio de éxito

- Log `[IntelligenceEngine] Max output tokens: N (switches: [X, Y])` visible en cada ciclo
- Latencia del switch `meeting` ≤ 4s
- 0 regresiones en tests
- Calibración final pendiente: analizar logs RRHH meeting 20/02

---

## 10. Context Phase 4 — TopicEmbeddingClusterer (N-4)

**Diagnóstico**: Smart cache key (Phase 3) usa `normalizedTopic` (string de 3 keywords). En Session 2, el topic rotó en casi cada ciclo → hit rate 0%. En Session 3, el topic fue estable → 62.5%. La raíz del problema: keywords de superficie cambian aunque el tema semántico sea el mismo.

**Solución**: Reemplazar `normalizedTopic` por `topicClusterId` en la clave hash. El cluster ID es estable mientras el embedding del topic esté dentro de la región del centroide (coseno ≥ 0.82).

### 10.1 Arquitectura

```
AssistantService (antes de analyze()):
  normalizedTopic = "arquitectura cliente producto"  // top-3 keywords
       │
       ▼ _topicClusterer.getOrCreateClusterId(normalizedTopic)  [async]
       │
       ├── ollamaService.embed(text, 'nomic-embed-text')
       │       → [0.23, -0.41, 0.87, ...]  (768 dimensiones)
       │
       ├── cosineSimilarity(embedding, centroid) para cada cluster existente
       │
       ├── sim ≥ 0.82?  YES → reuse cluster (update centroid via running avg)
       │                NO  → new cluster "t{n}"
       │
       └── _sessionContext.topicClusterId = "t0"  (o "t1", etc.)
                │
                ▼
       ContextCache._generateHash(..., sessionContext)
       │   topic = sessionContext.topicClusterId || sessionContext.normalizedTopic
       │   keyType = topicClusterId ? 'smart+embed' : 'smart'
       │
       └── SHA-256(stage + "t0" + switches + language)
               → mismo hash para ciclos con mismo tema semántico → L1 HIT
```

### 10.2 TopicEmbeddingClusterer

**Ubicación**: `src/features/assistant/services/cache/contextCache.js` (exportado como `module.exports.TopicEmbeddingClusterer`)

**Propiedades**:

| Parámetro             | Default            | Descripción                       |
| --------------------- | ------------------ | --------------------------------- |
| `similarityThreshold` | 0.82               | Coseno mínimo para reusar cluster |
| `embeddingModel`      | `nomic-embed-text` | Modelo Ollama para embeddings     |

**Lifecycle**: Una instancia por sesión (`startSession` → `stopSession`). `reset()` limpia centroides y cache en-sesión. Sin persistencia entre reinicios (acceptable — sesiones son ≤60-90 min).

**Fallbacks**:

- Ollama no corriendo → `null` (cache usa Phase 3 `normalizedTopic`)
- Modelo no instalado → `null` + warn `ollama pull nomic-embed-text`
- `embed()` falla → `null` + warn (non-fatal)

**In-session dedup cache**: Mismo string → mismo resultado sin re-embed (evita llamadas duplicadas cuando `normalizedTopic` no cambió).

### 10.3 Cambios en `ContextCache._generateHash`

```javascript
// Phase 4: preferir topicClusterId sobre normalizedTopic
const topicKey = useSmartKey
  ? sessionContext.topicClusterId || sessionContext.normalizedTopic || ''
  : null;

// Log diferenciado:
// 'smart+embed' — usando cluster ID de embedding
// 'smart'       — usando normalizedTopic (Phase 3 fallback)
// 'raw'         — sin sessionContext válido
```

### 10.4 Backward compatibility

- `topicClusterId: null` → comportamiento idéntico a Phase 3 (usa `normalizedTopic`)
- Llamadas sin `sessionContext` → hash raw (Phase 2, backward-compatible)
- Todos los tests Phase 3 siguen pasando sin modificación

### 10.5 Archivos modificados

| Archivo                            | Cambio                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/cache/contextCache.js`   | `TopicEmbeddingClusterer` class + export; `_generateHash` prefiere `topicClusterId`                                                                                             |
| `services/assistantService.js`     | Import `TopicEmbeddingClusterer`; `topicClusterId` en `_sessionContext`; `_topicClusterer` init en `start()`, `reset()` en `stop()`; enriquecimiento async antes de `analyze()` |
| `__tests__/context-phase2.test.js` | 10 nuevos tests: `TopicEmbeddingClusterer` (fallbacks, clustering, centroid update, reset) + `ContextCache Phase 4` (topicClusterId override, fallback, backward compat)        |

### 10.6 Logs esperados en sesión real

Con `nomic-embed-text` instalado:

```
[OllamaService] ✔ Embedding model nomic-embed-text ready
[TopicEmbeddingClusterer] New cluster t0 for topic "arquitectura cliente" (clusters total: 1)
[AssistantService] Topic cluster: "arquitectura cliente" → t0
[ContextCache] Hash (smart+embed): abc123... — topic="t0", stage=implementing
# 2 ciclos después, mismo tema con palabras diferentes:
[TopicEmbeddingClusterer] Topic "servicio backend api" → cluster t0 (sim=0.921, count=2)
[ContextCache] Hash (smart+embed): abc123... — topic="t0", stage=implementing  ← mismo hash → L1 HIT
```

### 10.7 Métrica esperada

Hit rate: de 0-10% → ~40-60% cuando el mismo tema técnico domina varios ciclos consecutivos.

---

## 11. N-1 Hardened — Stage hysteresis segunda ronda (20/02/2026)

**Disparador**: Análisis de logs 19/02. Transición `exploring → implementing` disparó en ciclo 2 con solo ~4 min de evidencia de audio — demasiado agresivo. MIN_CYCLES_IN_STAGE añadido para prevenir flip-flop en los primeros ciclos de sesión.

### 11.1 Cambios implementados

**`stageDetector.js`**:

```javascript
// STABLE_WINDOW_UP: 2 → 3 (raised to prevent premature up-transitions)
// Rationale: log analysis 19/02 showed transition fired at cycle 2 with only ~4 min audio evidence
const STABLE_WINDOW_UP = 3;
const STABLE_WINDOW_DOWN = 3;

// NEW: MIN_CYCLES_IN_STAGE = 2
// Blocks upward transitions until the CURRENT stage has been confirmed for ≥2 cycles.
// Prevents flip-flop when session starts with mixed-signal audio.
// Does NOT apply to downward transitions (wrapping_up must be reachable at any time).
const MIN_CYCLES_IN_STAGE = 2;
```

**`_cyclesInStage` counter** — propagado en todos los return paths de `detect()`:

- Incrementa en cada ciclo de análisis (tanto cuando se confirma la etapa como cuando se bloquea una transición).
- Resetea a 1 en cada cambio de etapa confirmado.
- Si maxScore === 0 o maxScore < MIN_SCORE_TO_TRANSITION → `_cyclesInStage + 1` (sin transición).

**`assistantService.js`** — `_sessionContext` inicialización:

```javascript
this._sessionContext = {
  ...
  _cyclesInStage: 0,  // NEW: N-1 MIN_CYCLES_IN_STAGE guard
  ...
};
```

**`clearEmbedCache()`** también llamado en `start()` (Phase 5 integration).

### 11.2 Flujo de decisión completo (N-1 hardened)

```
StageDetector.detect(context, sessionCtx):
  1. fullText.trim().length === 0? → return { stage: currentStage, _cyclesInStage: +1 }
  2. Score all stages via _scoreStages(fullText)
  3. Find candidateStage (max score, tie-break: prefer currentStage)
  4. maxScore === 0? → return { stage: currentStage, _cyclesInStage: +1 }
  5. maxScore < MIN_SCORE_TO_TRANSITION (3)? → return { stage: currentStage, _cyclesInStage: +1 }
  6. candidateStage === currentStage? → return { stage: currentStage, occurrenceCount: +1, _cyclesInStage: +1 }
  7. Different stage detected:
     a. isUpTransition?
        AND cyclesInCurrentStage < MIN_CYCLES_IN_STAGE (2)? → BLOCK, return { stage: currentStage, _cyclesInStage: unchanged }
     b. gap = maxScore - scores[currentStage]
        gap >= FAST_TRANSITION_GAP (6)? → IMMEDIATE transition, { stage: candidate, _cyclesInStage: 1 }
     c. windowRequired = isUpTransition ? STABLE_WINDOW_UP (3) : STABLE_WINDOW_DOWN (3)
        newCandidateCount >= windowRequired? → transition confirmed, { stage: candidate, _cyclesInStage: 1 }
     d. Not enough cycles → keep current, track candidate, { _cyclesInStage: +1 }
```

### 11.3 Criterio de éxito

- No up-transitions en los primeros 2 ciclos de una sesión nueva (sin importar el contenido del audio).
- `[StageDetector] Up-transition to "X" blocked — only N/2 cycles in "Y"` visible en logs cuando se aplica el guard.
- Downward transitions (→ wrapping_up) siguen funcionando sin restricción adicional.

---

## 12. Phase 5 — Semantic Suggestion Dedup (20/02/2026)

**Diagnóstico**: Dedup Phase 1 (Jaccard bigram) tenía ~10% catch rate. Mismo tema semántico con distinto framing de título/descripción no era detectado. nomic-embed-text ya disponible por Phase 4 → aprovechar sin costo adicional de infraestructura.

### 12.1 Arquitectura

```
suggestionManager.addSuggestions(newSuggestions):
    │
    ▼ filterDuplicatesAsync(newSuggestions, this.activeSuggestions, { ollamaService })
    │
    ├── Para cada newSugg vs cada existingSugg:
    │   ├── [Check 1] MD5 code hash identical? → DUPLICATE
    │   ├── [Check 2] Title Jaccard ≥ 0.65? → DUPLICATE
    │   ├── [Check 3] Description Jaccard ≥ 0.70? → DUPLICATE
    │   ├── [Check 4] Title bigram similarity? → DUPLICATE
    │   └── [Check 5] Cosine similarity(embed(title+desc)) ≥ 0.88? → DUPLICATE
    │       │
    │       ├── _getEmbedding(text, ollamaService):
    │       │   └── _embedCache.get(text) || ollamaService.embed(text, 'nomic-embed-text') → cache.set
    │       │
    │       └── cosineSimilarity(Float64Array, Float64Array)
    │
    └── Returns filtered array (non-duplicates only)
```

### 12.2 Decisiones de diseño

| Decisión                           | Valor                          | Razón                                                                                                |
| ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Threshold cosine                   | 0.88                           | Conservador — evita falsos positivos en sugerencias de mismo dominio pero distinto contenido técnico |
| In-session embed cache             | `_embedCache` (Map)            | Evita re-embedding del mismo texto (existingSuggestions se re-evalúan vs newSugg en cada ciclo)      |
| Sync checks primero                | Checks 1-4 antes del embedding | Evita llamadas Ollama innecesarias cuando dedup es obvio por Jaccard                                 |
| clearEmbedCache() en session start | sí                             | Previene que embeddings de una sesión anterior contaminen la siguiente                               |
| Fallback si Ollama unavailable     | Phase 1 sync solamente         | Non-fatal; dedup degrada gracefully                                                                  |

### 12.3 Archivos modificados

| Archivo                         | Cambio                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/suggestionDedup.js`      | `cosineSimilarity()`, `_getEmbedding()`, `_embedCache` (Map), `clearEmbedCache()`, `isDuplicateAsync()`, `filterDuplicatesAsync()`. Exports actualizados. |
| `services/suggestionManager.js` | Import `filterDuplicatesAsync` (reemplaza `filterDuplicates`); import `ollamaService`; `await filterDuplicatesAsync(...)`                                 |
| `services/assistantService.js`  | Import + llamada `clearEmbedCache()` en `start()`                                                                                                         |

### 12.4 Métricas esperadas

| Métrica                      | Phase 1 | Phase 5                            |
| ---------------------------- | ------- | ---------------------------------- |
| Catch rate estimado          | ~10%    | ~35-50%                            |
| Latencia adicional por ciclo | ~0ms    | ~50-200ms (solo si Ollama running) |
| Llamadas embed por ciclo     | 0       | 1 por sugerencia nueva (cacheadas) |

---

## 13. 6-Layer Prompt Architecture (20/02/2026)

**Diagnóstico**: Switches combinados (exercise+meeting, coding+tech-debate, etc.) generaban instrucciones contradictorias en un prompt monolítico. El LLM recibía formatos de output incompatibles simultáneamente y debía elegir arbitrariamente.

### 13.1 Problema raíz

```
ANTES — Prompt monolítico (todos los switches):
  "You are a coding assistant. Generate solutions with Big O analysis."  (exercise)
  "Do not generate code. Focus on meeting decisions."                    (meeting)
  → LLM: ??? (ambiguo, resultado no predecible)
```

### 13.2 Solución: Separación contextSignal vs outputRules

**`contextSignal`** (por switch, additive):

- Describe el contexto de la sesión al LLM — qué tipo de actividad está ocurriendo.
- NO prescribe formato de output.
- Todos los switches activos contribuyen. No hay contradicción entre señales de contexto.

**`outputRules`** (por switch, dominante solamente):

- Reglas precisas de formato de output — qué tipo de respuesta generar.
- Solo el switch dominante aplica → un conjunto de reglas, sin ambigüedad.

### 13.3 Jerarquía de dominancia

```
exercise (1) > coding (2) > debug (3) > system-design (4) > tech-debate (5) > research (6) > meeting (7)
```

Regla: si exercise y meeting están activos simultáneamente → exercise es dominante → se aplican outputRules de exercise.

### 13.4 Las 6 capas

```
Layer 1 — ROLE
  Identidad fija del sistema. Sin referencia a switches.
  Ejemplo: "You are an AI assistant for software engineering sessions."

Layer 2 — CONTEXT SIGNALS (additive)
  getContextSignals(activeSwitchIds) → concatena contextSignal de todos los switches activos.
  Ejemplo (exercise + meeting activos):
    "The session appears to involve a coding exercise or technical challenge."
    "A meeting or technical discussion is in progress."

Layer 3 — CONTEXT SOURCE
  _buildContextSourceLayer(hasAudio, hasScreen):
    audio-only:   "[CONTEXT: audio transcript only — no screen capture]"
    screen-only:  "[CONTEXT: screen capture only — no audio transcript]"
    both:         "[CONTEXT: audio transcript + screen capture]"

Layer 4 — OUTPUT RULES (dominant switch only)
  getDominantOutputRules(activeSwitchIds) → outputRules del switch dominante.
  Ejemplo (exercise dominante):
    "Provide a complete working solution with Big O complexity analysis. ..."

Layer 5 — CONTEXT DATA
  Audio transcript (sanitized) + OCR text (sanitized) + session stage/topic.

Layer 6 — RESPONSE SCHEMA
  JSON output format fijo.
```

### 13.5 Archivos modificados

| Archivo                          | Cambio                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/switches.config.js`      | `contextSignal: { en, es }` y `outputRules: { en, es }` por switch; `getDominantSwitch(ids)`, `getContextSignals(ids)`, `getDominantOutputRules(ids)` |
| `services/intelligenceEngine.js` | `_buildPrompt()` reescrito con 6 capas; `_buildContextSourceLayer(hasAudio, hasScreen)`; `_sanitizeContext(text)`                                     |

### 13.6 \_sanitizeContext — Prompt injection defense

Aplicado a audio transcript y OCR text antes de interpolación:

````javascript
_sanitizeContext(text) {
  return text
    .replace(/```[\s\S]*?```/g, '[code block removed]')    // strip code fences
    .replace(/`{3,}/g, '')                                   // strip remaining backtick sequences
    .replace(/<<|>>|<\||>\|/g, '')                          // strip shell-escape sequences
    .replace(/\b(ignore\s+(previous|all|above|prior)\s+(instructions?|...))\b/gi, '[filtered]')
    .replace(/\b(you\s+are\s+now\s+a?n?\s+\w+)\b/gi, '[filtered]')
    .replace(/^(SYSTEM|ASSISTANT|USER)\s*:/gim, '[speaker]:')
    .replace(/\s{3,}/g, '  ').trim();
}
````

### 13.7 Tests

- `context-phase2.test.js` actualizado: mock incluye `contextSignal`, `outputRules`, `getDominantSwitch`, `getContextSignals`, `getDominantOutputRules`; expectativas de texto de prompt actualizadas para la arquitectura de 6 capas.
- 101/104 tests pasando (3 pre-existing StageDetector failures no introducidas en esta sesión).

---

## 14. Estado del sistema — 20/02/2026

### Git state

```
main @ 5f33d85
History (most recent → oldest):
  5f33d85  6-layer prompt architecture + switch dominance
  14634b2  Stage hysteresis hardening + Phase 5 semantic dedup + prompt sanitization + normalizedTopic stability
  e49afe0  isModelInstalled() tag-agnostic fix (nomic-embed-text)
  895b3db  Phase 4 + N-1 + N-2 + audio consolidation
```

### Sesión pendiente de análisis

- RRHH meeting 20/02/2026 — primer uso real con meeting switch post-mejoras.
- Logs a capturar: hit rate cache, stage detection accuracy, dedup catch rate Phase 5, latencia con maxOutputTokens calibrados.

### Próximas tareas pendientes

| Tarea                                                          | Prioridad | Estado                   |
| -------------------------------------------------------------- | --------- | ------------------------ |
| Analizar logs RRHH meeting 20/02                               | P1        | Pendiente (post-reunión) |
| Corregir 3 StageDetector test failures (pre-existing)          | P2        | Pendiente                |
| Calibrar maxOutputTokens con datos reales de reunión           | P2        | Pendiente                |
| Migration guide para repo project-planning (Phase 4 + Round 8) | P2        | Pendiente                |
| Sistema audio 0 transcripciones (Speaker_2)                    | P2        | Pendiente                |
