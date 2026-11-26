# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 23:5x (sesión BytIA)

## Estado

🟢 **v2.0.1: la v2 funciona en la X real del Socio; esta versión corrige el tamaño y la letra del texto traducido, y él la confirmó en su X (26-nov, 23:5x). Repositorio con licencia MIT desde el 26-nov.**

- La **v1.0.0** solo pulsaba el botón «Traducir publicación» de X. En la X real no sirve para las respuestas de un hilo, porque **X no pone ese botón en ellas**.
- La **v2.0.0** añade un segundo camino: pedir la traducción al propio servicio de X y ponerla en el sitio del original. **Tiene que estar en `main` y subida al repo** (`asturwebs/X-AutoTranslate`, etiqueta `v2.0.0`). Si `main` no la tiene, la fusión del final de la sesión del 26-nov no llegó a hacerse: ver «Cómo continuar».
- **Comprobado en la X real del Socio (sonda del 26-nov, tarde):** las tres rutas responden 200 con su sesión y Grok devuelve la traducción. Detalle en el diseño v2, sección «La sonda».
- **Probada por el Socio en su X (26-nov, 22:2x–22:3x):** la 2.0.0 carga, pide y pone traducciones reales sin fallos (su consola a los 5 s: 18 bloques, pedidas 1, traducidas 1, fallidas 0, en espera 3, cupo de X 99 de 100) y al bajar por un hilo las respuestas se traducen: «Correcto, parece que funciona». Un fallo de aspecto: el texto traducido salía más pequeño y con otra letra que el de X, porque la caja heredaba la tipografía del padre del bloque y X la fija en el bloque. **Corregido en la 2.0.1**: el texto traducido toma la tipografía del bloque al que sustituye.
- **Confirmada por él la 2.0.1 en su X (26-nov, 23:5x):** «sí lo miré y ya se ve el texto». Lo que no dijo: el aspecto de la barra propia junto a la de X, en oscuro y en claro (no se da por confirmado). El gris clarito para el texto traducido quedó sin decidir; se le desaconsejó, porque baja el contraste de lo que se lee y la barra ya lo distingue.
- **Hay usuarios terceros desde el 26-nov por la noche:** el dueño del proyecto la compartió fuera. Lo que se publique a partir de ahora lo usa gente que no la ha construido.

## Dónde está cada cosa

| Sitio | Qué es |
|---|---|
| `~/Projects/X-AutoTranslate` | El único árbol de trabajo. Es la carpeta que carga Chrome como extensión desempaquetada, en `main` |
| `manifest.json`, `content.js`, `content.css` | La extensión. Sin permisos, sin dependencias |
| `test/run.mjs`, `test/driver.js`, `test/mock-x.html` | La bancada: simula a X y su servicio de traducción |
| `docs/superpowers/specs/` | Diseño de la v1 y de la v2 (el de la v2 lleva el resultado de la sonda) |
| `docs/superpowers/plans/` | Planes de la v1 y de la v2, con las enmiendas de la ejecución |
| `CHANGELOG.md` | Qué cambia en cada versión |
| `LICENSE` | Licencia MIT del código |
| [Releases de GitHub](https://github.com/asturwebs/X-AutoTranslate/releases) | Cada versión publicada: un zip con `manifest.json`, `content.js` y `content.css`, listo para cargar en Chrome, y sus notas |
| `CLAUDE.md` | Reglas para trabajar en el proyecto: dónde está cada cosa, cómo probar y lo que no se toca |
| `~/Work/x-autotranslate-adversarial-v2/` | Revisión adversaria del diseño (congelado, briefs, informes, `delta.md`) copia del registro de ejecución del plan v2 (`registro-v2-progress.md`: decisiones tomadas y menores aplazados) y la lista de roturas del código (`mutar-v2.py`); su `README.md` indexa la carpeta |

El worktree de desarrollo `~/Projects/X-AutoTranslate-dev` y la rama `feature/v2` ya no existen: se borraron al fusionar.

## Cómo saber qué versión está cargada

El Socio pidió versionar cada build para saber que la extensión se recarga bien. Cada build que se le entregue lleva su número:

- en `chrome://extensions` se ve la versión del manifiesto (la v1 era `1.0.0`; la 2.0.0 fue la primera que tradujo en su X; esta es `2.0.1`);
- en la consola de X, la línea `[X AutoTranslate] Página:` empieza por la versión cargada: `v2.0.1 · bloques de texto …`.

Para un arreglo nuevo: subir el parche del manifiesto (`2.0.1`, `2.0.2`…), etiquetar el commit con el mismo número y decírselo.

## Cómo probarla en la X real

1. `chrome://extensions` → botón de recargar de X AutoTranslate → comprobar que pone `2.0.1`.
2. Abrir un hilo con respuestas en otro idioma. Recargar la pestaña: las pestañas que ya estaban abiertas conservan el guion viejo.
3. Bajar por las respuestas: cada una entra traducida, con la barra propia «Traducido del inglés · Mostrar original».
4. Si algo no cuadra: F12 antes de recargar, y copiar la línea `[X AutoTranslate] Página:` y los avisos `[X AutoTranslate]` que salgan.

Condiciones: X con la interfaz en español (la extensión traduce al idioma de la interfaz) y la sesión iniciada.

Pasos que se le dieron al Socio el 26-nov por la noche: esos mismos.

## Hecho

- **2026-11-26 14:1x–17:2x** — v1: diseño, plan, construcción, revisión independiente, fusión y subida.
- **2026-11-26 17:3x–17:5x** — el Socio prueba la v1 en su X: las respuestas del hilo siguen sin traducirse. Causa raíz: X no pone enlace de traducir en las respuestas. El Socio elige el enfoque de pedir la traducción a X.
- **2026-11-26 17:5x–18:2x** — **revisión adversaria** del diseño y el plan de la v2 (MiMo v2.6-pro y DeepSeek flash): «GO con arreglos». Catorce hallazgos, tres escalados y ratificados por el Socio (sonda antes de construir; cada pestaña por su cuenta; topes de 60 por página y 300 por hora). Registro: `~/Work/x-autotranslate-adversarial-v2/`.
- **2026-11-26 18:2x–19:4x** — v2: Tarea 0 (sonda), Tareas 1 a 3 (camino de petición, caja, techo y paros).
- **2026-11-26 19:4x–21:3x** — **revisión final del código** (revisor `opus`, contexto fresco): «lista para fusionar con arreglos». Dos críticos, siete importantes, trece menores. **Pasada de arreglos**, cada uno con su prueba vista en rojo antes y en verde después: estado por publicación (una publicación no se pide dos veces, lo que sale de pantalla en cola vuelve a empezar, lo que falló se deja en paz), los 429 cuentan para la pausa de tres fallos, disyuntor ante fallo sistémico, los textos aparcados no bloquean los clics, identidad de cada bloque a prueba de fallo, marcas por artículo con caducidad, tope de tiempo por publicación, avisos con lo que respondió X.
- **2026-11-26 21:3x–22:xx** — **la sonda en la X real del Socio.** Resultado: Grok desde x.com responde 200 con la traducción (sin `x-client-transaction-id`); `api.x.com` ídem; la clásica responde 200 sin traducción (`NotCached`); cupo de 100 por ventana en Grok y 187 en el clásico. Con eso, cuatro ajustes con su prueba: el lector de trozos de Grok acepta salto de línea o espacio (sin ello, con trozos separados por espacios no habría traducido nada), reserva de cupo, el aviso enseña también lo que X responde en un 200 sin traducción, y la versión cargada en el resumen de página. La sonda se quitó del código. Bancada final: 67 escenarios en verde; de 51 roturas intencionadas del código, 47 cazadas a la primera y las otras 4 por roturas dobles (son defensas dobles: dos protecciones para el mismo fallo). Fusión en `main`, subida y etiqueta `v2.0.0`.
- **2026-11-26 22:3x–23:2x** — **el Socio prueba la 2.0.0 en su X:** funciona. Le molesta que el texto traducido salga más pequeño (la otra letra no); sugiere un gris clarito para diferenciarlo, sin decidir. **2.0.1** (rama `fix/2.0.1-tipografia`, en un worktree aparte para no mover la carpeta de Chrome hasta verificar; fusión por avance rápido): el texto traducido toma la tipografía del bloque de X. Escenario nuevo `tipografia`. BytIA le desaconseja el gris para el texto.
- **2026-11-26 23:2x–23:3x** — **presencia en GitHub.** El Socio pregunta si el README está bien y si hay versiones para descargar. Había etiquetas pero ningún release. Publicadas las tres (1.0.0, 2.0.0 y 2.0.1 como última) con un zip hecho con `git archive` de cada etiqueta y notas en español; descripción del repo corregida (describía la v1) y temas añadidos; README con el enlace de descarga, la instalación desde el zip y fuera un consejo de la v1 que ya no valía.
- **2026-11-26 23:3x–23:5x** — **dos correcciones del Socio a las primeras líneas del README.** Primero: no decían que traduce al español (commit `15c8652`; corregido también en la descripción del repo, las notas de las versiones y el registro de cambios). Después: que diga que **complementa a la traducción nativa de X**, porque las respuestas de un post no se traducen sin entrar en ellas; y que entre la configuración del idioma de X (texto sacado de Grok y comprobado por él). Hecho en `e1c43f8`: ese párrafo, arriba del todo; la sección «Instalación» con su encabezado (se había perdido en `c54ef43` y los pasos colgaban de «Estado»); antes de instalar, tres requisitos: X en español (la ruta de la ayuda oficial de X, la misma que comprobó el Socio), sesión iniciada y Chrome en el ordenador; en «Si no traduce», qué pasa si la interfaz de X no está en español. **La parte del móvil no entró**: es cierta según la ayuda de X, pero la extensión no se instala en la app del móvil. Las notas de la 2.0.1 y la 2.0.0 y la descripción del repo dicen lo mismo (preparado, comprobado y publicado en pasos separados).
- **2026-11-26 23:5x** — **hay usuarios terceros** (el dueño del proyecto la compartió fuera) y **él confirma la 2.0.1 en su X.** Repaso del repo público en ese momento: sin claves, cookies, identificadores de publicaciones ni capturas en los ficheros; lo único personal es la autoría de los commits. Con gente usándola, la licencia dejó de poder esperar.
- **2026-11-26 23:5x–00:0x** — **licencia MIT** (decisión del dueño del proyecto). `LICENSE` con la plantilla de GitHub, cotejada con el texto de SPDX; el titular es el nombre de autor de los commits. Cambiado donde decía que el código no se podía reutilizar: README, notas de las tres versiones y este fichero. Los zips publicados antes de la licencia no llevan el fichero dentro; los siguientes, sí.

## Cómo probar (la bancada)

```sh
cd ~/Projects/X-AutoTranslate
node test/run.mjs            # todos los escenarios, unos 6 minutos
node test/run.mjs hilo       # solo algunos
```

Sin dependencias. Un Chromium sin cabeza con perfil temporal, por `--remote-debugging-pipe`, sobre `test/mock-x.html`, servida por HTTP en `127.0.0.1` (puerto aleatorio, solo durante las pruebas) porque las cookies no existen sobre `file://`. Para romper el código a propósito está la lista de roturas de la v2, fuera del repo: `~/Work/x-autotranslate-adversarial-v2/mutar-v2.py`. Se copia a la raíz del proyecto, se ajustan las anclas al código nuevo y se lanza con `python3 -I mutar.py` (restaura `content.js` al acabar y dice cuántas cazó la bancada).

## Pendientes

1. Del lado del dueño del proyecto, cuando quiera: el aspecto de la barra propia junto a la de X (tema oscuro y claro) y el salto de alto de la celda al crecer, que no comentó al confirmar la 2.0.1; y una captura real para el README.
2. Publicar en la Chrome Web Store, si se quiere. Hoy se carga desempaquetada.
3. Menores aplazados de las dos revisiones de código: la vuelta atrás con teclado, rendimiento sin medir, el manifiesto sin prueba automática (v1); una ventana tapada por otra no cuenta como oculta (solo `document.hidden`), `test/run.mjs` sin manejador de SIGINT/SIGTERM (v2); y usar `AbortSignal.timeout()` en vez de `AbortController` con `setTimeout` para el tope de tiempo de cada publicación, que es lo que pide la guía `js` de `modern-web-guidance` (comprobando también `TimeoutError`, no solo `AbortError`; hoy funciona igual con el temporizador manual). Y de la adversaria: coordinación entre pestañas, no hecha por decisión del Socio.
4. La descripción del manifiesto (`description`, la que sale en `chrome://extensions`) no dice que traduce al español ni que complementa a la traducción de X. Texto propuesto para la próxima versión (114 caracteres; Chrome admite 132): «Complementa a la traducción de X: traduce al español, sin entrar en ellas, las respuestas que X deja sin traducir.». Cambiarla en la próxima versión, para no sacar una solo por eso.
5. La ruta clásica de X, en la única medición real, no tradujo nada. Se queda como último recurso porque no puede devolver una traducción falsa; si en la prueba real no sirve para nada, se puede quitar y simplificar.
6. Los zips de las versiones publicadas antes de la licencia (1.0.0, 2.0.0 y 2.0.1) no llevan `LICENSE` dentro. La licencia vale igual (está en el repositorio y la cita cada nota de versión); si se quiere el fichero dentro de esos zips, hay que volver a subirlos. Decisión del dueño del proyecto.

## Cómo continuar

1. Leer este fichero y el diseño v2 (`docs/superpowers/specs/2026-11-26-x-autotranslate-v2-design.md`).
2. Si el Socio ya probó la v2: partir de lo que diga y de la línea `[X AutoTranslate] Página:` de su consola.
3. Arreglo → prueba en rojo → código → verde → suite entera → subir la versión del parche → commit → subir `main` → etiquetar → publicar el release con su zip (ver `CLAUDE.md`) → avisar al Socio con el número.
4. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Lecciones que ya están pagadas

- X **no pone enlace de traducir en las respuestas de un hilo**: solo traduce solo el post principal. Por eso hay que pedirle la traducción al servicio.
- El servicio de traducción de X funciona con la sesión y la clave pública del cliente web, **sin `x-client-transaction-id`**. Pero su contrato documentado no bastaba: hizo falta una sonda en la X real.
- **Una sonda que imprime el cuerpo «limpio» pierde datos.** La de esta sesión colapsó los espacios y no dejó ver si X separa los trozos con saltos de línea o con espacios; el lector tuvo que aceptar las dos cosas. Que una sonda escriba lo que ve tal cual, o diga qué transformó.
- **El servicio falso puede tapar un fallo del de verdad.** El simulador hacía que la ruta clásica siempre tradujera; en la X real no traduce. Una prueba de Grok daba por buena una traducción que la había rescatado el clásico. Las pruebas exigen la ruta por la que tiene que venir la respuesta.
- **Una prueba que pasa antes de escribir el código dice algo de la prueba**, no del código: `trozosJuntos` pasó en rojo y eso destapó el hueco anterior.
- **Ejecutar lo que se tocó, y luego la suite entera.** Un parche de pruebas cayó en otro escenario (su ancla casó en el sitio equivocado) y solo se ejecutaron los dos escenarios que se creía tocados, así que la prueba mal escrita pasó desapercibida un rato. Lo destapó releer el simulador antes de commitear. Un parche aplica con una aserción por ancla y se comprueba leyendo el sitio exacto donde cayó.
- El botón de traducir de X no tiene un `data-testid` estable: se localiza por su nombre accesible. No se detecta por posición; un clic equivocado en X puede ser un «me gusta» o un repost.
- `element.click()` funciona, pero X redibuja el artículo tras el clic.
- X limita las peticiones a su traducción: de ahí la cola, la espera por respuesta y la pausa tras fallos. El hueco se sortea porque una cadencia fija delata un robot.
- Un plazo que solo se comprueba cuando otra cosa llama a la función no es un plazo: el fallo lleva su propio temporizador.
- En las pruebas, `FALLO_MS` debe ser distinto de `ESPERA_MAX_MS`, o una espera tapa la otra. Y un 429 no es «un 4xx más».
- Cuando X reutiliza un bloque cambiando solo su texto, no hay nodos nuevos: el observador tiene que mirar también los nodos de texto.
- Una prueba que pasa desde el principio puede ser hueca: se comprueba rompiendo el código a propósito. Cuando dos defensas cubren lo mismo, la rotura simple no se ve y hace falta la doble.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar. La bancada lo evita con `Emulation.setFocusEmulationEnabled` y los flags `--disable-background-*`, y falla el escenario si la página no está visible. Para ocultarla a propósito: otra pestaña con la emulación quitada.
- `--dump-dom --virtual-time-budget` no vale para probar nada que dependa del scroll.
- El nivel de `console.warn` en el protocolo de depuración es `warning`, no `warn`.
- La revisión adversaria con dos motores distintos cazó en 15 minutos lo que el autor no vio en una hora de diseño: entre otros, que la extensión se pulsaría a sí misma y que no tenía techo de peticiones. La revisión final del código con otro motor cazó dos defectos de corrección que 41 escenarios en verde no veían.
- `chrome.runtime.getManifest()` es de las pocas API que un content script usa sin permisos: da la versión sin tocar el manifiesto.
- **Verificar y publicar son dos pasos.** Un error en mi script de comprobación no frenó el comando que lo seguía y los zips de las versiones se publicaron sin verificar (se verificaron justo después y estaban bien). La verificación se lanza sola, se lee su resultado, y solo entonces se publica.
- En la X real, la tipografía de un tuit va en el propio bloque de texto, no en su padre. Lo que se inserte al lado tiene que tomarla del bloque (`getComputedStyle` pasado a variables CSS); si hereda del padre, sale más pequeño.
- **Tras editar documentación, mirar sus encabezados antes de commitear.** En `c54ef43` se borró sin querer el encabezado `## Instalación` del README: los pasos quedaron colgando de «Estado» y se publicó así, sin que nadie lo viera hasta el cambio siguiente. `grep -n '^## '` y el diff, leídos, lo cazan.
- **Las primeras líneas de una presentación dicen lo esencial, y lo esencial incluye cómo encaja con lo que ya existe.** Dos correcciones del Socio el mismo día: que traduce al español, y que complementa a la traducción nativa de X.
- **Un texto de configuración ajeno se comprueba antes de entrar en el README.** El de esta sesión (la ruta del idioma de X) venía de Grok; coincidía con la ayuda oficial de X y el Socio lo había comprobado en su X, así que entró. Su parte del móvil no: la extensión no se instala en la app del móvil.
- **Un texto canónico se genera desde la fuente, no se teclea.** Al pasar a mano la licencia MIT se perdió un «and/or»; lo cazó cotejar el fichero con la plantilla de GitHub palabra a palabra (y la plantilla, con el texto de SPDX).

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de ideas, con crédito en el código y en el README.
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; llama a la API de traducción de X.
- `dfrnoch/liquidX` y `rien7/twitter-extension-api`: documentación pública del contrato del servicio de traducción.
- Documentación de Chrome sobre content scripts: `https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts` (qué API usan sin permisos).
- Ayuda de X sobre el idioma de visualización (la ruta que cita el README): `https://help.x.com/es/managing-your-account/how-to-change-language-settings`. Límites del manifiesto de Chrome (la descripción admite 132 caracteres): `https://developer.chrome.com/docs/extensions/reference/manifest`.
- Revisión adversaria de la v2 y registro del plan: `~/Work/x-autotranslate-adversarial-v2/`.
