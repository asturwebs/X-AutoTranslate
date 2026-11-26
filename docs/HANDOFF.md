# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 14:1x (sesión BytIA)

## Estado

🟡 **En diseño.** Repositorio creado hoy a petición del Socio. Sin código todavía.

- `README.md` — qué es y por qué.
- `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md` — diseño corto, **pendiente de aprobación**.

## Hecho

- **2026-11-26 14:1x** — creados el workspace (`~/Projects/X-AutoTranslate`) y el repositorio público (`asturwebs/X-AutoTranslate`), solo con documentación de arranque.
- **2026-11-26 14:1x** — evaluado y descartado `cpetschnig/translate-twitter`, propuesto por el Socio: es una aplicación de servidor (Ruby on Rails, 2010-2013, archivada) que copia los tweets de una cuenta, los traduce y los publica desde otra cuenta. No es una extensión y no actúa sobre la X que se lee. El Socio coincidió en descartarlo.

## Pendientes

1. Aprobación del diseño por el Socio.
2. Construir la v1 (`manifest.json` + `content.js`) y verificarla en la página real:
   - texto exacto del botón «Traducir publicación» y si tiene `data-testid` utilizable;
   - que `button.click()` dispara la traducción;
   - qué muestra X ante un fallo o un 429, y qué ritmo tolera;
   - que funciona en la ventana `--app` de la web app.
3. Licencia del repositorio: sin decidir.

## Cómo continuar

1. Leer el diseño.
2. Si el Socio ya ha dado el GO, construir la v1 empezando por la verificación en la página real. Si no, pedírselo.
3. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Contexto de origen

La traducción automática nativa de X cubre los posts y no las respuestas. La extensión de la tienda usada hasta ahora (`Automatic TWITTER Translator`) tiene un tope de 50 traducciones al día sin PRO, y por eso se descartó.

## Referencias

- `Noctyn/x-native-translator` (MIT): userscript de referencia. Localiza el botón nativo por su texto («Traducir publicación» entre otros) y el texto del post en `[data-testid="tweetText"]`; trata los 429 con cola de un solo hilo y pausas.
