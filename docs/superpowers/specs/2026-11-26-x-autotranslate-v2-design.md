# Diseño — X AutoTranslate v2: pedir la traducción a X

**Estado:** revisado el 2026-11-26 por dos revisores de otros motores (MiMo v2.6-pro y DeepSeek flash) y corregido con sus hallazgos; el Socio ratificó las correcciones y los topes. Extiende y corrige el [diseño de la v1](2026-11-26-x-autotranslate-design.md): lo que aquí no cambia sigue valiendo. Lo que nadie ha probado todavía va marcado **por verificar** y es lo que comprueba la sonda, antes de construir el resto.

## Por qué cambia

La v1 daba por hecho que X pone un enlace «Traducir publicación» bajo cada respuesta sin traducir. No es así. En la X real del Socio (captura del 26-nov, 17:30):

- el post principal de un hilo lo traduce X solo («Traducido del inglés · Mostrar original»);
- las respuestas de debajo aparecen en su idioma **y sin ningún enlace**;
- solo se traducen al entrar en ellas.

La extensión estaba cargada y activa, pero no tenía nada que pulsar.

## Qué hace la v2

Según scrolleas, para cada publicación visible que X no ha traducido y que no lleva enlace:

1. identifica la publicación por su enlace permanente;
2. le pide a X su traducción, con la sesión de quien navega, al mismo servicio que usa el botón;
3. pone la traducción en el sitio del original, con una barra «Traducido del inglés · Mostrar original» parecida a la de X.

Si X sí pone el enlace, se pulsa como en la v1.

## Objetivos

- Respuestas, citas y posts sin traducir se ven en español según entren en pantalla, sin entrar en ellos.
- El mismo aspecto que la traducción de X: texto traducido en lugar del original y vuelta atrás a un clic. Se degrada en una cosa: dentro del texto traducido, enlaces, hashtags y menciones aparecen como texto plano.
- Un solo trabajo a la vez y con ritmo, también con el servicio de X.
- **La cuenta del Socio por encima de la traducción:** la extensión tiene techo y para.

## No objetivos

- Traducir lo que X ya tradujo (lleva su barra «Traducido de…»).
- Traducir lo que ya está en el idioma de la interfaz.
- Traducir publicaciones sin enlace permanente (no hay forma de pedirlas).
- Interfaz, ajustes o atajos.
- Coordinar varias pestañas de X: cada una lleva su cuenta (decisión del Socio).

## Anti-objetivos: sería un fallo aunque «funcione»

- **Poner la cuenta en riesgo.** Peticiones sin techo, cadencia fija o insistir tras un rechazo.
- **Pulsar algo que no es el botón de traducir de X.** Tampoco la interfaz de la propia extensión.
- **Poner una traducción bajo otra publicación.** Cada traducción solo se pinta en el bloque del que salió su identificador.
- **Dejar una publicación en blanco.** El original solo se esconde mientras nuestra caja está delante.
- **Pedir dos veces la misma publicación.** Se guarda lo que X ya contestó mientras la pestaña siga abierta.
- **Fallar en silencio.** Lo que no se pudo hacer se cuenta en consola.

## Seguridad

- El manifiesto sigue sin permisos. No puede leer pestañas, historial, portapapeles ni almacenamiento de Chrome.
- **Cambio respecto a la v1:** la extensión lee la cookie `ct0` de X (su token anti-falsificación de petición; no es `httpOnly`, la lee cualquier script de la página) y hace peticiones a X en nombre de quien navega. Solo a las rutas de traducción de X. No envía nada a nadie más y no guarda nada en disco. Nunca escribe el valor de una cookie en consola.
- Lleva escrita la clave pública del cliente web de X (`authorization`). No es un secreto: va a la vista en el código de x.com y en todos los clientes de código abierto, y solo sirve junto con una sesión. **Procedencia:** la constante `AAAAAAAA…` que publican `Noctyn/x-native-translator`, `llpgf/x-grok-visible-translate` y la documentación de `rien7/twitter-extension-api`. Si X la cambia, responde 401 aunque haya sesión: la extensión para y avisa en consola que hay que actualizar `CLIENTE_PUBLICO_X`.
- El texto traducido se pinta con `textContent`. No hay `innerHTML` ni `eval`.
- Los estilos van en `content.css`, inyectado por el manifiesto; no dependen de la política de contenido de la página.
- Riesgo que queda: X puede cambiar o limitar ese servicio, o contar estas peticiones como actividad automática. Por eso el techo, el ritmo y los paros.

## Cómo se pide a X

1. **Servicio de Grok.** `POST /i/api/2/grok/translation.json` (mismo origen). Si responde 404, la misma ruta en `https://api.x.com`: es una llamada a otro origen desde la página de x.com, como la que hace el propio cliente de X; si el navegador o X la bloquean, cuenta como fallo y se pasa al punto 2. **Por verificar.**
   - Cuerpo: `{"content_type":"POST","id":"<identificador>","dst_lang":"<idioma de la interfaz>"}`.
   - Cabeceras: `authorization: Bearer <clave pública>`, `x-csrf-token: <cookie ct0>`, `x-twitter-auth-type: OAuth2Session`, `x-twitter-active-user: yes`, `x-twitter-client-language: <idioma de la interfaz>`, `content-type: text/plain;charset=UTF-8`.
   - **No** se envía `x-client-transaction-id`: la generan algoritmos internos de X y los dos userscripts de referencia no la llevan. **Por verificar** que X no la exija; si la exige, la sonda lo destapa.
   - Respuesta: en trozos, uno por línea, `{"result":{"content_type":"POST","text":"…","entities":{…}}}`. Se concatenan los `text`. Una línea `{"error":{"code":…,"message":…}}` es un fallo.
2. **Servicio clásico.** `GET /i/api/1.1/strato/column/None/tweetId=<id>,destinationLanguage=Some(<idioma>),translationSource=Some(X),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`, con las mismas cabeceras de sesión y sin `content-type`.
   - Respuesta: JSON `{"translation":"…","sourceLanguage":"en","destinationLanguage":"es","localizedSourceLanguage":"…"}`. Si el estado no es 200, `{"errors":[{"code":…,"message":"…"}]}`. **Por verificar.**
   - Se prueba cuando el punto 1 falla por 404, 400, 401, 403, error de servidor, red, timeout o respuesta vacía. No cuando responde 429.

Fuente de este contrato: la documentación pública de `dfrnoch/liquidX` (leída del paquete del cliente de X el 13-nov-2026) y de `rien7/twitter-extension-api`, y el código de `Noctyn/x-native-translator` y `llpgf/x-grok-visible-translate` (ambos MIT). **Ninguna de las rutas se ha probado con la sesión del Socio.**

## Techo y paro

Ratificados por el Socio el 26-nov-2026:

- **Por página:** 60 publicaciones pedidas desde que se cargó la página. Al llegar no se pide ninguna más hasta que se recargue. Aviso una sola vez.
- **Por hora y pestaña:** 300 publicaciones pedidas en los últimos 60 minutos. Al llegar se espera a que se libere la ventana. Aviso una sola vez.
- **Pestaña oculta:** con la pestaña en segundo plano no se pide nada; al volver, sigue.
- **Rechazo de permiso:** si todas las rutas responden 401 o 403 para una publicación, no se pide nada más hasta recargar la página. Aviso con la causa probable.
- Cada cuenta («pedida») empieza con la primera petición de una publicación, y los reintentos no cuentan doble.

## Decisiones

1. **Unidad e identidad.** La unidad es cada bloque de texto de publicación (`[data-testid="tweetText"]`) dentro de un `<article>`. Una cita dentro de un post es otra unidad.
   - *Caja de cita:* el ancestro con `role="link"` más cercano, dentro del artículo, sin contar el artículo.
   - *Identificador de una cita:* el primer enlace `…/status/<números>` **dentro de su propia caja de cita** (normalmente el que envuelve la `time`). Si la caja no tiene ninguno, la cita no tiene identificador y no se pide. Nunca se usa el del post que la contiene.
   - *Identificador de un post:* el enlace `…/status/<números>` con una `time` que no esté dentro de ninguna caja de cita; si no lo hay, el primer enlace de estado fuera de las cajas de cita. Si no lo hay, no se pide.
   - Si dos bloques del mismo artículo resuelven al mismo identificador, solo se trata el primero.
2. **Idioma.** El de la publicación es el atributo `lang` de su bloque; si falta o es uno de los códigos de X para «sin idioma» (`und`, `zxx`, `qam`, `qct`, `qht`, `qme`, `qst`), no se toca. El de la interfaz es el idioma base de la cookie `lang` de X; si no existe, el de `<html lang>`; y si no, `es`.
3. **Ya traducido por X.** Hay un control «Mostrar original» que no es nuestro, que no está dentro de un bloque de texto y que en el artículo viene después del bloque anterior y antes de este. Ese bloque no se toca.
4. **Con enlace de X.** Si en el artículo hay un botón «Traducir publicación» fuera de nuestra interfaz, el artículo entero va por el camino del clic de la v1 y no se pide nada.
5. **Nuestra interfaz fuera del escaneo.** Todo lo que cuelga de `.xat-caja` se ignora al buscar botones, al observar la visibilidad, al comprobar justo antes de pulsar, en el listener de «Mostrar original» de X y en el diagnóstico.
6. **Disparo.** El bloque lleva 300 ms en pantalla, sigue ahí y la pestaña está visible.
7. **Ritmo.** Una petición cada vez. No empieza la siguiente hasta que la anterior termina (20 s como mucho) y pasa un hueco sorteado de 600 a 1500 ms, contado desde el final de la petición. En el camino del clic, el hueco se cuenta desde el clic.
8. **Fallo de X.**
   - **429:** pausa hasta la fecha que diga X y un solo reintento. `retry-after` se lee como segundos si son solo dígitos y como fecha HTTP si trae letras; si no viene, 60 s; nunca más de 15 min.
   - **401 o 403 en Grok:** se prueba el servicio clásico. Si también es 401 o 403, se aplica el paro por rechazo de permiso.
   - **404 u otro 4xx en todas las rutas:** esa publicación se deja en paz.
   - **Error de servidor, red, timeout, respuesta vacía o respuesta que no es una traducción:** un reintento a los 10 s; después se deja en paz.
   - **Tres intentos fallidos seguidos:** pausa de 60 s. Un intento cuenta como fallido cuando todas sus rutas fallan; los 429 también cuentan.
9. **Memoria.** Lo que X contesta se guarda por identificador mientras la pestaña viva, hasta 500 publicaciones; se expulsa la más antigua. Si X redibuja un post, se vuelve a poner sin pedirla otra vez.
10. **Vuelta atrás.** Nuestro «Mostrar original» enseña el original y deja un «Mostrar traducción», que vuelve a pintar la que ya se tenía sin pedirla. Una publicación devuelta al original **no se vuelve a pedir ni a pintar** en esa página, aunque X la redibuje. Se recuerda por publicación, no por artículo: devolver el post al original no afecta a su cita.
11. **Caja e invariante.** Nuestra caja es un hermano del bloque de texto y lleva `data-xat-id` con el identificador.
    - La marca `data-xat="traducido"`, que esconde el original, **solo se pone después de insertar la caja**. Si insertar falla, no se pone.
    - Si la caja desaparece del documento y el bloque sigue marcado, se le quita la marca. Un bloque oculto sin caja delante no puede existir.
    - La vista «original» le quita la marca al bloque y deja la caja en modo compacto.
12. **Nodos reutilizados.** Si X reutiliza un bloque para otra publicación (el identificador cambia), se quita la marca y la caja y se trata la nueva.
13. **Rótulo.** «Traducido del <idioma>», con el nombre del idioma del bloque en español (`Intl.DisplayNames`). Si el nombre empieza por «lengua» o «idioma», «Traducido de». Si no hay nombre, «Traducido».
14. **Diagnóstico.** En consola: una línea `warn` por intento fallido (estado o tipo de fallo, rutas probadas, tiempo y 120 caracteres como mucho de la respuesta) y, a los 5 s, una línea `info` con el resumen de la página: bloques vistos · ya traducidos por X · en el idioma de la interfaz · sin idioma · sin enlace permanente · pedidos · traducidos · fallidos · en espera. Si falta la cookie `ct0`, un `warn`: no hay sesión y no se puede pedir nada.

## La sonda (Tarea 0, antes de construir el resto)

Modo de diagnóstico temporal de la misma extensión, para aprender el contrato y el DOM reales con una sola prueba del Socio:

- **No toca la página:** no pinta, no esconde y no pide traducciones. El camino del clic de la v1 sigue activo.
- A los 5 s escribe **un único mensaje** en consola que empieza por `[X AutoTranslate SONDA]` con: si la cookie `lang` y la cookie `ct0` existen (sí o no, nunca el valor), el idioma de la interfaz, la ruta de la página y, de los tres primeros bloques candidatos: idioma, identificador y por qué regla, si está dentro de una caja de cita y un trozo del elemento anterior.
- Después hace **una petición por ruta** (Grok mismo origen, Grok en `api.x.com`, clásica) para el primer candidato con identificador, y añade al mensaje: estado, tiempo, tipo de respuesta, cabeceras de límite si vienen y 300 caracteres como mucho del cuerpo.

Con lo que salga se fijan las reglas 1, 3 y la sección «Cómo se pide a X» antes de escribir el resto.

## Por verificar en la X real

1. Que alguna de las rutas responde con la sesión del Socio, y cuál; y si X exige `x-client-transaction-id`.
2. Que el bloque de texto lleva `lang`, y dónde está el enlace permanente de una respuesta y de una cita.
3. Que la barra de X traducido está delante del texto, como en la captura.
4. Que la llamada a `api.x.com` pasa desde el navegador.
5. El aspecto de la barra propia junto a la de X, en tema oscuro y claro.
6. Qué ritmo y qué volumen tolera X antes de responder 429.
