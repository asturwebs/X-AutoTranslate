# AGENTS.md — X AutoTranslate

Extensión de Chrome (Manifest V3) que traduce al español por ti en X lo que entra en pantalla y X no traduce sola: complementa a la traducción nativa de X, que en un hilo se queda en el post principal. Traduce al idioma de la interfaz de X, y está hecha para X en español. Sin permisos, sin dependencias, sin build.

Este fichero es para cualquiera que trabaje en el proyecto, persona o agente. Antes de tocar nada, lee los dos diseños de `docs/`: explican por qué el código es como es.

## Dónde está cada cosa

- `manifest.json`: un content script (`content.js` + `content.css`) en x.com y twitter.com. **Sin `permissions`.**
- `content.js`: todo el comportamiento, con comentarios que explican el porqué. Dos caminos: pulsar el botón de X (si lo pone) y pedirle la traducción a su servicio.
- `test/`: la bancada. `run.mjs` dirige un Chromium sin cabeza sobre `mock-x.html`; `driver.js` simula a X y su servicio de traducción.
- `CHANGELOG.md`: qué cambia en cada versión.
- `SECURITY.md`: cómo avisar de un problema de seguridad en privado, y qué cuenta como tal.
- `LICENSE`: MIT.
- `docs/diseno-v1.md` y `docs/diseno-v2.md`: el diseño de cada versión. El de la v2 lleva lo que enseñó la prueba con una sesión real de X.
- [Releases de GitHub](https://github.com/asturwebs/X-AutoTranslate/releases): cada versión publicada, con un zip listo para cargar en Chrome (`manifest.json`, `content.js`, `content.css` y, desde la 2.0.2, `LICENSE`) y sus notas.

## Probar

```sh
node test/run.mjs               # todo (unos 6 minutos)
node test/run.mjs hilo clasico  # solo algunos
XAT_CHROME=/ruta/a/chrome node test/run.mjs
```

Necesita Node y Chromium en `/usr/lib/chromium/chromium` (o `XAT_CHROME`). No abre puertos de depuración y no toca el perfil del navegador: usa uno temporal y lo borra al salir, también si se corta con Ctrl+C. La página de pruebas se sirve por HTTP en `127.0.0.1`, con puerto aleatorio, porque las cookies no existen sobre `file://`.

La primera comprobación es `manifest.json`: sin claves de más (ni permisos), corriendo solo en x.com y twitter.com, y con la misma versión que la última del registro de cambios. Después van los escenarios.

## Reglas del proyecto

- **La seguridad manda.** Sin `permissions`; sin `innerHTML`, `eval` ni almacenamiento; el texto traducido se pinta con `textContent`; peticiones solo a las rutas de traducción de X; **nunca escribir en consola el valor de una cookie**.
- **La cuenta de quien navega va por delante de la traducción.** Un trabajo a la vez y con ritmo. El techo, los paros y el disyuntor están en el diseño de la v2 («Techo y paro»): no se aflojan a la ligera.
- **A prueba de fallo ante el DOM de X.** Si no hay manera segura de saber de qué publicación es un bloque, no se pide. Antes no traducir que traducir bajo otra publicación.
- **Primero la prueba, en rojo.** Cada cambio de comportamiento nace como un escenario de `test/driver.js` que falla; después el código; después todo junto. Un escenario que pasa antes de escribir el código dice algo de la prueba, no del código.
- **Romper el código a propósito.** Cada escenario nuevo se comprueba rompiendo la línea que debe vigilar: una prueba que no cae en rojo cuando se rompe lo que vigila no vale.
- **Cada build que se cargue lleva su número.** Subir la versión del manifiesto, anotarla en `CHANGELOG.md`, etiquetar el commit con el mismo número y publicar el release con su zip. La consola enseña la versión cargada gracias a `chrome.runtime.getManifest()`.
  Para el zip: `git archive --format=zip --output=X-AutoTranslate-<versión>.zip v<versión> manifest.json content.js content.css LICENSE`; para publicarlo: `gh release create v<versión> <zip> --notes-file <notas>`.
- **Publicar es un paso aparte.** Primero se verifica (y se lee su resultado); solo entonces se publica, en otro comando. Si la verificación falla a medias y todo iba encadenado, lo que sigue se publica sin comprobar.
- **Commits** en español, con prefijo convencional (`feat:`, `fix:`, `docs:`, `test:`) y rutas explícitas en `git add`. Si trabaja contigo un agente, que conste como coautor en el mensaje.

## Trampas ya pagadas

- La ruta clásica del simulador siempre traduce; en la X real no. Una prueba de la ruta de Grok tiene que exigir que la traducción venga de Grok.
- El simulador corta una petición con el motivo real de la señal. Si imitara solo «AbortError», daría por bueno un cambio que en Chrome se comporta distinto.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar: la bancada lo evita con `Emulation.setFocusEmulationEnabled` y los flags `--disable-background-*`.
- En el protocolo de depuración, el nivel de `console.warn` es `warning`.
- Una sonda de una sola medición pierde datos si imprime el cuerpo «limpio»: que escriba lo que ve tal cual.
- Antes de commitear documentación, mirar sus encabezados (`grep -n '^## '`) y el diff.
- `gh release view --json` no admite `isLatest`; para saber cuál es la última, `gh release list`. Y `git rev-parse --short` solo admite una revisión: para ver si `HEAD` y `origin/main` coinciden, `git status -sb` (tras `git fetch`) o dos llamadas.
