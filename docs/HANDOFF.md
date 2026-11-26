# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 17:2x (sesión BytIA)

## Estado

🟢 **v1.0.0 construida, probada en el simulador y revisada. En `main` y subida. Sin estrenar en la X real.**

- `manifest.json` + `content.js`: la extensión. Sin permisos, sin red, sin almacenamiento y sin dependencias.
- `test/`: bancada de pruebas, 16 escenarios. `node test/run.mjs`.
- `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md`: diseño.
- `docs/superpowers/plans/2026-11-26-x-autotranslate-v1.md`: plan ejecutado, con sus enmiendas al final.

## Versiones y subida

- Extensión: `1.0.0` (en `manifest.json`).
- Repositorio: `asturwebs/X-AutoTranslate`, público. Todo lo del proyecto está en `main`, sincronizado con `origin/main` en el commit que lleva este fichero.
- Probado con Node 26.13.1 y Chromium 158.0.8127.88, los de esta máquina el 26-nov.
- Sin licencia.

## Hecho

- **2026-11-26 14:1x** — creados el workspace (`~/Projects/X-AutoTranslate`) y el repositorio público (`asturwebs/X-AutoTranslate`).
- **2026-11-26 14:1x-14:4x** — investigación del botón de traducir de X, diseño y plan. Detalle en la entrada 10:1x-17:2x del `HANDOFF.md` del home.
- **2026-11-26 15:2x-16:3x** — ejecución del plan (4 tareas) en la rama `feature/v1`: extensión completa y bancada de pruebas.
- **2026-11-26 16:3x-17:2x** — revisión final de un revisor independiente (contexto limpio, modelo opus): sin críticos, tres importantes, once menores. Pasada única de arreglos: hueco entre clics sorteado de 600 a 1500 ms, temporizador propio para el plazo de fallo, regla de etiqueta cerrada y pruebas para las comprobaciones previas al clic. Barrido final de 14 roturas intencionadas: las de comportamiento, todas cazadas.
- **Descartados** por el camino: `cpetschnig/translate-twitter`, `amahteru/x-auto-translate` y la extensión de la tienda `Automatic TWITTER Translator` (tope de 50/día).

## Autonomía del Socio

El 26-nov, sobre las 15:1x, el Socio escribió: «me voy a la siesta, regreso en un par de horas, tienes total autonomía para este proyecto». Con eso se ejecutó el plan, se fusionó la rama en `main` y se subió, sin pedir el OK de cada paso. No entra en esa autonomía: publicar fuera del repositorio (tienda de Chrome) y elegir la licencia. Se pidió al Socio que lo confirme en el resumen final.

## Cómo probar

```sh
node test/run.mjs
```

Sin dependencias. Abre un Chromium sin cabeza con perfil temporal, por el canal de depuración (`--remote-debugging-pipe`, sin puertos), sobre `test/mock-x.html`. El binario se cambia con `XAT_CHROME`. Tarda un minuto y medio.

## Pendientes

1. **Prueba en la X real del Socio.** Es lo único que falta para dar la v1 por buena. Pasos en «Si no traduce» del `README.md`. Hay que mirar:
   - la etiqueta exacta del botón «Traducir publicación» en su interfaz (su `aria-label` y su texto);
   - que el clic programático dispara la traducción en su cuenta;
   - qué hace X con el control al recibir el clic y cuando falla (si también desaparece al fallar, no hay forma de detectar el fallo);
   - si el control es un conmutador (pulsarlo otra vez devuelve el original): entonces un reintento desharía la traducción;
   - qué ritmo tolera X antes de responder 429;
   - que funciona en la ventana `--app` de la web app;
   - que desactiva la extensión de la tienda, que al pasar de 50 pone su aviso de límite bajo cada respuesta.
2. **Licencia del repositorio.** Sin decidir; es del Socio.
3. **Publicar en la Chrome Web Store**, si se quiere. Hoy se carga desempaquetada.
4. **Menores aplazados de la revisión**, por si salen en la X real:
   - la vuelta atrás solo se detecta con `click`; con Enter o Espacio depende de que X emita `click`;
   - «Mostrar original» se recuerda por artículo: revertir la cita suprime también el principal, y no se consulta en la cola ni en el reintento;
   - un elemento reutilizado que pase a «Traducir publicación» cambiando solo su texto no se reexamina;
   - una traducción que tarda más de 5 s cuenta como fallo;
   - `enPantalla` no descuenta la cabecera fija;
   - el manifiesto no lo ejercita ninguna prueba;
   - el rendimiento no está medido.
5. **Mejoras posibles:** un interruptor para pausar la extensión sin ir a `chrome://extensions`; acordarse por identificador de publicación de las que el Socio devolvió al original.

## Cómo continuar

1. Leer este fichero y el diseño.
2. Si el Socio ya probó la extensión en su X: partir de lo que vio (consola, texto del botón) y corregir.
3. Si no: pedírselo con los pasos de «Si no traduce» del `README.md`.
4. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Lecciones que ya están pagadas

- El botón de traducir de X no tiene un `data-testid` estable: se localiza por su nombre accesible. No se detecta por posición; un clic equivocado en X puede ser un «me gusta» o un repost.
- `element.click()` funciona, pero X redibuja el artículo tras el clic: hay que volver a examinarlo o la cita se queda sin traducir.
- X limita las peticiones a su traducción (429): de ahí la cola de uno en uno, la espera por respuesta y la pausa tras fallos seguidos. El hueco se sortea porque una cadencia fija delata un robot.
- Un plazo que solo se comprueba cuando otra cosa llama a la función no es un plazo: el fallo lleva su propio temporizador.
- En las pruebas, `FALLO_MS` debe ser distinto de `ESPERA_MAX_MS`, o una espera tapa la otra.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar (deja de dibujar y ralentiza los temporizadores encadenados). La bancada lo evita con `Emulation.setFocusEmulationEnabled`, `Page.bringToFront` y los flags `--disable-background-*`, y falla el escenario si la página no está visible.
- `--dump-dom --virtual-time-budget` no vale para probar nada que dependa del scroll.
- El nivel de `console.warn` en el protocolo de depuración es `warning`, no `warn`.
- Una prueba que pasa desde el principio puede ser hueca: se comprueba rompiendo el código a propósito (mutación) y mirando si falla.

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de tres ideas, con crédito en el código y en el README.
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; localiza el botón por su texto, con «Traducir publicación» en la lista.
