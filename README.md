# X AutoTranslate

Extensión de Chrome que traduce por ti en X lo que va entrando en pantalla: las respuestas de un hilo, las citas y cualquier publicación que X no traduce sola.

## Por qué

X ofrece traducción automática para los posts (se activa por idioma), pero no llega a las respuestas de un hilo: aparecen en su idioma y **sin ningún enlace de traducir**. Solo se traducen al entrar en ellas. Leer un hilo obliga a entrar en cada respuesta. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

## Qué hace

- Según scrolleas, traduce cada publicación visible que X dejó sin traducir.
- Si X pone un enlace «Traducir publicación», lo pulsa.
- Si no pone nada (es lo que pasa en las respuestas), le pide a X su traducción, al mismo servicio que usa ese enlace, y la pone en el sitio del original con una barra «Traducido del inglés · Mostrar original».
- Con «Mostrar original» vuelves al texto de X; con «Mostrar traducción», a la traducción. Lo que devuelves al original no se vuelve a traducir en esa página.
- Va de una en una y con ritmo: una petición cada vez, con un hueco aleatorio de 0,6 a 1,5 s.

## Tu cuenta, por delante

La extensión habla con X en tu nombre. Para no poner tu cuenta en riesgo:

- **Techo:** 60 traducciones por página y 300 por hora y pestaña. Al llegar, para de pedir y lo dice en consola.
- **Pestaña en segundo plano:** no pide nada hasta que vuelves a ella.
- **Si X responde «demasiadas peticiones» (429):** espera lo que X diga y reintenta una sola vez.
- **Si X rechaza las peticiones (401 o 403):** para del todo hasta que recargues la página.
- Si X no encuentra una publicación o falla sin remedio, la deja en paz y el original se queda como estaba.
- Varias pestañas de X abiertas: cada una lleva su cuenta.

## Seguridad

- **Sin permisos.** El manifiesto no pide ninguno, así que la extensión no tiene acceso a las API de Chrome: ni pestañas, ni historial, ni portapapeles, ni almacenamiento.
- **Habla solo con X.** Hace peticiones a dos rutas de traducción de X. No hay terceros, no hay dependencias y no guarda nada en disco.
- **Con tu sesión.** Lee la cookie `ct0` de X (su token anti-falsificación de petición; no es `httpOnly`, la lee cualquier script de la página) y hace las peticiones como quien navega. Nunca escribe el valor de una cookie en consola.
- **Lleva escrita la clave pública del cliente web de X** (`CLIENTE_PUBLICO_X` en `content.js`). No es un secreto: va a la vista en el código de x.com y en todos los clientes de código abierto, y solo sirve junto con una sesión. Si X la cambia, responde 401 aunque haya sesión: la extensión para y lo dice en consola.
- **Pinta con `textContent`.** El texto traducido nunca se interpreta como HTML. No hay `innerHTML` ni `eval`.
- **Clics cerrados.** Solo pulsa botones cuyo nombre accesible coincide exactamente con una etiqueta de la lista `ETIQUETAS_TRADUCIR`, solo dentro de un `<article>`, y nunca los suyos propios.
- **La caja es suya.** La barra y el texto traducido son elementos de la extensión, pintados con `content.css`. El original de X no se toca: solo se esconde mientras la caja está delante, y si la caja desaparece, vuelve a verse.

Riesgo que queda: X puede cambiar o limitar su servicio de traducción, o tomar estas peticiones por actividad automática. Por eso el techo, el ritmo y los paros.

## Estado

**v2.0.0, a punto de estrenarse en la X real.** Probada contra una página que simula a X, con un servicio de traducción falso: ahí todo sale como se espera, pero **el servicio de verdad todavía no está probado con una sesión real**. Si no traduce, mira [Si no traduce](#si-no-traduce).

## Instalación

1. Descarga o clona esta carpeta.
2. Chrome → `chrome://extensions`.
3. Activa «Modo de desarrollador» (arriba a la derecha).
4. «Cargar descomprimida» y elige la carpeta del proyecto, la que tiene `manifest.json`.
5. Recarga la pestaña de X.

Para quitarla, «Quitar» en esa misma página. Para actualizarla tras cambiar el código, el botón de recargar de la extensión y luego recargar la pestaña de X.

## Si no traduce

1. Abre x.com en una pestaña normal, no en la ventana de la web app.
2. Pulsa F12 y ve a **Console**. Hazlo antes de nada: el diagnóstico sale una sola vez, 5 s después de cargar la página.
3. Recarga la página con abierto el hilo que no se traduce.
4. Busca la línea que empieza por `[X AutoTranslate] Página:`. Cuenta lo que hay en la página y explica casi todos los casos:
   - `sin enlace permanente` sube y no se traduce nada: X cambió dónde pone el enlace de cada publicación. Abre un issue con esa línea.
   - `ya traducidas por X`: se quedan como están, X las tradujo.
   - `en el idioma de la interfaz`: no hace falta traducirlas.
   - `pedidas` y `traducidas` se quedan en 0 con candidatos en pantalla: mira si hay algún aviso de los de abajo.

   Otros avisos que pueden salir:

   - *No hay sesión de X (falta la cookie ct0)*: no estás conectado a X en esa pestaña.
   - *X rechazó las peticiones de traducción (401 o 403…)*: sesión caducada, cuenta sin acceso al servicio o X cambió su clave pública. Recarga la página para volver a intentar.
   - *X no tradujo la publicación … HTTP 404 …*: X no conoce esa publicación o su servicio cambió. Abre un issue con la línea entera.
   - *Tope de … traducciones por página*: recarga la página. *… por hora*: espera un rato.
   - *No reconozco estos botones de traducir…*: X usa un texto que no está en la lista. Añádelo a `ETIQUETAS_TRADUCIR` en `content.js` y pulsa el botón de recargar de la extensión.

## Desarrollo

Las pruebas no necesitan dependencias. Probadas con Node 26 y Chromium 158.

```sh
node test/run.mjs            # todos los escenarios
node test/run.mjs hilo       # solo algunos
XAT_CHROME=/ruta/a/chrome node test/run.mjs
```

Abren un Chromium sin cabeza con un perfil temporal, dirigido por el canal de depuración, sobre una página que simula a X (`test/mock-x.html`), con un servicio de traducción de X falso. No abren ningún puerto de depuración y no tocan tu perfil de navegador. La página se sirve por HTTP en `127.0.0.1`, con puerto aleatorio y solo mientras duran las pruebas, porque las cookies no existen sobre `file://`.

El diseño está en `docs/superpowers/specs/` y el estado del proyecto en `docs/HANDOFF.md`.

## Crédito

Ideas tomadas de [`llpgf/x-grok-visible-translate`](https://github.com/llpgf/x-grok-visible-translate) y de `Noctyn/x-native-translator` (ambos MIT): observar el botón y no el texto, mirar también `aria-label`, volver a examinar el artículo después de un clic y llamar al servicio de traducción de X. El contrato de ese servicio, de la documentación pública de `dfrnoch/liquidX` y `rien7/twitter-extension-api`.

## Licencia

Todavía no tiene. Hasta que la tenga, el código es de su autor y no se puede reutilizar.
