# X AutoTranslate

Extensión de Chrome que pulsa por ti el botón **«Traducir publicación»** de X en cuanto entra en pantalla.

## Por qué

X ofrece traducción automática para los posts (se activa por idioma), pero no llega a las respuestas de un hilo: leer uno obliga a entrar en cada respuesta y pulsar el botón. La extensión de la tienda que hacía eso tiene un tope de 50 traducciones al día en su versión gratuita.

X AutoTranslate no traduce nada por su cuenta, usa la traducción de X. Por eso no necesita claves, servicios de terceros ni código de terceros, y no tiene tope diario.

## Qué hace

- Detecta cada botón «Traducir publicación» que entra en pantalla y lo pulsa.
- Va de uno en uno y con ritmo, para no chocar con el límite de peticiones de X.
- No tiene interfaz: X muestra la traducción y su enlace «Mostrar original», igual que al pulsar a mano.

## Estado

**En diseño.** Todavía no hay código.

- Diseño (pendiente de aprobación): [`docs/superpowers/specs/2026-11-26-x-autotranslate-design.md`](docs/superpowers/specs/2026-11-26-x-autotranslate-design.md)
- Estado del proyecto y cómo continuar: [`docs/HANDOFF.md`](docs/HANDOFF.md)

## Instalación (prevista)

Chrome → `chrome://extensions` → «Modo de desarrollador» → «Cargar descomprimida» → elegir esta carpeta.
