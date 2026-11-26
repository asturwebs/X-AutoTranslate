# X AutoTranslate

Extensión de Chrome que **traduce al español** por ti en X lo que va entrando en pantalla: las respuestas de un hilo, las citas y cualquier publicación que X no traduce sola.

**Complementa a la traducción nativa de X.** En un hilo, la traducción de X se queda en el post principal: sus respuestas aparecen en su idioma y solo se traducen si entras en ellas. La extensión las traduce donde están, sin entrar en nada.

La última versión está en [Releases](https://github.com/asturwebs/X-AutoTranslate/releases/latest), en un zip listo para cargar en Chrome. El registro de cambios está en [CHANGELOG.md](CHANGELOG.md).

## Por qué

La traducción automática de X se activa por idioma y, en un hilo, se queda en el post principal: las respuestas aparecen en su idioma y **sin ningún enlace de traducir**. Leer un hilo obliga a entrar en cada una. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

## Qué hace

- Según scrolleas, traduce al español cada publicación visible que X dejó sin traducir.
- Si X pone un enlace «Traducir publicación», lo pulsa.
- Si no pone nada (es lo que pasa en las respuestas), le pide a X su traducción, a su propio servicio de traducción y con tu sesión, y la pone en el sitio del original, con la misma letra que el texto de X y una barra «Traducido del inglés · Mostrar original».
- Con «Mostrar original» vuelves al texto de X; con «Mostrar traducción», a la traducción. Lo que devuelves al original no se vuelve a traducir en esa página.
- Va de una en una y con ritmo: una petición cada vez, con un hueco aleatorio de 0,6 a 1,5 s.
- **Va al idioma de tu interfaz de X**: español, si usas X en español. Por eso necesitas tener X en español (en [Instalación](#instalación) está cómo). La extensión está hecha para X en español: su barra y sus botones están solo en español, y de los botones de X reconoce los de X en español y en inglés.

## Tu cuenta, por delante

La extensión habla con X en tu nombre. Para no poner tu cuenta en riesgo:

- **Techo:** 60 traducciones por página y 300 por hora y pestaña. Al llegar, para de pedir y lo dice en consola.
- **Cupo de X:** X limita sus traducciones a **100 por ventana** (de unos 15 minutos, a juzgar por la hora de reinicio que da; medido el 26-nov-2026). Cuando quedan 10 o menos, la extensión deja de pedir hasta que la ventana se reinicia, para no chocar con ese límite. Aviso una sola vez.
- **Pestaña oculta:** con la pestaña oculta (estás en otra) no pide nada hasta que vuelves a ella. Solo cuenta eso: una ventana tapada por otra no la detecta.
- **Si X responde «demasiadas peticiones» (429):** espera lo que X diga y reintenta una sola vez.
- **Si X rechaza las peticiones (401 o 403):** para del todo hasta que recargues la página.
- **Si X falla sin remedio** (no encuentra la publicación, su servicio está caído): la deja en paz tras un reintento y el original se queda como estaba. Tres fallos seguidos, pausa de un minuto; dos pausas seguidas sin ningún éxito, para hasta que recargues.
- Varias pestañas de X abiertas: cada una lleva su cuenta de techo, pero el límite de X cuenta para toda la cuenta, así que se agota antes.

## Seguridad

- **Sin permisos.** El manifiesto no pide ninguno, así que la extensión no tiene acceso a las API de Chrome: ni pestañas, ni historial, ni portapapeles, ni almacenamiento.
- **Habla solo con X.** Hace peticiones a las rutas de traducción de X: su servicio de Grok desde x.com; la misma ruta en `api.x.com` si la primera no existe (una llamada a otro origen, como la que hace el propio cliente de X desde la página); y, como último recurso, el servicio clásico. No hay terceros, no hay dependencias y no guarda nada en disco.
- **Con tu sesión.** Lee la cookie `ct0` de X (su token anti-falsificación de petición; no es `httpOnly`, la lee cualquier script de la página) y hace las peticiones como quien navega. Nunca escribe el valor de una cookie en consola.
- **Lleva escrita la clave pública del cliente web de X** (`CLIENTE_PUBLICO_X` en `content.js`). No es un secreto: va a la vista en el código de x.com y en todos los clientes de código abierto, y solo sirve junto con una sesión. Si X la cambia, responde 401 aunque haya sesión: la extensión para y lo dice en consola.
- **Pinta con `textContent`.** El texto traducido nunca se interpreta como HTML. No hay `innerHTML` ni `eval`.
- **Clics cerrados.** Solo pulsa botones cuyo nombre accesible coincide exactamente con una etiqueta de la lista `ETIQUETAS_TRADUCIR`, solo dentro de un `<article>`, y nunca los suyos propios.
- **La caja es suya.** La barra y el texto traducido son elementos de la extensión, pintados con `content.css`. El original de X no se toca: solo se esconde mientras la caja está delante, y si la caja desaparece, vuelve a verse.

Riesgo que queda: X puede cambiar o limitar su servicio de traducción, o tomar estas peticiones por actividad automática. Por eso el techo, el ritmo y los paros.

## Estado

**v2.0.1.** Probada contra una página que simula a X, con un servicio de traducción falso; su forma de pedir la traducción, comprobada con una sesión real de X el 26-nov-2026; y la 2.0.0, probada entera en la X real: las respuestas de un hilo se traducen al bajar. La 2.0.1 corrige el tamaño y la letra del texto traducido, que salían más pequeños que los de X. Si no traduce, mira [Si no traduce](#si-no-traduce).

## Instalación

Antes de nada, comprueba tres cosas:

- **X en español.** La extensión traduce al idioma en que tengas la interfaz de X. Para ponerla en español, en la web: **Más → Configuración y privacidad → Accesibilidad, visualización e idiomas → Idiomas → Idioma de visualización**. Puede que te pida la contraseña; pulsa **Guardar**. Es la ruta que da [la ayuda de X](https://help.x.com/es/managing-your-account/how-to-change-language-settings).
- **La sesión de X iniciada** en ese navegador: la extensión le pide a X las traducciones con tu sesión.
- **Chrome, en el ordenador.** Es una extensión de Chrome, así que no se puede instalar en la app del móvil. Está probada solo en Chrome.

1. Descarga el zip de la [última versión](https://github.com/asturwebs/X-AutoTranslate/releases/latest) y descomprímelo, o clona el repo.
2. Chrome → `chrome://extensions`.
3. Activa «Modo de desarrollador» (arriba a la derecha).
4. «Cargar descomprimida» y elige la carpeta descomprimida, la que tiene `manifest.json`.
5. Recarga la pestaña de X.

Para quitarla, «Quitar» en esa misma página. Para actualizarla, descomprime el zip de la versión nueva sobre la misma carpeta, pulsa el botón de recargar de la extensión y recarga la pestaña de X: la versión nueva aparece en `chrome://extensions`. Todas las versiones están en [Releases](https://github.com/asturwebs/X-AutoTranslate/releases).

## Si no traduce

1. Abre el hilo que no se traduce.
2. Pulsa F12 y ve a **Console**. Hazlo antes de nada: el diagnóstico sale una sola vez, 5 s después de cargar la página. También vale en la ventana de la web app.
3. Recarga la página.
4. Busca la línea que empieza por `[X AutoTranslate] Página:`. Empieza con **la versión que tienes cargada** (por ejemplo `v2.0.1`): si no es la que esperabas, la extensión no llegó a recargarse. El resto cuenta lo que hay en la página y explica casi todos los casos:
   - `cupo de X en esta ventana`: cuántas peticiones le quedan a tu cuenta en la ventana en curso (unos 15 minutos). Baja y no sube hasta que pasa el rato.
   - `sin enlace permanente` sube y no se traduce nada: X cambió dónde pone el enlace de cada publicación. Abre un issue con esa línea.
   - `ya traducidas por X`: se quedan como están, X las tradujo.
   - `en el idioma de la interfaz`: no hace falta traducirlas.
   - `pedidas` y `traducidas` se quedan en 0 con candidatos en pantalla: mira si hay algún aviso de los de abajo.

   Otros avisos que pueden salir:

   - *No hay sesión de X (falta la cookie ct0)*: no estás conectado a X en esa pestaña.
   - *X rechazó las peticiones de traducción (401 o 403…)*: sesión caducada, cuenta sin acceso al servicio o X cambió su clave pública. Recarga la página para volver a intentar.
   - *X no tradujo la publicación … HTTP 404 … Respondió: …*: X no conoce esa publicación o su servicio cambió; tras «Respondió:» va lo que contestó, en sus primeras 240 letras. Abre un issue con la línea entera.
   - *Tope de … traducciones por página*: recarga la página. *… por hora*: espera un rato.
   - *X está cerca de su límite de traducciones en esta ventana*: se espera al reinicio de la ventana para no pasarse del límite de X.
   - *X no está traduciendo nada: dos pausas seguidas por fallos sin ningún éxito*: su servicio falla para todo. Recarga la página más tarde.
   - *No reconozco estos botones de traducir…*: X usa un texto que no está en la lista. Añádelo a `ETIQUETAS_TRADUCIR` en `content.js` y pulsa el botón de recargar de la extensión.

Si te traduce a **otro idioma**, tu interfaz de X no está en español: la extensión traduce al idioma de tu interfaz de X. En [Instalación](#instalación) está cómo cambiarlo.

## Desarrollo

Las pruebas no necesitan dependencias. Probadas con Node 26 y Chromium 158.

```sh
node test/run.mjs            # todos los escenarios
node test/run.mjs hilo       # solo algunos
XAT_CHROME=/ruta/a/chrome node test/run.mjs
```

Abren un Chromium sin cabeza con un perfil temporal, dirigido por el canal de depuración, sobre una página que simula a X (`test/mock-x.html`), con un servicio de traducción de X falso. No abren ningún puerto de depuración y no tocan tu perfil de navegador. La página se sirve por HTTP en `127.0.0.1`, con puerto aleatorio y solo mientras duran las pruebas, porque las cookies no existen sobre `file://`.

El diseño está en `docs/superpowers/specs/` y el estado del proyecto en `docs/HANDOFF.md`. Cada escenario se comprueba rompiendo el código a propósito: una prueba que no cae en rojo cuando se rompe lo que vigila no vale. Para trabajar en el proyecto, las reglas están en `CLAUDE.md`.

## Crédito

Ideas tomadas de [`llpgf/x-grok-visible-translate`](https://github.com/llpgf/x-grok-visible-translate) y de `Noctyn/x-native-translator` (ambos MIT): observar el botón y no el texto, mirar también `aria-label`, volver a examinar el artículo después de un clic y llamar al servicio de traducción de X. El contrato de ese servicio, de la documentación pública de `dfrnoch/liquidX` y `rien7/twitter-extension-api`, y comprobado después con una sesión real de X.

## Licencia

[MIT](LICENSE). Puedes usarla, cambiarla y compartirla, también dentro de tus propios proyectos. Lo único que pide es conservar el aviso de copyright y el de permiso. Se ofrece tal cual, sin garantía.
