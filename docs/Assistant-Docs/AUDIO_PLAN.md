# Audio — Plan unificado (Nivel 2 + captura sistema macOS + captura sistema Windows)

> Este documento unifica el plan de **Audio Nivel 2** (estéreo + Deepgram multichannel, **completado**), el **diseño de captura de audio de sistema en macOS** (pendiente), y la **corrección de captura de audio de sistema en Windows** vía `getDisplayMedia` + `setDisplayMediaRequestHandler` (**implementado**). Referencia única para todo lo relacionado con audio en el **módulo Assistant**.

**Alcance:** Solo **Assistant**. El módulo Listen está en proceso de deprecación; se mantuvo en el repo como ejemplo de referencia para mejorar la captura de audio de Assistant (p. ej. uso de `getDisplayMedia` en Windows). No se requiere consistencia entre Listen y Assistant; las decisiones de este plan aplican únicamente a Assistant.

**En el resto de la documentación**, "Phase 2" sin prefijo se refiere al **Context Phase 2** (session context + stage detection), no al audio.

---

# Parte I — Audio Nivel 2 (COMPLETADO)

Estéreo + Deepgram multichannel. Atribución por `channel_index`. Sustituye el hot-fix Issue 1 (\_lastAudioSource + ventana 500 ms).

**Estado: COMPLETADO** — Fases 1–6 implementadas.

**Alcance:** Solo pipeline de audio (captura estéreo, envío, STT multichannel, labels Speaker_1/Speaker_2). No incluye contexto de sesión ni stage detection; eso es Context Phase 2 (`SESSION_CONTEXT_PHASE2_PLAN.md`).

---

## I.1 Validación técnica final

### Deepgram (streaming)

- **URL**: En `createSTT` (provider): `channels=2`, `multichannel=true` cuando `sessionType === 'assistant'`.
- **Respuesta**: Cada mensaje incluye `channel_index`: `[0, 2]` → Speaker_1 (mic), `[1, 2]` → Speaker_2 (system).

### Frontend (Web Audio API)

- **ChannelMergerNode**: mic → canal 0 (L), system → canal 1 (R). Un solo ScriptProcessor 2in/2out, salida interleaved L-R → Int16 → base64.
- **Clock sin eco**: Processor → GainNode(gain=0) → destination.

### Backend

- Atribución: `channel_index[0] === 1 ? 'Speaker_2' : 'Speaker_1'`. Un solo método `sendStereoAudioContent(data, mimeType)`.

### IPC

- Un canal: `assistant:send-stereo-audio` desde el renderer.

---

## I.2 Plan de implementación por fases (referencia)

| Fase  | Objetivo                                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| **1** | Provider Deepgram: URL con channels=2, multichannel=true; mensaje con channel_index.                        |
| **2** | DeepgramSession: exponer channelIndex en transcriptionData.                                                 |
| **3** | AssistantAudioCapture: eliminar heurísticas de tiempo; speaker desde channel_index; sendStereoAudioContent. |
| **4** | IPC + AssistantService: handler send-stereo-audio, sendStereoAudioContent.                                  |
| **5** | Frontend: ChannelMerger + un processor + sendStereoAudio.                                                   |
| **6** | Limpieza y documentación.                                                                                   |

Detalle de acciones por archivo en historial del repo; resumen de archivos tocados: deepgram.js, deepgramSession.js, assistantAudioCapture.js (main + UI), preload.js, assistantBridge.js, assistantService.js.

---

## I.3 Compatibilidad por SO (Nivel 2)

| SO          | Canal sistema (Speaker_2)                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------- |
| **Windows** | ~~desktopCapturer + getUserMedia~~ → **Sustituido por Parte III** (`getDisplayMedia`).             |
| **macOS**   | Canal sistema suele ir vacío (sin loopback nativo). Ver **Parte II** para diseño de captura macOS. |
| **Linux**   | Depende del compositor; a menudo sin audio de sistema.                                             |

---

# Parte II — Captura de audio de sistema en macOS (PENDIENTE)

Diseño para que Assistant pueda usar captura de sistema en macOS (Speaker_2) sin duplicar código. Base para que Assistant sea extraíble como módulo independiente.

---

## II.1 Situación actual

- **Listen (en deprecación):** En macOS usaba `startMacosSystemAudio()` y el binario **SystemAudioDump**; se mantiene solo como referencia de implementación para Assistant.
- **Assistant (hoy):** En **macOS** no hay captura nativa de audio de sistema vía getDisplayMedia (canal derecho suele ir vacío). En Windows ya se usa getDisplayMedia + loopback (Parte III).

**Conclusión:** Para que Assistant tenga Speaker_2 en macOS hace falta implementar captura de sistema (p. ej. servicio con SystemAudioDump o equivalente) **dentro del módulo Assistant**. No se requiere compartir código con Listen.

---

## II.2 Opciones (resumen)

| Variante                       | Dónde vive                                                   | Transición                                                             |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **A – Singleton en Assistant** | `src/features/assistant/services/macosSystemAudioCapture.js` | Toda la lógica en Assistant; Listen no se considera.                   |
| **B – Singleton en common**    | `src/features/common/services/systemAudioCapture.js`         | Compartiría con otros módulos (Listen está en deprecación, no aplica). |

**Recomendación:** Variante **A** — lógica dentro de Assistant. Solo importa Assistant.

---

## II.3 Enfoque recomendado: servicio compartido (o dentro de Assistant)

1. Una sola instancia de SystemAudioDump cuando alguien necesite audio de sistema en macOS.
2. API propuesta: `start()` / `stop()` (ref count), `onChunk(callback)`, `isRunning()`, `getChunkSpec()`.
3. Assistant backend: IPC `assistant:start-system-audio` / `assistant:stop-system-audio`; callback que hace broadcast `assistant:system-audio-data`.
4. Assistant frontend: En macOS no pedir system por getUserMedia; llamar startSystemAudio, suscribirse a onSystemAudioData, **ring buffer** para el canal derecho; en `setupStereoCapture` soportar "system from buffer" (canal derecho desde buffer) y seguir enviando un único stereo por sendStereoAudio.

Sincronización: SystemAudioDump emite chunks ~0.1 s; ScriptProcessor consume cada ~0.17 s; ring buffer en el renderer decodifica base64 → Int16 → Float32 y alimenta el canal derecho.

---

## II.4 Orden de implementación sugerido (cuando se aborde)

| Fase  | Qué hacer                                                                                      |
| ----- | ---------------------------------------------------------------------------------------------- |
| **A** | Crear módulo de captura macOS (spawn SystemAudioDump, ref count, onChunk).                     |
| **B** | _(Omitido — Listen en deprecación.)_                                                           |
| **C** | Assistant backend: IPC start/stop system audio, broadcast de chunks.                           |
| **D** | Assistant frontend: rama macOS, ring buffer, canal derecho desde buffer en setupStereoCapture. |

---

# Parte III — Corrección de captura de audio de sistema en Windows (PRIORIDAD ACTUAL)

Reemplazo de `desktopCapturer` + `getUserMedia({chromeMediaSource: 'desktop'})` por `getDisplayMedia` + `setDisplayMediaRequestHandler` para captura confiable del audio de sistema (Speaker_2) en Windows.

**Estado: IMPLEMENTADO** — Handler en `index.js` (app.whenReady); frontend usa `getDisplayMedia({ audio: true, video: false })`; eliminados IPC `assistant:get-desktop-sources` y logs DIAG.

---

## III.1 Diagnóstico del problema

### Evidencia de la falla

En una prueba real de 10 minutos con Google Meet (sesión de debugging con logs diagnósticos):

- **Pipeline funcional**: Frontend envió 4902 chunks, backend recibió 5253 chunks (86 MB), Deepgram WebSocket conectado.
- **Canal izquierdo (mic/Speaker_1)**: RMS consistente ~0.01-0.04. Audio limpio.
- **Canal derecho (sistema/Speaker_2)**: RMS = 0.000007 durante la mayor parte de la sesión. **Silencio total**. Solo spikes esporádicos (0.03-0.04) provenientes de notificaciones del OS, no de audio de la reunión.
- **Resultado**: 86 MB de audio → 7 transcripciones monosilábicas, todas filtradas por `audioFilter`. Cero contexto útil de Speaker_2.

### Causa raíz

`desktopCapturer.getSources({types: ['screen']})` + `getUserMedia({audio: {chromeMediaSource: 'desktop'}})` obtiene un loopback WASAPI del mix master del OS. Google Meet (y otras apps de videoconferencia) no enrutan su audio de forma confiable a este loopback. Listen (módulo en deprecación) usaba `getDisplayMedia({audio: true})` con éxito en Windows; sirvió de referencia para migrar Assistant a la misma estrategia.

### Fix adicional encontrado durante debugging: sample rate mismatch

- Frontend AudioContext creaba a 24 kHz (`SAMPLE_RATE = 24000`).
- Backend abría Deepgram WebSocket con `sampleRate: 16000` porque `modelStateService.getCurrentModelInfo('stt')` no devuelve `sampleRate`, y todos los fallbacks eran `|| 16000`.
- **Fix aplicado**: Todos los fallbacks cambiados a `|| 24000` en `deepgramSession.js` y `assistantAudioCapture.js` (backend). Grep confirma cero ocurrencias de `16000` en el módulo assistant.

---

## III.2 Decisión técnica: `getDisplayMedia` + `setDisplayMediaRequestHandler`

### Por qué `getDisplayMedia`

| Criterio                        | `desktopCapturer` + `getUserMedia` (actual)           | `getDisplayMedia` (propuesto)                                                                   |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Confiabilidad audio sistema** | WASAPI loopback — no captura audio de Meet/Teams/Zoom | Captura directa del audio del tab/app seleccionado                                              |
| **API Chromium**                | Deprecated (`desktopCapturer.getSources` en renderer) | API estándar, soportada a largo plazo                                                           |
| **Diálogo de selección**        | No tiene (selección por `chromeMediaSourceId`)        | Tiene — pero `setDisplayMediaRequestHandler` lo elimina                                         |
| **Referencia probada**          | N/A                                                   | Listen (deprecando) usaba `getDisplayMedia` en Windows; se tomó como referencia para Assistant. |

### Por qué `setDisplayMediaRequestHandler`

API de Electron (main process) que intercepta la solicitud de `getDisplayMedia` antes de que el diálogo nativo aparezca. Permite auto-seleccionar la fuente sin interacción del usuario.

```javascript
// En main process (antes de que se cree cualquier ventana)
const { desktopCapturer, session } = require('electron');

session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  // Auto-seleccionar la primera pantalla (incluye todo el audio del sistema)
  callback({ video: sources[0], audio: 'loopback' });
});
```

**`audio: 'loopback'`** es la clave: indica a Chromium que capture el audio de sistema a nivel de sesión, no de una ventana específica. Esto captura TODO el audio que se reproduce en el sistema, incluyendo Meet/Teams/Zoom.

### Decisión: Auto-selección silenciosa (sin diálogo)

- El usuario estará **pre-informado** de que durante la sesión del assistant, si activa audio, se capturará lo que sale del sistema y del micrófono.
- No se muestra el picker nativo de `getDisplayMedia`.
- El handler auto-selecciona la pantalla principal + loopback audio.
- Esta decisión está alineada con el modelo de consentimiento de la app: el usuario activa el toggle de audio explícitamente en settings.

---

## III.3 Qué cambia y qué NO cambia

### NO cambia (el pipeline post-captura se mantiene intacto)

- ChannelMergerNode (mic → L, system → R)
- ScriptProcessor (interleave L-R → Int16 → base64)
- IPC `assistant:send-stereo-audio`
- Backend `sendStereoAudioContent()`
- DeepgramSession (channels=2, multichannel=true)
- Speaker attribution por `channel_index`
- AudioFilter, AudioRepository, todo el pipeline de contexto

### SÍ cambia

| Componente                                      | Cambio                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Main process** (nuevo setup)                  | Registrar `setDisplayMediaRequestHandler` en la sesión de Electron. Auto-seleccionar pantalla + `audio: 'loopback'`.                                       |
| **Frontend `captureSystemAudio()`**             | Reemplazar `desktopCapturer.getSources()` + `getUserMedia({chromeMediaSource})` por `navigator.mediaDevices.getDisplayMedia({audio: true, video: false})`. |
| **Frontend `acquireAudioStreams()`**            | Adaptar para usar el stream de `getDisplayMedia` en lugar de `getUserMedia` para sistema.                                                                  |
| **IPC handler `assistant:get-desktop-sources`** | **Eliminar** — ya no se necesita. `getDisplayMedia` no requiere listar fuentes desde el renderer.                                                          |
| **Preload**                                     | Eliminar exposición de `getDesktopSources` si era exclusivo de assistant.                                                                                  |

---

## III.4 Archivos a modificar

| Archivo                                               | Acción                  | Detalle                                                                                                                                                                                                           |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/assistant/assistantAudioCapture.js`           | **Modificar**           | `captureSystemAudio()`: reemplazar `desktopCapturer` por `getDisplayMedia({audio: true, video: false})`. Eliminar lógica de `chromeMediaSource`/`chromeMediaSourceId`. Extraer `audioTrack` del stream retornado. |
| `src/ui/assistant/assistantAudioCapture.js`           | **Modificar**           | `acquireAudioStreams()`: adaptar la adquisición de system stream. El flujo `mic + system → ChannelMerger → ScriptProcessor` no cambia, solo el origen del system MediaStream.                                     |
| `src/features/assistant/assistantBridge.js`           | **Modificar**           | Eliminar handler `assistant:get-desktop-sources` (ya no necesario).                                                                                                                                               |
| `src/ui/assistant/preload.js` (o equivalente)         | **Verificar/Modificar** | Eliminar `getDesktopSources` del bridge si era exclusivo de assistant.                                                                                                                                            |
| `src/main/` (o donde se configure la sesión Electron) | **Modificar**           | Registrar `setDisplayMediaRequestHandler` con auto-selección. Debe ejecutarse antes de que cualquier renderer solicite `getDisplayMedia`.                                                                         |

### Archivos que NO se tocan

- `src/features/assistant/services/assistantAudioCapture.js` (backend) — recibe bytes igual que antes
- `src/features/assistant/services/deepgramSession.js` — no cambia
- `src/features/common/ai/providers/deepgram.js` — no cambia
- `src/features/assistant/services/audioStateMachine.js` — no cambia
- `src/features/assistant/utils/audioFilter.js` — no cambia
- `src/features/assistant/services/assistantService.js` — no cambia (salvo cleanup de IPC handler si aplica)

---

## III.5 Plan de implementación

| Paso  | Qué hacer                                                                                                                                             | Riesgo                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **1** | Registrar `setDisplayMediaRequestHandler` en el main process de Electron. Validar que intercepta correctamente la solicitud de `getDisplayMedia`.     | Bajo — API documentada de Electron. Solo Assistant usa esta ruta (Listen en deprecación).                       |
| **2** | Modificar `captureSystemAudio()` en el frontend: reemplazar `desktopCapturer` + `getUserMedia` por `getDisplayMedia({audio: true, video: false})`.    | Medio — validar que el `audioTrack` retornado sea compatible con `createMediaStreamSource()` del Web Audio API. |
| **3** | Adaptar `acquireAudioStreams()` para usar el nuevo stream. Verificar que ChannelMerger recibe el track correctamente en canal R.                      | Bajo — el MediaStreamAudioSourceNode acepta cualquier MediaStream con audioTrack.                               |
| **4** | Eliminar IPC `assistant:get-desktop-sources` del bridge y preload. Cleanup de código muerto.                                                          | Bajo — verificar que ningún otro módulo depende de este handler.                                                |
| **5** | Remover logs diagnósticos temporales (DIAG-\*) de los 4 archivos instrumentados durante debugging.                                                    | Bajo — solo borrar código marcado con "remove after debugging".                                                 |
| **6** | Test real: reunión de 10 minutos con Meet. Verificar: (a) R(sys) RMS > 0.01 consistente, (b) transcripciones de Speaker_2, (c) sugerencias generadas. | N/A — validación.                                                                                               |

### Consideraciones para Paso 1 (setDisplayMediaRequestHandler)

- **Alcance**: Solo Assistant invoca `getDisplayMedia` para captura de audio de sistema. Listen está en deprecación; no se requiere compatibilidad ni registro compartido con Listen.
- **Timing**: El handler debe registrarse antes de que el renderer de Assistant invoque `getDisplayMedia`. Se hace en `app.whenReady()` en `index.js`.

---

## III.6 Logs diagnósticos (removidos)

Los logs DIAG listados en la tabla anterior fueron removidos en la implementación de Parte III.

---

_Unificado desde AUDIO_NIVEL2_IMPLEMENTATION_PLAN.md y AUDIO_SYSTEM_CAPTURE_SHARED_DESIGN.md. Última actualización: 2026-02-16._
_Parte III implementada: getDisplayMedia + setDisplayMediaRequestHandler; cleanup IPC y DIAG._
