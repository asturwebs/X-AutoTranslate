# Seguridad

Si crees que has encontrado un problema de seguridad en X AutoTranslate, **no lo abras como un issue público**. Usa el aviso privado de GitHub: pestaña **Security** → **Report a vulnerability** («Notificar una vulnerabilidad»). Solo lo ve el mantenedor.

## Qué cuenta como problema de seguridad

Cualquier cosa por la que la extensión, instalada como se describe en el README, haga algo de esto:

- Enviar datos a alguien que no sea X, o leer algo que no necesita para traducir (la cookie `ct0` y la cookie `lang`).
- Ejecutar, o interpretar como HTML, texto que viene de una publicación o de la respuesta de X.
- Pulsar en X algo que no sea un botón de traducir de la propia X.

## Qué no cuenta

- **El riesgo para la cuenta.** La extensión habla con un servicio interno de X con la sesión de quien navega, y X puede tomarlo por actividad automática. Es conocido, está declarado en el README y lo decide quien la instala.
- **Que X cambie su servicio o su interfaz y la extensión deje de traducir.** Eso es un issue normal; abre uno con la línea `[X AutoTranslate] Página:` de tu consola.

## Qué pasa después

Se mira el aviso y se contesta. Si hay arreglo, sale como versión nueva, con su nota en [Releases](https://github.com/asturwebs/X-AutoTranslate/releases). Si quieres, te nombramos en esa nota.
