# X AutoTranslate

Extensión de Chrome que pulsa por ti el botón **«Traducir publicación»** de X en cuanto entra en pantalla.

## Por qué

X ofrece traducción automática para los posts (se activa por idioma), pero no llega a las respuestas de un hilo: las traduce algunas y la mayoría no. Leer un hilo obliga a entrar en cada respuesta y pulsar el botón. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

X AutoTranslate no traduce nada por su cuenta, usa la traducción de X. Por eso no necesita claves, servicios de terceros ni código de terceros, y no tiene tope diario.

## Qué hace

- Según scrolleas, pulsa «Traducir publicación» en las publicaciones que entran en pantalla y X dejó sin traducir: respuestas, citas y cualquier post que muestre el botón.
- Va de uno en uno, con un hueco aleatorio de 0,6 a 1,5 s entre clics, y no acumula peticiones mientras X tarda en responder, para no chocar con el límite de peticiones de X ni ir a golpe fijo.
- Si X no responde a un clic, lo reintenta una vez; después deja esa publicación en paz.
- No tiene interfaz: X muestra la traducción y su enlace «Mostrar original», igual que al pulsar a mano. Si pulsas «Mostrar original», esa publicación no se vuelve a traducir mientras sigas en esa página.

## Estado

**v1.0.0, sin estrenar en la X real.** Está probada contra una página que simula a X (16 escenarios) y todavía no en la página de verdad. Si no traduce, mira [Si no traduce](#si-no-traduce).

## Instalación

1. Descarga o clona esta carpeta.
2. Chrome → `chrome://extensions`.
3. Activa «Modo de desarrollador» (arriba a la derecha).
4. «Cargar descomprimida» y elige la carpeta del proyecto, la que tiene `manifest.json`.
5. Recarga la pestaña de X.

Para quitarla, «Quitar» en esa misma página.

## Seguridad

- **Sin permisos.** El manifiesto no pide ninguno, así que la extensión no tiene acceso a las API de Chrome: ni pestañas, ni historial, ni portapapeles, ni almacenamiento.
- **Sin red y sin almacenamiento.** El código no contiene ninguna llamada de red ni de almacenamiento. La única petición que sale es la que hace X al traducir.
- **Sin dependencias ni código de terceros.**
- **Corre dentro de la página de X.** Como cualquier content script, lo que ve es la página que tú ya estás viendo, con tu sesión. Este código solo lee la etiqueta de los botones y no modifica la página.
- **Clics cerrados.** Solo pulsa botones cuyo nombre accesible coincide exactamente con una etiqueta de la lista `ETIQUETAS_TRADUCIR` de `content.js`, y solo dentro de un `<article>`. El nombre accesible es su `aria-label`; si no tiene, su texto. Un botón con el texto correcto pero otro `aria-label` no se pulsa.

## Si no traduce

1. Abre x.com en una pestaña normal, no en la ventana de la web app.
2. Pulsa F12 y ve a **Console**. Hazlo antes de nada: el aviso sale una sola vez, 5 s después de cargar la página.
3. Recarga la página con abierto el hilo que no se traduce.
4. Busca un aviso que empieza por `[X AutoTranslate]`.

Si dice *No reconozco estos botones de traducir…*, X usa un texto que no está en la lista: añádelo a `ETIQUETAS_TRADUCIR` en `content.js` y pulsa el botón de recargar de la extensión.

Si no hay aviso y tampoco traduce, abre un issue con el texto exacto del botón de traducir (clic derecho sobre él → Inspeccionar) y el idioma de tu interfaz de X.

## Desarrollo

Las pruebas no necesitan dependencias. Probadas con Node 26 y Chromium 158.

```sh
node test/run.mjs            # todos los escenarios
node test/run.mjs visible    # solo algunos
XAT_CHROME=/ruta/a/chrome node test/run.mjs
```

Abren un Chromium sin cabeza con un perfil temporal, dirigido por el canal de depuración, sobre una página que simula a X (`test/mock-x.html`). No abren ningún puerto y no tocan tu perfil de navegador.

## Crédito

Tres ideas tomadas de [`llpgf/x-grok-visible-translate`](https://github.com/llpgf/x-grok-visible-translate) (MIT): observar el botón y no el texto, mirar también `aria-label` y volver a examinar el artículo después de un clic.

## Licencia

Todavía no tiene. Hasta que la tenga, el código es de su autor y no se puede reutilizar.
