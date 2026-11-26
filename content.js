// X AutoTranslate — pulsa «Traducir publicación» en X por ti, en lo que entra en pantalla.
//
// No traduce nada: usa la traducción de X. No pide permisos, no llama a ninguna red y no
// guarda nada. Solo pulsa botones cuya etiqueta está en la lista de abajo y que están dentro
// de un <article>; cualquier otra cosa de la página queda intacta.
//
// Tres ideas tomadas de llpgf/x-grok-visible-translate (MIT): observar el botón y no el
// texto, mirar también aria-label y volver a examinar el artículo después de un clic.
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

  // Clave pública del cliente web de X. No es un secreto: va a la vista en el código de x.com y
  // en todos los clientes de código abierto, y solo sirve junto con una sesión.
  // Procedencia: `Noctyn/x-native-translator`, `llpgf/x-grok-visible-translate` y
  // `rien7/twitter-extension-api`. Si X la cambia, responde 401 aunque haya sesión.
  const CLIENTE_PUBLICO_X = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  // Tiempos en ms. __XAT_AJUSTES__ solo lo fija la bancada de pruebas.
  const RITMO = Object.freeze({
    PARADA_MS: 300,      // cuánto tiene que estar el botón en pantalla antes de contar
    HUECO_MIN_MS: 600,   // hueco mínimo entre dos clics
    HUECO_MAX_MS: 1500,  // hueco máximo: cada clic sortea uno entre el mínimo y este
    ESPERA_MAX_MS: 1500, // hasta que X responde al último clic (o pasa este tiempo) no se pulsa el siguiente
    FALLO_MS: 5000,      // si el botón sigue ahí tras este tiempo, el clic ha fallado
    REINTENTO_MS: 10000, // espera antes de reintentar una publicación que falló
    PAUSA_MS: 60000,     // pausa de la cola tras varios fallos seguidos
    FALLOS_PARA_PAUSA: 3,
    DIAGNOSTICO_MS: 5000, // cuándo avisar de botones de traducir que no están en la lista
    REEXAMEN_MS: 150,     // pausa antes de volver a examinar los artículos con nodos nuevos
    PETICION_MAX_MS: 20000, // tiempo máximo de una petición de traducción a X
    ...globalThis.__XAT_AJUSTES__,
  });

  // Estado de cada botón: 'visto' (observado, sin cumplir todavía la parada), 'enCola',
  // 'pendiente' (pulsado, a la espera de X o de un reintento) o 'descartado' (ese elemento
  // no se vuelve a tocar).
  const estado = new WeakMap();
  const observados = new Set();     // botones que sigue mirando el IntersectionObserver
  const paradas = new Map();        // botón → temporizador de la parada
  const pendientes = new Map();     // botón → momento del último clic, a la espera de X
  const intentos = new WeakMap();   // botón → clics que ha recibido
  const sucios = new Set();         // <article> con nodos nuevos desde el último examen
  const revertidos = new WeakSet(); // <article> donde el Socio pulsó «Mostrar original»
  const cola = [];
  let huecoHasta = -Infinity; // tras cada clic no se pulsa nada hasta que pasa el hueco sorteado
  let pausadoHasta = 0;       // la cola no pulsa nada hasta este momento
  let fallosSeguidos = 0;
  let temporizador = 0;       // próxima llamada a bombeo(), si la hay
  let avisoEn = 0;            // momento en que dispararía ese temporizador
  let examenPendiente = false;

  // Nombre accesible del control: su aria-label si lo tiene; si no, su texto visible.
  // Si el aria-label no está en la lista, el botón no se pulsa aunque su texto sí lo esté.
  function etiqueta(el) {
    const aria = el.getAttribute('aria-label')?.trim();
    return aria || el.textContent.trim();
  }
  const esBotonTraducir = (el) => ETIQUETAS_TRADUCIR.has(etiqueta(el));
  const esBotonOriginal = (el) => ETIQUETAS_ORIGINAL.has(etiqueta(el));

  // ── Lectura de la página ───────────────────────────────────────────────────────────────

  // Lo que cuelga de nuestra propia interfaz queda fuera de todo escaneo.
  const esNuestro = (el) => !!el.closest('.xat-caja');

  function cookie(nombre) {
    const hallado = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
    return hallado ? decodeURIComponent(hallado[1]) : '';
  }

  // Idioma base de la interfaz de X: la cookie `lang`, si es un código válido; si no, el de
  // <html lang>; y si no, español. (X usa `xx` para «inglés por defecto».)
  function idiomaDestino() {
    const base = (texto) => texto.trim().toLowerCase().split('-')[0];
    const valido = (idioma) => /^[a-z]{2,3}$/.test(idioma);
    const deLaCookie = base(cookie('lang'));
    const delHtml = base(document.documentElement.lang);
    return (valido(deLaCookie) && deLaCookie) || (valido(delHtml) && delHtml) || 'es';
  }

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

  // X traduce solo el post principal de un hilo y pone su barra «Traducido de… · Mostrar
  // original» delante del texto. El bloque conserva el idioma original, así que `lang` no basta
  // para saberlo. ¿Hay un «Mostrar original» de X entre el bloque de texto anterior y este?
  function traducidoPorX(nodo) {
    const articulo = nodo.closest('article');
    if (!articulo) return false;
    const bloques = [...articulo.querySelectorAll('[data-testid="tweetText"]')];
    const anterior = bloques[bloques.indexOf(nodo) - 1];
    const antesDe = (quien, de) => (quien.compareDocumentPosition(de) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
    for (const control of articulo.querySelectorAll('button, [role="button"], span')) {
      if (esNuestro(control) || control.closest('[data-testid="tweetText"]')) continue;
      if (!ETIQUETAS_ORIGINAL.has(etiqueta(control))) continue;
      if (!antesDe(nodo, control)) continue;
      if (anterior && antesDe(anterior, control)) continue;
      return true;
    }
    return false;
  }

  function enPantalla(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  function examinar(article) {
    // Donde el Socio volvió al original no se vuelve a traducir.
    if (revertidos.has(article)) return;
    for (const el of article.querySelectorAll('button, [role="button"]')) {
      if (!estado.has(el) && esBotonTraducir(el)) registrar(el);
    }
  }

  function registrar(btn) {
    estado.set(btn, 'visto');
    observados.add(btn);
    visibilidad.observe(btn);
  }

  function alEntrar(btn) {
    if (estado.get(btn) !== 'visto' || paradas.has(btn) || revertidos.has(btn.closest('article'))) return;
    paradas.set(btn, setTimeout(() => {
      paradas.delete(btn);
      if (estado.get(btn) === 'visto' && esBotonTraducir(btn) && enPantalla(btn)) encolar(btn);
    }, RITMO.PARADA_MS));
  }

  function alSalir(btn) {
    clearTimeout(paradas.get(btn));
    paradas.delete(btn);
  }

  function encolar(btn) {
    estado.set(btn, 'enCola');
    cola.push(btn);
    bombeo();
  }

  function pulsar(btn) {
    const ahora = performance.now();
    intentos.set(btn, (intentos.get(btn) ?? 0) + 1);
    pendientes.set(btn, ahora);
    // El hueco se sortea y no depende de la respuesta de X: si X quita el control de inmediato,
    // los clics no van a cadencia fija ni se acumulan.
    const hueco = RITMO.HUECO_MIN_MS + Math.random() * (Math.max(RITMO.HUECO_MAX_MS, RITMO.HUECO_MIN_MS) - RITMO.HUECO_MIN_MS);
    huecoHasta = ahora + hueco;
    estado.set(btn, 'pendiente');
    btn.click();
    programar(hueco);
  }

  // Un pendiente cuyo botón ya no es de traducir ha salido bien (X lo ha sustituido).
  // Si sigue ahí pasados FALLO_MS, el clic ha fallado.
  function resolverPendientes() {
    const ahora = performance.now();
    for (const [btn, clic] of pendientes) {
      if (btn.isConnected && esBotonTraducir(btn)) {
        if (ahora - clic < RITMO.FALLO_MS) continue;
        pendientes.delete(btn);
        fallo(btn);
      } else {
        pendientes.delete(btn);
        fallosSeguidos = 0;
        soltar(btn);
      }
    }
  }

  // Al segundo fallo la publicación se deja en paz; al primero se reintenta una vez.
  function fallo(btn) {
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
      if (enPantalla(btn)) encolar(btn);
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

  const candidatoValido = (btn) => btn.isConnected && esBotonTraducir(btn) && enPantalla(btn);

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
    // Hasta que X responde al último clic (o pasa ESPERA_MAX_MS), y hasta que pasa el hueco
    // sorteado, no se pulsa el siguiente.
    let bloqueo = 0;
    for (const clic of pendientes.values()) bloqueo = Math.max(bloqueo, clic + RITMO.ESPERA_MAX_MS - ahora);
    const falta = Math.max(bloqueo, huecoHasta - ahora);
    if (falta > 0) {
      programar(falta);
      return;
    }
    while (cola.length) {
      const btn = cola.shift();
      if (!candidatoValido(btn)) {
        // Salió de pantalla mientras esperaba: vuelve a empezar si reaparece.
        if (estado.get(btn) === 'enCola') estado.set(btn, 'visto');
        continue;
      }
      pulsar(btn);
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
      // Los botones que ya no están en la página dejan de ocupar al observador.
      for (const btn of observados) {
        if (!btn.isConnected) {
          visibilidad.unobserve(btn);
          observados.delete(btn);
        }
      }
      bombeo();
    }, RITMO.REEXAMEN_MS);
  }

  // Una sola vez: si hay botones que parecen de traducir y no están en la lista, se avisa en
  // consola con lo que se ha visto, para añadirlo. No se pulsa nada que no esté en la lista.
  function diagnosticar() {
    const vistas = new Set();
    for (const el of document.querySelectorAll('article button, article [role="button"]')) {
      for (const texto of [el.getAttribute('aria-label'), el.textContent]) {
        const etiqueta = texto?.trim();
        if (etiqueta && etiqueta.length <= 60 && PARECE_TRADUCCION.test(etiqueta)
          && !ETIQUETAS_TRADUCIR.has(etiqueta) && !ETIQUETAS_ORIGINAL.has(etiqueta)) vistas.add(etiqueta);
      }
    }
    if (vistas.size) {
      console.warn(`[X AutoTranslate] No reconozco estos botones de traducir y no los pulso: «${[...vistas].join('», «')}». `
        + 'Si es el botón de traducir de X, añádelo a ETIQUETAS_TRADUCIR en content.js.');
    }
  }

  // Si el Socio vuelve al original, esa publicación no se vuelve a traducir.
  document.addEventListener('click', (evento) => {
    const boton = evento.target instanceof Element ? evento.target.closest('button, [role="button"]') : null;
    const article = boton?.closest('article');
    if (article && esBotonOriginal(boton)) revertidos.add(article);
  }, true);

  setTimeout(diagnosticar, RITMO.DIAGNOSTICO_MS);

  // ── Petición a X ───────────────────────────────────────────────────────────────────────

  function cabecerasDeSesion() {
    return {
      authorization: `Bearer ${CLIENTE_PUBLICO_X}`,
      'x-csrf-token': cookie('ct0'),
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': idiomaDestino(),
    };
  }

  const RUTA_GROK = '/i/api/2/grok/translation.json';
  const RUTA_GROK_API = 'https://api.x.com/2/grok/translation.json';
  const rutaClasico = (id, idioma) => '/i/api/1.1/strato/column/None/'
    + `tweetId=${id},destinationLanguage=Some(${idioma}),translationSource=Some(X),feature=None,timeout=None,onlyCached=None`
    + '/translation/service/translateTweet';

  // Una petición cruda a una ruta de traducción de X. Devuelve lo que contestó; no lo interprete.
  async function abrirRuta(id, ruta) {
    const esGrok = ruta !== 'clasico';
    const url = { grok: RUTA_GROK, 'grok-api': RUTA_GROK_API, clasico: rutaClasico(id, idiomaDestino()) }[ruta];
    const controlador = new AbortController();
    const tope = setTimeout(() => controlador.abort(), RITMO.PETICION_MAX_MS);
    const empieza = performance.now();
    try {
      const respuesta = await fetch(url, {
        method: esGrok ? 'POST' : 'GET',
        credentials: 'include',
        headers: esGrok ? { ...cabecerasDeSesion(), 'content-type': 'text/plain;charset=UTF-8' } : cabecerasDeSesion(),
        body: esGrok ? JSON.stringify({ content_type: 'POST', id, dst_lang: idiomaDestino() }) : undefined,
        signal: controlador.signal,
      });
      const cuerpo = await respuesta.text();
      const cabeceras = {};
      for (const nombre of ['content-type', 'retry-after', 'x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset']) {
        cabeceras[nombre] = respuesta.headers.get(nombre);
      }
      return { estado: respuesta.status, ms: Math.round(performance.now() - empieza), cabeceras, cuerpo };
    } catch (error) {
      const fallo = new Error(error?.name === 'AbortError' ? 'tiempo agotado' : 'error de red');
      fallo.tipo = error?.name === 'AbortError' ? 'timeout' : 'red';
      throw fallo;
    } finally {
      clearTimeout(tope);
    }
  }

  // ── Sonda: diagnóstico de la X real. No cambia nada en la página. ──────────────────────
  // Describe lo que ve y hace UNA petición por ruta para el primer candidato, para fijar el
  // contrato y el DOM reales antes de construir el resto. Se quita en cuanto sirve.

  const MODO_SONDA = globalThis.__XAT_SONDA__ ?? true;

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
    lineas.push(`sesión: ${cookie('ct0') ? 'sí' : 'no'} (cookie ct0)`);
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
    } else if (!cookie('ct0')) {
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

  // X redibuja sin parar: cada nodo nuevo marca su artículo para el próximo examen.
  new MutationObserver((mutaciones) => {
    for (const { addedNodes } of mutaciones) {
      for (const nodo of addedNodes) {
        if (nodo.nodeType !== 1) continue;
        const article = nodo.closest('article');
        if (article) sucios.add(article);
        else for (const interior of nodo.querySelectorAll('article')) sucios.add(interior);
      }
    }
    if (sucios.size) reexaminar();
  }).observe(document.body, { childList: true, subtree: true });

  document.querySelectorAll('article').forEach(examinar);
})();
