# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 22:xx (sesión BytIA)

## Estado

🟢 **v2.0.0 terminada, probada en el simulador y con su forma de pedir la traducción comprobada en la X real. Falta que el Socio la pruebe entera en su X.**

- La **v1.0.0** solo pulsaba el botón «Traducir publicación» de X. En la X real no sirve para las respuestas de un hilo, porque **X no pone ese botón en ellas**.
- La **v2.0.0** añade un segundo camino: pedir la traducción al propio servicio de X y ponerla en el sitio del original. **Tiene que estar en `main` y subida al repo** (`asturwebs/X-AutoTranslate`, etiqueta `v2.0.0`). Si `main` no la tiene, la fusión del final de la sesión del 26-nov no llegó a hacerse: ver «Cómo continuar».
- **Comprobado en la X real del Socio (sonda del 26-nov, tarde):** las tres rutas responden 200 con su sesión y Grok devuelve la traducción. Detalle en el diseño v2, sección «La sonda».
- **Sin comprobar:** la extensión entera corriendo en su X (aspecto de la barra propia junto a la de X, ritmo real).

## Dónde está cada cosa

| Sitio | Qué es |
|---|---|
| `~/Projects/X-AutoTranslate` | El único árbol de trabajo. Es la carpeta que carga Chrome como extensión desempaquetada, en `main` |
| `manifest.json`, `content.js`, `content.css` | La extensión. Sin permisos, sin dependencias |
| `test/run.mjs`, `test/driver.js`, `test/mock-x.html` | La bancada: simula a X y su servicio de traducción |
| `docs/superpowers/specs/` | Diseño de la v1 y de la v2 (el de la v2 lleva el resultado de la sonda) |
| `docs/superpowers/plans/` | Planes de la v1 y de la v2, con las enmiendas de la ejecución |
| `~/Work/x-autotranslate-adversarial-v2/` | Revisión adversaria del diseño (congelado, briefs, informes, `delta.md`) copia del registro de ejecución del plan v2 (`registro-v2-progress.md`: decisiones tomadas y menores aplazados) y la lista de roturas del código (`mutar-v2.py`) |

El worktree de desarrollo `~/Projects/X-AutoTranslate-dev` y la rama `feature/v2` ya no existen: se borraron al fusionar.

## Cómo saber qué versión está cargada

El Socio pidió versionar cada build para saber que la extensión se recarga bien. Cada build que se le entregue lleva su número:

- en `chrome://extensions` se ve la versión del manifiesto (la v1 era `1.0.0`; esta es `2.0.0`);
- en la consola de X, la línea `[X AutoTranslate] Página:` empieza por la versión cargada: `v2.0.0 · bloques de texto …`.

Para un arreglo nuevo: subir el parche del manifiesto (`2.0.1`, `2.0.2`…), etiquetar el commit con el mismo número y decírselo.

## Cómo probarla en la X real

1. `chrome://extensions` → botón de recargar de X AutoTranslate → comprobar que pone `2.0.0`.
2. Abrir un hilo con respuestas en otro idioma. Recargar la pestaña: las pestañas que ya estaban abiertas conservan el guion viejo.
3. Bajar por las respuestas: cada una entra traducida, con la barra propia «Traducido del inglés · Mostrar original».
4. Si algo no cuadra: F12 antes de recargar, y copiar la línea `[X AutoTranslate] Página:` y los avisos `[X AutoTranslate]` que salgan.

Pasos que se le dieron al Socio el 26-nov por la noche: esos mismos.

## Hecho

- **2026-11-26 14:1x–17:2x** — v1: diseño, plan, construcción, revisión independiente, fusión y subida.
- **2026-11-26 17:3x–17:5x** — el Socio prueba la v1 en su X: las respuestas del hilo siguen sin traducirse. Causa raíz: X no pone enlace de traducir en las respuestas. El Socio elige el enfoque de pedir la traducción a X.
- **2026-11-26 17:5x–18:2x** — **revisión adversaria** del diseño y el plan de la v2 (MiMo v2.6-pro y DeepSeek flash): «GO con arreglos». Catorce hallazgos, tres escalados y ratificados por el Socio (sonda antes de construir; cada pestaña por su cuenta; topes de 60 por página y 300 por hora). Registro: `~/Work/x-autotranslate-adversarial-v2/`.
- **2026-11-26 18:2x–19:4x** — v2: Tarea 0 (sonda), Tareas 1 a 3 (camino de petición, caja, techo y paros).
- **2026-11-26 19:4x–21:3x** — **revisión final del código** (revisor `opus`, contexto fresco): «lista para fusionar con arreglos». Dos críticos, siete importantes, trece menores. **Pasada de arreglos**, cada uno con su prueba vista en rojo antes y en verde después: estado por publicación (una publicación no se pide dos veces, lo que sale de pantalla en cola vuelve a empezar, lo que falló se deja en paz), los 429 cuentan para la pausa de tres fallos, disyuntor ante fallo sistémico, los textos aparcados no bloquean los clics, identidad de cada bloque a prueba de fallo, marcas por artículo con caducidad, tope de tiempo por publicación, avisos con lo que respondió X.
- **2026-11-26 21:3x–22:xx** — **la sonda en la X real del Socio.** Resultado: Grok desde x.com responde 200 con la traducción (sin `x-client-transaction-id`); `api.x.com` ídem; la clásica responde 200 sin traducción (`NotCached`); cupo de 100 por ventana en Grok y 187 en el clásico. Con eso, cuatro ajustes con su prueba: el lector de trozos de Grok acepta salto de línea o espacio (sin ello, con trozos separados por espacios no habría traducido nada), reserva de cupo, el aviso enseña también lo que X responde en un 200 sin traducción, y la versión cargada en el resumen de página. La sonda se quitó del código. Bancada final: 67 escenarios en verde; de 51 roturas intencionadas del código, 47 cazadas a la primera y las otras 4 por roturas dobles (son defensas dobles: dos protecciones para el mismo fallo). Fusión en `main`, subida y etiqueta `v2.0.0`.

## Cómo probar (la bancada)

```sh
cd ~/Projects/X-AutoTranslate
node test/run.mjs            # todos los escenarios, unos 6 minutos
node test/run.mjs hilo       # solo algunos
```

Sin dependencias. Un Chromium sin cabeza con perfil temporal, por `--remote-debugging-pipe`, sobre `test/mock-x.html`, servida por HTTP en `127.0.0.1` (puerto aleatorio, solo durante las pruebas) porque las cookies no existen sobre `file://`. Para romper el código a propósito está la lista de roturas de la v2, fuera del repo: `~/Work/x-autotranslate-adversarial-v2/mutar-v2.py`. Se copia a la raíz del proyecto, se ajustan las anclas al código nuevo y se lanza con `python3 -I mutar.py` (restaura `content.js` al acabar y dice cuántas cazó la bancada).

## Pendientes

1. **Prueba en la X real del Socio con la v2:** que las respuestas se traducen según baja; el aspecto de la barra propia junto a la de X (tema oscuro y claro); el salto de alto de la celda al crecer. Cada arreglo, con su número de versión.
2. **Licencia del repositorio.** Sin decidir; es del Socio.
3. Publicar en la Chrome Web Store, si se quiere. Hoy se carga desempaquetada.
4. Menores aplazados de las dos revisiones de código: la vuelta atrás con teclado, rendimiento sin medir, el manifiesto sin prueba automática (v1); una ventana tapada por otra no cuenta como oculta (solo `document.hidden`), `test/run.mjs` sin manejador de SIGINT/SIGTERM (v2). Y de la adversaria: coordinación entre pestañas, no hecha por decisión del Socio.
5. La ruta clásica de X, en la única medición real, no tradujo nada. Se queda como último recurso porque no puede devolver una traducción falsa; si en la prueba real no sirve para nada, se puede quitar y simplificar.

## Cómo continuar

1. Leer este fichero y el diseño v2 (`docs/superpowers/specs/2026-11-26-x-autotranslate-v2-design.md`).
2. Si el Socio ya probó la v2: partir de lo que diga y de la línea `[X AutoTranslate] Página:` de su consola.
3. Arreglo → prueba en rojo → código → verde → suite entera → subir la versión del parche → commit → subir `main` → avisar al Socio con el número.
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

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de ideas, con crédito en el código y en el README.
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; llama a la API de traducción de X.
- `dfrnoch/liquidX` y `rien7/twitter-extension-api`: documentación pública del contrato del servicio de traducción.
- Documentación de Chrome sobre content scripts: `https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts` (qué API usan sin permisos).
- Revisión adversaria de la v2 y registro del plan: `~/Work/x-autotranslate-adversarial-v2/`.
