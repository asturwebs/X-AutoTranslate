# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 19:xx (sesión BytIA)

## Estado

🟡 **v2.0.0 construida y probada en el simulador, en la rama `feature/v2`. Falta la prueba en la X real antes de fusionarla.**

- La **v1.0.0** está en `main` y subida: solo pulsa el botón «Traducir publicación» de X. En la X real no sirve para las respuestas de un hilo, porque **X no pone ese botón en ellas**.
- La **v2.0.0** añade un segundo camino: pedir la traducción al servicio de X y ponerla en el sitio del original. Está entera en `feature/v2`, con 41 escenarios en verde. Su contrato con X es el de la documentación pública y del simulador: **ninguna ruta se ha probado con la sesión del Socio**.
- **Pendiente y bloqueante:** el resultado de la **sonda** en la X real del Socio (Tarea 0).

## Dónde está cada cosa (ojo: hay dos carpetas)

| Carpeta | Qué es | Estado |
|---|---|---|
| `~/Projects/X-AutoTranslate` | La que carga Chrome como extensión desempaquetada | Desacoplada en `e090492` (v1 + sonda de diagnóstico). **No moverla** hasta fusionar la v2 |
| `~/Projects/X-AutoTranslate-dev` | Worktree de desarrollo, rama `feature/v2` | Aquí se desarrolla la v2. Al fusionar: `git worktree remove` |

Es un mismo repositorio con dos árboles de trabajo (`git worktree list`). El registro de ejecución del plan está en `.superpowers/sdd/2026-11-26-x-autotranslate-v2/progress.md` dentro de cada uno.

## Hecho

- **2026-11-26 14:1x–17:2x** — v1: diseño, plan, construcción, revisión independiente, fusión y subida. Detalle en la entrada 10:1x–16:5x del `HANDOFF.md` del home.
- **2026-11-26 17:3x–17:5x** — el Socio prueba la v1 en su X: las respuestas del hilo siguen sin traducirse. Causa raíz: X no pone enlace de traducir en las respuestas (su captura de las 17:30). El Socio elige el enfoque de pedir la traducción a X.
- **2026-11-26 17:5x–18:2x** — **revisión adversaria** del diseño y el plan de la v2 (MiMo v2.6-pro y DeepSeek flash, motores distintos del autor): «GO con arreglos». Catorce hallazgos, trece corregidos, uno contestado con evidencia, tres escalados y ratificados por el Socio (sonda antes de construir; cada pestaña por su cuenta; topes de 60 por página y 300 por hora). Registro: `~/Work/x-autotranslate-adversarial-v2/delta.md` e `informes/`.
- **2026-11-26 18:2x–19:xx** — v2: Tarea 0 (sonda), Tareas 1 a 3 (camino de petición, caja, techo y paros). Dos defectos reales cazados por las pruebas: un 429 se tomaba por fallo definitivo y no se reintentaba; al reutilizar X un bloque mientras se pedía su traducción, la publicación nueva quedaba sin traducir. Barrido de 27 roturas intencionadas: 25 cazadas a la primera, 1 tapada por tres salvaguardas (la rotura triple sí la caza), 1 salvaguarda redundante.

## Cómo probar

```sh
cd ~/Projects/X-AutoTranslate-dev
node test/run.mjs            # 41 escenarios, unos 3 minutos
node test/run.mjs hilo       # solo algunos
```

Sin dependencias. Un Chromium sin cabeza con perfil temporal, por `--remote-debugging-pipe`, sobre `test/mock-x.html`, servida por HTTP en `127.0.0.1` (puerto aleatorio, solo durante las pruebas) porque las cookies no existen sobre `file://`. Para romper el código a propósito: `python3 -I .superpowers/sdd/2026-11-26-x-autotranslate-v2/mutar.py`.

## La sonda (Tarea 0)

La carpeta que carga Chrome lleva una versión de diagnóstico que **no cambia nada en la página**: a los 5 s escribe un mensaje `[X AutoTranslate SONDA]` en consola con lo que ve (idioma, sesión, bloques de texto, enlaces permanentes, estructura de los artículos) y hace **una petición por ruta** (Grok, Grok en `api.x.com`, clásica) para el primer candidato.

Pasos que se le dieron al Socio: recargar la extensión en `chrome://extensions` → abrir un hilo → F12 → Console → recargar → copiar el mensaje y pegarlo.

**Con lo que salga hay que fijar, antes de fusionar:**

1. Qué ruta responde con su sesión y con qué cuerpo (trozos por línea en Grok; `translation` en la clásica). Si responde 404 o 403 en todas, ver si X exige `x-client-transaction-id`.
2. Que cada bloque de texto lleva `lang` y dónde está su enlace permanente (una respuesta, y una cita dentro de un post).
3. Dónde pone X la barra «Traducido de…»: el código la busca entre el bloque de texto anterior y el actual.

Las funciones afectadas en `content.js`: `idDe`, `cajaDeCitaDe`, `traducidoPorX`, `pedirAX`, `textoGrok`, `textoClasico`, `cabecerasDeSesion`.

## Pendientes

1. **Recoger la sonda del Socio y ajustar** las funciones de arriba. Después quitar `sondear()` y `MODO_SONDA` de `content.js` (y el escenario `sonda` del simulador): es el último paso de la Tarea 4.
2. Revisión final independiente del código con `delta.md` en la mano; pasada de arreglos; fusionar `feature/v2` en `main`; subir; quitar el worktree (`git worktree remove ~/Projects/X-AutoTranslate-dev`) y dejar `~/Projects/X-AutoTranslate` en `main`.
3. **Prueba en la X real del Socio con la v2:** que las respuestas se traducen según baja; el aspecto de la barra propia junto a la de X (tema oscuro y claro); qué ritmo y volumen tolera X antes de un 429.
4. **Licencia del repositorio.** Sin decidir; es del Socio.
5. Publicar en la Chrome Web Store, si se quiere. Hoy se carga desempaquetada.
6. Menores aplazados de la revisión de la v1 (la vuelta atrás con teclado, rendimiento sin medir, el manifiesto sin prueba automática) y de la adversaria de la v2 (coordinación entre pestañas, no hecha por decisión del Socio).

## Cómo continuar

1. Leer este fichero y el diseño v2 (`docs/superpowers/specs/2026-11-26-x-autotranslate-v2-design.md`).
2. Si el Socio ya pegó la salida de la sonda: partir de ahí. Si no: pedírsela.
3. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Lecciones que ya están pagadas

- X **no pone enlace de traducir en las respuestas de un hilo**: solo traduce solo el post principal. Por eso hay que pedirle la traducción al servicio.
- Ese servicio no tiene un `data-testid` ni nada parecido en el botón; y nadie ha probado sus rutas con esta cuenta todavía.
- El botón de traducir de X no tiene un `data-testid` estable: se localiza por su nombre accesible. No se detecta por posición; un clic equivocado en X puede ser un «me gusta» o un repost.
- `element.click()` funciona, pero X redibuja el artículo tras el clic.
- X limita las peticiones a su traducción: de ahí la cola, la espera por respuesta y la pausa tras fallos. El hueco se sortea porque una cadencia fija delata un robot.
- Un plazo que solo se comprueba cuando otra cosa llama a la función no es un plazo: el fallo lleva su propio temporizador.
- En las pruebas, `FALLO_MS` debe ser distinto de `ESPERA_MAX_MS`, o una espera tapa la otra. Y un 429 no es «un 4xx más».
- Cuando X reutiliza un bloque cambiando solo su texto, no hay nodos nuevos: el observador tiene que mirar también los nodos de texto.
- Una prueba que pasa desde el principio puede ser hueca: se comprueba rompiendo el código a propósito.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar. La bancada lo evita con `Emulation.setFocusEmulationEnabled` y los flags `--disable-background-*`, y falla el escenario si la página no está visible. Para ocultarla a propósito: otra pestaña con la emulación quitada.
- `--dump-dom --virtual-time-budget` no vale para probar nada que dependa del scroll.
- El nivel de `console.warn` en el protocolo de depuración es `warning`, no `warn`.
- La revisión adversaria con dos motores distintos cazó en 15 minutos lo que el autor no vio en una hora de diseño: entre otros, que la extensión se pulsaría a sí misma y que no tenía techo de peticiones.

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de ideas, con crédito en el código y en el README.
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; llama a la API de traducción de X.
- `dfrnoch/liquidX` y `rien7/twitter-extension-api`: documentación pública del contrato del servicio de traducción.
- Revisión adversaria de la v2: `~/Work/x-autotranslate-adversarial-v2/` (congelado, huellas, briefs, informes, `delta.md`).
