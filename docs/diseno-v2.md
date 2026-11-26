# Diseño — X AutoTranslate v2: pedir la traducción a X

**Estado:** revisado el 2026-11-26 por dos revisores de otros motores (MiMo v2.6-pro y DeepSeek flash) y corregido con sus hallazgos; el mantenedor ratificó las correcciones y los topes. Extiende y corrige el [diseño de la v1](diseno-v1.md): lo que aquí no cambia sigue valiendo. Lo que nadie había probado iba marcado **por verificar** y lo comprobó la sonda en la X real el 26-nov-2026: cada punto dice ya si está comprobado o qué falta, y el resultado está en «La sonda».

## Por qué cambia

La v1 daba por hecho que X pone un enlace «Traducir publicación» bajo cada respuesta sin traducir. No es así. En la X real (26-nov-2026, 17:30):

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
- **La cuenta de quien navega por encima de la traducción:** la extensión tiene techo y para.

## No objetivos

- Traducir lo que X ya tradujo (lleva su barra «Traducido de…»).
- Traducir lo que ya está en el idioma de la interfaz.
- Traducir publicaciones sin enlace permanente (no hay forma de pedirlas).
- Interfaz, ajustes o atajos.
- Coordinar varias pestañas de X: cada una lleva su cuenta (decisión del mantenedor).

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

1. **Servicio de Grok.** `POST /i/api/2/grok/translation.json` (mismo origen). Si responde 404, la misma ruta en `https://api.x.com`: es una llamada a otro origen desde la página de x.com, como la que hace el propio cliente de X; si el navegador o X la bloquean, cuenta como fallo y se pasa al punto 2. **Comprobado en la X real (sonda del 26-nov-2026):** responde 200 con la traducción.
   - Cuerpo: `{"content_type":"POST","id":"<identificador>","dst_lang":"<idioma de la interfaz>"}`.
   - Cabeceras: `authorization: Bearer <clave pública>`, `x-csrf-token: <cookie ct0>`, `x-twitter-auth-type: OAuth2Session`, `x-twitter-active-user: yes`, `x-twitter-client-language: <idioma de la interfaz>`, `content-type: text/plain;charset=UTF-8`.
   - **No** se envía `x-client-transaction-id`: la generan algoritmos internos de X y los dos userscripts de referencia no la llevan. **Comprobado:** X no la exige; las tres rutas respondieron 200 sin ella.
   - Respuesta: en trozos, un objeto JSON cada uno, `{"result":{"content_type":"POST","text":"…","entities":{…}}}`. Se concatenan los `text`. **La sonda no dejó ver si X separa los trozos con saltos de línea o con espacios** (los imprimió juntos), así que el lector acepta las dos cosas. Un objeto `{"error":{"code":…,"message":…}}`, o un 200 sin texto, es un fallo; el aviso enseña lo que contestó.
2. **Servicio clásico.** `GET /i/api/1.1/strato/column/None/tweetId=<id>,destinationLanguage=Some(<idioma>),translationSource=Some(X),feature=None,timeout=None,onlyCached=None/translation/service/translateTweet`, con las mismas cabeceras de sesión y sin `content-type`.
   - Respuesta según la documentación: JSON `{"translation":"…","sourceLanguage":"en","destinationLanguage":"es","localizedSourceLanguage":"…"}`. Si el estado no es 200, `{"errors":[{"code":…,"message":"…"}]}`.
   - **Comprobado en la X real (sonda del 26-nov-2026):** responde 200, pero con `{"translation":"","translationState":"NotCached","destinationLanguage":""}` para una publicación que Grok sí tradujo. Hoy solo parece servir traducciones que ya tuviera guardadas. Se mantiene como último recurso porque no puede devolver una traducción falsa: una traducción vacía cuenta como fallo.
   - Se prueba cuando el punto 1 falla por 404, 400, 401, 403, error de servidor, red, timeout o respuesta vacía. No cuando responde 429.

Fuente de este contrato: la documentación pública de `dfrnoch/liquidX` (leída del paquete del cliente de X el 13-nov-2026) y de `rien7/twitter-extension-api`, y el código de `Noctyn/x-native-translator` y `llpgf/x-grok-visible-translate` (ambos MIT). Las tres rutas se probaron en la X real el 26-nov-2026 con la sonda; el resultado está en cada punto y en «La sonda».

## Techo y paro

Ratificados por el mantenedor el 26-nov-2026:

- **Por página:** 60 publicaciones pedidas desde que se cargó la página. Al llegar no se pide ninguna más hasta que se recargue. Aviso una sola vez.
- **Por hora y pestaña:** 300 publicaciones pedidas en los últimos 60 minutos. Al llegar se espera a que se libere la ventana. Aviso una sola vez.
- **Pestaña oculta:** con la pestaña en segundo plano no se pide nada; al volver, sigue. Solo cuenta la pestaña oculta (`document.hidden`): una ventana tapada por otra no se detecta.
- **Rechazo de permiso:** si todas las rutas responden 401 o 403 para una publicación, no se pide nada más hasta recargar la página. Aviso con la causa probable.
- Cada cuenta («pedida») empieza con la primera petición de una publicación, y los reintentos no cuentan doble.
- **Cupo de X** (añadido tras la sonda, sin tocar los topes de arriba): X cuenta sus traducciones por ventanas y lo dice en las cabeceras `x-rate-limit-remaining` y `x-rate-limit-reset`: 100 peticiones por ventana en Grok y 187 en el clásico (la ventana parece de 15 minutos, a juzgar por la hora de reinicio que dio; es una deducción, no una medida). Cuando una respuesta deja 10 o menos, no se pide nada hasta el reinicio de la ventana, con un segundo de margen: es prudencia, porque ese contador puede que no sea solo de la extensión (otras pestañas, la propia X). Si las cabeceras no vienen, no se reserva nada y manda el tratamiento del 429. Aviso una sola vez.
- **Disyuntor:** dos pausas seguidas por fallos sin ningún éxito entre ellas significan que X no traduce nada. No se pide más hasta recargar la página. Aviso con la causa.

## Decisiones

1. **Unidad e identidad.** La unidad es cada bloque de texto de publicación (`[data-testid="tweetText"]`) dentro de un `<article>`. Una cita dentro de un post es otra unidad.
   - *Caja de cita:* el ancestro más cercano, dentro del artículo, que no contiene al post. No hace falta que lleve `role="link"` (corregido en la revisión del código: la regla anterior dependía de ese atributo y, sin él, una cita heredaba el identificador del post).
   - *Identificador de una cita:* el primer enlace `…/status/<números>` con una `time` **dentro de su propia caja de cita**. Si la caja no tiene ninguno, la cita no tiene identificador y no se pide. Nunca se usa el del post que la contiene.
   - *Identificador de un post:* el enlace `…/status/<números>` con una `time` que no esté dentro de ninguna caja de cita. Si no lo hay, no se pide: no hay relevo al primer enlace de estado (corregido en la revisión del código, por la misma razón).
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
   - **Tope de tiempo:** 20 s para todas las rutas de una publicación juntas, no para cada ruta.
   - **Un solo intento a la vez por publicación, y la que sale de pantalla no se pierde:** si a una publicación le llega el turno estando fuera de pantalla, su tarea se suelta y vuelve a empezar cuando reaparece. Lo que está aparcado por el techo o por un paro se queda en la cola sin estorbar a los clics del camino de la v1.
9. **Memoria.** Lo que X contesta se guarda por identificador mientras la pestaña viva, hasta 500 publicaciones; se expulsa la más antigua. Si X redibuja un post, se vuelve a poner sin pedirla otra vez.
10. **Vuelta atrás.** Nuestro «Mostrar original» enseña el original y deja un «Mostrar traducción», que vuelve a pintar la que ya se tenía sin pedirla. Una publicación devuelta al original **no se vuelve a pedir ni a pintar** en esa página, aunque X la redibuje. Se recuerda por publicación, no por artículo: devolver el post al original no afecta a su cita.
11. **Caja e invariante.** Nuestra caja es un hermano del bloque de texto y lleva `data-xat-id` con el identificador.
    - La marca `data-xat="traducido"`, que esconde el original, **solo se pone después de insertar la caja**. Si insertar falla, no se pone.
    - Si la caja desaparece del documento y el bloque sigue marcado, se le quita la marca. Un bloque oculto sin caja delante no puede existir.
    - La vista «original» le quita la marca al bloque y deja la caja en modo compacto.
12. **Nodos reutilizados.** Si X reutiliza un bloque para otra publicación (el identificador cambia), se quita la marca y la caja y se trata la nueva.
13. **Rótulo.** «Traducido del <idioma>», con el nombre del idioma del bloque en español (`Intl.DisplayNames`). Si el nombre empieza por «lengua» o «idioma», «Traducido de». Si no hay nombre, «Traducido».
14. **Diagnóstico.** En consola: una línea `warn` por intento fallido (estado o tipo de fallo, rutas probadas, tiempo y 240 caracteres como mucho de la respuesta, también cuando X responde 200 sin traducción) y, a los 5 s, una línea `info` con el resumen de la página: versión cargada · bloques vistos · ya traducidos por X · en el idioma de la interfaz · sin idioma · sin enlace permanente · devueltos al original · traducidos · pedidos · fallidos · en espera · cupo que le queda a X en su ventana. Si falta la cookie `ct0`, un `warn`: no hay sesión y no se puede pedir nada. La versión es la del manifiesto: tras recargar la extensión se ve en consola qué código está cargado.
15. **Estado por publicación** (corregido en la revisión del código). Que una publicación está pedida, fallida, devuelta al original, en cola o en vuelo se sabe por su identificador, no por el bloque que la pinta: X crea, redibuja y reutiliza bloques. Una publicación se pide una sola vez, la que falló se deja en paz aunque X redibuje su bloque, y la misma traducción se pinta en todos los bloques de esa publicación.
16. **Marcas por artículo con caducidad.** «Este artículo tiene botón de X» y «de este artículo se volvió al original» recuerdan a qué publicación pertenecen y caducan cuando X recicla el artículo para otra.
18. **Tipografía del texto traducido.** Es la del bloque de X al que sustituye: fuente, tamaño, peso, interlineado y espaciado, tomados del propio bloque con `getComputedStyle` y pasados a la caja como variables CSS que usan las reglas de `content.css` (si falta alguna, se hereda). X fija la tipografía en el bloque, no en su padre: heredando del padre, el texto traducido salía más pequeño en la X real. La barra conserva su tamaño (13 px) y su gris. El color del texto sigue heredado, para que cambie con el tema de X.
17. **La caja va con su bloque.** Si X cambia de sitio el bloque, la caja se coloca otra vez detrás de él; un bloque oculto sin su caja delante no puede existir. Lo que toca un artículo que lleva caja se examina en el acto, para que la traducción de una publicación no llegue a verse bajo otra.

## La sonda (Tarea 0, antes de construir el resto)

Modo de diagnóstico temporal de la misma extensión, para aprender el contrato y el DOM reales con una sola prueba en la X real:

- **No toca la página:** no pinta, no esconde y no pide traducciones. El camino del clic de la v1 sigue activo.
- A los 5 s escribe **un único mensaje** en consola que empieza por `[X AutoTranslate SONDA]` con: si la cookie `lang` y la cookie `ct0` existen (sí o no, nunca el valor), el idioma de la interfaz, la ruta de la página y, de los tres primeros bloques candidatos: idioma, identificador y por qué regla, si está dentro de una caja de cita y un trozo del elemento anterior.
- Después hace **una petición por ruta** (Grok mismo origen, Grok en `api.x.com`, clásica) para el primer candidato con identificador, y añade al mensaje: estado, tiempo, tipo de respuesta, cabeceras de límite si vienen y 300 caracteres como mucho del cuerpo.

Con lo que salga se fijan las reglas 1, 3 y la sección «Cómo se pide a X» antes de escribir el resto.

**Resultado (26-nov-2026, en la X real, hilo con respuestas en inglés):**

- Sesión e idioma: cookie `ct0` presente, `lang=es`, `<html lang>=es`.
- Grok desde x.com: 200 en 715 ms, con la traducción en trozos `{"result":{"content_type":"POST","text":"…"}}`. Grok en `api.x.com`: 200 en 217 ms, el mismo texto entero, y deja leer sus cabeceras de límite.
- Clásica: 200 en 221 ms, sin traducción (`translationState: "NotCached"`).
- Cupo: `x-rate-limit-limit=100` para Grok (el mismo contador en las dos rutas) y `187` para la clásica. Por la hora de reinicio que dieron, la ventana parece de 15 minutos (deducido, no medido). Cada petición bajó el contador de Grok en uno. Tras la petición de la sonda los contadores marcaban 97 de 100 y 183 de 187: antes de ella alguien había pedido 2 y 3 veces en esas ventanas. Puede ser una carga anterior de la propia sonda o la propia X; la sonda no permite saberlo.
- Bloques de texto: 7 en 7 artículos; 4 ya traducidos por X (detectados por su barra) y 3 candidatos en inglés, cada uno con su identificador. El servicio clásico devolvió el mismo identificador para el primero: es el que X espera.
- La sonda recortó la estructura de los artículos antes de llegar al bloque de texto y a su enlace, así que **no enseñó** dónde pone X el enlace de una cita. La regla de identidad es a prueba de fallo y no depende de ello.

Con ese resultado la sonda ya no hace falta y se quitó del código.

## Verificado en la X real y lo que falta

1. **Verificado.** Las tres rutas responden con la sesión de quien navega; X no exige `x-client-transaction-id`.
2. **Verificado en parte.** El bloque de texto lleva `lang`, y una respuesta tiene su enlace permanente donde se buscaba. El enlace de una cita dentro de un post: sin datos; si no está donde se busca, la cita no se traduce (nunca se traduce mal).
3. **Verificado.** La barra de X traducido está delante del texto.
4. **Verificado.** La llamada a `api.x.com` pasa desde el navegador.
5. **Falta:** el aspecto de la barra propia junto a la de X, en tema oscuro y claro.
6. **Medido el límite** (100 y 187 por ventana de 15 minutos, debajo de los topes); **falta** ver en uso real cuánto consume la propia X de ese cupo.
