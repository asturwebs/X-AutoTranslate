# CLAUDE.md — X AutoTranslate

Extensión de Chrome (Manifest V3) que traduce al español por ti en X lo que entra en pantalla y X no traduce sola: complementa a la traducción nativa de X, que en un hilo se queda en el post principal (traduce al idioma de la interfaz de X; la extensión está hecha para X en español). Sin permisos, sin dependencias, sin build. Antes de tocar nada, lee `docs/HANDOFF.md` (estado, cómo probarla, lecciones) y el diseño de la v2 (`docs/superpowers/specs/2026-11-26-x-autotranslate-v2-design.md`).

## Dónde está cada cosa

- `manifest.json`: un content script (`content.js` + `content.css`) en x.com y twitter.com. **Sin `permissions`.**
- `content.js`: todo el comportamiento, con comentarios que explican el porqué. Dos caminos: pulsar el botón de X (si lo pone) y pedirle la traducción a su servicio.
- `test/`: la bancada. `run.mjs` dirige un Chromium sin cabeza sobre `mock-x.html`; `driver.js` simula a X y su servicio de traducción.
- `CHANGELOG.md`: qué cambia en cada versión.
- `LICENSE`: licencia MIT del código (decisión del dueño del proyecto, 26-nov-2026).
- [Releases de GitHub](https://github.com/asturwebs/X-AutoTranslate/releases): cada versión publicada, con un zip listo para cargar en Chrome (`manifest.json`, `content.js`, `content.css`) y sus notas. Desde la versión que siga, el zip lleva también `LICENSE`.
- `docs/`: handoff del proyecto, y los diseños y planes de la v1 y de la v2.

## Probar

```sh
node test/run.mjs               # todo (unos 6 minutos)
node test/run.mjs hilo clasico  # solo algunos
XAT_CHROME=/ruta/a/chrome node test/run.mjs
```

Necesita Node y Chromium en `/usr/lib/chromium/chromium` (o `XAT_CHROME`). No abre puertos y no toca el perfil del navegador. La página de pruebas se sirve por HTTP en `127.0.0.1`, con puerto aleatorio, porque las cookies no existen sobre `file://`.

## Reglas del proyecto

- **La seguridad manda.** Sin `permissions`; sin `innerHTML`, `eval` ni almacenamiento; el texto traducido se pinta con `textContent`; peticiones solo a las rutas de traducción de X; **nunca escribir en consola el valor de una cookie**.
- **La cuenta de quien navega va por delante de la traducción.** Un trabajo a la vez y con ritmo. El techo, los paros y el disyuntor están en el diseño («Techo y paro»): no se aflojan sin decisión del dueño del proyecto.
- **A prueba de fallo ante el DOM de X.** Si no hay manera segura de saber de qué publicación es un bloque, no se pide. Antes no traducir que traducir bajo otra publicación.
- **Primero la prueba, en rojo.** Cada cambio de comportamiento nace como un escenario de `test/driver.js` que falla; después el código; después la suite entera. Un escenario que pasa antes de escribir el código dice algo de la prueba, no del código.
- **Romper el código a propósito.** Las pruebas se comprueban rompiendo la línea que deben vigilar. La lista de roturas se conserva fuera del repo (ver `docs/HANDOFF.md`).
- **Cada build que se cargue lleva su número.** Subir la versión del manifiesto, anotarla en `CHANGELOG.md`, etiquetar el commit con el mismo número y publicar el release con su zip. La consola enseña la versión cargada gracias a `chrome.runtime.getManifest()`.
  Para el zip: `git archive --format=zip --output=X-AutoTranslate-<versión>.zip v<versión> manifest.json content.js content.css LICENSE` (`LICENSE` existe en el árbol desde la licencia; en las etiquetas anteriores no está y el comando falla); para publicarlo: `gh release create v<versión> <zip> --notes-file <notas>`.
- **Publicar es un paso aparte.** Primero se verifica (y se lee su resultado); solo entonces se publica, en otro comando. Si la verificación falla a medias y todo iba encadenado, lo que sigue se publica sin comprobar.
- **Commits** en español, con prefijo convencional (`feat:`, `fix:`, `docs:`), rutas explícitas en `git add` y remate `Co-Authored-By: BytIA <bytia@bytia.es>`.

## Trampas ya pagadas

- La ruta clásica del simulador siempre traduce; en la X real no. Una prueba de la ruta de Grok tiene que exigir que la traducción venga de Grok.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar: la bancada lo evita con `Emulation.setFocusEmulationEnabled` y los flags `--disable-background-*`.
- En el protocolo de depuración, el nivel de `console.warn` es `warning`.
- Una sonda de una sola medición pierde datos si imprime el cuerpo «limpio»: que escriba lo que ve tal cual.
- Antes de commitear documentación, mirar sus encabezados (`grep -n '^## '`) y el diff: en `c54ef43` se borró sin querer el de «Instalación» del README y se publicó así.
- `gh release view --json` no admite `isLatest`; para saber cuál es la última, `gh release list`. Y `git rev-parse --short` solo admite una revisión: para ver si `HEAD` y `origin/main` coinciden, `git status -sb` (tras `git fetch`) o dos llamadas.
