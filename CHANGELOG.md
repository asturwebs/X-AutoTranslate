# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Versionado: [SemVer](https://semver.org/lang/es/).

Cada build que se cargue en Chrome lleva su número. Se ve en `chrome://extensions` y al principio de la línea `[X AutoTranslate] Página:` de la consola de X.

## [Sin publicar]

Nada.

## [2.0.2] - 2026-11-27

No cambia cómo traduce. Esta versión acaba lo que quedaba suelto: lo que la extensión dice de sí misma, cómo se cortan sus peticiones y cómo se comprueba todo.

### Cambiado

- La descripción de la extensión (la que sale en `chrome://extensions`) dice ya que traduce al español y que complementa a la traducción de X.
- El tope de tiempo de cada publicación (20 s para todas sus rutas) usa `AbortSignal.timeout()`, que es la forma recomendada, en vez de un temporizador hecho a mano.

### Añadido

- Licencia MIT para el código (`LICENSE`).

### Corregido

- La bancada de pruebas deja el sistema limpio también si se corta con Ctrl+C o con `kill`: antes dejaba huérfano el perfil temporal en `/tmp`.

### Comprobado

- La bancada comprueba en cada pasada `manifest.json`: sin claves de más (ni permisos), corriendo solo en x.com y twitter.com, y con la misma versión que la última de este registro.
- El simulador de la bancada informa el corte de una petición como lo hace Chrome de verdad. Antes no, y eso habría dado por bueno el cambio del tope de tiempo: en Chrome real el corte llega con otro nombre.
- La bancada entera en verde: 69 de 69 comprobaciones. El cambio del tope de tiempo se vio en rojo antes de arreglarse; la comprobación del manifiesto, rota de cinco maneras a propósito, cayó en rojo las cinco.

## [2.0.1] - 2026-11-26

### Corregido

- El texto traducido salía más pequeño y con otra letra que el de X. Ahora toma la tipografía del bloque de X al que sustituye: fuente, tamaño, peso, interlineado y espaciado. La barra «Traducido del…» conserva su tamaño.

### Comprobado

- La 2.0.0, probada entera en la X real: las respuestas de un hilo se traducen al bajar.

## [2.0.0] - 2026-11-26

La v1 solo pulsaba el botón «Traducir publicación» de X, y X no pone ese botón en las respuestas de un hilo. La v2 añade un segundo camino: pedirle a X la traducción al español de lo que deja sin traducir.

### Añadido

- **Pedir la traducción a X.** Para cada publicación visible que X no tradujo y que no lleva botón, la extensión identifica la publicación por su enlace permanente, le pide su traducción al servicio de Grok de X (con la sesión de quien navega) y la pone en el sitio del original, con una barra «Traducido del inglés · Mostrar original». Rutas, en orden: Grok desde x.com; la misma en `api.x.com` si la primera no existe; el servicio clásico como último recurso.
- **Vuelta atrás propia.** «Mostrar original» enseña el texto de X; «Mostrar traducción», la que ya se tenía. Lo devuelto al original no se vuelve a pedir ni a pintar en esa página.
- **Sin pedir dos veces.** Lo que X contestó se recuerda mientras la pestaña viva: si X redibuja la publicación, se vuelve a poner sin pedirla.
- **Techo y paros.** 60 publicaciones por página y 300 por hora y pestaña; nada con la pestaña oculta; paro hasta recargar si X rechaza las peticiones (401 o 403) o si deja de traducir nada (dos pausas seguidas sin ningún éxito).
- **Reserva de cupo.** X cuenta sus traducciones por ventanas (100 por ventana en Grok, medido el 26-nov-2026). Cuando quedan 10 o menos, no se pide nada hasta el reinicio.
- **Fallos de X.** Un 429 espera lo que X diga y reintenta una sola vez; tres fallos seguidos, pausa de un minuto; cada publicación fallida se deja en paz tras un reintento.
- **Diagnóstico en consola.** A los 5 s, una línea con la versión cargada y el recuento de la página; un aviso por cada publicación que X no traduzca, con lo que respondió.

### Cambiado

- La extensión lee ahora la cookie `ct0` de X y hace peticiones a X en nombre de quien navega. Solo a sus rutas de traducción. El manifiesto sigue sin permisos.

### Corregido

- Un 429 se tomaba por fallo definitivo y la publicación no se reintentaba.
- Si X reutilizaba un bloque de texto mientras se pedía su traducción, la publicación nueva quedaba sin traducir.

### Comprobado

- Servicio de traducción de X con una sesión real (sonda del 26-nov-2026): las tres rutas responden 200; Grok devuelve la traducción; la clásica responde sin traducción.
- Bancada: 67 escenarios en verde.

## [1.0.0] - 2026-11-26

- Primera versión. Pulsa el botón «Traducir publicación» de X en lo que entra en pantalla, de uno en uno y con ritmo; reintenta y hace pausas ante fallos; respeta «Mostrar original».
- **No sirve para las respuestas de un hilo:** X no pone ese botón en ellas. Corregido en la 2.0.0.

## Builds de diagnóstico

- **26-nov-2026, commit `e090492`** (número 1.0.0, sin cambiar): la v1 con una sonda que describía la página y hacía una petición por ruta a X, sin tocar nada. Solo para aprender el contrato y el DOM reales antes de construir la v2. Sin etiqueta.

[2.0.2]: https://github.com/asturwebs/X-AutoTranslate/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/asturwebs/X-AutoTranslate/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/asturwebs/X-AutoTranslate/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/asturwebs/X-AutoTranslate/tree/v1.0.0
