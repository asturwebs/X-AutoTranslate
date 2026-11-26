# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 14:2x (sesión BytIA)

## Estado

🟡 **En diseño.** Repositorio creado hoy a petición del Socio. Sin código todavía.

- `README.md` — qué es y por qué.
- `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md` — diseño corto, **pendiente de aprobación**.

## Hecho

- **2026-11-26 14:1x** — creados el workspace (`~/Projects/X-AutoTranslate`) y el repositorio público (`asturwebs/X-AutoTranslate`), solo con documentación de arranque.
- **2026-11-26 14:1x** — evaluado y descartado `cpetschnig/translate-twitter`, propuesto por el Socio: es una aplicación de servidor (Ruby on Rails, 2010-2013, archivada) que copia los tweets de una cuenta, los traduce y los publica desde otra cuenta. No es una extensión y no actúa sobre la X que se lee. El Socio coincidió en descartarlo.
- **2026-11-26 14:2x** — a propuesta del Socio («inspirarse en la extensión actual»), leído el *content script* de `Automatic TWITTER Translator` v1.2.20. Tomados sus selectores; descartado su mecanismo (sondeo con `setInterval`, todo el DOM sin mirar la pantalla, repeticiones al redibujar). Detalle en el diseño, aparte «Lo que se toma de la extensión de la tienda».

## Pendientes

1. Aprobación del diseño por el Socio.
2. Construir la v1 (`manifest.json` + `content.js`) y verificarla en la página real:
   - texto exacto del botón «Traducir publicación» y si tiene `data-testid` utilizable;
   - que `button.click()` dispara la traducción;
   - qué muestra X ante un fallo o un 429, y qué ritmo tolera;
   - que funciona en la ventana `--app` de la web app.
3. Licencia del repositorio: sin decidir.
4. Subir a GitHub los commits que queden solo en local (regla de git del Socio: proponer no es ejecutar).

## Cómo continuar

1. Leer el diseño.
2. Si el Socio ya ha dado el GO, construir la v1 empezando por la verificación en la página real. Si no, pedírselo.
3. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Contexto de origen

La traducción automática nativa de X cubre los posts y no las respuestas. La extensión de la tienda usada hasta ahora (`Automatic TWITTER Translator`) tiene un tope de 50 traducciones al día sin PRO, y por eso se descartó.

## Referencias

- `Noctyn/x-native-translator` (MIT): userscript de referencia. Localiza el botón nativo por su texto («Traducir publicación» entre otros) y el texto del post en `[data-testid="tweetText"]`; trata los 429 con cola de un solo hilo y pausas.
- `cpetschnig/translate-twitter`: evaluado y descartado (véase «Hecho»).
