# Diseño — X AutoTranslate

**Estado:** borrador del 2026-11-26, pendiente de aprobación.
**Tamaño:** cambio pequeño. Previsto: dos ficheros, `manifest.json` y `content.js`, del orden de cien líneas.

## Qué es y por qué

Extensión de Chrome que pulsa por ti el botón **«Traducir publicación»** de X en cuanto entra en pantalla.

X ofrece traducción automática para los posts (se activa por idioma), pero no llega a las respuestas de un hilo. Leer un hilo obliga a entrar en cada respuesta y pulsar el botón. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

Pulsar el botón de X reutiliza su propia traducción: no hay claves, ni servicios de terceros, ni código de terceros, ni tope.

## Objetivos

- Respuestas y citas en español al entrar en pantalla, en el timeline y dentro de los hilos.
- Sin acción del usuario, también al refrescar, al hacer scroll y al cambiar de hilo.
- El resultado se ve como si se hubiera pulsado a mano: traducción en lugar del original y enlace «Mostrar original».

## No objetivos

- Traducir por cuenta propia (ni Google ni ninguna otra API).
- Interfaz, opciones o atajos (en la v1).
- Biografías, tarjetas flotantes, mensajes directos ni nada que no lleve el botón.
- Publicar en la Chrome Web Store (en la v1 se carga desempaquetada).

## Anti-objetivos: sería un fallo aunque «funcione»

- **Una ráfaga de peticiones.** X pone límite de peticiones a su traducción (el script de referencia trata las respuestas 429 con pausas). Un hilo largo traducido de golpe puede acabar en un aviso de error o en una marca de automatismo sobre la cuenta. De ahí la cola y el ritmo.
- **Perder el original.** Siempre tiene que quedar la vuelta atrás de X.
- **Consumir CPU al hacer scroll.** X redibuja el feed sin parar; el observador tiene que ser barato.

## Restricciones

- Google Chrome, extensiones Manifest V3, sin permisos: solo un *content script* en `https://x.com/*`.
- El botón de X no tiene un identificador estable conocido. Se localiza por su texto exacto en el idioma de la interfaz («Traducir publicación»). Si X cambia el texto o se usa la interfaz en otro idioma, se añade a la lista.
- No se puede medir desde fuera. El texto exacto, la tolerancia de X y el comportamiento en la ventana de la web app se comprueban en la página real.

## Enfoques considerados

| | Qué es | A cambio |
|---|---|---|
| **A. Extensión propia que pulsa el botón de X** (elegido) | Un *content script* que detecta el botón y lo pulsa | Depende del HTML y del texto de X; solo traduce donde X muestra el botón |
| B. Usar un userscript ya hecho | `Noctyn/x-native-translator` (MIT, Greasy Fork 602228): auto-traducción con cola y pausa ante 429 | Interfaz en chino, más de mil líneas, exige un gestor de scripts y llama a la API de X con la sesión |
| C. Extensión que traduce por su cuenta | Llamar a Google o a otra API desde la extensión | API no oficial, más código, el texto sale a un tercero y la calidad no coincide con la de los posts |

Se elige A porque cubre la necesidad con el mínimo código y sin terceros. B queda como alternativa si A se rompe y no compensa arreglarla.

Otro repositorio evaluado y descartado: `cpetschnig/translate-twitter`. No es una extensión, sino una aplicación de servidor (Ruby on Rails, 2010-2013, archivada) que copia los tweets de una cuenta, los traduce y los publica desde otra cuenta.

## Decisiones (propuestas por BytIA, corregibles)

1. **Mecanismo:** clic programático en el botón nativo. Sin llamadas a la API.
2. **Alcance:** todo lo que esté dentro de un `<article>` (timeline, hilos y citas). Fuera: diálogos (el compositor) y tarjetas flotantes.
3. **Disparo:** el botón entra en pantalla y se queda unos 300 ms. Lo que se cruza al vuelo no se traduce.
4. **Ritmo:** cola global, de arriba a abajo, de uno en uno. No se pulsa el siguiente hasta que X responde al anterior (el botón desaparece) o pasan 1,5 s; nunca menos de 300 ms entre clics.
5. **Fallo:** si un botón sigue ahí 5 s después del clic, se reintenta una vez a los 10 s; si sigue, se deja en paz esa publicación. Tres fallos seguidos pausan la cola 60 s.
6. **Redibujados:** X reutiliza y recrea nodos. Un botón nuevo se pulsa aunque la publicación ya estuviera traducida antes (X vuelve a servir la traducción). Un mismo botón nunca se pulsa dos veces.
7. **Sin estado:** nada de `storage`, ni servicio en segundo plano, ni caché.

## Lo que queda por verificar en la página real (primer paso de la construcción)

1. Texto exacto del botón en la interfaz en español de España, y si X le pone algún `data-testid` utilizable.
2. Que `button.click()` dispara la traducción.
3. Qué muestra X cuando una traducción falla o responde 429, y qué ritmo tolera.
4. Que la extensión carga y funciona en la ventana `--app` de la web app.

## Abierto

- **Licencia del repositorio.** Hoy no tiene. Es decisión del autor.
