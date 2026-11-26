# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 14:4x (sesión BytIA)

## Estado

🟡 **Diseño revisado y plan escrito. Sin código todavía.** Esperan la revisión del Socio y su elección del método de ejecución.

- `README.md` — qué es y por qué.
- `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md` — diseño (10 decisiones).
- `docs/superpowers/plans/2026-11-26-x-autotranslate-v1.md` — plan de implementación (4 tareas, 11 escenarios de prueba).

## Hecho

- **2026-11-26 14:1x** — creados el workspace (`~/Projects/X-AutoTranslate`) y el repositorio público (`asturwebs/X-AutoTranslate`), solo con documentación de arranque.
- **2026-11-26 14:1x** — evaluado y descartado `cpetschnig/translate-twitter`, propuesto por el Socio: aplicación de servidor (Ruby on Rails, 2010-2013, archivada) que republica tweets traducidos de otra cuenta.
- **2026-11-26 14:2x** — a propuesta del Socio («inspirarse en la extensión actual»), leído el *content script* de `Automatic TWITTER Translator` v1.2.20: tomados sus selectores, descartado su mecanismo (sondeo con `setInterval`, todo el DOM, repeticiones al redibujar).
- **2026-11-26 14:3x-14:4x** — investigación del botón de traducir de X (búsqueda de un subagente `haiku`, comprobada después en GitHub): sin `data-testid` estable, se localiza por etiqueta; `element.click()` funciona en tres proyectos MIT; X redibuja el artículo tras el clic. Evaluados `llpgf/x-grok-visible-translate` (MIT; tres ideas tomadas con crédito) y `amahteru/x-auto-translate` (MIT; descartado). Diseño revisado y plan escrito.
- **Bancada de pruebas probada en esta máquina**: Node 26 dirigiendo `/usr/lib/chromium/chromium` por `--remote-debugging-pipe`. El modo `--dump-dom --virtual-time-budget` no vale: casi no dibuja y el observador de visibilidad no llega a dispararse.

## Pendientes

1. Revisión del plan por el Socio y elección del método de ejecución (recomendado: ejecución en la propia sesión y una revisión independiente al final).
2. Ejecutar el plan (4 tareas).
3. Subir a GitHub los commits que queden solo en local (regla de git del Socio: proponer no es ejecutar). Ahora mismo hay 2 en local.
4. Prueba en la X real del Socio: etiqueta exacta del botón, que el clic dispara la traducción, qué muestra X ante un fallo o un 429, y que funciona en la ventana `--app` de la web app.
5. Licencia del repositorio: sin decidir.

## Cómo continuar

1. Leer el diseño y el plan.
2. Ejecutar el plan con el método que haya elegido el Socio. Si no lo ha elegido, preguntárselo.
3. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Contexto de origen

La traducción automática nativa de X cubre los posts y traduce algunas respuestas, pero la mayoría no. La extensión de la tienda usada hasta ahora (`Automatic TWITTER Translator`) tiene un tope de 50 traducciones al día sin PRO, y por eso se descartó.

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de tres ideas (observar el botón, mirar `aria-label`, reexaminar el artículo tras un clic).
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; localiza el botón por su texto, con «Traducir publicación» en la lista.
- `amahteru/x-auto-translate` (MIT): extensión que traduce por su cuenta; descartada.
- `cpetschnig/translate-twitter`: aplicación de servidor de 2010-2013; descartada.
