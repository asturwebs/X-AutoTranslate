# HANDOFF — X AutoTranslate

Última actualización: 2026-11-26 16:3x (sesión BytIA)

## Estado

🟢 **v1.0.0 construida y probada en el simulador. Sin estrenar en la X real.**

- `manifest.json` + `content.js`: la extensión. Sin permisos, sin red, sin almacenamiento y sin dependencias.
- `test/`: bancada de pruebas, 12 escenarios. `node test/run.mjs`.
- `docs/superpowers/specs/2026-11-26-x-autotranslate-design.md`: diseño.
- `docs/superpowers/plans/2026-11-26-x-autotranslate-v1.md`: plan ejecutado, con sus enmiendas al final.

## Hecho

- **2026-11-26 14:1x** — creados el workspace (`~/Projects/X-AutoTranslate`) y el repositorio público (`asturwebs/X-AutoTranslate`).
- **2026-11-26 14:1x-14:4x** — investigación del botón de traducir de X, diseño y plan. Detalle en la entrada 10:1x-14:4x del `HANDOFF.md` del home.
- **2026-11-26 15:2x-16:3x** — ejecución del plan en la rama `feature/v1`, con la Tarea 1 a la 4: extensión completa, bancada de 12 escenarios en verde y revisión final.
- **Descartados** por el camino: `cpetschnig/translate-twitter`, `amahteru/x-auto-translate` y la extensión de la tienda `Automatic TWITTER Translator` (tope de 50/día).

## Cómo probar

```sh
node test/run.mjs
```

Sin dependencias. Abre un Chromium sin cabeza con perfil temporal, por el canal de depuración (`--remote-debugging-pipe`, sin puertos), sobre `test/mock-x.html`. El binario se cambia con `XAT_CHROME`.

## Pendientes

1. **Prueba en la X real del Socio.** Es lo único que falta para dar la v1 por buena:
   - la etiqueta exacta del botón «Traducir publicación» en su interfaz;
   - que el clic programático dispara la traducción en su cuenta;
   - qué muestra X cuando una traducción falla o responde 429, y qué ritmo tolera;
   - que funciona en la ventana `--app` de la web app;
   - que desactiva la extensión de la tienda, que al pasar de 50 pone su aviso de límite bajo cada respuesta.
2. **Licencia del repositorio.** Sin decidir; es del Socio.
3. **Publicar en la Chrome Web Store**, si se quiere. Hoy se carga desempaquetada.
4. **Mejoras posibles, sin hacer:** un interruptor para pausar la extensión sin ir a `chrome://extensions`; acordarse por identificador de publicación de las que el Socio devolvió al original, para respetarlo aunque X redibuje el artículo.

## Cómo continuar

1. Leer este fichero y el diseño.
2. Si el Socio ya probó la extensión en su X: partir de lo que vio (consola, texto del botón) y corregir.
3. Si no: pedírselo con los pasos de «Si no traduce» del `README.md`.
4. Al cerrar una sesión con trabajo de código, actualizar este fichero y el `HANDOFF.md` del home.

## Lecciones que ya están pagadas

- El botón de traducir de X no tiene un `data-testid` estable: se localiza por su etiqueta. No se detecta por posición; un clic equivocado en X puede ser un «me gusta» o un repost.
- `element.click()` funciona, pero X redibuja el artículo tras el clic: hay que volver a examinarlo o la cita se queda sin traducir.
- X limita las peticiones a su traducción (429): de ahí la cola de uno en uno, la espera por respuesta y la pausa tras fallos seguidos.
- Chromium sin cabeza deja la página como oculta unos 2,5 s después de arrancar (deja de dibujar y ralentiza los temporizadores encadenados). La bancada lo evita con `Emulation.setFocusEmulationEnabled`, `Page.bringToFront` y los flags `--disable-background-*`, y falla el escenario si la página no está visible.
- `--dump-dom --virtual-time-budget` no vale para probar nada que dependa del scroll.
- El nivel de `console.warn` en el protocolo de depuración es `warning`, no `warn`.

## Referencias

- `llpgf/x-grok-visible-translate` (MIT): userscript de 339 líneas, solo lo visible y primero el botón nativo. Fuente de tres ideas, con crédito en el código y en el README.
- `Noctyn/x-native-translator` (MIT): userscript con cola y pausas ante 429; localiza el botón por su texto, con «Traducir publicación» en la lista.
