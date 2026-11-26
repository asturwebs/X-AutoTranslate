// X AutoTranslate — traducciones por ti en X, en lo que entra en pantalla.
//
// Dos caminos, según lo que ponga X bajo cada publicación:
//   1. Si X pone un botón «Traducir publicación», se pulsa.
//   2. Si no pone nada (es lo que pasa en las respuestas de un hilo), se le pide la traducción
//      al propio servicio de X, con la sesión de quien navega, y se pone en el sitio del
//      original con su «Mostrar original».
//
// No traduce por su cuenta y no habla con nadie más que X. No pide permisos ni guarda nada en
// disco. Solo actúa dentro de un <article>, solo sobre lo que pasa por las reglas de abajo, y
// con techo: la cuenta de quien navega va por delante de la traducción.
//
// Ideas tomadas de llpgf/x-grok-visible-translate y Noctyn/x-native-translator (ambos MIT);
// contrato del servicio de traducción, de la documentación pública de dfrnoch/liquidX y
// rien7/twitter-extension-api, y comprobado en la X real el 26-nov-2026 con una sonda.
(() => {
  'use strict';

  // Etiquetas exactas del botón de X. Si X cambia el texto o se usa la interfaz en otro
  // idioma, se añaden aquí; nada más se pulsa.
  const ETIQUETAS_TRADUCIR = new Set([
    'Traducir publicación', 'Traducir post', 'Mostrar traducción',
    'Translate post', 'Show translation',
  ]);
  // El enlace con el que X vuelve al texto original.
  const ETIQUETAS_ORIGINAL = new Set(['Mostrar original', 'Show original']);

  // Etiquetas que empiezan como una acción de traducir. «Traducido de…» es un estado, no un botón.
  const PARECE_TRADUCCION = /^(traduc(?!id)|translat(?!ed)|mostrar trad|show trans)/i;

  // Códigos con los que X marca un texto «sin idioma».
  const SIN_IDIOMA = new Set(['', 'und', 'zxx', 'qam', 'qct', 'qht', 'qme', 'qst']);

  const TIENE_LETRAS = /\p{L}{2,}/u;

  // Un modelo de lenguaje, si recibe algo que no es una publicación, contesta con frases así.
  const RESPUESTA_META = /^(?:please provide|what would you like|i need the|por favor (?:proporcione|dime))/i;

  // Clave pública del cliente web de X. No es un secreto: va a la vista en el código de x.com y
  // en todos los clientes de código abierto, y solo sirve junto con una sesión.
  // Procedencia: `Noctyn/x-native-translator`, `llpgf/x-grok-visible-translate` y
  // `rien7/twitter-extension-api`. Si X la cambia, responde 401 aunque haya sesión.
  const CLIENTE_PUBLICO_X = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  const AJUSTES = globalThis.__XAT_AJUSTES__ ?? {}; // solo lo fija la bancada de pruebas

  // Tiempos en ms.
  const RITMO = Object.freeze({
    PARADA_MS: 300,      // cuánto tiene que estar en pantalla antes de contar
    HUECO_MIN_MS: 600,   // hueco mínimo entre dos trabajos
    HUECO_MAX_MS: 1500,  // hueco máximo: cada trabajo sortea uno entre el mínimo y este
    ESPERA_MAX_MS: 1500, // hasta que X responde al último clic (o pasa este tiempo) no se pulsa el siguiente
    FALLO_MS: 5000,      // si el botón sigue ahí tras este tiempo, el clic ha fallado
    REINTENTO_MS: 10000, // espera antes de reintentar una publicación que falló
    PAUSA_MS: 60000,     // pausa de la cola tras varios fallos seguidos
    FALLOS_PARA_PAUSA: 3,
    DIAGNOSTICO_MS: 5000,  // cuándo escribir el diagnóstico
    REEXAMEN_MS: 150,      // pausa antes de volver a examinar los artículos con nodos nuevos
    PETICION_MAX_MS: 20000, // tiempo máximo de las peticiones de una publicación, todas sus rutas juntas
    ...AJUSTES,
  });

  // Techo de peticiones. Decisión del mantenedor, 26-nov-2026: la cuenta va por delante.
  const TOPE = Object.freeze({
    PAGINA: AJUSTES.TOPE_PAGINA ?? 60,          // publicaciones pedidas desde que se cargó la página
    HORA: AJUSTES.TOPE_HORA ?? 300,             // publicaciones pedidas en la ventana
    VENTANA_MS: AJUSTES.TOPE_VENTANA_MS ?? 60 * 60 * 1000,
    MEMORIA: 500,                               // traducciones guardadas en esta pestaña
  });

  // ── Estado ─────────────────────────────────────────────────────────────────────────────

  // Camino del clic. Estado de cada botón: 'visto' (observado, sin cumplir todavía la parada),
  // 'enCola', 'pendiente' (pulsado, a la espera de X o de un reintento) o 'descartado'.
  const estado = new WeakMap();
  // X recicla artículos, así que las marcas por artículo recuerdan a qué publicación pertenecen.
  const articulosConBoton = new WeakMap(); // <article> → publicación que había al aparecer su botón
  const revertidos = new WeakMap();        // <article> → publicación que quien navega devolvió al original
  const pendientes = new Map();     // botón → momento del último clic, a la espera de X
  const intentos = new WeakMap();   // botón → clics que ha recibido

  // Camino de petición. Lo que se sabe de cada publicación, por su identificador: así no depende
  // del bloque que la pinta, que X crea, redibuja y reutiliza.
  const memoria = new Map();        // identificador → traducción que X ya contestó
  const fallidas = new Set();       // publicaciones que X no pudo traducir y se dejaron en paz
  const devueltas = new Set();      // publicaciones que quien navega devolvió al original
  const enCola = new Set();         // publicaciones con una tarea en cola: una sola por publicación
  const pedidas = new Set();        // publicaciones ya pedidas (para no contar dos veces)
  const pedidasPorHora = [];        // momentos de la primera petición de cada publicación
  let pedidasEnPagina = 0;
  let peticionEnVuelo = false;
  let paroPorPermiso = false;       // X rechazó las peticiones: nada más hasta recargar
  let paroPorFallos = false;        // X no traduce nada: nada más hasta recargar
  let pausasSinExito = 0;
  let cupoHasta = 0;                // hasta que se reinicie la ventana de cupo de X (ms de reloj)
  let cupoVisto = '';               // lo último que dijo X que quedaba, para el diagnóstico

  // …y por dónde va cada bloque de texto: 'visto', 'enCola', 'pedido', 'hecho' (traducción
  // puesta) o 'descartado' (no se vuelve a pedir).
  const textos = new WeakMap();
  const cajas = new WeakMap();      // bloque → nuestra caja
  const duenoDe = new WeakMap();    // caja → bloque

  const observados = new Set();     // botones y bloques que sigue mirando el IntersectionObserver
  const paradas = new Map();        // elemento → temporizador de la parada
  const cajasVivas = new Set();     // nuestras cajas que están en el documento
  const sucios = new Set();         // <article> con nodos nuevos desde el último examen
  const cola = [];                  // { tipo: 'clic', boton } | { tipo: 'texto', nodo, id, intentos, noAntes }
  const avisados = new Set();
  let huecoHasta = -Infinity; // tras cada clic o petición no se hace nada hasta que pasa el hueco
  let pausadoHasta = 0;       // la cola no trabaja hasta este momento
  let fallosSeguidos = 0;
  let temporizador = 0;       // próxima llamada a bombeo(), si la hay
  let avisoEn = 0;            // momento en que dispararía ese temporizador
  let examenPendiente = false;

  // ── Lectura de la página ───────────────────────────────────────────────────────────────

  // Nombre accesible del control: su aria-label si lo tiene; si no, su texto visible.
  // Si el aria-label no está en la lista, el botón no se pulsa aunque su texto sí lo esté.
  function etiqueta(el) {
    const aria = el.getAttribute('aria-label')?.trim();
    return aria || el.textContent.trim();
  }
  const esBotonTraducir = (el) => ETIQUETAS_TRADUCIR.has(etiqueta(el));
  const esBotonOriginal = (el) => ETIQUETAS_ORIGINAL.has(etiqueta(el));

  // Lo que cuelga de nuestra propia interfaz queda fuera de todo escaneo.
  const esNuestro = (el) => !!el.closest('.xat-caja');

  function cookie(nombre) {
    const hallado = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
    if (!hallado) return '';
    try {
      return decodeURIComponent(hallado[1]);
    } catch {
      return hallado[1]; // una cookie mal formada no debe tumbar la extensión
    }
  }

  // La sesión y el idioma de la interfaz casi nunca cambian: se leen una vez por segundo.
  // Las cabeceras de cada petición leen la cookie fresca, no la copia.
  let cacheSesion = null;
  function haySesion() {
    const ahora = performance.now();
    if (!cacheSesion || cacheSesion.hasta <= ahora) cacheSesion = { hasta: ahora + 1000, hay: !!cookie('ct0') };
    return cacheSesion.hay;
  }

  const VALIDO_IDIOMA = /^(?!xx$)[a-z]{2,3}$/; // X usa «xx» para «inglés por defecto»: no es un idioma
  const baseDelIdioma = (texto) => (texto ?? '').trim().toLowerCase().split('-')[0];

  // Idioma base de la interfaz de X: la cookie `lang`, si es un código válido; si no, el de
  // <html lang>; y si no, español.
  let cacheIdioma = null;
  function idiomaDestino() {
    const ahora = performance.now();
    if (!cacheIdioma || cacheIdioma.hasta <= ahora) {
      const deLaCookie = baseDelIdioma(cookie('lang'));
      const delHtml = baseDelIdioma(document.documentElement.lang);
      cacheIdioma = {
        hasta: ahora + 1000,
        idioma: (VALIDO_IDIOMA.test(deLaCookie) && deLaCookie) || (VALIDO_IDIOMA.test(delHtml) && delHtml) || 'es',
      };
    }
    return cacheIdioma.idioma;
  }

  // Bloques de texto de un artículo, en orden. El primero es el post; los demás son citas o
  // tarjetas dentro de él.
  const bloquesDe = (articulo) => [...articulo.querySelectorAll('[data-testid="tweetText"]')];

  // La caja propia de un bloque que no es el post: el ancestro más cercano, dentro del artículo,
  // que no contiene al post. No hace falta que lleve role="link".
  function cajaDeCitaDe(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return null;
    const primero = bloquesDe(articulo)[0];
    if (!primero || nodo === primero) return null;
    let caja = nodo.parentElement;
    while (caja && caja !== articulo && caja.contains(primero)) caja = caja.parentElement;
    return caja && caja !== articulo ? caja : null;
  }

  const identificadorEn = (enlace) => enlace?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] ?? '';

  // Enlaces permanentes de `raiz`: los que envuelven un <time>.
  const enlacesPermanentesEn = (raiz) => [...raiz.querySelectorAll('a[href*="/status/"]')]
    .filter((enlace) => enlace.querySelector('time'));

  // Identificador de la publicación de un bloque, por su enlace permanente. A prueba de fallo:
  // si no hay manera segura de saberlo, no hay identificador y no se pide.
  //  · Una cita solo se identifica por un enlace de su propia caja: nunca por el del post.
  //  · El post, por su enlace con `time` fuera de las cajas de sus citas.
  function idDe(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return '';
    const bloques = bloquesDe(articulo);
    const primero = bloques[0];
    if (!primero) return '';
    if (nodo !== primero) {
      const caja = cajaDeCitaDe(nodo);
      return caja ? identificadorEn(enlacesPermanentesEn(caja)[0]) : '';
    }
    const cajasDeCitas = bloques.slice(1).map(cajaDeCitaDe).filter(Boolean);
    const propio = enlacesPermanentesEn(articulo).find((enlace) => !cajasDeCitas.some((caja) => caja.contains(enlace)));
    return identificadorEn(propio);
  }

  const idDelArticulo = (articulo) => {
    const bloques = bloquesDe(articulo);
    return bloques[0] ? idDe(bloques[0]) : '';
  };

  // ¿Viene `control` antes que `nodo` en el documento?
  const vieneAntes = (control, nodo) => (nodo.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;

  // X traduce solo el post principal de un hilo y pone su barra «Traducido de… · Mostrar
  // original» delante del texto. El bloque conserva el idioma original, así que `lang` no basta
  // para saberlo. ¿Hay un «Mostrar original» de X entre el bloque de texto anterior y este?
  function traducidoPorX(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return false;
    const bloques = bloquesDe(articulo);
    const anterior = bloques[bloques.indexOf(nodo) - 1];
    for (const control of articulo.querySelectorAll('button, [role="button"], span')) {
      if (esNuestro(control) || control.closest('[data-testid="tweetText"]')) continue;
      if (!ETIQUETAS_ORIGINAL.has(etiqueta(control))) continue;
      if (!vieneAntes(control, nodo)) continue;
      if (anterior && vieneAntes(control, anterior)) continue;
      return true;
    }
    return false;
  }

  // El bloque de texto de la publicación de la que cuelga un «Mostrar original» de X.
  function bloqueDespuesDe(control, articulo) {
    for (const nodo of bloquesDe(articulo)) {
      if ((control.compareDocumentPosition(nodo) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) return nodo;
    }
    return null;
  }

  function enPantalla(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  // ¿Se le puede pedir a X la traducción de este bloque?
  function esCandidato(nodo, id) {
    if (!id || !haySesion() || devueltas.has(id) || fallidas.has(id)) return false;
    const idioma = baseDelIdioma(nodo.getAttribute('lang'));
    if (idioma === idiomaDestino() || SIN_IDIOMA.has(idioma)) return false;
    if (traducidoPorX(nodo)) return false;
    return TIENE_LETRAS.test((nodo.textContent ?? '').replace(/https?:\/\/\S+/g, ''));
  }

  // ── Examen de los artículos ────────────────────────────────────────────────────────────

  function examinar(article) {
    // X recicla artículos: las marcas son de la publicación que había cuando se pusieron.
    const idArticulo = idDelArticulo(article);
    if (articulosConBoton.has(article) && articulosConBoton.get(article) !== idArticulo) articulosConBoton.delete(article);
    if (revertidos.has(article) && revertidos.get(article) !== idArticulo) revertidos.delete(article);
    // Camino del clic. Donde quien navega volvió al original no se vuelve a pulsar nada.
    if (!revertidos.has(article)) {
      for (const el of article.querySelectorAll('button, [role="button"]')) {
        if (estado.has(el) || esNuestro(el) || !esBotonTraducir(el)) continue;
        registrarBoton(el);
        articulosConBoton.set(article, idArticulo);
      }
    }
    // Con botón de X, el artículo entero va por el camino del clic y no se pide nada.
    if (articulosConBoton.has(article)) return;
    for (const nodo of bloquesDe(article)) revisarTexto(nodo);
  }

  function examinarSeguro(article) {
    try {
      examinar(article);
    } catch (error) {
      // Un artículo raro no debe tumbar el examen de los demás.
      console.warn('[X AutoTranslate] No se pudo examinar un artículo:', error?.message);
    }
  }

  // ── Camino del clic: pulsar el botón de X ──────────────────────────────────────────────

  function registrarBoton(btn) {
    estado.set(btn, 'visto');
    observados.add(btn);
    visibilidad.observe(btn);
  }

  function alEntrarBoton(btn) {
    if (estado.get(btn) !== 'visto' || paradas.has(btn) || revertidos.has(btn.closest('article'))) return;
    paradas.set(btn, setTimeout(() => {
      paradas.delete(btn);
      if (estado.get(btn) === 'visto' && esBotonTraducir(btn) && enPantalla(btn)) encolarClic(btn);
    }, RITMO.PARADA_MS));
  }

  function encolarClic(btn) {
    estado.set(btn, 'enCola');
    cola.push({ tipo: 'clic', boton: btn });
    bombeo();
  }

  function sorteo() {
    return RITMO.HUECO_MIN_MS + Math.random() * (Math.max(RITMO.HUECO_MAX_MS, RITMO.HUECO_MIN_MS) - RITMO.HUECO_MIN_MS);
  }

  function pulsar(btn) {
    const ahora = performance.now();
    intentos.set(btn, (intentos.get(btn) ?? 0) + 1);
    pendientes.set(btn, ahora);
    // El hueco se sortea y no depende de la respuesta de X: si X quita el control de inmediato,
    // los clics no van a cadencia fija ni se acumulan.
    huecoHasta = ahora + sorteo();
    estado.set(btn, 'pendiente');
    btn.click();
    programar(RITMO.HUECO_MIN_MS);
  }

  // Un pendiente cuyo botón ya no es de traducir ha salido bien (X lo ha sustituido).
  // Si sigue ahí pasados FALLO_MS, el clic ha fallado.
  function resolverPendientes() {
    const ahora = performance.now();
    for (const [btn, clic] of pendientes) {
      if (btn.isConnected && esBotonTraducir(btn)) {
        if (ahora - clic < RITMO.FALLO_MS) continue;
        pendientes.delete(btn);
        falloDeClic(btn);
      } else {
        pendientes.delete(btn);
        fallosSeguidos = 0;
        soltar(btn);
      }
    }
  }

  // Al segundo fallo la publicación se deja en paz; al primero se reintenta una vez.
  function falloDeClic(btn) {
    fallosSeguidos += 1;
    if (fallosSeguidos >= RITMO.FALLOS_PARA_PAUSA) {
      pausar(RITMO.PAUSA_MS);
      fallosSeguidos = 0;
    }
    if (intentos.get(btn) >= 2) {
      soltar(btn);
      return;
    }
    setTimeout(() => {
      if (estado.get(btn) !== 'pendiente' || !btn.isConnected || !esBotonTraducir(btn)) return;
      // Si mientras tanto salió de pantalla, se reintenta cuando vuelva a entrar.
      if (enPantalla(btn)) encolarClic(btn);
      else estado.set(btn, 'visto');
    }, RITMO.REINTENTO_MS);
  }

  function pausar(ms) {
    pausadoHasta = Math.max(pausadoHasta, performance.now() + ms);
  }

  // Deja de mirarse: ese elemento no se vuelve a tocar.
  function soltar(btn) {
    visibilidad.unobserve(btn);
    observados.delete(btn);
    estado.set(btn, 'descartado');
  }

  const candidatoValido = (btn) => btn.isConnected && !esNuestro(btn) && esBotonTraducir(btn) && enPantalla(btn);

  // ── Camino de petición: pedir la traducción a X ────────────────────────────────────────

  // Clasifica un bloque: traducido por X, en el idioma de la interfaz, ya en memoria,
  // registrado o nuevo.
  function revisarTexto(nodo) {
    const id = idDe(nodo);
    if (cajas.has(nodo)) {
      // X reutilizó el bloque para otra publicación.
      if (cajas.get(nodo).getAttribute('data-xat-id') !== id) quitarTraduccion(nodo);
      else {
        asegurarCaja(nodo);
        return;
      }
    }
    const info = textos.get(nodo);
    if (info && info.id !== id) textos.delete(nodo);
    if (!esCandidato(nodo, id)) return;
    // Si ya sabemos su traducción, se pone sin esperar ni volver a pedir.
    if (memoria.has(id)) {
      if (!yaPintada(id)) mostrarTraduccion(nodo, id, memoria.get(id));
      return;
    }
    if (textos.has(nodo)) return;
    textos.set(nodo, { id, estado: 'visto' });
    observados.add(nodo);
    visibilidad.observe(nodo);
    // Si el bloque ya se estaba observando, el observador no vuelve a avisar: se arranca la
    // parada aquí mismo (alEntrarTexto ya evita los temporizadores duplicados).
    alEntrarTexto(nodo);
  }

  function alEntrarTexto(nodo) {
    const info = textos.get(nodo);
    if (!info || info.estado !== 'visto' || paradas.has(nodo)) return;
    paradas.set(nodo, setTimeout(() => {
      paradas.delete(nodo);
      const actual = textos.get(nodo);
      if (actual?.estado !== 'visto' || !enPantalla(nodo) || !esCandidato(nodo, actual.id)) return;
      encolarTexto(nodo);
    }, RITMO.PARADA_MS));
  }

  // Una sola tarea en cola por publicación. Si ya hay otra, de este bloque se encarga la que
  // hay: cuando llegue la traducción se pinta en todos los bloques de esa publicación.
  function encolarTexto(nodo) {
    const info = textos.get(nodo);
    if (!info || info.estado !== 'visto' || enCola.has(info.id)) return;
    info.estado = 'enCola';
    enCola.add(info.id);
    cola.push({ tipo: 'texto', nodo, id: info.id, intentos: 0, noAntes: 0 });
    bombeo();
  }

  // Una tarea deja la cola sin pedir nada más: la publicación vuelve a estar libre.
  function soltarTrabajo(trabajo) {
    enCola.delete(trabajo.id);
    const info = textos.get(trabajo.nodo);
    if (info && info.id === trabajo.id && info.estado === 'enCola') info.estado = 'visto';
    rearmarOtros(trabajo.id, trabajo.nodo);
  }

  // Si la tarea de una publicación se cae, otro bloque suyo que esté en pantalla toma el relevo.
  function rearmarOtros(id, excepto) {
    for (const otro of observados) {
      const info = textos.get(otro);
      if (otro !== excepto && info?.id === id && info.estado === 'visto' && !paradas.has(otro)) alEntrarTexto(otro);
    }
  }

  const textoValido = ({ nodo, id }) => {
    const info = textos.get(nodo);
    return !!info && info.id === id && nodo.isConnected && enPantalla(nodo) && !cajas.has(nodo) && esCandidato(nodo, id);
  };

  // Cuánto hay que esperar para poder volver a pedir a X: 0 si ya se puede, Infinity si hasta
  // un acontecimiento (volver a la pestaña, recargar la página) y si no los ms de espera.
  function esperaParaPedir() {
    if (paroPorPermiso) {
      avisar('permiso', 'X rechazó las peticiones de traducción (401 o 403 en todas sus rutas). Causas probables: '
        + 'sesión caducada, cuenta sin acceso al servicio, o X cambió la clave pública de su cliente web '
        + '(CLIENTE_PUBLICO_X en content.js). No se pide nada más hasta recargar la página.');
      return Infinity;
    }
    if (paroPorFallos) {
      avisar('paro-fallos', 'X no está traduciendo nada: dos pausas seguidas por fallos sin ningún éxito. '
        + 'No se pide nada más hasta recargar la página.');
      return Infinity;
    }
    if (pedidasEnPagina >= TOPE.PAGINA) {
      avisar('tope-pagina', `Tope de ${TOPE.PAGINA} traducciones por página alcanzado: no se pide nada más hasta recargar la página.`);
      return Infinity;
    }
    if (document.hidden) return Infinity;
    if (cupoHasta > Date.now()) {
      avisar('cupo', 'X está cerca de su límite de traducciones en esta ventana: se deja de pedir '
        + 'hasta que se reinicie, para no pasarse de ese límite.');
      return cupoHasta - Date.now();
    }
    while (pedidasPorHora.length && pedidasPorHora[0] + TOPE.VENTANA_MS <= performance.now()) pedidasPorHora.shift();
    if (pedidasPorHora.length >= TOPE.HORA) {
      avisar('tope-hora', `Tope de ${TOPE.HORA} traducciones por hora alcanzado: se espera a que pase el tiempo.`);
      return pedidasPorHora[0] + TOPE.VENTANA_MS - performance.now();
    }
    return 0;
  }

  function avisar(clave, texto) {
    if (avisados.has(clave)) return;
    avisados.add(clave);
    console.warn(`[X AutoTranslate] ${texto}`);
  }

  async function pedirTraduccion(trabajo) {
    const { nodo, id } = trabajo;
    enCola.delete(id);
    const info = textos.get(nodo);
    if (info && info.id === id) info.estado = 'pedido';
    peticionEnVuelo = true;
    const empieza = performance.now();
    if (!pedidas.has(id)) {
      // Cada cuenta empieza con la primera petición; los reintentos no cuentan doble.
      pedidas.add(id);
      pedidasEnPagina += 1;
      pedidasPorHora.push(empieza);
    }
    let traduccion;
    let fallo = null;
    try {
      traduccion = await pedirAX(id);
    } catch (error) {
      fallo = error;
    }
    const fin = performance.now();
    peticionEnVuelo = false;
    huecoHasta = fin + sorteo();
    if (fallo) {
      tratarFallo(trabajo, fallo, fin - empieza);
    } else {
      fallosSeguidos = 0;
      pausasSinExito = 0;
      if (memoria.size >= TOPE.MEMORIA) memoria.delete(memoria.keys().next().value);
      memoria.set(id, traduccion);
      // Se pinta en su bloque y en cualquier otro de la misma publicación que esté esperando.
      // Solo si el bloque sigue siendo esa misma publicación y sigue sin nada propio.
      if (nodo.isConnected && !cajas.has(nodo) && esCandidato(nodo, id)) mostrarTraduccion(nodo, id, traduccion);
      for (const otro of observados) {
        if (otro !== nodo && !cajas.has(otro) && textos.get(otro)?.id === id && esCandidato(otro, id)) {
          mostrarTraduccion(otro, id, traduccion);
        }
      }
    }
    programar(Math.max(0, huecoHasta - performance.now()));
  }

  function tratarFallo(trabajo, error, ms) {
    const { nodo, id } = trabajo;
    fallosSeguidos += 1;
    trabajo.intentos += 1;
    if (error.estado === 429) pausar(error.esperaMs);
    if (error.permiso) paroPorPermiso = true;
    // 404 u otro 4xx es definitivo; un 429 no: es un límite y se reintenta.
    const definitivo = error.permiso || trabajo.intentos >= 2
      || (error.tipo === 'estado' && error.estado >= 400 && error.estado < 500 && error.estado !== 429);
    console.warn(`[X AutoTranslate] X no tradujo la publicación ${id}: ${error.message} (${Math.round(ms)} ms). `
      + (definitivo ? 'Se deja en paz.' : 'Se reintenta una vez.')
      + (error.detalle ? ` Respondió: ${error.detalle}` : ''));
    const info = textos.get(nodo);
    if (definitivo) {
      fallidas.add(id);
      if (info && info.id === id) info.estado = 'descartado';
    } else {
      // La misma tarea vuelve a la cola: tras un 429 la pausa ya hace de espera; en los demás
      // casos se espera el tiempo de reintento.
      trabajo.noAntes = error.estado === 429 ? 0 : performance.now() + RITMO.REINTENTO_MS;
      if (info && info.id === id) info.estado = 'enCola';
      enCola.add(id);
      cola.push(trabajo);
      programar(Math.max(0, trabajo.noAntes - performance.now()));
    }
    if (fallosSeguidos >= RITMO.FALLOS_PARA_PAUSA) {
      // Los 429 también cuentan: son la señal más clara de que X está al límite.
      pausar(RITMO.PAUSA_MS);
      fallosSeguidos = 0;
      pausasSinExito += 1;
      // Disyuntor: dos pausas seguidas sin ningún éxito significan que X no traduce nada.
      if (pausasSinExito >= 2) paroPorFallos = true;
    }
  }

  // Una petición cruda a una ruta de traducción de X. Devuelve lo que contestó; no lo interprete.
  // La señal es el tope de tiempo de toda la publicación.
  async function abrirRuta(id, ruta, señal) {
    const esGrok = ruta !== 'clasico';
    const url = {
      grok: '/i/api/2/grok/translation.json',
      'grok-api': 'https://api.x.com/2/grok/translation.json',
      clasico: '/i/api/1.1/strato/column/None/'
        + `tweetId=${id},destinationLanguage=Some(${idiomaDestino()}),translationSource=Some(X),feature=None,timeout=None,onlyCached=None`
        + '/translation/service/translateTweet',
    }[ruta];
    const empieza = performance.now();
    try {
      const respuesta = await fetch(url, {
        method: esGrok ? 'POST' : 'GET',
        credentials: 'include',
        headers: esGrok
          ? { ...cabecerasDeSesion(), 'content-type': 'text/plain;charset=UTF-8' }
          : cabecerasDeSesion(),
        body: esGrok ? JSON.stringify({ content_type: 'POST', id, dst_lang: idiomaDestino() }) : undefined,
        signal: señal,
      });
      const cuerpo = await respuesta.text();
      const cabeceras = {};
      for (const nombre of ['retry-after', 'x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset']) {
        cabeceras[nombre] = respuesta.headers.get(nombre);
      }
      return { estado: respuesta.status, ms: Math.round(performance.now() - empieza), cabeceras, cuerpo };
    } catch (error) {
      // El corte por tiempo llega como «TimeoutError» (AbortSignal.timeout) o como «AbortError».
      // Cualquier otra cosa es la red.
      const aTiempo = error?.name === 'AbortError' || error?.name === 'TimeoutError';
      const fallo = new Error(aTiempo ? 'tiempo agotado' : 'error de red');
      fallo.tipo = aTiempo ? 'timeout' : 'red';
      throw fallo;
    }
  }

  function cabecerasDeSesion() {
    return {
      authorization: `Bearer ${CLIENTE_PUBLICO_X}`,
      'x-csrf-token': cookie('ct0'),
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': idiomaDestino(),
    };
  }

  // Un trozo de lo que respondió X, para el aviso en consola: 240 caracteres como mucho. La
  // respuesta clásica de la X real lleva al final el dato que importa (translationState).
  const recorte = (cuerpo) => cuerpo.slice(0, 240).replace(/\s+/g, ' ');

  const describirFallo = (fallo) => ({
    estado: `HTTP ${fallo.estado}`,
    red: 'error de red',
    timeout: 'tiempo agotado',
    vacia: 'respuesta sin traducción',
    sinTiempo: 'sin tiempo para probarla',
  }[fallo.tipo] ?? fallo.tipo);

  // Le pide a X la traducción de una publicación. Devuelve el texto o lanza un Error con
  // `.tipo` ('estado' | 'red' | 'timeout' | 'vacia'), `.estado`, `.esperaMs`, `.permiso` y
  // `.detalle` (un trozo de lo que respondió).
  async function pedirAX(id) {
    const porProbar = ['grok'];
    const resultados = [];
    let sinPermisoEnTodas = true;
    let ultimo = null;
    // El tope de tiempo vale para toda la publicación, no para cada ruta: agotado, no se sigue.
    // Una sola señal sirve para todas sus rutas.
    const señal = AbortSignal.timeout(RITMO.PETICION_MAX_MS);
    while (porProbar.length) {
      const ruta = porProbar.shift();
      const fallo = { ruta, tipo: '', estado: 0, esperaMs: 0, detalle: '' };
      if (señal.aborted) {
        fallo.tipo = 'sinTiempo';
      } else {
        try {
          const cruda = await abrirRuta(id, ruta, señal);
          apuntarCupo(cruda.cabeceras);
          fallo.estado = cruda.estado;
          fallo.esperaMs = cruda.estado === 429 ? esperaTrasEl429(cruda) : 0;
          if (cruda.estado === 200) {
            const texto = ruta === 'clasico' ? textoClasico(cruda.cuerpo) : textoGrok(cruda.cuerpo);
            if (texto) return texto;
            fallo.tipo = 'vacia';
            fallo.detalle = recorte(cruda.cuerpo);
          } else {
            fallo.tipo = 'estado';
            fallo.detalle = recorte(cruda.cuerpo);
          }
        } catch (error) {
          fallo.tipo = error.tipo;
        }
      }
      resultados.push(`${ruta}: ${describirFallo(fallo)}`);
      sinPermisoEnTodas &&= fallo.estado === 401 || fallo.estado === 403;
      ultimo = fallo;
      if (fallo.estado === 429) break; // límite: no se insiste por otra ruta
      if (ruta === 'grok' && fallo.estado === 404) porProbar.unshift('grok-api'); // la misma ruta en api.x.com
      if (ruta !== 'clasico' && !porProbar.includes('clasico')) porProbar.push('clasico');
    }
    const error = new Error(`probadas ${resultados.join(', ')}`);
    error.tipo = ultimo.tipo;
    error.estado = ultimo.estado;
    error.esperaMs = ultimo.esperaMs;
    error.detalle = ultimo.detalle;
    error.permiso = sinPermisoEnTodas;
    throw error;
  }

  // X reparte su traducción en ventanas y lo cuenta en las cabeceras de cada respuesta. Medido
  // en la X real (sonda del 26-nov-2026): 100 peticiones por ventana en el servicio de Grok y
  // 187 en el clásico; la ventana parece de 15 minutos, a juzgar por la hora de reinicio. Cuando
  // quedan pocas se deja de pedir hasta el reinicio, por prudencia: ese contador puede que no sea
  // solo de la extensión (otras pestañas, la propia X) y pasarse es un 429 contra la cuenta. Si
  // las cabeceras no vienen, no se reserva nada.
  const CUPO_RESERVA = 10;
  function apuntarCupo(cabeceras) {
    const quedan = cabeceras['x-rate-limit-remaining'];
    if (!quedan || !Number.isInteger(Number(quedan)) || Number(quedan) < 0) return;
    const reinicio = Number(cabeceras['x-rate-limit-reset']);
    cupoVisto = `${quedan} de ${cabeceras['x-rate-limit-limit'] ?? '?'}`;
    if (Number(quedan) > CUPO_RESERVA || !(reinicio * 1000 > Date.now())) return;
    cupoHasta = Math.max(cupoHasta, reinicio * 1000 + 1000);
  }

  // Lo que dijo X que hay que esperar tras un 429: `retry-after` en segundos o en fecha HTTP,
  // o la hora de reseteo; si no viene nada, 60 s. Nunca más de 15 minutos.
  function esperaTrasEl429(cruda) {
    let ms = 0;
    const retryAfter = cruda.cabeceras['retry-after']?.trim();
    if (retryAfter) ms = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
    if (!(ms > 0) && cruda.cabeceras['x-rate-limit-reset']) ms = Number(cruda.cabeceras['x-rate-limit-reset']) * 1000 - Date.now();
    return ms > 0 ? Math.min(ms, 15 * 60 * 1000) : RITMO.PAUSA_MS;
  }

  // Algunas respuestas de X van cifradas en base64 con el prefijo «data:».
  function descifrar(cuerpo) {
    const texto = cuerpo.trim();
    if (!texto.startsWith('data:')) return texto;
    try {
      return atob(texto.slice(5).replace(/\s+/g, ''));
    } catch {
      return texto;
    }
  }

  // Cada objeto JSON que trae un cuerpo. La ruta de Grok contesta en trozos y X puede
  // separarlos con saltos de línea o con espacios (la sonda del 26-nov-2026 no dejó
  // distinguirlo): se sigue el nivel de llaves, así que un texto con llaves o comillas dentro
  // no se parte.
  function objetosJson(cuerpo) {
    const objetos = [];
    let nivel = 0;
    let empieza = -1;
    let enCadena = false;
    let escapado = false;
    for (let i = 0; i < cuerpo.length; i += 1) {
      const c = cuerpo[i];
      if (enCadena) {
        if (escapado) escapado = false;
        else if (c === '\\') escapado = true;
        else if (c === '"') enCadena = false;
      } else if (c === '"') enCadena = true;
      else if (c === '{' || c === '[') {
        if (nivel === 0) empieza = i;
        nivel += 1;
      } else if (c === '}' || c === ']') {
        nivel = Math.max(0, nivel - 1);
        if (nivel === 0 && empieza >= 0) {
          objetos.push(cuerpo.slice(empieza, i + 1));
          empieza = -1;
        }
      }
    }
    return objetos;
  }

  // La ruta de Grok contesta en trozos, un objeto JSON cada uno: se concatenan sus textos.
  function textoGrok(cuerpo) {
    const piezas = [];
    for (const objeto of objetosJson(descifrar(cuerpo))) {
      try {
        const dato = JSON.parse(objeto);
        const texto = dato?.result?.text ?? dato?.translated_text ?? dato?.text;
        if (typeof texto === 'string' && texto) piezas.push(texto);
      } catch { /* trozos que no son JSON */ }
    }
    const texto = piezas.join('').trim();
    return texto && !RESPUESTA_META.test(texto) ? texto : '';
  }

  function textoClasico(cuerpo) {
    try {
      const texto = JSON.parse(descifrar(cuerpo))?.translation;
      const limpio = typeof texto === 'string' ? texto.trim() : '';
      return limpio && !RESPUESTA_META.test(limpio) ? limpio : '';
    } catch {
      return '';
    }
  }

  // ── Nuestra caja ───────────────────────────────────────────────────────────────────────

  const yaPintada = (id) => [...cajasVivas].some((caja) => caja.getAttribute('data-xat-id') === id);

  let nombresDeIdioma = null;

  // «Traducido del francés»; «Traducido de la lengua…»; «Traducido» si no hay nombre.
  function rotuloDe(codigo) {
    let nombre = '';
    try {
      nombresDeIdioma ??= new Intl.DisplayNames(['es'], { type: 'language' });
      nombre = nombresDeIdioma.of(baseDelIdioma(codigo)) ?? '';
    } catch { /* código desconocido */ }
    if (!nombre) return 'Traducido';
    return /^(lengua|idioma)\b/i.test(nombre) ? `Traducido de ${nombre}` : `Traducido del ${nombre}`;
  }

  // Solo se pinta una vez por publicación: el primer bloque de esa publicación.
  function mostrarTraduccion(nodo, id, traduccion) {
    if (cajas.has(nodo) || yaPintada(id)) return;
    const caja = armarCaja(nodo, id, traduccion);
    // Primero la caja; solo entonces se esconde el original.
    nodo.after(caja);
    cajas.set(nodo, caja);
    duenoDe.set(caja, nodo);
    cajasVivas.add(caja);
    nodo.setAttribute('data-xat-id', id);
    nodo.setAttribute('data-xat', 'traducido');
    visibilidad.unobserve(nodo);
    observados.delete(nodo);
    const info = textos.get(nodo);
    if (info) info.estado = 'hecho';
  }

  // Todo con textContent: el texto traducido nunca se interpreta como HTML.
  function armarCaja(nodo, id, traduccion) {
    const caja = document.createElement('div');
    caja.className = 'xat-caja';
    caja.setAttribute('data-xat-id', id);
    // La tipografía del texto es la del bloque de X al que sustituye: X fija el tamaño, la
    // fuente y el interlineado en el propio bloque, no en su padre, y heredando del padre el
    // texto traducido salía más pequeño (X real, 26-nov-2026). Se toman del bloque como
    // variables que usan las reglas de content.css; si alguna faltara, se hereda como antes.
    const estilo = getComputedStyle(nodo);
    const tipografia = {
      '--xat-fuente': estilo.fontFamily,
      '--xat-tamano': estilo.fontSize,
      '--xat-peso': estilo.fontWeight,
      '--xat-interlineado': estilo.lineHeight,
      '--xat-espaciado': estilo.letterSpacing,
    };
    for (const [variable, valor] of Object.entries(tipografia)) if (valor) caja.style.setProperty(variable, valor);
    const barra = document.createElement('div');
    barra.className = 'xat-barra';
    const rotulo = document.createElement('span');
    rotulo.className = 'xat-rotulo';
    rotulo.textContent = rotuloDe(nodo.getAttribute('lang') ?? '');
    const enlace = document.createElement('button');
    enlace.type = 'button';
    enlace.className = 'xat-enlace';
    enlace.textContent = 'Mostrar original';
    enlace.addEventListener('click', (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      alternar(nodo, id);
    });
    barra.append(rotulo, enlace);
    const cuerpo = document.createElement('div');
    cuerpo.className = 'xat-texto';
    cuerpo.lang = idiomaDestino();
    cuerpo.dir = 'auto';
    cuerpo.textContent = traduccion;
    caja.append(barra, cuerpo);
    return caja;
  }

  // «Mostrar original» enseña el texto de X y deja «Mostrar traducción», que vuelve a pintar la
  // que ya se tenía. Lo devuelto al original no se vuelve a pedir ni a pintar en esta página.
  function alternar(nodo, id) {
    const caja = cajas.get(nodo);
    if (!caja) return;
    const aOriginal = caja.getAttribute('data-xat-vista') !== 'original';
    caja.setAttribute('data-xat-vista', aOriginal ? 'original' : 'traduccion');
    caja.querySelector('.xat-enlace').textContent = aOriginal ? 'Mostrar traducción' : 'Mostrar original';
    if (aOriginal) {
      nodo.removeAttribute('data-xat');
      devueltas.add(id);
    } else {
      nodo.setAttribute('data-xat', 'traducido');
      devueltas.delete(id);
    }
  }

  function quitarTraduccion(nodo) {
    const caja = cajas.get(nodo);
    if (caja) {
      caja.remove();
      cajasVivas.delete(caja);
      duenoDe.delete(caja);
    }
    cajas.delete(nodo);
    nodo.removeAttribute('data-xat');
    nodo.removeAttribute('data-xat-id');
  }

  // Invariante: un bloque oculto sin su caja delante no puede existir.
  function asegurarCaja(nodo) {
    const caja = cajas.get(nodo);
    if (!caja.isConnected) {
      quitarTraduccion(nodo);
      return;
    }
    // X cambió de sitio el bloque: la caja va con él.
    if (caja.previousElementSibling !== nodo) nodo.after(caja);
    const enOriginal = caja.getAttribute('data-xat-vista') === 'original';
    if (enOriginal === nodo.hasAttribute('data-xat')) {
      if (enOriginal) nodo.removeAttribute('data-xat');
      else nodo.setAttribute('data-xat', 'traducido');
    }
  }

  // X borró nuestra caja: el original vuelve a verse en el acto.
  function restaurarOriginalDe(caja) {
    const nodo = duenoDe.get(caja);
    if (!nodo) return;
    quitarTraduccion(nodo);
    const info = textos.get(nodo);
    if (info) info.estado = 'descartado';
  }

  // ── Cola ───────────────────────────────────────────────────────────────────────────────

  function bombeo() {
    resolverPendientes();
    const ahora = performance.now();
    // El fallo más cercano lleva su propio despertador: en una página quieta nada más llamaría
    // a bombeo() y un clic sin respuesta no se detectaría nunca.
    let proximoFallo = Infinity;
    for (const clic of pendientes.values()) proximoFallo = Math.min(proximoFallo, clic + RITMO.FALLO_MS);
    if (proximoFallo < Infinity) programar(proximoFallo - ahora);
    if (ahora < pausadoHasta) {
      programar(pausadoHasta - ahora);
      return;
    }
    // Mientras hay una petición en curso no se arranca nada: una cada vez.
    if (peticionEnVuelo) return;
    // Hasta que X responde al último clic (o pasa ESPERA_MAX_MS), y hasta que pasa el hueco
    // sorteado, no se trabaja el siguiente.
    let bloqueo = 0;
    for (const clic of pendientes.values()) bloqueo = Math.max(bloqueo, clic + RITMO.ESPERA_MAX_MS - ahora);
    const falta = Math.max(bloqueo, huecoHasta - ahora);
    if (falta > 0) {
      programar(falta);
      return;
    }
    // Se recorre la cola sin sacarlo todo: lo que espera se queda en su sitio y lo demás sigue.
    let esperaPeticiones = null; // el techo se calcula una sola vez por pasada
    let i = 0;
    while (i < cola.length) {
      const trabajo = cola[i];
      if (trabajo.tipo === 'clic') {
        cola.splice(i, 1);
        const btn = trabajo.boton;
        if (candidatoValido(btn)) {
          pulsar(btn);
          return;
        }
        // Salió de pantalla mientras esperaba: vuelve a empezar si reaparece.
        if (estado.get(btn) === 'enCola') estado.set(btn, 'visto');
        continue;
      }
      if (trabajo.noAntes > ahora) {
        programar(trabajo.noAntes - ahora);
        i += 1;
        continue;
      }
      if (esperaPeticiones === null) {
        esperaPeticiones = esperaParaPedir();
        if (esperaPeticiones > 0 && Number.isFinite(esperaPeticiones)) programar(esperaPeticiones);
      }
      if (esperaPeticiones > 0) {
        // Parado por el techo o por un paro: se queda en la cola y no estorba a los clics.
        i += 1;
        continue;
      }
      cola.splice(i, 1);
      if (memoria.has(trabajo.id)) {
        // Mientras esperaba ya llegó su traducción por otro bloque de la misma publicación.
        soltarTrabajo(trabajo);
        const { nodo } = trabajo;
        if (nodo.isConnected && !cajas.has(nodo) && esCandidato(nodo, trabajo.id)) {
          mostrarTraduccion(nodo, trabajo.id, memoria.get(trabajo.id));
        }
        continue;
      }
      // Salió de pantalla, X lo cambió o ya no es candidato: se suelta y vuelve a empezar si reaparece.
      if (!textoValido(trabajo)) {
        soltarTrabajo(trabajo);
        continue;
      }
      pedirTraduccion(trabajo);
      return;
    }
  }

  function programar(ms) {
    const cuando = performance.now() + ms;
    if (temporizador && avisoEn <= cuando) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = 0;
      bombeo();
    }, ms);
    avisoEn = cuando;
  }

  // ── Observadores ───────────────────────────────────────────────────────────────────────

  function alEntrar(objetivo) {
    if (estado.has(objetivo)) alEntrarBoton(objetivo);
    else alEntrarTexto(objetivo);
  }

  function alSalir(objetivo) {
    clearTimeout(paradas.get(objetivo));
    paradas.delete(objetivo);
  }

  const visibilidad = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) alEntrar(entrada.target);
      else alSalir(entrada.target);
    }
  });

  function reexaminar() {
    if (examenPendiente) return;
    examenPendiente = true;
    setTimeout(() => {
      examenPendiente = false;
      for (const article of sucios) examinarSeguro(article);
      sucios.clear();
      // Lo que ya no está en la página deja de ocupar al observador.
      for (const elemento of observados) {
        if (!elemento.isConnected) {
          visibilidad.unobserve(elemento);
          observados.delete(elemento);
        }
      }
      bombeo();
    }, RITMO.REEXAMEN_MS);
  }

  // X redibuja sin parar. Cada cambio dentro de un artículo lo marca para el próximo examen
  // (también los nodos de texto: X reutiliza bloques cambiando solo su contenido); cada caja
  // nuestra que desaparece devuelve su original; y lo que toca un artículo que lleva caja se
  // examina en el acto, porque X puede haber reutilizado el bloque para otra publicación.
  const articuloDe = (nodo) => (nodo.nodeType === 1 ? nodo.closest('article') : nodo.parentElement?.closest('article'));

  new MutationObserver((mutaciones) => {
    try {
      const tocados = cajasVivas.size ? new Set() : null;
      for (const mutacion of mutaciones) {
        if (mutacion.type === 'characterData') {
          const article = articuloDe(mutacion.target);
          if (article) {
            sucios.add(article);
            if (tocados) tocados.add(article);
          }
          continue;
        }
        for (const nodo of mutacion.addedNodes) {
          const article = articuloDe(nodo);
          if (article) {
            sucios.add(article);
            if (tocados) tocados.add(article);
          } else if (nodo.nodeType === 1) {
            for (const interior of nodo.querySelectorAll('article')) sucios.add(interior);
          }
        }
        if (!cajasVivas.size) continue;
        for (const nodo of mutacion.removedNodes) {
          if (nodo.nodeType !== 1) continue;
          if (nodo.classList.contains('xat-caja')) restaurarOriginalDe(nodo);
          else for (const caja of nodo.querySelectorAll('.xat-caja')) restaurarOriginalDe(caja);
        }
      }
      if (tocados) for (const article of tocados) if (article.querySelector('.xat-caja')) examinarSeguro(article);
      if (sucios.size) reexaminar();
    } catch (error) {
      console.warn('[X AutoTranslate] No se pudo procesar un cambio de la página:', error?.message);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // Con la pestaña en segundo plano no se pide nada; al volver, sigue.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bombeo();
  });

  // La versión es la del manifiesto: tras recargar la extensión, en consola se ve qué código
  // está cargado. Fuera de una extensión (la bancada) no hay versión y no se enseña nada.
  function version() {
    try {
      return globalThis.chrome?.runtime?.getManifest?.().version ?? '';
    } catch {
      return '';
    }
  }

  // Una sola vez, a los 5 s: el estado de la página en consola, contando todos los casos (también
  // los que no se pueden pedir), para que nada falle en silencio. Y, si hay botones que parecen
  // de traducir y no están en la lista, cuáles son, para añadirlos.
  function diagnosticar() {
    const cuenta = { deX: 0, destino: 0, sinIdioma: 0, sinEnlace: 0, devueltas: 0, traducidas: 0 };
    let bloques = 0;
    for (const nodo of document.querySelectorAll('article [data-testid="tweetText"]')) {
      bloques += 1;
      if (cajas.has(nodo)) {
        if (cajas.get(nodo).getAttribute('data-xat-vista') === 'original') cuenta.devueltas += 1;
        else cuenta.traducidas += 1;
      } else if (traducidoPorX(nodo)) cuenta.deX += 1;
      else if (baseDelIdioma(nodo.getAttribute('lang')) === idiomaDestino()) cuenta.destino += 1;
      else if (SIN_IDIOMA.has(baseDelIdioma(nodo.getAttribute('lang')))) cuenta.sinIdioma += 1;
      else if (!idDe(nodo)) cuenta.sinEnlace += 1;
      else if (devueltas.has(idDe(nodo))) cuenta.devueltas += 1;
    }
    const cargada = version();
    console.info(`[X AutoTranslate] Página: ${cargada ? `v${cargada} · ` : ''}bloques de texto ${bloques} · ya traducidas por X: ${cuenta.deX} · `
      + `en el idioma de la interfaz: ${cuenta.destino} · sin idioma: ${cuenta.sinIdioma} · `
      + `sin enlace permanente: ${cuenta.sinEnlace} · devueltas al original: ${cuenta.devueltas} · `
      + `traducidas: ${cuenta.traducidas} · pedidas: ${pedidas.size} · fallidas: ${fallidas.size} · `
      + `en espera: ${cola.filter((trabajo) => trabajo.tipo === 'texto').length}`
      + (cupoVisto ? ` · cupo de X en esta ventana: ${cupoVisto}` : ''));
    if (!haySesion()) {
      console.warn('[X AutoTranslate] No hay sesión de X (falta la cookie ct0): no se pueden pedir traducciones.');
    }
    const vistas = new Set();
    for (const el of document.querySelectorAll('article button, article [role="button"]')) {
      if (esNuestro(el)) continue;
      for (const texto of [el.getAttribute('aria-label'), el.textContent]) {
        const etiquetaVista = texto?.trim();
        if (etiquetaVista && etiquetaVista.length <= 60 && PARECE_TRADUCCION.test(etiquetaVista)
          && !ETIQUETAS_TRADUCIR.has(etiquetaVista) && !ETIQUETAS_ORIGINAL.has(etiquetaVista)) vistas.add(etiquetaVista);
      }
    }
    if (vistas.size) {
      console.warn(`[X AutoTranslate] No reconozco estos botones de traducir y no los pulso: «${[...vistas].join('», «')}». `
        + 'Si es el botón de traducir de X, añádelo a ETIQUETAS_TRADUCIR en content.js.');
    }
  }

  // Si quien navega vuelve al original con el «Mostrar original» de X, en esa publicación no se
  // vuelve a pulsar nada ni a pedir su traducción.
  document.addEventListener('click', (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest('button, [role="button"]') : null;
    if (!boton || esNuestro(boton)) return;
    const article = boton.closest('article');
    if (!article || !esBotonOriginal(boton)) return;
    revertidos.set(article, idDelArticulo(article));
    const bloque = bloqueDespuesDe(boton, article);
    const id = bloque ? idDe(bloque) : '';
    if (id) devueltas.add(id);
  }, true);

  setTimeout(diagnosticar, RITMO.DIAGNOSTICO_MS);

  document.querySelectorAll('article').forEach(examinarSeguro);
})();
