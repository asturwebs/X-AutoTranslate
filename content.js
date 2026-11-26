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
// rien7/twitter-extension-api.
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
    PETICION_MAX_MS: 20000, // tiempo máximo de una petición de traducción a X
    ...AJUSTES,
  });

  // Techo de peticiones. Ratificado por el Socio el 26-nov-2026: la cuenta va por delante.
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
  const articulosConBoton = new WeakSet(); // <article> con botón «Traducir publicación» de X
  const pendientes = new Map();     // botón → momento del último clic, a la espera de X
  const intentos = new WeakMap();   // botón → clics que ha recibido
  const revertidos = new WeakSet(); // <article> donde el Socio pulsó el «Mostrar original» de X

  // Camino de petición. Estado de cada bloque de texto: 'visto', 'enCola', 'pedido', 'hecho'
  // (traducción puesta) o 'descartado' (no se vuelve a pedir).
  const textos = new WeakMap();
  const cajas = new WeakMap();      // bloque → nuestra caja
  const duenoDe = new WeakMap();    // caja → bloque
  const memoria = new Map();        // identificador → traducción que X ya contestó
  const devueltas = new Set();      // identificadores que el Socio devolvió al original
  const pedidas = new Set();        // publicaciones ya pedidas (para no contar dos veces)
  const fallidas = new Set();       // publicaciones que X no pudo traducir y se dejaron en paz
  const pedidasPorHora = [];        // momentos de la primera petición de cada publicación
  let pedidasEnPagina = 0;
  let peticionEnVuelo = false;
  let paroPorPermiso = false;       // X rechazó las peticiones: nada más hasta recargar

  const observados = new Set();     // botones y bloques que sigue mirando el IntersectionObserver
  const paradas = new Map();        // elemento → temporizador de la parada
  const cajasVivas = new Set();     // nuestras cajas que están en el documento
  const sucios = new Set();         // <article> con nodos nuevos desde el último examen
  const cola = [];                  // { tipo: 'clic', boton } | { tipo: 'texto', nodo, id, intentos }
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
    return hallado ? decodeURIComponent(hallado[1]) : '';
  }
  const haySesion = () => !!cookie('ct0');

  // Idioma base de la interfaz de X: la cookie `lang`, si es un código válido; si no, el de
  // <html lang>; y si no, español. (X usa `xx` para «inglés por defecto».)
  function idiomaDestino() {
    const deLaCookie = baseDelIdioma(cookie('lang'));
    const delHtml = baseDelIdioma(document.documentElement.lang);
    return (VALIDO_IDIOMA.test(deLaCookie) && deLaCookie) || (VALIDO_IDIOMA.test(delHtml) && delHtml) || 'es';
  }
  const VALIDO_IDIOMA = /^[a-z]{2,3}$/;
  const baseDelIdioma = (texto) => (texto ?? '').trim().toLowerCase().split('-')[0];

  // La caja de cita de un bloque: el ancestro role="link" más cercano dentro del artículo.
  function cajaDeCitaDe(nodo) {
    const articulo = nodo.closest('article');
    const caja = nodo.parentElement?.closest('[role="link"]');
    return articulo && caja && articulo.contains(caja) ? caja : null;
  }

  const identificadorEn = (enlace) => enlace?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] ?? '';

  // Identificador de la publicación de un bloque, por su enlace permanente.
  // Una cita solo se identifica por un enlace de su propia caja: nunca por el del post que la
  // contiene. El post, por su enlace con `time` fuera de las cajas de cita.
  function idDe(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return '';
    const caja = cajaDeCitaDe(nodo);
    if (caja) {
      const enlaces = [...caja.querySelectorAll('a[href*="/status/"]')];
      return identificadorEn(enlaces.find((enlace) => enlace.querySelector('time')) ?? enlaces[0]);
    }
    const enlaces = [...articulo.querySelectorAll('a[href*="/status/"]')].filter((enlace) => !cajaDeCitaDe(enlace));
    return identificadorEn(enlaces.find((enlace) => enlace.querySelector('time')) ?? enlaces[0]);
  }

  // ¿Viene `control` antes que `nodo` en el documento?
  const vieneAntes = (control, nodo) => (nodo.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;

  // X traduce solo el post principal de un hilo y pone su barra «Traducido de… · Mostrar
  // original» delante del texto. El bloque conserva el idioma original, así que `lang` no basta
  // para saberlo. ¿Hay un «Mostrar original» de X entre el bloque de texto anterior y este?
  function traducidoPorX(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return false;
    const bloques = [...articulo.querySelectorAll('[data-testid="tweetText"]')];
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
    for (const nodo of articulo.querySelectorAll('[data-testid="tweetText"]')) {
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
    if (!id || !haySesion() || devueltas.has(id)) return false;
    const idioma = baseDelIdioma(nodo.getAttribute('lang'));
    if (idioma === idiomaDestino() || SIN_IDIOMA.has(idioma)) return false;
    if (traducidoPorX(nodo)) return false;
    return TIENE_LETRAS.test((nodo.textContent ?? '').replace(/https?:\/\/\S+/g, ''));
  }

  // ── Examen de los artículos ────────────────────────────────────────────────────────────

  function examinar(article) {
    // Camino del clic. Donde el Socio volvió al original no se vuelve a pulsar nada.
    if (!revertidos.has(article)) {
      for (const el of article.querySelectorAll('button, [role="button"]')) {
        if (estado.has(el) || esNuestro(el) || !esBotonTraducir(el)) continue;
        registrarBoton(el);
        articulosConBoton.add(article);
      }
    }
    // Con botón de X, el artículo entero va por el camino del clic y no se pide nada.
    if (articulosConBoton.has(article)) return;
    for (const nodo of article.querySelectorAll('[data-testid="tweetText"]')) revisarTexto(nodo);
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
    if (MODO_SONDA) return;
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
    // parada aquí mismo (alEntrarTexto ya evita las temporizadores duplicados).
    alEntrarTexto(nodo);
  }

  function alEntrarTexto(nodo) {
    const info = textos.get(nodo);
    if (!info || info.estado !== 'visto' || paradas.has(nodo)) return;
    paradas.set(nodo, setTimeout(() => {
      paradas.delete(nodo);
      const actual = textos.get(nodo);
      if (actual?.estado !== 'visto' || !enPantalla(nodo) || !esCandidato(nodo, actual.id)) return;
      actual.estado = 'enCola';
      cola.push({ tipo: 'texto', nodo, id: actual.id, intentos: 0 });
      bombeo();
    }, RITMO.PARADA_MS));
  }

  const textoValido = ({ nodo, id }) => {
    const info = textos.get(nodo);
    return !!info && info.id === id && info.estado === 'enCola' && !cajas.has(nodo)
      && nodo.isConnected && enPantalla(nodo) && esCandidato(nodo, id);
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
    if (pedidasEnPagina >= TOPE.PAGINA) {
      avisar('tope-pagina', `Tope de ${TOPE.PAGINA} traducciones por página alcanzado: no se pide nada más hasta recargar la página.`);
      return Infinity;
    }
    if (document.hidden) return Infinity;
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
    const info = textos.get(nodo);
    if (info) info.estado = 'pedido';
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
    if (fallo) tratarFallo(trabajo, fallo, fin - empieza);
    else {
      fallosSeguidos = 0;
      if (memoria.size >= TOPE.MEMORIA) memoria.delete(memoria.keys().next().value);
      memoria.set(id, traduccion);
      // Solo se pinta si el bloque sigue siendo esa misma publicación y sigue sin nada propio.
      if (nodo.isConnected && idDe(nodo) === id && esCandidato(nodo, id) && !cajas.has(nodo) && !yaPintada(id)) {
        mostrarTraduccion(nodo, id, traduccion);
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
      + (definitivo ? 'Se deja en paz.' : 'Se reintenta una vez.'));
    if (definitivo) {
      fallidas.add(id);
      const info = textos.get(nodo);
      if (info) info.estado = 'descartado';
    } else {
      // Tras un 429 la pausa ya hace de espera; en los demás casos se espera el reintento.
      setTimeout(() => reencolar(trabajo), error.estado === 429 ? 0 : RITMO.REINTENTO_MS);
    }
    if (fallosSeguidos >= RITMO.FALLOS_PARA_PAUSA && error.estado !== 429) {
      pausar(RITMO.PAUSA_MS);
      fallosSeguidos = 0;
    }
  }

  function reencolar(trabajo) {
    const { nodo, id } = trabajo;
    const info = textos.get(nodo);
    if (!info || info.id !== id) return;
    info.estado = 'enCola';
    cola.push(trabajo);
    bombeo();
  }

  // Una petición cruda a una ruta de traducción de X. Devuelve lo que contestó; no lo interprete.
  async function abrirRuta(id, ruta) {
    const esGrok = ruta !== 'clasico';
    const url = {
      grok: '/i/api/2/grok/translation.json',
      'grok-api': 'https://api.x.com/2/grok/translation.json',
      clasico: '/i/api/1.1/strato/column/None/'
        + `tweetId=${id},destinationLanguage=Some(${idiomaDestino()}),translationSource=Some(X),feature=None,timeout=None,onlyCached=None`
        + '/translation/service/translateTweet',
    }[ruta];
    const controlador = new AbortController();
    const tope = setTimeout(() => controlador.abort(), RITMO.PETICION_MAX_MS);
    const empieza = performance.now();
    try {
      const respuesta = await fetch(url, {
        method: esGrok ? 'POST' : 'GET',
        credentials: 'include',
        headers: esGrok
          ? { ...cabecerasDeSesion(), 'content-type': 'text/plain;charset=UTF-8' }
          : cabecerasDeSesion(),
        body: esGrok ? JSON.stringify({ content_type: 'POST', id, dst_lang: idiomaDestino() }) : undefined,
        signal: controlador.signal,
      });
      const cuerpo = await respuesta.text();
      const cabeceras = {};
      for (const nombre of ['retry-after', 'x-rate-limit-reset']) cabeceras[nombre] = respuesta.headers.get(nombre);
      return { estado: respuesta.status, ms: Math.round(performance.now() - empieza), cabeceras, cuerpo };
    } catch (error) {
      const fallo = new Error(error?.name === 'AbortError' ? 'tiempo agotado' : 'error de red');
      fallo.tipo = error?.name === 'AbortError' ? 'timeout' : 'red';
      throw fallo;
    } finally {
      clearTimeout(tope);
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

  // Le pide a X la traducción de una publicación. Devuelve el texto o lanza un Error con
  // `.tipo` ('estado' | 'red' | 'timeout' | 'vacia'), `.estado`, `.esperaMs` y `.permiso`.
  async function pedirAX(id) {
    const porProbar = ['grok'];
    const resultados = [];
    let sinPermisoEnTodas = true;
    let ultimo = null;
    while (porProbar.length) {
      const ruta = porProbar.shift();
      const fallo = { ruta, tipo: '', estado: 0, esperaMs: 0, detalle: '' };
      try {
        const cruda = await abrirRuta(id, ruta);
        fallo.estado = cruda.estado;
        fallo.esperaMs = cruda.estado === 429 ? esperaTrasEl429(cruda) : 0;
        if (cruda.estado === 200) {
          const texto = ruta === 'clasico' ? textoClasico(cruda.cuerpo) : textoGrok(cruda.cuerpo);
          if (texto) return texto;
          fallo.tipo = 'vacia';
        } else {
          fallo.tipo = 'estado';
          fallo.detalle = cruda.cuerpo.slice(0, 120).replace(/\s+/g, ' ');
        }
      } catch (error) {
        fallo.tipo = error.tipo;
      }
      resultados.push(`${ruta}: ${fallo.tipo === 'estado' ? `HTTP ${fallo.estado}` : fallo.tipo}`);
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
    error.permiso = sinPermisoEnTodas;
    throw error;
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

  // La ruta de Grok contesta en trozos, uno por línea: se concatenan.
  function textoGrok(cuerpo) {
    const piezas = [];
    for (const linea of descifrar(cuerpo).split('\n')) {
      try {
        const dato = JSON.parse(linea);
        const texto = dato?.result?.text ?? dato?.translated_text ?? dato?.text;
        if (typeof texto === 'string' && texto) piezas.push(texto);
      } catch { /* líneas que no son JSON */ }
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
      nombre = nombresDeIdioma.of(codigo.split('-')[0]) ?? '';
    } catch { /* código desconocido */ }
    if (!nombre) return 'Traducido';
    return /^(lengua|idioma)\b/i.test(nombre) ? `Traducido de ${nombre}` : `Traducido del ${nombre}`;
  }

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

  // Invariante: un bloque oculto sin caja delante no puede existir.
  function asegurarCaja(nodo) {
    const caja = cajas.get(nodo);
    if (!caja.isConnected) {
      quitarTraduccion(nodo);
      return;
    }
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
    while (cola.length) {
      const trabajo = cola.shift();
      if (trabajo.tipo === 'clic') {
        const btn = trabajo.boton;
        if (!candidatoValido(btn)) {
          // Salió de pantalla mientras esperaba: vuelve a empezar si reaparece.
          if (estado.get(btn) === 'enCola') estado.set(btn, 'visto');
          continue;
        }
        pulsar(btn);
        return;
      }
      // Techo y paros: solo miran las peticiones.
      const espera = esperaParaPedir();
      if (espera > 0) {
        cola.unshift(trabajo);
        if (Number.isFinite(espera)) programar(espera);
        return;
      }
      if (!textoValido(trabajo)) continue;
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
      for (const article of sucios) examinar(article);
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

  // X redibuja sin parar: cada cambio dentro de un artículo lo marca para el próximo examen
  // (también los nodos de texto: X reutiliza bloques cambiando solo su contenido), y cada caja
  // nuestra que desaparece devuelve su original.
  const articuloDe = (nodo) => (nodo.nodeType === 1 ? nodo.closest('article') : nodo.parentElement?.closest('article'));

  new MutationObserver((mutaciones) => {
    for (const mutacion of mutaciones) {
      if (mutacion.type === 'characterData') {
        const article = articuloDe(mutacion.target);
        if (article) sucios.add(article);
        continue;
      }
      for (const nodo of mutacion.addedNodes) {
        const article = articuloDe(nodo);
        if (article) sucios.add(article);
        else if (nodo.nodeType === 1) for (const interior of nodo.querySelectorAll('article')) sucios.add(interior);
      }
      if (!cajasVivas.size) continue;
      for (const nodo of mutacion.removedNodes) {
        if (nodo.nodeType !== 1) continue;
        if (nodo.classList.contains('xat-caja')) restaurarOriginalDe(nodo);
        else for (const caja of nodo.querySelectorAll('.xat-caja')) restaurarOriginalDe(caja);
      }
    }
    if (sucios.size) reexaminar();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // Con la pestaña en segundo plano no se pide nada; al volver, sigue.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bombeo();
  });

  // Una sola vez, a los 5 s: el estado de la página en consola, contando todos los casos (también
  // los que no se pueden pedir), para que nada falle en silencio. Y, si hay botones que parecen
  // de traducir y no están en la lista, cuáles son, para añadirlos.
  function diagnosticar() {
    const cuenta = { deX: 0, destino: 0, sinIdioma: 0, sinEnlace: 0, devueltas: 0, traducidas: 0 };
    let bloques = 0;
    for (const nodo of document.querySelectorAll('article [data-testid="tweetText"]')) {
      bloques += 1;
      if (cajas.has(nodo)) {
        cuenta.traducidas += 1;
      } else if (traducidoPorX(nodo)) cuenta.deX += 1;
      else if (baseDelIdioma(nodo.getAttribute('lang')) === idiomaDestino()) cuenta.destino += 1;
      else if (SIN_IDIOMA.has(baseDelIdioma(nodo.getAttribute('lang')))) cuenta.sinIdioma += 1;
      else if (!idDe(nodo)) cuenta.sinEnlace += 1;
      else if (devueltas.has(idDe(nodo))) cuenta.devueltas += 1;
    }
    console.info(`[X AutoTranslate] Página: bloques de texto ${bloques} · ya traducidas por X: ${cuenta.deX} · `
      + `en el idioma de la interfaz: ${cuenta.destino} · sin idioma: ${cuenta.sinIdioma} · `
      + `sin enlace permanente: ${cuenta.sinEnlace} · devueltas al original: ${cuenta.devueltas} · `
      + `traducidas: ${cuenta.traducidas} · pedidas: ${pedidas.size} · fallidas: ${fallidas.size} · `
      + `en espera: ${cola.filter((trabajo) => trabajo.tipo === 'texto').length}`);
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

  // Si el Socio vuelve al original con el «Mostrar original» de X, en ese artículo no se vuelve
  // a pulsar nada y esa publicación no se vuelve a pedir.
  document.addEventListener('click', (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest('button, [role="button"]') : null;
    if (!boton || esNuestro(boton)) return;
    const article = boton.closest('article');
    if (!article || !esBotonOriginal(boton)) return;
    revertidos.add(article);
    const bloque = bloqueDespuesDe(boton, article);
    const id = bloque ? idDe(bloque) : '';
    if (id) devueltas.add(id);
  }, true);

  setTimeout(diagnosticar, RITMO.DIAGNOSTICO_MS);

  // ── Sonda: diagnóstico de la X real. No cambia nada en la página. ──────────────────────

  const MODO_SONDA = globalThis.__XAT_SONDA__ ?? false;

  // Esquema de un elemento: etiqueta, atributos útiles e hijos, lo justo para reconocer la
  // estructura sin volcar todo el HTML. Sin imágenes ni iconos.
  function esquema(raiz, maxLineas = 45) {
    const lineas = [];
    const saltar = new Set(['svg', 'path', 'img', 'style', 'script', 'link']);
    const recorrer = (nodo, nivel) => {
      if (lineas.length >= maxLineas || nodo.nodeType !== 1 || saltar.has(nodo.localName)) return;
      const partes = [nodo.localName];
      for (const atributo of ['data-testid', 'role', 'lang', 'dir', 'aria-label', 'href', 'tabindex']) {
        const valor = nodo.getAttribute(atributo);
        if (valor !== null && valor !== '') partes.push(`${atributo}="${valor.slice(0, 60)}"`);
      }
      const texto = [...nodo.childNodes].filter((hijo) => hijo.nodeType === 3).map((hijo) => hijo.textContent.trim()).join(' ');
      lineas.push(`${'  '.repeat(nivel)}${partes.join(' ')}${texto ? ` «${texto.slice(0, 50)}»` : ''}`);
      for (const hijo of nodo.children) recorrer(hijo, nivel + 1);
    };
    recorrer(raiz, 0);
    if (lineas.length >= maxLineas) lineas.push('  …');
    return lineas;
  }

  async function sondear() {
    const lineas = ['[X AutoTranslate SONDA] Diagnóstico de la página. No cambia nada: solo mira y hace una petición por ruta.'];
    lineas.push(`ruta: ${location.pathname}`);
    lineas.push(`idioma de la interfaz: ${idiomaDestino()} · cookie lang: ${cookie('lang') ? 'sí' : 'no'} · <html lang>: ${document.documentElement.lang || '(vacío)'}`);
    lineas.push(`sesión: ${haySesion() ? 'sí' : 'no'} (cookie ct0)`);
    const bloques = [...document.querySelectorAll('article [data-testid="tweetText"]')];
    lineas.push(`bloques de texto en la página: ${bloques.length} · artículos: ${document.querySelectorAll('article').length}`);
    const candidatos = [];
    let descartadosDescritos = 0;
    bloques.forEach((nodo, i) => {
      const idioma = nodo.getAttribute('lang') ?? '';
      let motivo = '';
      if (traducidoPorX(nodo)) motivo = 'ya traducido por X';
      else if (idioma.split('-')[0].toLowerCase() === idiomaDestino()) motivo = 'en el idioma de la interfaz';
      else if (SIN_IDIOMA.has(idioma)) motivo = 'sin idioma';
      else if (!idDe(nodo)) motivo = 'sin enlace permanente';
      if (!motivo) candidatos.push(nodo);
      else if (descartadosDescritos < 4) {
        descartadosDescritos += 1;
        lineas.push(`bloque ${i + 1} · idioma «${idioma || '—'}» · no se pediría: ${motivo}`);
      }
    });
    lineas.push(`candidatos para pedir: ${candidatos.length}`);
    candidatos.slice(0, 3).forEach((nodo, i) => {
      lineas.push(`candidato ${i + 1} · idioma «${nodo.getAttribute('lang') || '—'}» · identificador ${idDe(nodo) || '(ninguno)'}${cajaDeCitaDe(nodo) ? ' · dentro de una caja de cita' : ''}`);
    });
    if (candidatos[0]) {
      lineas.push('estructura del artículo del primer candidato:');
      lineas.push(...esquema(candidatos[0].closest('article')).map((linea) => `    ${linea}`));
    }
    const deX = bloques.find((nodo) => traducidoPorX(nodo));
    if (deX) {
      lineas.push('estructura de un artículo que X ya tradujo:');
      lineas.push(...esquema(deX.closest('article'), 35).map((linea) => `    ${linea}`));
    }
    if (!candidatos[0]) {
      lineas.push('No hay ningún bloque que pedir. Abre un hilo con respuestas en otro idioma.');
    } else if (!haySesion()) {
      lineas.push('No hay sesión (falta la cookie ct0): no se puede pedir nada.');
    } else {
      const id = idDe(candidatos[0]);
      for (const ruta of ['grok', 'grok-api', 'clasico']) {
        try {
          const r = await abrirRuta(id, ruta);
          const cabeceras = Object.entries(r.cabeceras).filter(([, valor]) => valor).map(([nombre, valor]) => `${nombre}=${valor}`).join(' · ');
          lineas.push(`${ruta}: ${r.estado} en ${r.ms} ms${cabeceras ? ` · ${cabeceras}` : ''}`);
          lineas.push(`  cuerpo: ${r.cuerpo.slice(0, 300).replace(/\s+/g, ' ')}`);
        } catch (error) {
          lineas.push(`${ruta}: fallo (${error.message})`);
        }
      }
    }
    console.info(lineas.join('\n'));
  }

  if (MODO_SONDA) setTimeout(sondear, RITMO.DIAGNOSTICO_MS);

  document.querySelectorAll('article').forEach(examinar);
})();
