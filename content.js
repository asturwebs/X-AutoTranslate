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

  // Tiempos en ms. __XAT_AJUSTES__ solo lo fija la bancada de pruebas.
  const RITMO = Object.freeze({
    PARADA_MS: 300,      // cuánto tiene que estar el botón en pantalla antes de contar
    HUECO_MIN_MS: 300,   // mínimo entre dos clics
    ESPERA_MAX_MS: 1500, // hasta que X responde al último clic (o pasa este tiempo) no se pulsa el siguiente
    FALLO_MS: 5000,      // si el botón sigue ahí tras este tiempo, el clic ha fallado
    REINTENTO_MS: 10000, // espera antes de reintentar una publicación que falló
    PAUSA_MS: 60000,     // pausa de la cola tras varios fallos seguidos
    FALLOS_PARA_PAUSA: 3,
    REEXAMEN_MS: 150,    // pausa antes de volver a examinar los artículos con nodos nuevos
    ...globalThis.__XAT_AJUSTES__,
  });

  // Estado de cada botón: 'visto' (observado, sin cumplir todavía la parada), 'enCola',
  // 'pendiente' (pulsado, a la espera de X o de un reintento) o 'descartado' (ese elemento
  // no se vuelve a tocar).
  const estado = new WeakMap();
  const observados = new Set();  // botones que sigue mirando el IntersectionObserver
  const paradas = new Map();     // botón → temporizador de la parada
  const pendientes = new Map();   // botón → momento del último clic, a la espera de X
  const intentos = new WeakMap(); // botón → clics que ha recibido
  const sucios = new Set();      // <article> con nodos nuevos desde el último examen
  const cola = [];
  let ultimoClic = -Infinity;
  let pausadoHasta = 0;          // la cola no pulsa nada hasta este momento
  let fallosSeguidos = 0;
  let temporizador = 0;          // próxima llamada a bombeo(), si la hay
  let avisoEn = 0;               // momento en que dispararía ese temporizador
  let examenPendiente = false;

  function coincide(el, etiquetas) {
    const aria = el.getAttribute('aria-label');
    return (aria !== null && etiquetas.has(aria.trim())) || etiquetas.has(el.textContent.trim());
  }
  const esBotonTraducir = (el) => coincide(el, ETIQUETAS_TRADUCIR);

  function enPantalla(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  function examinar(article) {
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
    if (estado.get(btn) !== 'visto' || paradas.has(btn)) return;
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
    ultimoClic = ahora;
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
    if (ahora < pausadoHasta) {
      programar(pausadoHasta - ahora);
      return;
    }
    // Hasta que X responde al último clic (o pasa ESPERA_MAX_MS) no se pulsa el siguiente.
    let bloqueo = 0;
    for (const clic of pendientes.values()) bloqueo = Math.max(bloqueo, clic + RITMO.ESPERA_MAX_MS - ahora);
    const falta = Math.max(bloqueo, RITMO.HUECO_MIN_MS - (ahora - ultimoClic));
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
