# Diseño — X AutoTranslate

**Estado:** v1 ejecutada el 2026-11-26 y revisada por un revisor independiente. Sin estrenar en la X real. Tras esa revisión cambiaron la regla de la etiqueta y las decisiones 4 y 5.
**Tamaño:** cambio pequeño. Previsto: dos ficheros, `manifest.json` y `content.js`, del orden de doscientas líneas, más su bancada de pruebas.

## Qué es y por qué

Extensión de Chrome que pulsa por ti el botón **«Traducir publicación»** de X en cuanto entra en pantalla.

X ofrece traducción automática para los posts (se activa por idioma), pero no llega a las respuestas de un hilo: las traduce algunas y la mayoría no. Leer un hilo obliga a entrar en cada respuesta y pulsar el botón. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

Pulsar el botón de X reutiliza su propia traducción: no hay claves, ni servicios de terceros, ni código de terceros, ni tope.

## Objetivos

- Según se scrollea, se van traduciendo las publicaciones que X deja sin traducir: respuestas, citas y cualquier post que muestre el botón.
- Sin acción del usuario, también al refrescar, al hacer scroll y al cambiar de hilo.
- El resultado se ve como si se hubiera pulsado a mano: traducción en lugar del original y enlace «Mostrar original».

## No objetivos

- Traducir por cuenta propia (ni Google ni ninguna otra API).
- Interfaz, opciones o atajos (en la v1).
- Biografías, tarjetas flotantes, mensajes directos ni nada que no lleve el botón.
- Publicar en la Chrome Web Store (en la v1 se carga desempaquetada).

## Anti-objetivos: sería un fallo aunque «funcione»

- **Un clic en otro sitio.** Un clic equivocado en X puede ser un «me gusta» o un repost público. Solo se pulsa algo cuya etiqueta esté en la lista exacta.
- **Una ráfaga de peticiones.** X pone límite de peticiones a su traducción y responde 429 (varios proyectos de 2026 llevan pausa para eso). Un hilo largo traducido de golpe puede acabar en error o en una marca de automatismo sobre la cuenta. De ahí la cola y el ritmo.
- **Quedarse sin el original.** Siempre tiene que quedar la vuelta atrás de X, y si quien navega pulsa «Mostrar original», esa publicación no se vuelve a traducir.
- **Consumir CPU al hacer scroll.** X redibuja el feed sin parar; el observador tiene que ser barato.

## Restricciones

- Google Chrome, extensiones Manifest V3, sin permisos: solo un *content script* en `https://x.com/*`.
- El botón de X **no tiene un `data-testid` estable**: cuatro proyectos independientes de 2026 lo buscan en código público y ninguno lo encuentra; todos lo localizan por su etiqueta. Aquí se localiza por su nombre accesible exacto («Traducir publicación», «Mostrar traducción» y sus equivalentes en inglés): el `aria-label` si lo tiene y, si no, el texto visible. Si el `aria-label` es otro, no se pulsa aunque el texto coincida; el diagnóstico lo avisa. Si X cambia el texto o se usa la interfaz en otro idioma, se añade a la lista.
- No se usa detección por posición junto al texto del post (la usa uno de los proyectos): en un cambio de diseño de X podría señalar a otro control.
- Pulsar el botón hace que X redibuje el artículo entero. Hay que volver a examinarlo después de cada clic, o la cita de un post se queda sin traducir.
- No se puede medir desde fuera. La etiqueta exacta, la tolerancia de X y el comportamiento en la ventana de la web app se comprueban en la página real.

## Lo que se toma de la extensión de la tienda

`Automatic TWITTER Translator` (v1.2.20) hace el mismo trabajo traduciendo por su cuenta. De ella se toman ideas, no código: es software propietario, distribuido minificado y sin licencia de reutilización en el paquete.

- **Selectores, ya en uso en una extensión que se mantiene:** `article` como unidad de publicación y `div[data-testid='tweetText']` para el texto.
- **La traducción vive dentro del bloque del post**, no en un panel aparte. Aquí lo hace X al responder al clic.
- **Qué no copiar:** sondea la página con `setInterval` y envía a traducir todo lo que hay en el DOM, esté o no en pantalla. Cuando X redibuja, el nodo es nuevo y lo vuelve a pedir, y su contador diario también suma esas repeticiones. Así se agota una cuota de 50. Por eso aquí solo se traduce lo que entra en pantalla y nada se pide dos veces.
- No usa el botón nativo de X. Aquí ese botón es toda la mecánica.

## Enfoques considerados

| | Qué es | A cambio |
|---|---|---|
| **A. Extensión propia que pulsa el botón de X** (elegido) | Un *content script* que detecta el botón y lo pulsa | Depende del HTML y del texto de X; solo traduce donde X muestra el botón |
| B. Adaptar `Noctyn/x-native-translator` (MIT) | Userscript con auto-traducción, cola y pausa ante 429 | Interfaz en chino, más de mil líneas, exige un gestor de scripts y llama a la API de X con la sesión |
| C. Extensión que traduce por su cuenta | Llamar a Google o a otra API desde la extensión | API no oficial, más código, el texto sale a un tercero y la calidad no coincide con la de los posts |
| D. Adaptar `llpgf/x-grok-visible-translate` (MIT) | Userscript de 339 líneas: solo lo visible, y primero el botón nativo | Exige un gestor de scripts, no conoce etiquetas en español y, si no encuentra el botón, llama a la API de X con las cabeceras de la sesión |

Se elige A porque cubre la necesidad con el mínimo código y sin terceros. De D se toman tres ideas, con crédito en el código y en el README: observar el botón y no el texto, mirar también `aria-label`, y volver a examinar el artículo después de un clic.

También evaluado y descartado: `amahteru/x-auto-translate` (MIT), extensión de Chrome que traduce por su cuenta, sin español entre sus idiomas y sin control de ritmo; y `cpetschnig/translate-twitter`, aplicación de servidor (Ruby on Rails, 2010-2013, archivada) que copia los tweets de una cuenta, los traduce y los publica desde otra cuenta.

## Decisiones

1. **Mecanismo:** clic programático en el botón nativo. Sin llamadas a la API. Tres proyectos de 2026 lo hacen con `element.click()` y les funciona.
2. **Alcance:** todo lo que esté dentro de un `<article>` (timeline, hilos y citas). Fuera: diálogos (el compositor) y tarjetas flotantes.
3. **Disparo:** el botón entra en pantalla y se queda unos 300 ms. Lo que se cruza al vuelo no se traduce.
4. **Ritmo:** cola global, de arriba a abajo, de uno en uno. Después de cada clic se sortea un hueco de 600 a 1500 ms. Además no se pulsa el siguiente hasta que X responde al anterior (el botón deja de ser de traducir) o pasan 1,5 s. El hueco no depende de la respuesta de X: si X quita el control de inmediato, no hay cadencia fija ni se acumulan peticiones.
5. **Fallo:** si un botón sigue ahí 5 s después del clic, se reintenta una vez a los 10 s; si sigue, se deja en paz esa publicación. Tres fallos seguidos pausan la cola 60 s. El plazo de fallo lleva su propio temporizador: se cumple aunque la página esté quieta.
6. **Redibujados:** X reutiliza y recrea nodos. Un botón nuevo se pulsa aunque la publicación ya estuviera traducida antes (X vuelve a servir la traducción). Un mismo botón nunca se pulsa dos veces sin haber fallado.
7. **Vuelta atrás:** si quien navega pulsa «Mostrar original», esa publicación no se vuelve a traducir mientras la página no cambie.
8. **Sin estado:** nada de `storage`, ni servicio en segundo plano, ni caché.
9. **Diagnóstico:** si a los 5 s hay botones que parecen de traducir y no están en la lista, la extensión no los toca y avisa una vez en la consola con las etiquetas vistas, para añadirlas.
10. **Tiempos ajustables para las pruebas:** todos los tiempos viven en un solo objeto que la bancada de pruebas acorta. En X real nadie los toca.

## Lo que queda por verificar en la página real (primer día de uso)

1. Etiqueta exacta del botón en la interfaz de X en español de España.
2. Que `button.click()` dispara la traducción en su cuenta.
3. Qué muestra X cuando una traducción falla o responde 429, y qué ritmo tolera.
4. Que la extensión carga y funciona en la ventana `--app` de la web app.
5. Qué hace X con el control de traducir al recibir el clic: si desaparece enseguida y, sobre todo, si también desaparece cuando falla. En ese caso no hay forma de detectar el fallo, y no habrá reintento ni pausa.
6. Si el control es un conmutador (pulsarlo otra vez devuelve el original): entonces un reintento desharía la traducción.

## Abierto

- **Licencia del repositorio.** Al escribir este diseño no tenía: era decisión del autor. Resuelto el 26-nov-2026 por la noche: **MIT** (`LICENSE` en la raíz).
