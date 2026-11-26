# X AutoTranslate v1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extensión de Chrome que pulsa «Traducir publicación» en las publicaciones de X que entran en pantalla y X no ha traducido, de una en una y con ritmo.

**Architecture:** Un único *content script* sin permisos. Un `MutationObserver` examina cada `<article>` que recibe nodos nuevos; un `IntersectionObserver` encola sus botones de traducir cuando llevan 300 ms en pantalla; una cola de uno en uno los pulsa y vigila si el botón desaparece. Las pruebas van en Node sin dependencias y dirigen un Chromium sin cabeza por el canal de depuración (`--remote-debugging-pipe`, sin puertos abiertos) sobre una página que simula a X.

**Tech Stack:** JavaScript de navegador (sin dependencias ni build), Chrome Manifest V3, Node 26 y el Chromium del sistema.

**Spec:** `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md`

## Global Constraints

- Manifest V3; **sin `permissions`**; un solo *content script* en `https://x.com/*` y `https://twitter.com/*`, `run_at: document_idle`.
- Sin llamadas a la API de X, sin `storage`, sin servicio en segundo plano, sin interfaz.
- Solo se actúa dentro de `<article>`, y solo sobre elementos con una etiqueta de la lista exacta.
- Tiempos en un único objeto `RITMO` (ms): `PARADA_MS 300 · HUECO_MIN_MS 300 · ESPERA_MAX_MS 1500 · FALLO_MS 5000 · REINTENTO_MS 10000 · PAUSA_MS 60000 · FALLOS_PARA_PAUSA 3 · DIAGNOSTICO_MS 5000 · REEXAMEN_MS 150`. Las pruebas los acortan con `globalThis.__XAT_AJUSTES__`; en X real esa variable no existe.
- Nombres y comentarios en español. Crédito a `llpgf/x-grok-visible-translate` (MIT) en la cabecera de `content.js` y en el README.
- Commits en español con prefijo convencional y remate `Co-Authored-By: BytIA <bytia@bytia.es>`; `git add` con rutas explícitas.
- Commits en local, sí. **Push solo con el OK del Socio.**

## Interfaces de `content.js`

```js
const ETIQUETAS_TRADUCIR = ['Traducir publicación', 'Traducir post', 'Mostrar traducción', 'Translate post', 'Show translation'];
const ETIQUETAS_ORIGINAL = ['Mostrar original', 'Show original'];
// Estado por botón (WeakMap): 'visto' | 'enCola' | 'pendiente' | 'descartado'
function etiqueta(el)            // aria-label recortado si existe; si no, textContent recortado
function esBotonTraducir(el)     // etiqueta(el) está en ETIQUETAS_TRADUCIR
function esBotonOriginal(el)     // etiqueta(el) está en ETIQUETAS_ORIGINAL
function examinar(article)       // registra los botones de traducir sin estado, salvo en artículos de `revertidos`
function registrar(btn)          // lo observa con el IntersectionObserver y lo deja en 'visto'
function alEntrar(btn)           // tras PARADA_MS visible y siendo aún botón de traducir → encolar(btn)
function alSalir(btn)            // cancela la parada si aún no se había encolado
function encolar(btn)            // estado 'enCola'; al final de la cola; bombeo()
function resolverPendientes()    // éxito si el botón ya no es de traducir; fallo si lleva FALLO_MS
function bombeo()                // 1 resolverPendientes · 2 si hay pausa, reprogramar y salir · 3 pulsar el siguiente
function pulsar(btn)             // btn.click(); cuenta el intento; lo deja 'pendiente'
function diagnosticar()          // una sola vez, a los DIAGNOSTICO_MS
```

Reglas de `bombeo()`: no se pulsa nada mientras haya un pendiente con menos de `ESPERA_MAX_MS`, ni antes de `HUECO_MIN_MS` desde el último clic, ni durante una pausa. Un candidato de la cola que ya no esté conectado, ya no sea botón de traducir o esté fuera de pantalla se descarta y vuelve a 'visto'. Un pendiente resuelto con éxito deja ese elemento 'descartado'. Cada fallo suma a `fallosSeguidos`; al llegar a `FALLOS_PARA_PAUSA` se pausa `PAUSA_MS` y el contador vuelve a 0. Un fallo con 1 intento reencola el botón al final de la cola pasados `REINTENTO_MS`; con 2 lo deja 'descartado'. Siempre se resuelven los pendientes antes de sacar al siguiente de la cola.

Resto de la mecánica: `MutationObserver` sobre `document.body` (`childList`, `subtree`); cada nodo añadido marca como sucio el `<article>` que lo contiene o los que lleva dentro; a los `REEXAMEN_MS` se examinan los sucios y se llama a `bombeo()`. Un clic capturado en un «Mostrar original» mete su artículo en `revertidos`. `diagnosticar()` avisa una vez con `console.warn` si hay en algún `<article>` un `button` o `[role="button"]` cuya etiqueta contenga `traduc` o `translat` y no esté en las listas.

## Bancada de pruebas

- `test/run.mjs`: `node test/run.mjs [escenario…]`. Lanza el binario de `XAT_CHROME` o `/usr/lib/chromium/chromium` con perfil temporal, ventana de 800×600, abre `test/mock-x.html#<escenario>` y espera `window.__result` ({ ok, fallos }) hasta 40 s. Un escenario falla si `ok` es falso, si salta una excepción o si declara `avisoEsperado` y ese texto no apareció en un `console.warn`. Imprime `PASS nombre` o `FAIL nombre — …` y sale con 1 si alguno falla.
- `test/mock-x.html`: carga `driver.js` y después `../content.js`.
- `test/driver.js`: `window.__xatEscenarios = { nombre: { ajustes?, avisoEsperado?, ejecutar: async (ctx) => {}, comprobar: (ctx) => [fallos] } }`. Publicaciones de 200 px con el botón abajo (tres caben en pantalla). Simula a X: al recibir el clic traduce pasados `retrasoMs` (texto con prefijo «ES: », `lang="es"`, y el mismo elemento pasa a «Mostrar original»). Con `falla: true` no responde nunca; con `yaTraducida: true` el texto sale ya en español y el control es «Mostrar original».

```js
ctx.clics                                  // [{ id, t }] con t en ms desde el inicio del escenario
ctx.avanzar(ms)                            // espera
ctx.visibleAlInicio                        // ids con el botón dentro de la ventana al empezar
ctx.crearRespuesta({ id, lang = 'en', boton = 'texto' | 'aria' | 'ambos' | 'ninguno', retrasoMs = 50, falla = false, yaTraducida = false })
ctx.crearHilo({ id, cita, retrasoMs = 50 })  // artículo con post principal y cita, cada uno con botón; traducir el principal sustituye el artículo entero
ctx.texto(id)                              // texto visible de la publicación
ctx.pulsarOriginal(id)                     // simula que el Socio pulsa «Mostrar original»: vuelve el texto original y «Traducir publicación» en un elemento nuevo
ctx.anadirBoton(id, boton)                 // X muestra el botón más tarde, en un artículo ya examinado
ctx.fueraDeArticulo(boton)                 // botón de traducir en un diálogo (id `dialogo`) y en una tarjeta flotante (id `tarjeta`), sin <article> por encima
ctx.sustituirPor(ids, boton)               // navegación dentro de la SPA: fuera todo lo montado, dentro publicaciones nuevas
ctx.irA(id)                                // centra la publicación
ctx.recorrerRapido(msEntrePasos)           // baja publicación a publicación sin detenerse
```

## Review Focus

1. Etiqueta solo en `aria-label`, solo en texto o en ambos → se pulsan igual (`visible`, Tarea 1).
2. X reutiliza el mismo elemento y le cambia la etiqueta a «Mostrar original» → no se vuelve a pulsar (`original`, Tarea 3).
3. Un botón que X dibuja más tarde en un artículo ya examinado → se pulsa al aparecer (`sinBoton`, Tarea 3).
4. Navegación dentro de la SPA con clics en cola → ningún clic en nodos sueltos ni excepciones (`navegacion`, Tarea 3).
5. Paso rápido por publicaciones sin detenerse → no se traducen (`vuelo`, Tarea 1).

---

### Task 1: Bancada, detección y clic de lo visible

**Files:**
- Create: `manifest.json`, `content.js`, `test/run.mjs`, `test/mock-x.html`, `test/driver.js`

**Interfaces:**
- Produce: `content.js` con las funciones de arriba; la bancada descrita arriba.

- [ ] **Step 1: Escribir los escenarios que fallan** en `test/driver.js`:
  - `visible`: 12 respuestas en inglés alternando `boton` texto / aria / ambos. Esperar 2,5 s sin scrollear. Fallos si (a) los ids con clic ≠ `visibleAlInicio`, (b) alguna de ellas no empieza por «ES: », (c) hay alguna con más de un clic, (d) dos clics consecutivos distan menos de `HUECO_MIN_MS` − 20 ms. Después `irA('r11')`, esperar 1,5 s: (e) «ES: » en r11, (f) las primeras siguen con un solo clic.
  - `vuelo`: 20 respuestas, `recorrerRapido(60)`, esperar 1 s parado en la última. Fallos si alguna de r1–r17 tiene clic, o si r20 no está traducida.
  - `fuera`: 1 respuesta y `fueraDeArticulo('texto')`. Esperar 1,5 s. Fallos si hay clic en `dialogo` o en `tarjeta`, o si r1 no está traducida.
- [ ] **Step 2: Escribir `test/run.mjs`, `test/mock-x.html` y `test/driver.js`** y comprobar que la bancada arranca: `node test/run.mjs` da 3 `FAIL`, porque todavía no existe `content.js`.
- [ ] **Step 3: Escribir `manifest.json` y `content.js`** con las funciones de arriba.
- [ ] **Step 4: `node test/run.mjs`** → 3 `PASS`.
- [ ] **Step 5: Commit** `feat: detecta y pulsa «Traducir publicación» en lo que entra en pantalla`.

### Task 2: Ritmo, fallos y redibujados

**Files:**
- Modify: `content.js`, `test/driver.js`

- [ ] **Step 1: Escribir los escenarios que fallan** (`fallo` y `pausa` con `ajustes: { FALLO_MS: 1500, REINTENTO_MS: 2000, PAUSA_MS: 1000 }`; `lento` y `redisado` con los tiempos por defecto):
  - `lento`: 3 visibles con `retrasoMs: 2500`. Esperar 7 s. Fallos si los tres no están traducidos con un clic cada uno o si el 2.º clic no llega al menos `ESPERA_MAX_MS` − 20 ms después del 1.º.
  - `fallo`: r1 `falla: true`, r2 y r3 sanas. Esperar 9 s. Fallos si r1 no tiene exactamente 2 clics separados al menos `REINTENTO_MS` − 20 ms, si r2 o r3 no están traducidas con un clic, o si r1 recibe algún clic en los últimos 3 s.
  - `pausa`: r1, r2 y r3 `falla: true`, r4 sana. Esperar 16 s. Fallos si r4 no acaba traducida con un clic, si r1–r3 no tienen 2 clics cada una, o si el clic de r4 no llega al menos `FALLO_MS + PAUSA_MS` − 20 ms después del clic de r3.
  - `redisado`: `crearHilo({ id: 'h1', cita: 'q1' })`. Esperar 3 s. Fallos si h1 o q1 no están traducidos o si alguno tiene más de un clic.
- [ ] **Step 2: `node test/run.mjs lento fallo pausa redisado`** → 4 `FAIL`.
- [ ] **Step 3: Implementar en `content.js`** `resolverPendientes`, la reencola por reintento, `pausar` y el recuento de intentos.
- [ ] **Step 4: `node test/run.mjs`** → 7 `PASS`.
- [ ] **Step 5: Commit** `feat: ritmo de uno en uno, reintento y pausa ante fallos`.

### Task 3: Vuelta atrás, respeto y robustez

**Files:**
- Modify: `content.js`, `test/driver.js`

- [ ] **Step 1: Escribir los escenarios que fallan:**
  - `original`: 2 visibles con retardo 50 ms. Esperar 1 s, `pulsarOriginal('r1')`, esperar 1,5 s. Fallos si r1 no muestra su texto original, si r1 tiene más de un clic o si r2 no está traducida.
  - `sinBoton`: `crearRespuesta({ id: 'es', lang: 'es', boton: 'ninguno' })`, `crearRespuesta({ id: 'auto', yaTraducida: true })`, `crearRespuesta({ id: 'tarde', boton: 'ninguno' })`. A los 600 ms, `anadirBoton('tarde', 'texto')`. Esperar 2 s. Fallos si `es` o `auto` cambiaron de texto, si `es` o `auto` tienen algún clic, si `tarde` no está traducida o si `tarde` tiene más de un clic.
  - `navegacion`: 6 respuestas, `retrasoMs: 800`. A los 700 ms, `sustituirPor(['n1','n2','n3'], 'texto')`. Esperar 4 s. Fallos si las tres nuevas no están traducidas con un clic cada una o si hay clic en las antiguas después de la sustitución.
  - `casi`: 1 respuesta con un botón de texto «Traducir publicacion» (sin tilde) y `ajustes: { DIAGNOSTICO_MS: 500 }`, `avisoEsperado: 'Traducir publicacion'`. Esperar 1,5 s. Fallo si ese botón recibió clic.
- [ ] **Step 2: `node test/run.mjs original sinBoton navegacion casi`** → 4 `FAIL`.
- [ ] **Step 3: Implementar en `content.js`** `revertidos` (clic capturado en «Mostrar original») y `diagnosticar()`.
- [ ] **Step 4: `node test/run.mjs`** → 11 `PASS`.
- [ ] **Step 5: Commit** `feat: respeta «Mostrar original» y diagnostica etiquetas desconocidas`.

### Task 4: Entrega

**Files:**
- Modify: `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: README**: estado «v1, sin estrenar en X real», instalación (cargar desempaquetada), comportamiento, crédito a llpgf, y qué hacer si no traduce: abrir x.com en una pestaña normal, F12 → Console, y copiar el aviso de `[X AutoTranslate]`.
- [ ] **Step 2: HANDOFF del proyecto**: qué hay, cómo probar (`node test/run.mjs`), qué falta verificar en la X real y el commit que queda por subir.
- [ ] **Step 3: `node test/run.mjs`** → 11 `PASS`.
- [ ] **Step 4: Commit** `docs: instalación y manejo de la v1`.
- [ ] **Step 5: Parar y pedir al Socio** el OK para subir y su prueba en la X real.
