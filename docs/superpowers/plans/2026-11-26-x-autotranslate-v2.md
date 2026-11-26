# X AutoTranslate v2 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las respuestas de un hilo se traduzcan según entran en pantalla aunque X no ponga enlace de traducir, pidiéndole la traducción al propio servicio de X, con techo y paros para no poner en riesgo la cuenta del Socio.

**Architecture:** Se añade un segundo camino al content script. Para cada bloque de texto de publicación sin enlace, la extensión identifica la publicación por su enlace permanente, le pide a X su traducción (servicio de Grok; si falla, el clásico) y pinta una caja en el sitio del original con su «Mostrar original». El camino de pulsar el enlace de X (v1) se conserva. Los estilos van en `content.css`. Antes de todo, una **sonda** de diagnóstico comprueba en la X real el contrato y el DOM.

**Tech Stack:** JavaScript de navegador sin dependencias; Chrome Manifest V3; Node 26 y el Chromium del sistema para la bancada.

**Spec:** `docs/superpowers/specs/2026-11-26-x-autotranslate-v2-design.md` (extiende `…-design.md` de la v1). Corregida tras la revisión adversaria del 26-nov-2026.

## Global Constraints

- Manifest V3 **sin `permissions`**; un content script (`content.js` + `content.css`) en `https://x.com/*` y `https://twitter.com/*`.
- Peticiones solo a las rutas de traducción de X. Sin `innerHTML`, sin `eval`, sin almacenamiento. Nunca escribir en consola el valor de una cookie.
- Techo (ratificado por el Socio): 60 publicaciones pedidas por página y 300 por hora y pestaña; nada con la pestaña oculta; rechazo de permiso en todas las rutas → paro hasta recargar.
- Tiempos en `RITMO` (ms): los de la v1 más `PETICION_MAX_MS 20000`. Techo en `TOPE`. `globalThis.__XAT_AJUSTES__` los fija solo la bancada.
- Una petición a la vez; hueco sorteado de 600 a 1500 ms desde el final de la petición.
- Nombres y comentarios en español. Crédito a `llpgf/x-grok-visible-translate`, `Noctyn/x-native-translator`, `dfrnoch/liquidX` y `rien7/twitter-extension-api`.
- Commits en español con prefijo convencional y remate `Co-Authored-By: BytIA <bytia@bytia.es>`; `git add` con rutas explícitas. La subida está cubierta por la autonomía del Socio sobre el proyecto.

## Interfaces de `content.js` (lo nuevo)

```js
const MODO_SONDA = true | false           // mientras dura la Tarea 0: diagnóstico, sin tocar la página
function cookie(nombre)                   // valor de una cookie de la página, o ''
function idiomaDestino()                  // idioma base de la interfaz de X
function cajaDeCitaDe(nodo)               // el ancestro role="link" dentro del artículo, o null
function idDe(nodo)                       // identificador de la publicación del bloque según la regla 1; '' si no tiene
function traducidoPorX(nodo)              // delante del bloque hay un «Mostrar original» de X
function esNuestro(elemento)              // el elemento cuelga de .xat-caja
function necesitaTraduccion(nodo, id)     // regla 2, 3 y 4
function revisarTexto(nodo)               // clasifica un bloque: traducido por X, en destino, en memoria, registrado o nuevo
function pedirAX(id)                      // → { texto, origen }; lanza un Error con .tipo ('estado' | 'red' | 'vacia') y .estado
function mostrarTraduccion(nodo, id, r)   // inserta la caja .xat-caja y solo entonces marca el original
function quitarTraduccion(nodo)           // quita marca y caja
function sondear()                        // Tarea 0: describe la página y hace una petición por ruta
```

## Bancada de pruebas (lo que cambia)

- `test/run.mjs` sirve el proyecto por HTTP en `127.0.0.1` con puerto aleatorio, solo mientras duran las pruebas, porque las cookies no existen en `file://`. Acepta peticiones `GET` de ficheros `.html`, `.js` y `.css` del proyecto y nada más.
- Recoge también los mensajes de consola de nivel `info`. Un escenario declara `avisosEsperados: [fragmentos]` (todos deben aparecer) y `unSoloAviso: '<prefijo>'` (debe haber exactamente un mensaje con ese prefijo).
- `test/mock-x.html` carga `../content.css` además de `../content.js`.
- Cada publicación del simulador lleva enlace permanente (`a[href="/usuario/status/<número>"] > time`) y un número propio, salvo `enlace: false`.
- El simulador sustituye `window.fetch` para las rutas de traducción y deja pasar el resto.

```js
// Un escenario declara:
sesion: true                                   // fija la cookie ct0; sin esto, no hay sesión
api: { latenciaMs, trozos, estado, cuerpo, mensaje, cabeceras }   // o una función (id, ruta) => {...}
// y recibe en ctx:
ctx.peticiones          // [{ id, ruta: 'grok' | 'grok-api' | 'clasico', inicio, fin, cabeceras }]
ctx.cajaDe(id)          // nuestra caja, o null
ctx.traduccionDe(id)    // texto de la traducción visible, o null
ctx.originalVisible(id) // si el bloque original de X se está viendo
ctx.enlaceDe(id)        // nuestro botón «Mostrar original» / «Mostrar traducción», o null
ctx.nodoDe(id)          // el bloque de texto de X
ctx.numero(id)          // el identificador numérico que viaja a X
ctx.crearTraducidaPorX({ id, texto })     // X ya lo tradujo: barra «Traducido del inglés · Mostrar original» delante del texto
ctx.redibujar(id)       // X redibuja el artículo: mismo <article>, hijos nuevos, misma publicación
ctx.reutilizar(id, nuevoId, texto)  // X reutiliza el bloque de texto para otra publicación
ctx.crearHilo({ id, cita, boton: 'ninguno', sinEnlaceEnCita: true })
ctx.borrarCaja(id)      // X borra nuestra caja del documento
ctx.ocultarPestania(bool)  // manda la pestaña a segundo plano o la trae de vuelta
```

## Review Focus

1. X reutiliza un bloque ya traducido para otra publicación → no se ve la traducción de la anterior (`nodoReutilizado`, Tarea 2).
2. X borra nuestra caja → el original vuelve a verse; nunca en blanco (`cajaBorrada`, Tarea 2).
3. Una cita sin enlace propio dentro de un post con enlace → no se pide con el identificador del post (`citaSinEnlace`, Tarea 1).
4. Tras «Mostrar original», la extensión no pulsa su propio «Mostrar traducción» (`nuestroNoSePulsa`, Tarea 2).
5. Tope alcanzado o pestaña oculta → ni una petición más (`topePagina`, `pestaniaOculta`, Tarea 3).

---

### Task 0: La sonda

**Files:**
- Modify: `content.js`, `test/driver.js`, `test/run.mjs`

- [ ] **Step 1: Escribir el escenario que falla** `sonda`: `sesion: true`, `ajustes: { DIAGNOSTICO_MS: 500 }`; un post traducido por X y cuatro respuestas en inglés sin botón; `api` responde 200 a `grok`, 404 a `grok-api` y 200 a `clasico`. Esperar 2 s. `avisosEsperados: ['[X AutoTranslate SONDA]', 'sesión: sí', 'idioma de la interfaz: es', 'grok: 200', 'grok-api: 404', 'clasico: 200']` y `unSoloAviso: '[X AutoTranslate SONDA]'`. Fallos si hubo alguna caja, algún original no es visible, no hubo exactamente 3 peticiones, o alguna no es del identificador del primer candidato.
- [ ] **Step 2: `node test/run.mjs sonda`** → FAIL.
- [ ] **Step 3: Implementar** la recogida de mensajes `info` en la bancada y `MODO_SONDA` + `sondear()` en `content.js`, con `cookie`, `idiomaDestino`, `cajaDeCitaDe`, `idDe` y `traducidoPorX`.
- [ ] **Step 4: `node test/run.mjs sonda`** → PASS, y las 16 de la v1 siguen en verde. Los escenarios de las tareas 1 a 3, ya escritos, siguen en rojo hasta les llegue su tarea.
- [ ] **Step 5: Commit** `feat: sonda de diagnóstico del servicio de traducción de X` y **pedir al Socio que la cargue y pegue la consola**.

### Task 1: Bancada por HTTP y camino de petición

**Files:**
- Create: `content.css`
- Modify: `manifest.json`, `content.js`, `test/driver.js`

- [ ] **Step 1: Escribir los escenarios que fallan**:
  - `hilo` (ya escrito): post traducido por X, cinco respuestas en inglés sin botón, una en español; `sesion: true`, `api: { latenciaMs: 100 }`. Fallos si (a) el post de X o el de español tuvieron petición o caja, o cambiaron de texto; (b) `r1` y `r2` no tienen caja con el texto traducido, o su original sigue visible; (c) hubo alguna petición de `r3`–`r5` antes de scrollear; (d) las primeras peticiones no son exactamente `r1`, `r2` en ese orden; (e) la 2.ª empieza menos de 580 ms después del fin de la 1.ª; (f) falta `x-csrf-token: prueba-csrf` o `authorization` no empieza por `Bearer `; (g) la caja de `r1` no lleva «Traducido del inglés» y un botón «Mostrar original». Después `irA('r4')`: (h) `r3`–`r5` traducidas; (i) seis peticiones en total.
  - `citaSinEnlace`: `crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno', sinEnlaceEnCita: true })`. Esperar 3 s. Fallos si hubo alguna petición, si `h1` no está traducida o si `q1` tiene caja.
- [ ] **Step 2: `node test/run.mjs citaSinEnlace`** → FAIL.
- [ ] **Step 3: Implementar** `content.css`, la entrada `css` del manifiesto, `necesitaTraduccion`, `revisarTexto`, `pedirAX`, `mostrarTraduccion` y `quitarTraduccion`; `MODO_SONDA = false` detrás de `globalThis.__XAT_SONDA__` para que la bancada pueda elegir.
- [ ] **Step 4: `node test/run.mjs`** → 31 PASS.
- [ ] **Step 5: Commit** `feat: pedir a X la traducción de las publicaciones sin enlace`.

### Task 2: Vuelta atrás, redibujados, citas, nodos reutilizados y la caja

**Files:**
- Modify: `content.js`, `test/driver.js`

- [ ] **Step 1: Escribir los escenarios que fallan** (todos con `sesion: true` y respuestas en inglés sin botón):
  - `vueltaNuestra` (ya escrito): pulsar nuestro «Mostrar original» enseña el original y deja «Mostrar traducción»; volver pinta la que se tenía; dos peticiones en total.
  - `nuestroNoSePulsa`: 2 respuestas; esperar 2,5 s; pulsar `enlaceDe('r1')`; esperar 2,5 s. Fallos si la traducción de `r1` vuelve a verse o el enlace deja de decir «Mostrar traducción».
  - `revertirYRedibujar`: 2 respuestas; esperar 2,5 s; pulsar `enlaceDe('r1')`; `redibujar('r1')`; esperar 2 s. Fallos si `r1` tiene caja o su traducción se ve, o hubo una 3.ª petición.
  - `redisadoApi` (ya escrito), `citaSinBoton` (ya escrito), `nodoReutilizado` (ya escrito).
  - `cajaBorrada`: 2 respuestas; esperar 2,5 s; `borrarCaja('r1')`; esperar 700 ms. Fallos si el original de `r1` no es visible o hubo una 3.ª petición.
  - `rotuloFrances`: 1 respuesta con `lang: 'fr'`; esperar 2,5 s. Fallos si no está traducida o su caja no dice «Traducido del francés».
- [ ] **Step 2: `node test/run.mjs nuestroNoSePulsa revertirYRedibujar cajaBorrada rotuloFrances`** → 4 FAIL (los otros cuatro ya están escritos y en rojo).
- [ ] **Step 3: Implementar** la alternancia, la exclusión de `.xat-caja` de todo escaneo, la vuelta atrás por publicación, la restauración si la caja desaparece y el rótulo por idioma.
- [ ] **Step 4: `node test/run.mjs`** → 39 PASS.
- [ ] **Step 5: Commit** `feat: vuelta atrás por publicación, caja a salvo y botones propios fuera del escaneo`.

### Task 3: Errores, límites, techo y ritmo

**Files:**
- Modify: `content.js`, `test/driver.js`, `test/run.mjs`

- [ ] **Step 1: Escribir los escenarios que fallan**:
  - Ya escritos: `limite429`, `falloApi`, `servidorCaido`, `sinSesion`, `sinPermiso`, `trozos`, `clasico`, `vueloApi`. `sinPermiso` cambia: Grok y clásica responden 401; exactamente 3 peticiones en 6 s (una por publicación: 401 en Grok, clásica también 401, paro).
  - `sinPermiso403`: Grok responde 403 y la clásica 200. 2 respuestas; esperar 3 s. Fallos si no están traducidas o por cada una no se pidió `grok` y luego `clasico`.
  - `topePagina`: `ajustes: { TOPE_PAGINA: 2 }`; 4 respuestas; esperar 4 s. Fallos si hubo más de 2 peticiones, más de 2 publicaciones traducidas, o los originales de `r3` y `r4` no son visibles.
  - `topeHora`: `ajustes: { TOPE_HORA: 2 }`; 4 respuestas; esperar 4 s. Fallos si hubo más de 2 peticiones. Después `ajustes` permite `TOPE_VENTANA_MS: 1500` y, tras esperar 3 s más, `r3` acaba traducida.
  - `pestaniaOculta`: 2 respuestas; `ocultarPestania(true)`; esperar 1,5 s; fallo si hubo alguna petición; `ocultarPestania(false)`; esperar 2,5 s; fallo si no están traducidas.
- [ ] **Step 2: `node test/run.mjs sinPermiso sinPermiso403 topePagina topeHora pestaniaOculta`** → 6 FAIL.
- [ ] **Step 3: Implementar** el tratamiento de fallos de la regla 8, el techo y el paro de «Techo y paro», y el mando de ocultar la pestaña en `test/run.mjs`.
- [ ] **Step 4: `node test/run.mjs`** → 44 PASS.
- [ ] **Step 5: Commit** `feat: techo, paros y ritmo al pedir traducciones a X`.

### Task 4: Diagnóstico y documentación

**Files:**
- Modify: `content.js`, `test/driver.js`, `README.md`, `docs/HANDOFF.md`, `manifest.json`

- [ ] **Step 1: Escribir el escenario que falla** `diagnostico`: post traducido por X, 1 respuesta en inglés sin botón con sesión, 1 en español, 1 sin enlace (`enlace: false`); `ajustes: { DIAGNOSTICO_MS: 1500 }`; `avisosEsperados: ['[X AutoTranslate] Página:', 'ya traducidas por X: 1', 'en el idioma de la interfaz: 1', 'sin enlace permanente: 1', 'traducidas: 1']`.
- [ ] **Step 2: `node test/run.mjs diagnostico`** → FAIL.
- [ ] **Step 3: Implementar** el resumen de página de la regla 14 y quitar `sondear()` y `MODO_SONDA`.
- [ ] **Step 4: Documentar**: README (qué hace, seguridad con el cambio de la v2, techo, diagnóstico), HANDOFF del proyecto, versión `2.0.0` en el manifiesto.
- [ ] **Step 5: `node test/run.mjs`** → 44 PASS (el `sonda` desaparece con la sonda).
- [ ] **Step 6: Commit** `docs: v2, seguridad, techo y diagnóstico`.
- [ ] **Step 7:** revisión final independiente con el `delta.md` de la adversarial en la mano, pasada de arreglos, fusión en `main`, subida y aviso al Socio.

---

## Enmiendas durante la ejecución (2026-11-26)

Estas son las decisiones de ejecución que cambian lo que dice el plan. El registro completo está en `.superpowers/sdd/2026-11-26-x-autotranslate-v2/progress.md`.

- **Tarea 0, paso 4:** «sonda PASS y las 16 de la v1 en verde», no «30 PASS»: los escenarios de las tareas 1 a 3 ya estaban escritos y en rojo.
- **Tarea 1:** el escenario `hilo` espera **5** peticiones (hay cinco respuestas en inglés, no seis) y se rehace: el tuit en español está en pantalla desde el principio, el recorrido va en dos pasos y se comprueba que **todas** las peticiones van de una en una. El escenario `citaSinEnlace` exige exactamente una petición. El escenario `sinPermiso` se reescribe según el diseño corregido: dos peticiones (Grok y clásica) de la primera publicación y paro. La sonda se enciende solo en su escenario (`sonda: true`).
- **Tarea 2:** escenario nuevo `reutilizarEnVuelo` (X reutiliza un bloque mientras se pide su traducción). Cazó un defecto real.
- **Tarea 3:** `pestaniaOculta` necesita un mando nuevo en la bancada (`ctx.ocultarPestania`), que manda la pestaña a segundo plano de verdad.
- **Recuentos reales**, no los 44 del plan: 31 al cerrar la Tarea 1, 40 al cerrar la Tarea 3, 41 con el resumen de la Tarea 4, y 40 cuando se vaya la sonda.
- **Commits:** las Tareas 1, 2 y 3 van juntas en un solo commit porque el código se escribió de una vez.
- **Tarea 4:** la sonda no se quita hasta que llegue el resultado de la X real, porque puede hacer falta corregirla.
