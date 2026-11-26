// Simulador de X para la bancada de X AutoTranslate.
//
// Carga antes que ../content.js para fijar, antes de que arranque la extensión, los ajustes
// del escenario, el azar, la sesión y el servicio de traducción de X. El nombre del escenario
// llega en el ancla de la URL (mock-x.html#visible). Cada escenario recibe un contexto `ctx`,
// monta sus publicaciones, espera lo que necesite y deja su veredicto en window.__result.
(() => {
  'use strict';

  const NOMBRE = decodeURIComponent(location.hash.slice(1));
  const escenarios = {};
  window.__xatEscenarios = escenarios;

  const publicaciones = new Map(); // id del escenario → publicación
  const porNumero = new Map();     // identificador numérico → publicación
  const clics = [];                // clics en los botones de traducir de X
  const peticiones = [];           // peticiones al servicio de traducción de X
  let siguienteNumero = 1000;
  let t0 = 0;

  const avanzar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

  // ---- Simulación de X ------------------------------------------------------------

  function traducir(pub) {
    if (pub.traducida) return;
    pub.traducida = true;
    pub.texto.textContent = pub.traduccion ?? `ES: ${pub.original}`;
    pub.texto.lang = 'es';
    // El mismo elemento pasa a «Mostrar original» (si el control sigue ahí).
    if (!pub.control) return;
    pub.control.setAttribute('aria-label', 'Mostrar original');
    pub.control.textContent = 'Mostrar original';
  }

  function alClic(pub) {
    // El mismo elemento hace de «Mostrar original» una vez traducida la publicación:
    // al pulsarlo, X vuelve al texto original.
    if (pub.traducida) return mostrarOriginal(pub);
    clics.push({ id: pub.id, t: Math.round(performance.now() - t0) });
    if (pub.falla) return;
    // Algunos controles desaparecen en cuanto X recibe el clic, y la traducción llega después.
    if (pub.quitaControl) {
      pub.control.remove();
      pub.control = null;
    }
    setTimeout(() => (pub.redibuja ? pub.redibuja() : traducir(pub)), pub.retrasoMs);
  }

  // X vuelve al texto original y muestra «Traducir publicación» en un elemento nuevo.
  function mostrarOriginal(pub) {
    pub.traducida = false;
    pub.texto.textContent = pub.original;
    pub.texto.lang = pub.lang ?? 'en';
    ponerControl(pub, botonDeTraducir('texto', () => alClic(pub)));
  }

  function botonDeTexto(texto) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.setAttribute('aria-label', texto);
    boton.textContent = texto;
    return boton;
  }

  function botonDeTraducir(variante, alPulsar, etiqueta = 'Traducir publicación') {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'xat-traducir';
    const texto = document.createElement('span');
    if (variante !== 'aria') texto.textContent = etiqueta;
    if (variante === 'aria' || variante === 'ambos') boton.setAttribute('aria-label', etiqueta);
    if (variante === 'mixto') boton.setAttribute('aria-label', 'Traducir');
    boton.append(texto);
    boton.addEventListener('click', alPulsar);
    return boton;
  }

  // ---- Construcción de publicaciones ----------------------------------------------

  function ponerControl(pub, boton) {
    pub.control?.remove();
    pub.control = boton;
    pub.hueco.append(boton);
  }

  function ponerControles(pub) {
    // A lo que X ya tradujo no le pone control debajo: su «Mostrar original» va en la barra.
    if (pub.traducidaPorX) return;
    if (pub.traducida) ponerControl(pub, botonDeTexto('Mostrar original'));
    else if (pub.boton !== 'ninguno') ponerControl(pub, botonDeTraducir(pub.boton, () => alClic(pub), pub.etiqueta));
  }

  // Lo que X pone en una publicación: enlace permanente, su barra si ya la tradujo, texto y control.
  function hijosDe(pub) {
    const hijos = [];
    if (pub.enlace) {
      const cabecera = document.createElement('div');
      cabecera.className = 'xat-cab';
      pub.enlaceEl = document.createElement('a');
      pub.enlaceEl.href = `/usuario/status/${pub.numerico}`;
      const hora = document.createElement('time');
      hora.textContent = '6 h';
      pub.enlaceEl.append(hora);
      cabecera.append(pub.enlaceEl);
      hijos.push(cabecera);
    }
    if (pub.traducidaPorX) {
      const barra = document.createElement('div');
      barra.className = 'xat-barra-x';
      const origen = document.createElement('span');
      origen.textContent = 'Traducido del inglés';
      const enlaceOriginal = document.createElement('button');
      enlaceOriginal.type = 'button';
      enlaceOriginal.textContent = 'Mostrar original';
      enlaceOriginal.addEventListener('click', () => {
        pub.traducidaPorX = false;
        montarPublicacion(pub);
      });
      barra.append(origen, enlaceOriginal);
      hijos.push(barra);
    }
    pub.texto = document.createElement('div');
    pub.texto.setAttribute('data-testid', 'tweetText');
    // Ojo: cuando X traduce, el bloque conserva el idioma original. La extensión no puede
    // guiarse solo por `lang` para saber que X ya tradujo.
    pub.texto.lang = pub.traducida ? 'es' : pub.lang;
    pub.texto.textContent = pub.traducida || pub.traducidaPorX ? (pub.traduccion ?? `ES: ${pub.original}`) : pub.original;
    pub.hueco = document.createElement('div');
    pub.hueco.className = 'xat-control';
    pub.control = null;
    hijos.push(pub.texto, pub.hueco);
    return hijos;
  }

  function montarPublicacion(pub) {
    pub.articulo.replaceChildren(...(pub.remontar ? pub.remontar() : hijosDe(pub)));
    ponerControles(pub);
    for (const otra of pub.otras ?? []) ponerControles(otra);
  }

  function crearPublicacion(opciones) {
    const pub = {
      lang: 'en', boton: 'texto', retrasoMs: 50, falla: false, quitaControl: false, enlace: true,
      traduccion: null, traducida: false, traducidaPorX: false, ...opciones,
    };
    pub.original = opciones.texto ?? `Original ${pub.id}`;
    pub.numerico = pub.enlace ? String(siguienteNumero++) : '';
    pub.articulo = document.createElement('article');
    pub.articulo.className = 'xat-pub';
    pub.articulo.dataset.xatId = pub.id;
    if (opciones.yaTraducida) pub.traducida = true;
    montarPublicacion(pub);
    publicaciones.set(pub.id, pub);
    if (pub.numerico) porNumero.set(pub.numerico, pub);
    document.querySelector('main').append(pub.articulo);
    return pub;
  }

  // El post principal de un hilo, que X ya tradujo solo: barra delante y texto en español.
  function crearTraducidaPorX({ id, texto, traduccion }) {
    const pub = crearPublicacion({ id, boton: 'ninguno', texto, traduccion });
    pub.traducidaPorX = true;
    montarPublicacion(pub);
    return pub;
  }

  // Hilo cuyo post principal cita otra publicación. Cada una lleva su enlace permanente y,
  // si `boton` no es 'ninguno', su botón de traducir. Traducir el principal redibuja el
  // contenido del artículo: el <article> es el mismo elemento, pero todos sus hijos son nuevos.
  function crearHilo({ id, cita, retrasoMs = 50, boton = 'texto', sinEnlaceEnCita = false, citaSinRol = false }) {
    const principal = crearPublicacion({ id, boton, retrasoMs });
    principal.articulo.classList.add('xat-hilo');
    const citada = {
      id: cita, lang: 'en', boton, retrasoMs, falla: false, quitaControl: false, enlace: !sinEnlaceEnCita,
      traduccion: null, traducida: false, traducidaPorX: false,
      original: `Original ${cita}`, numerico: sinEnlaceEnCita ? '' : String(siguienteNumero++), articulo: principal.articulo,
    };
    principal.otras = [citada];
    const bloque = (pub) => {
      const caja = document.createElement('div');
      caja.className = 'xat-bloque';
      caja.append(...hijosDe(pub));
      return caja;
    };
    principal.remontar = () => {
      const marco = document.createElement('div');
      if (!citaSinRol) marco.setAttribute('role', 'link');
      marco.className = 'xat-cita';
      marco.append(bloque(citada));
      return [bloque(principal), marco];
    };
    principal.redibuja = () => {
      principal.traducida = true;
      montarPublicacion(principal);
    };
    montarPublicacion(principal);
    publicaciones.set(cita, citada);
    porNumero.set(citada.numerico, citada);
    return principal.articulo;
  }

  // ---- Contexto que reciben los escenarios -----------------------------------------

  function calcularVisibleAlInicio() {
    return [...publicaciones.values()]
      .filter(({ articulo }) => articulo.matches('article.xat-pub:not(.xat-hilo)'))
      .filter(({ control }) => control && !control.textContent.includes('Mostrar original'))
      .filter(({ control }) => {
        const r = control.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      })
      .map(({ id }) => id);
  }

  const ctx = {
    clics,
    peticiones,
    avanzar,
    memo: {},
    crearPublicacion,
    crearHilo,
    crearTraducidaPorX,
    texto: (id) => publicaciones.get(id)?.texto.textContent ?? null,
    // Identificador numérico de la publicación: lo que viaja a X en las peticiones.
    numero: (id) => publicaciones.get(id)?.numerico ?? '',
    // Nuestra caja de traducción (la que pone la extensión), o null.
    cajaDe(id) {
      const caja = publicaciones.get(id)?.texto.nextElementSibling;
      return caja?.classList.contains('xat-caja') ? caja : null;
    },
    traduccionDe(id) {
      const caja = ctx.cajaDe(id);
      return caja && caja.getAttribute('data-xat-vista') !== 'original' ? (caja.querySelector('.xat-texto')?.textContent ?? null) : null;
    },
    originalVisible: (id) => (publicaciones.get(id)?.texto.getClientRects().length ?? 0) > 0,
    enlaceDe: (id) => ctx.cajaDe(id)?.querySelector('.xat-enlace') ?? null,
    nodoDe: (id) => publicaciones.get(id)?.texto ?? null,
    // Quien navega pulsa «Mostrar original».
    pulsarOriginal(id) {
      publicaciones.get(id).control.click();
    },
    // X muestra el botón más tarde, en un artículo que ya estaba en la página.
    anadirBoton(id, boton = 'texto') {
      const pub = publicaciones.get(id);
      ponerControl(pub, botonDeTraducir(boton, () => alClic(pub)));
    },
    // Navegación dentro de la SPA: desaparece todo lo montado y entra otra página.
    sustituirPor(ids, boton = 'texto') {
      for (const pub of publicaciones.values()) pub.articulo.remove();
      publicaciones.clear();
      for (const id of ids) crearPublicacion({ id, boton });
    },
    // Alguien traduce a mano, sin que intervenga la extensión.
    traducirAMano(id) {
      traducir(publicaciones.get(id));
    },
    irA(id) {
      publicaciones.get(id).articulo.scrollIntoView({ block: 'center' });
    },
    async recorrerRapido(msEntrePasos) {
      for (const pub of publicaciones.values()) {
        pub.articulo.scrollIntoView({ block: 'start' });
        await avanzar(msEntrePasos);
      }
    },
    // Botón de traducir en un diálogo y en una tarjeta flotante, sin <article> por encima.
    fueraDeArticulo(variante) {
      const soltar = (id, rol, extra) => {
        const caja = document.createElement('div');
        caja.setAttribute('role', rol);
        caja.className = extra ? `xat-flotante ${extra}` : 'xat-flotante';
        caja.append(botonDeTraducir(variante, () => clics.push({ id, t: Math.round(performance.now() - t0) })));
        document.body.append(caja);
      };
      soltar('dialogo', 'dialog');
      soltar('tarjeta', 'complementary', 'xat-tarjeta');
    },
    // X redibuja el artículo de una publicación: el mismo <article>, con hijos nuevos.
    redibujar(id) {
      montarPublicacion(publicaciones.get(id));
    },
    // X reutiliza el mismo bloque de texto para otra publicación.
    reutilizar(id, nuevoId, texto) {
      const pub = publicaciones.get(id);
      pub.texto.textContent = texto;
      pub.texto.lang = 'en';
      pub.numerico = String(siguienteNumero++);
      pub.enlaceEl.href = `/usuario/status/${pub.numerico}`;
      const nuevo = { ...pub, id: nuevoId, original: texto, traduccion: null };
      publicaciones.set(nuevoId, nuevo);
      porNumero.set(nuevo.numerico, nuevo);
    },
    // X borra nuestra caja del documento, pero deja el bloque de texto donde estaba.
    borrarCaja(id) {
      ctx.cajaDe(id)?.remove();
    },
    // Manda la pestaña a segundo plano (true) o la trae de vuelta (false); lo ejecuta la bancada.
    ocultarPestania(si) {
      window.__xatOculta = si;
    },
    // Espera a que la pestaña esté de verdad en segundo plano (la bancada la mueve).
    async esperarOculta() {
      const fin = performance.now() + 5000;
      while (!document.hidden && performance.now() < fin) await avanzar(20);
      return document.hidden;
    },
    // X recicla un artículo entero para otra publicación: el mismo <article>, con contenido nuevo.
    reciclarArticulo(id, nuevoId, opciones = {}) {
      const articulo = publicaciones.get(id).articulo;
      const pub = {
        lang: 'en', boton: 'ninguno', retrasoMs: 50, falla: false, quitaControl: false, enlace: true,
        traduccion: null, traducida: false, traducidaPorX: false, ...opciones, id: nuevoId,
      };
      pub.original = opciones.texto ?? `Original ${nuevoId}`;
      pub.numerico = String(siguienteNumero++);
      pub.articulo = articulo;
      articulo.className = 'xat-pub';
      montarPublicacion(pub);
      publicaciones.set(nuevoId, pub);
      porNumero.set(pub.numerico, pub);
    },
    // X cambia de sitio el bloque de texto (otro padre); nuestra caja se queda donde estaba.
    moverBloque(id) {
      const pub = publicaciones.get(id);
      const otroPadre = document.createElement('div');
      pub.articulo.append(otroPadre);
      otroPadre.append(pub.texto);
    },
    // Un segundo bloque de texto colgando del artículo, hermano del post, sin caja ni enlace propios.
    crearConBloqueHermano(id) {
      const pub = crearPublicacion({ id, boton: 'ninguno', texto: 'The post itself.' });
      const hermano = document.createElement('div');
      hermano.setAttribute('data-testid', 'tweetText');
      hermano.lang = 'en';
      hermano.textContent = 'A second block with no box of its own.';
      pub.texto.after(hermano);
      return hermano;
    },
    // Dos publicaciones acaban resolviendo al mismo enlace permanente.
    repetirEnlace(id, comoId) {
      const pub = publicaciones.get(id);
      const modelo = publicaciones.get(comoId);
      pub.numerico = modelo.numerico;
      pub.enlaceEl.href = modelo.enlaceEl.getAttribute('href');
    },
    get visibleAlInicio() {
      const valor = calcularVisibleAlInicio();
      Object.defineProperty(this, 'visibleAlInicio', { value: valor, enumerable: true });
      return valor;
    },
  };
  // ---- Escenarios ------------------------------------------------------------------

  const recuentos = (lista) => lista.reduce((mapa, { id }) => ((mapa[id] = (mapa[id] ?? 0) + 1), mapa), {});

  // Respuestas en inglés del escenario `hilo`: [id, texto, traducción que devuelve X].
  const RESPUESTAS_HILO = [
    ['r1', 'My reviewer. Other model. Other instance.', 'Mi revisor. Otro modelo. Otra instancia.'],
    ['r2', 'Then I will do the merge.', 'Entonces haré el merge.'],
    ['r3', 'Same here, unfortunately.', 'Lo mismo por aquí, lamentablemente.'],
    ['r4', 'Totally agree with this.', 'Totalmente de acuerdo con esto.'],
    ['r5', 'Well said.', 'Bien dicho.'],
  ];

  Object.assign(escenarios, {
    // Solo se pulsa lo que está en pantalla, de una en una, y al scrollear se pulsa lo nuevo.
    visible: {
      async ejecutar(c) {
        const variantes = ['texto', 'aria', 'ambos', 'mixto'];
        for (let i = 1; i <= 12; i++) c.crearPublicacion({ id: `r${i}`, boton: variantes[(i - 1) % variantes.length] });
        c.memo.visible = c.visibleAlInicio;
        await c.avanzar(2500);
        c.memo.fase1 = {
          clics: c.clics.slice(),
          traducidas: new Set(c.memo.visible.filter((id) => c.texto(id).startsWith('ES: '))),
        };
        c.irA('r11');
        await c.avanzar(2500); // da tiempo a que le llegue el turno a r12: si fuera a pulsarse, sería aquí
      },
      comprobar(c) {
        const fallos = [];
        const orden = (ids) => JSON.stringify([...ids].sort());
        const conClic = new Set(c.memo.fase1.clics.map(({ id }) => id));
        if (orden(conClic) !== orden(c.memo.visible)) {
          fallos.push(`sin scrollear hubo clics en ${orden(conClic)} y debería ser solo lo visible al inicio: ${orden(c.memo.visible)}`);
        }
        for (const id of c.memo.visible) {
          if (!c.memo.fase1.traducidas.has(id)) fallos.push(`${id} estaba visible y a los 2,5 s no está traducida`);
        }
        const tiempos = c.memo.fase1.clics.map(({ t }) => t);
        for (let i = 1; i < tiempos.length; i++) {
          if (tiempos[i] - tiempos[i - 1] < 580) fallos.push(`dos clics seguidos distan ${tiempos[i] - tiempos[i - 1]} ms (mínimo 580)`);
        }
        for (const [id, n] of Object.entries(recuentos(c.clics))) {
          if (n > 1) fallos.push(`${id} recibió ${n} clics`);
        }
        for (const id of ['r10', 'r11']) {
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`tras scrollear, ${id} no está traducida («${c.texto(id)}»)`);
        }
        // r4, r8 y r12 llevan un aria-label que no está en la lista («Traducir»): no se pulsan.
        for (const id of ['r4', 'r8', 'r12']) {
          if (c.clics.some(({ id: x }) => x === id)) fallos.push(`${id} tiene un aria-label fuera de la lista y recibió un clic`);
        }
        return fallos;
      },
    },

    // Lo que solo se cruza por pantalla, sin detenerse, no se traduce.
    vuelo: {
      async ejecutar(c) {
        for (let i = 1; i <= 20; i++) c.crearPublicacion({ id: `r${i}` });
        await c.recorrerRapido(60);
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        for (const { id } of c.clics) {
          if (Number(id.slice(1)) <= 17) fallos.push(`${id} recibió un clic y solo se pasó por encima`);
        }
        if (!c.texto('r20')?.startsWith('ES: ')) fallos.push(`la última, donde sí se está parado, no está traducida («${c.texto('r20')}»)`);
        return fallos;
      },
    },

    // Lo que no está dentro de un <article> no se toca.
    fuera: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1' });
        c.fueraDeArticulo('texto');
        await c.avanzar(1500);
      },
      comprobar(c) {
        const fallos = [];
        for (const { id } of c.clics) {
          if (id !== 'r1') fallos.push(`hubo un clic fuera de un <article>: ${id}`);
        }
        if (!c.texto('r1')?.startsWith('ES: ')) fallos.push(`r1 no está traducida («${c.texto('r1')}»)`);
        return fallos;
      },
    },

    // Con X lento no se acumulan peticiones: el siguiente clic espera la respuesta (1,5 s como mucho).
    lento: {
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, retrasoMs: 2500 });
        await c.avanzar(7000);
      },
      comprobar(c) {
        const fallos = [];
        for (const id of ['r1', 'r2', 'r3']) {
          const n = c.clics.filter(({ id: x }) => x === id).length;
          if (n !== 1) fallos.push(`${id} recibió ${n} clics y debería ser uno`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        const [primero, segundo] = c.clics.map(({ t }) => t);
        if (segundo - primero < 1480) fallos.push(`el 2.º clic llegó ${segundo - primero} ms después del 1.º (mínimo 1480)`);
        return fallos;
      },
    },

    // Una publicación a la que X no responde se reintenta una vez y después se deja en paz.
    fallo: {
      ajustes: { FALLO_MS: 1500, REINTENTO_MS: 2000, PAUSA_MS: 1000 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', falla: true });
        c.crearPublicacion({ id: 'r2' });
        c.crearPublicacion({ id: 'r3' });
        await c.avanzar(9000);
      },
      comprobar(c) {
        const fallos = [];
        const deR1 = c.clics.filter(({ id }) => id === 'r1');
        if (deR1.length !== 2) fallos.push(`r1 recibió ${deR1.length} clics y debería recibir 2`);
        else if (deR1[1].t - deR1[0].t < 1980) fallos.push(`el reintento de r1 llegó ${deR1[1].t - deR1[0].t} ms después del 1.º clic (mínimo 1980)`);
        for (const id of ['r2', 'r3']) {
          const n = c.clics.filter(({ id: x }) => x === id).length;
          if (n !== 1) fallos.push(`${id} recibió ${n} clics y debería ser uno`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        if (deR1.some(({ t }) => t > 6000)) fallos.push('r1 recibió algún clic en los últimos 3 s');
        return fallos;
      },
    },

    // Tras tres fallos seguidos la cola hace una pausa, y lo sano que llegue durante la pausa espera.
    // Las tres que fallan son las únicas visibles al empezar; la sana entra en pantalla en mitad
    // de la pausa (que va de ~4,97 s a ~5,97 s). Sin pausa se la pulsaría hacia el 5,7 s.
    pausa: {
      ajustes: { FALLO_MS: 1500, REINTENTO_MS: 6000, PAUSA_MS: 1000 },
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, falla: true });
        c.crearPublicacion({ id: 'r4' });
        await c.avanzar(5400);
        c.irA('r4');
        await c.avanzar(1200); // r4 ya está traducida
        c.irA('r1');           // las tres que fallan vuelven a estar en pantalla para sus reintentos
        await c.avanzar(6400);
      },
      comprobar(c) {
        const fallos = [];
        const clicsDe = (id) => c.clics.filter(({ id: x }) => x === id);
        for (const id of ['r1', 'r2', 'r3']) {
          if (clicsDe(id).length !== 2) fallos.push(`${id} recibió ${clicsDe(id).length} clics y debería recibir 2`);
        }
        if (clicsDe('r4').length !== 1) fallos.push(`r4 recibió ${clicsDe('r4').length} clics y debería ser uno`);
        if (!c.texto('r4')?.startsWith('ES: ')) fallos.push(`r4 no está traducida («${c.texto('r4')}»)`);
        const [deR4] = clicsDe('r4');
        const [deR3] = clicsDe('r3');
        if (deR4 && deR3 && deR4.t - deR3.t < 2480) {
          fallos.push(`el clic de r4 llegó ${deR4.t - deR3.t} ms después del 1.º clic de r3 (mínimo 2480)`);
        }
        return fallos;
      },
    },

    // Una publicación que falló y salió de pantalla antes de llegar su reintento se reintenta al volver.
    vuelve: {
      ajustes: { FALLO_MS: 1500, REINTENTO_MS: 2000 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', falla: true });
        for (let i = 2; i <= 6; i++) c.crearPublicacion({ id: `r${i}` });
        await c.avanzar(2500);
        c.irA('r6'); // r1 sale de pantalla; su reintento llegaría hacia el 3,97 s
        await c.avanzar(2000);
        c.irA('r1'); // y vuelve
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        const deR1 = c.clics.filter(({ id }) => id === 'r1');
        if (deR1.length !== 2) fallos.push(`r1 recibió ${deR1.length} clics y debería recibir 2: falta el reintento al volver a pantalla`);
        else if (deR1[1].t < 4500) fallos.push(`el 2.º clic de r1 llegó en ${deR1[1].t} ms, antes de volver a pantalla`);
        return fallos;
      },
    },

    // Si quien navega pulsa «Mostrar original», esa publicación no se vuelve a traducir.
    original: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1' });
        c.crearPublicacion({ id: 'r2' });
        await c.avanzar(1000);
        c.pulsarOriginal('r1');
        await c.avanzar(1500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.texto('r1') !== 'Original r1') fallos.push(`r1 no se quedó en su texto original («${c.texto('r1')}»)`);
        const clicsR1 = c.clics.filter(({ id }) => id === 'r1').length;
        if (clicsR1 !== 1) fallos.push(`r1 recibió ${clicsR1} clics y debería recibir solo el primero`);
        if (!c.texto('r2')?.startsWith('ES: ')) fallos.push(`r2 no está traducida («${c.texto('r2')}»)`);
        return fallos;
      },
    },

    // Lo que ya está en español o X ya tradujo no se toca; un botón que X dibuja más tarde sí.
    sinBoton: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'es', lang: 'es', boton: 'ninguno' });
        c.crearPublicacion({ id: 'auto', yaTraducida: true });
        c.crearPublicacion({ id: 'tarde', boton: 'ninguno' });
        await c.avanzar(600);
        c.anadirBoton('tarde');
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.texto('es') !== 'Original es') fallos.push(`es estaba en español y cambió («${c.texto('es')}»)`);
        if (c.texto('auto') !== 'ES: Original auto') fallos.push(`auto ya la había traducido X y cambió («${c.texto('auto')}»)`);
        for (const id of ['es', 'auto']) {
          if (c.clics.some(({ id: x }) => x === id)) fallos.push(`${id} recibió un clic sin tener botón de traducir`);
        }
        if (!c.texto('tarde')?.startsWith('ES: ')) fallos.push(`tarde no está traducida («${c.texto('tarde')}»)`);
        if (c.clics.filter(({ id }) => id === 'tarde').length !== 1) fallos.push('tarde no recibió exactamente un clic');
        return fallos;
      },
    },

    // Cambiar de página dentro de X: lo que había desaparece con clics en cola y lo nuevo se traduce.
    navegacion: {
      async ejecutar(c) {
        for (let i = 1; i <= 6; i++) c.crearPublicacion({ id: `r${i}`, retrasoMs: 800 });
        await c.avanzar(700);
        c.sustituirPor(['n1', 'n2', 'n3']);
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        for (const id of ['n1', 'n2', 'n3']) {
          const n = c.clics.filter(({ id: x }) => x === id).length;
          if (n !== 1) fallos.push(`${id} recibió ${n} clics y debería ser uno`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        for (const { id, t } of c.clics) {
          if (id.startsWith('r') && t > 700) fallos.push(`${id} recibió un clic después de desaparecer (en ${t} ms)`);
        }
        return fallos;
      },
    },

    // Un botón casi igual pero que no está en la lista no se pulsa; se avisa en consola.
    casi: {
      ajustes: { DIAGNOSTICO_MS: 500 },
      avisoEsperado: 'Traducir publicacion',
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', etiqueta: 'Traducir publicacion' });
        await c.avanzar(1500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.clics.length) fallos.push(`hubo ${c.clics.length} clic(s) sobre una etiqueta que no está en la lista`);
        if (c.texto('r1') !== 'Original r1') fallos.push(`r1 cambió de texto («${c.texto('r1')}»)`);
        return fallos;
      },
    },

    // Si X quita el control en cuanto recibe el clic, la extensión no puede usarlo de señal de
    // fin: entre dos clics hay siempre un hueco sorteado, ni corto ni de cadencia fija.
    // Con la secuencia [0, 1] los huecos son 600 + 0·900 y 600 + 1·900.
    sinEspera: {
      azar: [0, 1],
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, retrasoMs: 1000, quitaControl: true });
        await c.avanzar(4500);
      },
      comprobar(c) {
        const fallos = [];
        const tiempos = c.clics.map(({ t }) => t);
        const huecos = [tiempos[1] - tiempos[0], tiempos[2] - tiempos[1]];
        if (huecos[0] < 580 || huecos[0] > 640) fallos.push(`el 1.er hueco es de ${huecos[0]} ms y debería rondar 600`);
        if (huecos[1] < 1480 || huecos[1] > 1540) fallos.push(`el 2.º hueco es de ${huecos[1]} ms y debería rondar 1500`);
        for (const id of ['r1', 'r2', 'r3']) {
          if (c.clics.filter(({ id: x }) => x === id).length !== 1) fallos.push(`${id} no recibió exactamente un clic`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        return fallos;
      },
    },

    // El plazo de fallo lleva su propio despertador: aunque nadie toque la página, un clic sin
    // respuesta se detecta a los FALLO_MS y se reintenta. Aquí FALLO_MS no coincide con la espera.
    falloTarde: {
      ajustes: { FALLO_MS: 3000, REINTENTO_MS: 2000, PAUSA_MS: 1000 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', falla: true });
        c.crearPublicacion({ id: 'r2' });
        await c.avanzar(9000);
      },
      comprobar(c) {
        const fallos = [];
        const deR1 = c.clics.filter(({ id }) => id === 'r1');
        if (deR1.length !== 2) fallos.push(`r1 recibió ${deR1.length} clics y debería recibir 2: el fallo no se detectó a los 3 s`);
        else if (deR1[1].t - deR1[0].t < 4980) fallos.push(`el reintento de r1 llegó ${deR1[1].t - deR1[0].t} ms después del 1.º clic (mínimo 4980)`);
        if (c.clics.filter(({ id }) => id === 'r2').length !== 1 || !c.texto('r2')?.startsWith('ES: ')) {
          fallos.push('r2 no quedó traducida con un solo clic');
        }
        return fallos;
      },
    },

    // Una publicación que estaba en cola y alguien tradujo a mano mientras esperaba no se toca:
    // pulsar su control desharía esa traducción.
    manualEnCola: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', retrasoMs: 2500 });
        c.crearPublicacion({ id: 'r2' });
        c.crearPublicacion({ id: 'r3' });
        await c.avanzar(800);
        c.traducirAMano('r2'); // r2 y r3 están en cola, detrás de r1
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.texto('r2') !== 'ES: Original r2') fallos.push(`r2 no conserva la traducción hecha a mano («${c.texto('r2')}»)`);
        if (c.clics.some(({ id }) => id === 'r2')) fallos.push('la extensión pulsó el control de r2, que ya era «Mostrar original»');
        for (const id of ['r1', 'r3']) {
          if (c.clics.filter(({ id: x }) => x === id).length !== 1) fallos.push(`${id} no recibió exactamente un clic`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        return fallos;
      },
    },

    // Lo que estaba en cola y salió de pantalla antes de su turno no se pulsa hasta que vuelve.
    saleEnCola: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', retrasoMs: 2500 });
        c.crearPublicacion({ id: 'r2' });
        c.crearPublicacion({ id: 'r3' });
        for (let i = 4; i <= 9; i++) c.crearPublicacion({ id: `r${i}`, retrasoMs: 800 });
        await c.avanzar(800);
        c.irA('r9'); // r2 y r3 salen de pantalla con el clic de r1 aún pendiente
        await c.avanzar(2500);
        c.memo.clicsFuera = c.clics.filter(({ id }) => id === 'r2' || id === 'r3').length;
        c.irA('r1'); // y vuelven
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.memo.clicsFuera !== 0) fallos.push('se pulsó algo que estaba fuera de pantalla');
        for (const id of ['r2', 'r3']) {
          if (c.clics.filter(({ id: x }) => x === id).length !== 1) fallos.push(`${id} no recibió exactamente un clic`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        return fallos;
      },
    },

    // El caso real: X traduce solo el post principal del hilo; las respuestas llegan sin enlace
    // de traducir y la extensión se las tiene que pedir a X.
    hilo: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearTraducidaPorX({ id: 'principal', texto: 'Anthropic studied ~300 implementations.' });
        // En pantalla al empezar quedan el post de X, r1 y el tuit en español.
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: RESPUESTAS_HILO[0][1], traduccion: RESPUESTAS_HILO[0][2] });
        c.crearPublicacion({ id: 'es', lang: 'es', boton: 'ninguno', texto: 'Totalmente de acuerdo.' });
        for (const [id, texto, traduccion] of RESPUESTAS_HILO.slice(1)) c.crearPublicacion({ id, boton: 'ninguno', texto, traduccion });
        await c.avanzar(3500);
        c.memo.fase1 = {
          principal: c.texto('principal'),
          es: c.texto('es'),
          pedidas: c.peticiones.map(({ id }) => id),
        };
        c.irA('r2'); // entran en pantalla el tuit en español, r2 y r3
        await c.avanzar(3500);
        c.irA('r5'); // entran r4 y r5
        await c.avanzar(3500);
      },
      comprobar(c) {
        const fallos = [];
        const { fase1 } = c.memo;
        if (c.cajaDe('principal') || c.cajaDe('es')) fallos.push('la extensión puso su caja donde X ya tradujo o donde el texto ya está en español');
        if (c.texto('principal') !== fase1.principal || c.texto('es') !== fase1.es) fallos.push('cambió el texto de una publicación que no debía tocarse');
        if (fase1.pedidas.some((n) => n === c.numero('principal') || n === c.numero('es'))) fallos.push('se pidió a X una publicación que ya estaba traducida o en español');
        for (const [id, , traduccion] of RESPUESTAS_HILO) {
          if (c.traduccionDe(id) !== traduccion) fallos.push(`${id} no muestra su traducción («${c.traduccionDe(id)}»)`);
          if (c.originalVisible(id)) fallos.push(`${id} sigue enseñando el original junto a la traducción`);
        }
        if (JSON.stringify(fase1.pedidas) !== JSON.stringify([c.numero('r1')])) {
          fallos.push(`sin scrollear se pidió ${JSON.stringify(fase1.pedidas)} y debería ser solo r1: lo demás en pantalla está traducido por X o en español`);
        }
        const [p1, p2] = c.peticiones;
        if (p1 && p2 && p2.inicio - p1.fin < 580) fallos.push(`la 2.ª petición empezó ${p2.inicio - p1.fin} ms después del fin de la 1.ª (mínimo 580)`);
        for (let i = 2; i < c.peticiones.length; i++) {
          const margen = c.peticiones[i].inicio - c.peticiones[i - 1].fin;
          if (margen < 580) fallos.push(`la petición ${i + 1} empezó ${margen} ms después del fin de la anterior (mínimo 580): no van de una en una`);
        }
        if (JSON.stringify(c.peticiones.map(({ id }) => id)) !== JSON.stringify(['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => c.numero(id)))) {
          fallos.push(`se pidió ${JSON.stringify(c.peticiones.map(({ id }) => id))} y debería ser r1, r2, r3, r4, r5, una vez cada una y en ese orden`);
        }
        if (c.peticiones.some(({ cabeceras }) => cabeceras['x-csrf-token'] !== 'prueba-csrf' || !String(cabeceras.authorization).startsWith('Bearer '))) {
          fallos.push('a alguna petición le falta la sesión (x-csrf-token o authorization)');
        }
        if (!c.cajaDe('r1')?.textContent.includes('Traducido del inglés')) fallos.push('la caja no dice de qué idioma viene la traducción');
        if (c.enlaceDe('r1')?.textContent !== 'Mostrar original') fallos.push('la caja no lleva un botón «Mostrar original»');
        return fallos;
      },
    },

    // Nuestro «Mostrar original» enseña el original y deja volver a la traducción, sin volver a pedirla.
    vueltaNuestra: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Nice thread, thanks for sharing.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Totally agree.' });
        await c.avanzar(2500);
        c.enlaceDe('r1')?.click();
        await c.avanzar(500);
        c.memo.fase1 = {
          original: c.originalVisible('r1'),
          traduccion: c.traduccionDe('r1'),
          enlace: c.enlaceDe('r1')?.textContent ?? null,
          pedidas: c.peticiones.length,
        };
        c.enlaceDe('r1')?.click();
        await c.avanzar(500);
      },
      comprobar(c) {
        const fallos = [];
        const f = c.memo.fase1;
        if (!f.original) fallos.push('tras pulsar «Mostrar original», el original sigue oculto');
        if (f.traduccion !== null) fallos.push('tras pulsar «Mostrar original», la traducción sigue a la vista');
        if (f.enlace !== 'Mostrar traducción') fallos.push(`tras mostrar el original, el enlace dice «${f.enlace}» y debería decir «Mostrar traducción»`);
        if (f.pedidas !== 2) fallos.push(`se hicieron ${f.pedidas} peticiones y deberían ser 2`);
        if (c.originalVisible('r1')) fallos.push('tras volver a la traducción, el original sigue a la vista');
        if (c.traduccionDe('r1') !== 'ES: Nice thread, thanks for sharing.') fallos.push(`tras volver, no se ve la traducción («${c.traduccionDe('r1')}»)`);
        if (c.enlaceDe('r1')?.textContent !== 'Mostrar original') fallos.push(`el enlace no volvió a «Mostrar original» («${c.enlaceDe('r1')?.textContent}»)`);
        if (c.peticiones.length !== 2) fallos.push(`volver a la traducción hizo peticiones nuevas (${c.peticiones.length} en total)`);
        return fallos;
      },
    },

    // X redibuja una respuesta ya traducida: la traducción vuelve a aparecer y no se vuelve a pedir.
    redisadoApi: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'First one.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Second one.' });
        await c.avanzar(2500);
        c.redibujar('r1');
        await c.avanzar(700);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: First one.') fallos.push(`tras redibujar, r1 no muestra su traducción («${c.traduccionDe('r1')}»)`);
        if (c.originalVisible('r1')) fallos.push('tras redibujar, el original de r1 está a la vista');
        if (c.peticiones.length !== 2) fallos.push(`se hicieron ${c.peticiones.length} peticiones y deberían ser 2: la traducción se pidió otra vez`);
        return fallos;
      },
    },

    // Una cita dentro de una respuesta, las dos sin enlace: cada una se pide por su propio identificador.
    citaSinBoton: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno' });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        for (const id of ['h1', 'q1']) {
          if (c.traduccionDe(id) !== `ES: Original ${id}`) fallos.push(`${id} no muestra su traducción («${c.traduccionDe(id)}»)`);
        }
        const pedidas = c.peticiones.map(({ id }) => id);
        if (JSON.stringify(pedidas) !== JSON.stringify([c.numero('h1'), c.numero('q1')])) {
          fallos.push(`se pidió ${JSON.stringify(pedidas)} y debería ser h1 y luego q1`);
        }
        return fallos;
      },
    },

    // X reutiliza el mismo bloque de texto para otra publicación: se quita lo de la anterior.
    nodoReutilizado: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'The first tweet.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'The second tweet.' });
        await c.avanzar(2500);
        c.memo.cajaVieja = c.cajaDe('r1');
        c.memo.numeroViejo = c.numero('r1');
        c.reutilizar('r1', 'r9', 'A completely different tweet.');
        // En cuanto cede el hilo ya han corrido los observadores: ahí no debe quedar nada de la anterior.
        await new Promise((resolver) => setTimeout(resolver, 0));
        c.memo.viejaVisible = c.memo.cajaVieja.isConnected;
        c.memo.originalOculto = !c.originalVisible('r1');
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.memo.viejaVisible) fallos.push('justo tras reutilizar el bloque, la traducción de la publicación anterior seguía en pantalla');
        if (c.memo.originalOculto) fallos.push('justo tras reutilizar el bloque, el original nuevo estaba oculto');
        if (c.memo.cajaVieja?.isConnected) fallos.push('la traducción de la publicación anterior sigue en el bloque');
        if (c.traduccionDe('r9') !== 'ES: A completely different tweet.') fallos.push(`la publicación nueva no muestra su traducción («${c.traduccionDe('r9')}”)`);
        if (c.originalVisible('r9')) fallos.push('la publicación nueva enseña el original junto a la traducción');
        if (c.peticiones.filter(({ id }) => id === c.memo.numeroViejo).length !== 1) fallos.push('se volvió a pedir la publicación anterior');
        return fallos;
      },
    },

    // X responde 429: la cola espera lo que diga X y solo hay un reintento.
    limite429: {
      sesion: true,
      ajustes: { PAUSA_MS: 1000 },
      api: (() => {
        let primera = true;
        return () => (primera ? ((primera = false), { estado: 429, cabeceras: { 'retry-after': '2' } }) : { latenciaMs: 100 });
      })(),
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Rate limited once.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Never limited.' });
        await c.avanzar(6000);
      },
      comprobar(c) {
        const fallos = [];
        for (const [id, texto] of [['r1', 'Rate limited once.'], ['r2', 'Never limited.']]) {
          if (c.traduccionDe(id) !== `ES: ${texto}`) fallos.push(`${id} no está traducida («${c.traduccionDe(id)}»)`);
        }
        const deR1 = c.peticiones.filter(({ id }) => id === c.numero('r1'));
        if (deR1.length !== 2) fallos.push(`r1 recibió ${deR1.length} peticiones y debería recibir 2`);
        const [p1, p2] = c.peticiones;
        if (p1 && p2 && p2.inicio - p1.fin < 1900) fallos.push(`tras el 429, la petición siguiente empezó ${p2.inicio - p1.fin} ms después de su fin (X dijo 2 s)`);
        return fallos;
      },
    },

    // X no encuentra una publicación (404): se deja en paz. A otra le falla Grok: se prueba el servicio clásico.
    falloApi: {
      sesion: true,
      ajustes: { DIAGNOSTICO_MS: 1500 },
      avisosEsperados: ['error simulado'],
      api(id, ruta) {
        if (id === ctx.numero('r1')) return { estado: 404 };
        if (id === ctx.numero('r2')) return ruta === 'clasico' ? { latenciaMs: 100 } : { estado: 500 };
        return { latenciaMs: 100 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'This one is gone.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Grok is down for this one.' });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.cajaDe('r1')) fallos.push('la publicación que X no encuentra recibió una caja');
        if (!c.originalVisible('r1')) fallos.push('el original de r1 no está a la vista');
        if (c.traduccionDe('r2') !== 'ES: Grok is down for this one.') fallos.push(`r2 no está traducida («${c.traduccionDe('r2')}»)`);
        const deR1 = c.peticiones.filter(({ id }) => id === c.numero('r1')).map(({ ruta }) => ruta);
        if (JSON.stringify(deR1) !== JSON.stringify(['grok', 'grok-api', 'clasico'])) fallos.push(`por r1 se pidió ${JSON.stringify(deR1)} y debería ser grok, grok-api y clasico, una vez cada una`);
        const deR2 = c.peticiones.filter(({ id }) => id === c.numero('r2')).map(({ ruta }) => ruta);
        if (JSON.stringify(deR2) !== JSON.stringify(['grok', 'clasico'])) fallos.push(`por r2 se pidió ${JSON.stringify(deR2)} y debería ser grok y luego clasico`);
        return fallos;
      },
    },

    // X falla en todas sus rutas para una publicación: un reintento y se deja en paz; las demás siguen.
    servidorCaido: {
      sesion: true,
      ajustes: { REINTENTO_MS: 1500 },
      api(id) {
        return id === ctx.numero('r1') ? { estado: 500 } : { latenciaMs: 100 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Always broken.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Perfectly fine.' });
        await c.avanzar(5000);
      },
      comprobar(c) {
        const fallos = [];
        const deR1 = c.peticiones.filter(({ id }) => id === c.numero('r1'));
        if (c.cajaDe('r1')) fallos.push('la publicación que X no pudo traducir recibió una caja');
        if (!c.originalVisible('r1')) fallos.push('el original de r1 no está a la vista');
        if (deR1.length !== 4) fallos.push(`r1 recibió ${deR1.length} peticiones y debería recibir 4 (dos rutas, dos intentos)`);
        if (c.traduccionDe('r2') !== 'ES: Perfectly fine.') fallos.push(`r2 no está traducida («${c.traduccionDe('r2')}”)`);
        return fallos;
      },
    },

    // Sin sesión no hay nada que pedir: no se hace ninguna petición y no se toca nada.
    sinSesion: {
      ajustes: { DIAGNOSTICO_MS: 500 },
      avisosEsperados: ['No hay sesión de X'],
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Not logged in here.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Nothing to do.' });
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.peticiones.length) fallos.push(`sin sesión se hicieron ${c.peticiones.length} peticiones`);
        for (const id of ['r1', 'r2']) {
          if (c.cajaDe(id)) fallos.push(`${id} recibió una caja sin sesión`);
          if (!c.originalVisible(id)) fallos.push(`el original de ${id} no está a la vista`);
        }
        return fallos;
      },
    },

    // X rechaza las peticiones (401 en todas sus rutas): se prueba la clásica, se para del todo
    // hasta recargar y no se insiste con las demás publicaciones.
    sinPermiso: {
      sesion: true,
      ajustes: { DIAGNOSTICO_MS: 500 },
      avisosEsperados: ['X rechazó las peticiones de traducción'],
      api: { estado: 401 },
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(6000);
      },
      comprobar(c) {
        const fallos = [];
        for (let i = 1; i <= 3; i++) {
          if (c.cajaDe(`r${i}`)) fallos.push(`r${i} recibió una caja aunque X rechazó las peticiones`);
          if (!c.originalVisible(`r${i}`)) fallos.push(`el original de r${i} no está a la vista`);
        }
        const rutas = c.peticiones.map(({ ruta }) => ruta);
        if (JSON.stringify(rutas) !== JSON.stringify(['grok', 'clasico'])) fallos.push(`se pidió ${JSON.stringify(rutas)} y debería ser solo grok y clasico, de la primera publicación`);
        if (c.peticiones.some(({ id }) => id !== c.numero('r1'))) fallos.push('se insistió con otra publicación tras el rechazo');
        return fallos;
      },
    },

    // La respuesta llega en trozos, uno por línea: se concatenan.
    trozos: {
      sesion: true,
      api: { trozos: 4 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'This is a fairly long reply so that it splits into several pieces.' });
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: This is a fairly long reply so that it splits into several pieces.') {
          fallos.push(`los trozos no se montaron bien («${c.traduccionDe('r1')}”)`);
        }
        return fallos;
      },
    },

    // A la ruta de Grok le falta (404): sirve la clásica.
    clasico: {
      sesion: true,
      api(id, ruta) {
        return ruta === 'clasico' ? { latenciaMs: 100 } : { estado: 404 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Only the old service works.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Same here.' });
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        for (const [id, texto] of [['r1', 'Only the old service works.'], ['r2', 'Same here.']]) {
          if (c.traduccionDe(id) !== `ES: ${texto}`) fallos.push(`${id} no está traducida («${c.traduccionDe(id)}”)`);
          const rutas = c.peticiones.filter(({ id: x }) => x === c.numero(id)).map(({ ruta }) => ruta);
          if (JSON.stringify(rutas) !== JSON.stringify(['grok', 'grok-api', 'clasico'])) fallos.push(`por ${id} se pidió ${JSON.stringify(rutas)} y debería ser grok, grok-api y luego clasico`);
        }
        return fallos;
      },
    },

    // Lo que solo se cruza por pantalla no se pide; donde sí se está parado, sí.
    vueloApi: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        for (let i = 1; i <= 20; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.recorrerRapido(60);
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        const numeros = new Set(Array.from({ length: 17 }, (_, i) => c.numero(`r${i + 1}`)));
        if (c.peticiones.some(({ id }) => numeros.has(id))) fallos.push('se pidió alguna publicación por la que solo se pasó por encima');
        if (c.traduccionDe('r20') !== 'ES: Reply number 20.') fallos.push(`la última, donde sí se está parado, no está traducida («${c.traduccionDe('r20')}”)`);
        return fallos;
      },
    },

    // Una cita sin enlace propio dentro de un post que sí lo tiene: la cita no se pide nunca con
    // el identificador del post.
    citaSinEnlace: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno', sinEnlaceEnCita: true });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        const pedidas = c.peticiones.map(({ id }) => id);
        if (pedidas.length !== 1 || pedidas[0] !== c.numero('h1')) fallos.push(`se pidió ${JSON.stringify(pedidas)} y debería ser una sola petición, la del post exterior (${c.numero('h1')})`);
        if (c.traduccionDe('h1') !== 'ES: Original h1') fallos.push(`el post exterior no está traducido («${c.traduccionDe('h1')}»)`);
        if (c.cajaDe('q1')) fallos.push('la cita sin enlace recibió una caja');
        if (!c.originalVisible('q1')) fallos.push('el original de la cita no está a la vista');
        return fallos;
      },
    },

    // Tras «Mostrar original», la extensión no pulsa su propio «Mostrar traducción».
    nuestroNoSePulsa: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Leave this one in the original.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'This one stays translated.' });
        await c.avanzar(2500);
        c.enlaceDe('r1')?.click();
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== null) fallos.push('la traducción de r1 volvió a verse sola: la extensión se pulsó su propio botón');
        if (!c.originalVisible('r1')) fallos.push('el original de r1 no está a la vista');
        if (c.enlaceDe('r1')?.textContent !== 'Mostrar traducción') fallos.push(`el enlace de r1 dice «${c.enlaceDe('r1')?.textContent}» y debería seguir en «Mostrar traducción»`);
        if (c.traduccionDe('r2') !== 'ES: This one stays translated.') fallos.push(`r2 dejó de estar traducida («${c.traduccionDe('r2')}”)`);
        if (c.peticiones.length !== 2) fallos.push(`se hicieron ${c.peticiones.length} peticiones y deberían ser 2`);
        return fallos;
      },
    },

    // Lo devuelto al original no se vuelve a pedir ni a pintar, aunque X redibuje el artículo.
    revertirYRedibujar: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Keep the original here.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Translate this one.' });
        await c.avanzar(2500);
        c.enlaceDe('r1')?.click();
        c.redibujar('r1');
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.cajaDe('r1')) fallos.push('r1 volvió a recibir una caja tras devolverla al original');
        if (!c.originalVisible('r1')) fallos.push('el original de r1 no está a la vista');
        if (c.peticiones.length !== 2) fallos.push(`se hicieron ${c.peticiones.length} peticiones y deberían ser 2`);
        if (c.traduccionDe('r2') !== 'ES: Translate this one.') fallos.push(`r2 no está traducida («${c.traduccionDe('r2')}”)`);
        return fallos;
      },
    },

    // X borra nuestra caja: el original vuelve a verse en el acto; nunca en blanco.
    cajaBorrada: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'X removes this box.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'This one stays.' });
        await c.avanzar(2500);
        c.memo.ocultoAntes = !c.originalVisible('r1');
        c.borrarCaja('r1');
        await c.avanzar(700);
        c.memo.trasBorrar = { visible: c.originalVisible('r1'), traduccion: c.traduccionDe('r1'), pedidas: c.peticiones.length };
        c.redibujar('r1'); // X redibuja el artículo: la traducción vuelve de la memoria, sin pedirla otra vez
        await c.avanzar(800);
      },
      comprobar(c) {
        const fallos = [];
        if (!c.memo.ocultoAntes) fallos.push('antes de borrar la caja, el original de r1 ya estaba a la vista: la prueba no prueba nada');
        if (!c.memo.trasBorrar.visible) fallos.push('X borró la caja y el original de r1 sigue oculto: publicación en blanco');
        if (c.memo.trasBorrar.traduccion !== null) fallos.push('la traducción de r1 sigue a la vista sin caja');
        if (c.memo.trasBorrar.pedidas !== 2) fallos.push(`se hicieron ${c.memo.trasBorrar.pedidas} peticiones y deberían ser 2`);
        if (c.traduccionDe('r1') !== 'ES: X removes this box.') fallos.push(`tras redibujar, la traducción no volvió desde la memoria («${c.traduccionDe('r1')}”)`);
        if (c.peticiones.length !== 2) fallos.push(`al volver la traducción se pidió otra vez (${c.peticiones.length} peticiones)`);
        return fallos;
      },
    },

    // El rótulo dice el idioma de verdad del bloque.
    rotuloFrances: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', lang: 'fr', boton: 'ninguno', texto: 'Ceci est une réponse.' });
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: Ceci est une réponse.') fallos.push(`la respuesta en francés no está traducida («${c.traduccionDe('r1')}”)`);
        if (!c.cajaDe('r1')?.textContent.includes('Traducido del francés')) fallos.push(`el rótulo no dice «Traducido del francés» («${c.cajaDe('r1')?.textContent}»)`);
        return fallos;
      },
    },

    // X reutiliza un bloque mientras se pide su traducción: lo que llegue no se pinta bajo la otra
    // publicación.
    reutilizarEnVuelo: {
      sesion: true,
      api: { latenciaMs: 1000 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'The slow one.' });
        await c.avanzar(700); // la petición de r1 está en curso (empezó hacia 0,45 s)
        c.reutilizar('r1', 'r9', 'A different tweet took its place.');
        // Mientras llega la respuesta de la publicación vieja se mira cada poco rato: ninguna caja
        // ajena puede asomar bajo la publicación nueva, ni por un instante.
        c.memo.cajaAjena = false;
        for (let i = 0; i < 60; i++) {
          await c.avanzar(25);
          const caja = c.cajaDe('r9');
          if (caja && caja.getAttribute('data-xat-id') !== c.numero('r9')) c.memo.cajaAjena = true;
        }
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.memo.cajaAjena) fallos.push('la traducción de la publicación vieja se llegó a ver bajo la publicación nueva');
        if (c.traduccionDe('r9') !== 'ES: A different tweet took its place.') fallos.push(`el bloque reutilizado no muestra su propia traducción («${c.traduccionDe('r9')}”)`);
        if (c.cajaDe('r9')?.getAttribute('data-xat-id') !== c.numero('r9')) fallos.push('la caja del bloque reutilizado lleva otro identificador');
        if (c.originalVisible('r9')) fallos.push('el bloque reutilizado enseña el original junto a la traducción');
        return fallos;
      },
    },

    // X prohíbe la ruta de Grok (403) pero no la clásica: sirve la clásica.
    sinPermiso403: {
      sesion: true,
      api(id, ruta) {
        return ruta === 'clasico' ? { latenciaMs: 100 } : { estado: 403 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Grok says forbidden.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'The old service works.' });
        await c.avanzar(3500);
      },
      comprobar(c) {
        const fallos = [];
        for (const [id, texto] of [['r1', 'Grok says forbidden.'], ['r2', 'The old service works.']]) {
          if (c.traduccionDe(id) !== `ES: ${texto}`) fallos.push(`${id} no está traducida («${c.traduccionDe(id)}”)`);
          const rutas = c.peticiones.filter(({ id: x }) => x === c.numero(id)).map(({ ruta }) => ruta);
          if (JSON.stringify(rutas) !== JSON.stringify(['grok', 'clasico'])) fallos.push(`por ${id} se pidió ${JSON.stringify(rutas)} y debería ser grok y luego clasico`);
        }
        return fallos;
      },
    },

    // Tope por página: al llegar no se pide nada más, aunque haya publicaciones esperando.
    topePagina: {
      sesion: true,
      ajustes: { TOPE_PAGINA: 2, DIAGNOSTICO_MS: 500 },
      avisosEsperados: ['Tope de 2 traducciones por página'],
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(5000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.peticiones.length !== 2) fallos.push(`se hicieron ${c.peticiones.length} peticiones y el tope de página es 2`);
        if (c.traduccionDe('r3') !== null) fallos.push('r3 se tradujo por encima del tope');
        if (c.cajaDe('r3') || !c.originalVisible('r3')) fallos.push('r3 no quedó como estaba');
        for (const id of ['r1', 'r2']) if (c.traduccionDe(id) !== `ES: Reply number ${id[1]}.`) fallos.push(`${id} no está traducida («${c.traduccionDe(id)}”)`);
        return fallos;
      },
    },

    // Tope por hora: al llegar se espera a que pase la ventana, y entonces sigue.
    topeHora: {
      sesion: true,
      ajustes: { TOPE_HORA: 2, TOPE_VENTANA_MS: 2500, DIAGNOSTICO_MS: 500 },
      avisosEsperados: ['Tope de 2 traducciones por hora'],
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(1500);
        c.memo.pedidasAntes = c.peticiones.length;
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.memo.pedidasAntes !== 2) fallos.push(`antes de que pase la ventana se hicieron ${c.memo.pedidasAntes} peticiones y deberían ser 2`);
        if (c.traduccionDe('r3') !== 'ES: Reply number 3.') fallos.push(`pasada la ventana, r3 no llegó a traducirse («${c.traduccionDe('r3')}”)`);
        return fallos;
      },
    },

    // Con la pestaña en segundo plano no se pide nada; al volver, sigue.
    pestaniaOculta: {
      sesion: true,
      ajustes: { PARADA_MS: 1500 },
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Hidden tab, no requests.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Back to the tab.' });
        c.ocultarPestania(true);
        c.memo.oculta = await c.esperarOculta(); // la pestaña está oculta mucho antes de que venza la parada
        await c.avanzar(1800);
        c.memo.pedidasOculto = c.peticiones.length;
        c.ocultarPestania(false);
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (!c.memo.oculta) fallos.push('la pestaña no llegó a quedar en segundo plano: la prueba no prueba nada');
        if (c.memo.pedidasOculto !== 0) fallos.push(`con la pestaña oculta se hicieron ${c.memo.pedidasOculto} peticiones`);
        for (const [id, texto] of [['r1', 'Hidden tab, no requests.'], ['r2', 'Back to the tab.']]) {
          if (c.traduccionDe(id) !== `ES: ${texto}`) fallos.push(`al volver a la pestaña, ${id} no está traducida («${c.traduccionDe(id)}”)`);
        }
        return fallos;
      },
    },

    // A los 5 s, un resumen de la página en consola: cuenta todos los casos, también los que no se
    // pueden pedir, para que nada falle en silencio.
    diagnostico: {
      sesion: true,
      ajustes: { DIAGNOSTICO_MS: 1500 },
      avisosEsperados: ['[X AutoTranslate] Página:', 'ya traducidas por X: 1', 'en el idioma de la interfaz: 1', 'sin enlace permanente: 1', 'traducidas: 1', 'pedidas: 1'],
      async ejecutar(c) {
        c.crearTraducidaPorX({ id: 'principal', texto: 'The main post, already translated by X.' });
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'A reply in English.' });
        c.crearPublicacion({ id: 'es', lang: 'es', boton: 'ninguno', texto: 'Una respuesta en español.' });
        c.crearPublicacion({ id: 'sinenlace', boton: 'ninguno', texto: 'A reply without a permalink.', enlace: false });
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: A reply in English.') fallos.push(`r1 no está traducida («${c.traduccionDe('r1')}”)`);
        if (c.peticiones.length !== 1) fallos.push(`se hicieron ${c.peticiones.length} peticiones y debería ser 1`);
        return fallos;
      },
    },

    // Lo que estaba en cola y salió de pantalla antes de su turno se pide cuando vuelve.
    saleEnColaApi: {
      sesion: true,
      api(id) {
        return id === ctx.numero('r1') ? { latenciaMs: 2500 } : { latenciaMs: 50 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'The slow first reply.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Second reply.' });
        c.crearPublicacion({ id: 'r3', boton: 'ninguno', texto: 'Third reply.' });
        for (let i = 4; i <= 9; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(800);
        c.irA('r9'); // r2 y r3 salen de pantalla con la petición de r1 aún en curso
        await c.avanzar(3500); // …y les llega el turno mientras siguen fuera
        c.memo.pedidasFuera = c.peticiones.filter(({ id }) => id === c.numero('r2') || id === c.numero('r3')).length;
        c.irA('r1'); // y vuelven
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.memo.pedidasFuera !== 0) fallos.push('se pidió algo que estaba fuera de pantalla');
        for (const [id, texto] of [['r2', 'Second reply.'], ['r3', 'Third reply.']]) {
          if (c.peticiones.filter(({ id: x }) => x === c.numero(id)).length !== 1) fallos.push(`${id} no recibió exactamente una petición al volver a pantalla`);
          if (c.traduccionDe(id) !== `ES: ${texto}`) fallos.push(`al volver a pantalla, ${id} no está traducida («${c.traduccionDe(id)}”)`);
        }
        return fallos;
      },
    },

    // Lo que X no puede traducir no se vuelve a pedir, por muchos redibujados que haya.
    fallidaTrasRedibujar: {
      sesion: true,
      ajustes: { DIAGNOSTICO_MS: 1500 },
      avisosEsperados: ['fallidas: 1'],
      api: { estado: 404 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'A deleted reply.' });
        await c.avanzar(2500);
        for (let i = 0; i < 3; i++) {
          c.redibujar('r1');
          await c.avanzar(500);
        }
      },
      comprobar(c) {
        const fallos = [];
        const rutas = c.peticiones.filter(({ id }) => id === c.numero('r1')).map(({ ruta }) => ruta);
        if (JSON.stringify(rutas) !== JSON.stringify(['grok', 'grok-api', 'clasico'])) fallos.push(`por una publicación que X no encuentra se pidió ${JSON.stringify(rutas)} y debería ser una vez cada ruta y nada más`);
        if (c.cajaDe('r1') || !c.originalVisible('r1')) fallos.push('la publicación fallida no quedó como estaba');
        return fallos;
      },
    },

    // X redibuja el bloque de una publicación mientras se pide su traducción: una sola petición.
    mismaEnVuelo: {
      sesion: true,
      api: { latenciaMs: 1000 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Slow reply, redrawn meanwhile.' });
        await c.avanzar(700); // la petición de r1 está en curso
        c.redibujar('r1');
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.peticiones.length !== 1) fallos.push(`se hicieron ${c.peticiones.length} peticiones de la misma publicación y debería ser una`);
        if (c.traduccionDe('r1') !== 'ES: Slow reply, redrawn meanwhile.') fallos.push(`tras redibujar, la publicación no está traducida («${c.traduccionDe('r1')}”)`);
        return fallos;
      },
    },

    // Dos bloques del mismo artículo resuelven al mismo identificador: solo se trata el primero.
    mismoIdentificador: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno' });
        c.repetirEnlace('q1', 'h1');
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.peticiones.length !== 1) fallos.push(`por un identificador repetido se hicieron ${c.peticiones.length} peticiones y debería ser una: solo se trata el primer bloque`);
        if (c.traduccionDe('h1') !== 'ES: Original h1') fallos.push('el primer bloque no está traducido');
        if (c.cajaDe('q1')) fallos.push('el segundo bloque recibió una caja');
        return fallos;
      },
    },

    // Tres fallos seguidos por límite (429) también hacen la pausa de tres fallos.
    pausaTresFallosApi: {
      sesion: true,
      ajustes: { PAUSA_MS: 2500 },
      api: (() => {
        let quedan = 3; // los tres primeros intentos se topan con el límite de X
        return () => (quedan-- > 0 ? { estado: 429, cabeceras: { 'retry-after': '1' } } : { latenciaMs: 50 });
      })(),
      async ejecutar(c) {
        for (let i = 1; i <= 3; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(9000);
      },
      comprobar(c) {
        const fallos = [];
        const tercera = c.peticiones[2];
        const cuarta = c.peticiones[3];
        if (!cuarta) fallos.push('no hubo suficientes peticiones para comprobar la pausa');
        else if (cuarta.inicio - tercera.fin < 2400) fallos.push(`tras tres fallos seguidos por límite, la petición siguiente tardó ${cuarta.inicio - tercera.fin} ms y la pausa debe ser de 2500 ms`);
        for (let i = 1; i <= 3; i++) if (c.traduccionDe(`r${i}`) !== `ES: Reply number ${i}.`) fallos.push(`r${i} se quedó sin traducir («${c.traduccionDe(`r${i}`)}”)`);
        return fallos;
      },
    },

    // X no traduce nada (dos pausas seguidas sin ningún éxito): no se insiste hasta recargar.
    disyuntor: {
      sesion: true,
      ajustes: { PAUSA_MS: 500 },
      avisosEsperados: ['sin ningún éxito'],
      api: { estado: 404 },
      async ejecutar(c) {
        for (let i = 1; i <= 9; i++) c.crearPublicacion({ id: `r${i}`, boton: 'ninguno', texto: `Reply number ${i}.` });
        await c.avanzar(2500); // r1–r3 fallan y llega la primera pausa
        c.irA('r5'); // r4–r6 entran en pantalla
        await c.avanzar(3000); // fallan y llega la segunda pausa: paro
        c.irA('r8'); // r7–r9 entran en pantalla
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        const pedidas = new Set(c.peticiones.map(({ id }) => id));
        for (const id of ['r7', 'r8', 'r9']) if (pedidas.has(c.numero(id))) fallos.push(`${id} se pidió después de dos pausas seguidas sin ningún éxito`);
        for (let i = 1; i <= 9; i++) if (!c.originalVisible(`r${i}`) || c.cajaDe(`r${i}`)) fallos.push(`r${i} no quedó como estaba`);
        return fallos;
      },
    },

    // Un texto parado por el tope no bloquea los clics que tenga detrás en la cola.
    mixtoClicYPeticion: {
      sesion: true,
      ajustes: { TOPE_PAGINA: 1 },
      api: { latenciaMs: 50 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'First, by request.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Second, parked by the cap.' });
        c.crearPublicacion({ id: 'r3', texto: 'Third, with the button of X.' }); // botón de X: camino del clic
        await c.avanzar(3500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: First, by request.') fallos.push(`r1 no está traducida («${c.traduccionDe('r1')}”)`);
        if (c.peticiones.length !== 1 || c.peticiones[0].id !== c.numero('r1')) fallos.push('se hizo alguna petición por encima del tope de página');
        if (c.cajaDe('r2') || !c.originalVisible('r2')) fallos.push('r2 no quedó como estaba');
        if (c.clics.filter(({ id }) => id === 'r3').length !== 1) fallos.push('el botón de X de r3 no recibió su clic: el texto parado por el tope lo bloqueó');
        if (c.texto('r3') !== 'ES: Third, with the button of X.') fallos.push('r3 no está traducida');
        return fallos;
      },
    },

    // La caja de la cita no lleva role="link": se reconoce por la estructura.
    citaSinRol: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno', citaSinRol: true });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        const pedidas = c.peticiones.map(({ id }) => id);
        if (JSON.stringify(pedidas) !== JSON.stringify([c.numero('h1'), c.numero('q1')])) fallos.push(`sin role="link" en la caja de la cita se pidió ${JSON.stringify(pedidas)} y debería ser h1 y luego q1, cada una por su enlace`);
        for (const id of ['h1', 'q1']) if (c.traduccionDe(id) !== `ES: Original ${id}`) fallos.push(`${id} no está traducida («${c.traduccionDe(id)}”)`);
        return fallos;
      },
    },

    // Y si la cita no tiene ni caja reconocible ni enlace propio, no se pide nunca con el del post.
    citaSinRolNiEnlace: {
      sesion: true,
      api: { latenciaMs: 100 },
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1', boton: 'ninguno', citaSinRol: true, sinEnlaceEnCita: true });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        const pedidas = c.peticiones.map(({ id }) => id);
        if (pedidas.length !== 1 || pedidas[0] !== c.numero('h1')) fallos.push(`una cita sin caja reconocible ni enlace se pidió ${JSON.stringify(pedidas)} y no debería pedirse nunca con el identificador del post`);
        if (c.cajaDe('q1') || !c.originalVisible('q1')) fallos.push('la cita sin enlace no quedó como estaba');
        return fallos;
      },
    },

    // X recicla un artículo que tuvo botón para una publicación que no lo tiene: pasa a pedir.
    articuloReciclado: {
      sesion: true,
      api: { latenciaMs: 50 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', texto: 'Had the button of X.' }); // camino del clic
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Plain reply.' });
        await c.avanzar(2000);
        c.reciclarArticulo('r1', 'n1', { boton: 'ninguno', texto: 'Recycled for a reply without button.' });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('n1') !== 'ES: Recycled for a reply without button.') fallos.push(`el artículo reciclado no pasó al camino de petición («${c.traduccionDe('n1')}”)`);
        if (c.originalVisible('n1')) fallos.push('el original del artículo reciclado está a la vista junto a la traducción');
        if (c.peticiones.filter(({ id }) => id === c.numero('n1')).length !== 1) fallos.push('la publicación reciclada no recibió exactamente una petición');
        return fallos;
      },
    },

    // Y lo mismo al revés: la vuelta al original de una publicación no tapa a la que llega después.
    revertidoReciclado: {
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', texto: 'First post here.' });
        c.crearPublicacion({ id: 'r2', texto: 'Another post.' });
        await c.avanzar(1200);
        c.pulsarOriginal('r1');
        c.reciclarArticulo('r1', 'n1', { boton: 'texto', texto: 'A different post took the article.' });
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.clics.filter(({ id }) => id === 'n1').length !== 1) fallos.push('el botón de X de la publicación nueva no se pulsó: la marca de «vuelta al original» del artículo viejo la tapó');
        if (c.texto('n1') !== 'ES: A different post took the article.') fallos.push('la publicación nueva no está traducida');
        return fallos;
      },
    },

    // Se cae la red: un reintento y se deja en paz; las demás siguen.
    sinRed: {
      sesion: true,
      ajustes: { REINTENTO_MS: 800, DIAGNOSTICO_MS: 500 },
      avisosEsperados: ['error de red'],
      api(id) {
        return id === ctx.numero('r1') ? { red: true } : { latenciaMs: 50 };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'The network drops this one.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'The network is fine here.' });
        await c.avanzar(5000);
      },
      comprobar(c) {
        const fallos = [];
        const deR1 = c.peticiones.filter(({ id }) => id === c.numero('r1'));
        if (deR1.length !== 4) fallos.push(`r1 recibió ${deR1.length} peticiones y debería recibir 4 (dos rutas, dos intentos)`);
        if (deR1.length === 4 && deR1[2].inicio - deR1[1].fin < 700) fallos.push(`el reintento no esperó: llegó ${deR1[2].inicio - deR1[1].fin} ms después del primer intento y debe esperar unos 800 ms`);
        if (c.cajaDe('r1') || !c.originalVisible('r1')) fallos.push('la publicación sin red no quedó como estaba');
        if (c.traduccionDe('r2') !== 'ES: The network is fine here.') fallos.push(`r2 no está traducida («${c.traduccionDe('r2')}”)`);
        return fallos;
      },
    },

    // X no contesta nunca: la petición se corta al tope de tiempo. El tope es por publicación, no
    // por ruta: agotado, no se prueba la siguiente. Y lo que se corta por tiempo se reconoce como
    // tal (y no como un error de red): el aviso lo tiene que decir.
    topeDeTiempo: {
      sesion: true,
      ajustes: { PETICION_MAX_MS: 300, REINTENTO_MS: 500 },
      api: { latenciaMs: 5000 },
      avisoEsperado: 'probadas grok: tiempo agotado, clasico: sin tiempo para probarla',
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'X takes forever here.' });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        if (c.peticiones.some(({ abortada }) => !abortada)) fallos.push('alguna petición no se cortó al llegar al tope de tiempo');
        if (c.peticiones.some(({ inicio, fin }) => fin - inicio > 450)) fallos.push('alguna petición tardó más del tope de tiempo');
        if (c.peticiones.length !== 2) fallos.push(`se hicieron ${c.peticiones.length} peticiones y deberían ser 2: una por intento, porque el tope de tiempo es por publicación y no por ruta`);
        if (c.cajaDe('r1') || !c.originalVisible('r1')) fallos.push('la publicación que X no contesta no quedó como estaba');
        return fallos;
      },
    },

    // Lo que no es una traducción no se pinta; lo que llega cifrado, se descifra.
    formatosRaros: {
      sesion: true,
      api(id, ruta) {
        if (ruta !== 'grok') return { estado: 500 };
        if (id === ctx.numero('meta')) return { cuerpo: JSON.stringify({ result: { text: 'Please provide the text to translate.' } }) };
        return { cuerpo: `data:${btoa(JSON.stringify({ result: { text: 'ES: Wrapped in base64.' } }))}` };
      },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'meta', boton: 'ninguno', texto: 'A reply the model did not translate.' });
        c.crearPublicacion({ id: 'cifrada', boton: 'ninguno', texto: 'Wrapped in base64.' });
        await c.avanzar(3500);
      },
      comprobar(c) {
        const fallos = [];
        if (c.cajaDe('meta') || !c.originalVisible('meta')) fallos.push('la respuesta que no es una traducción se pintó como si lo fuera');
        if (c.traduccionDe('cifrada') !== 'ES: Wrapped in base64.') fallos.push(`la respuesta cifrada no se descifró («${c.traduccionDe('cifrada')}”)`);
        return fallos;
      },
    },

    // X usa «xx» para «inglés por defecto»: no es un idioma al que pedir.
    idiomaXX: {
      sesion: true,
      idioma: 'xx',
      api: { latenciaMs: 50 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Interface language is not a code.' });
        await c.avanzar(2000);
      },
      comprobar(c) {
        const fallos = [];
        let pedido = {};
        try { pedido = JSON.parse(c.peticiones[0]?.cuerpo ?? 'null') ?? {}; } catch { /* sin cuerpo */ }
        if (pedido.dst_lang !== 'es') fallos.push(`se pidió traducir a «${pedido.dst_lang}» y debería ser «es» (el de <html lang>)`);
        if (c.peticiones[0]?.cabeceras['x-twitter-client-language'] !== 'es') fallos.push('la cabecera de idioma no es «es»');
        return fallos;
      },
    },

    // X cambia de sitio el bloque de texto: la caja va con él.
    cajaLejos: {
      sesion: true,
      api: { latenciaMs: 50 },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'X moves this block elsewhere.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'This one does not move.' });
        await c.avanzar(2000);
        c.moverBloque('r1');
        await c.avanzar(800);
      },
      comprobar(c) {
        const fallos = [];
        if (c.traduccionDe('r1') !== 'ES: X moves this block elsewhere.') fallos.push(`tras cambiar de sitio el bloque, su traducción no está delante («${c.traduccionDe('r1')}”)`);
        if (c.originalVisible('r1')) fallos.push('tras cambiar de sitio el bloque, se ve el original junto a la traducción');
        return fallos;
      },
    },
    // Un segundo bloque sin caja ni enlace propios no se pide nunca con el identificador del post.
    bloqueHermanoSinEnlace: {
      sesion: true,
      ajustes: { DIAGNOSTICO_MS: 1500 },
      avisosEsperados: ['sin enlace permanente: 1'],
      api: { latenciaMs: 50 },
      async ejecutar(c) {
        c.crearConBloqueHermano('r1');
        await c.avanzar(2500);
      },
      comprobar(c) {
        const fallos = [];
        const pedidas = c.peticiones.map(({ id }) => id);
        if (pedidas.length !== 1 || pedidas[0] !== c.numero('r1')) fallos.push(`se pidió ${JSON.stringify(pedidas)} y debería ser solo el post, una vez`);
        if (c.traduccionDe('r1') !== 'ES: The post itself.') fallos.push('el post no está traducido');
        return fallos;
      },
    },

    // El reintento espera su tiempo, no sale en el siguiente hueco.
    reintentoEspera: {
      sesion: true,
      ajustes: { REINTENTO_MS: 1500, DIAGNOSTICO_MS: 500 },
      api: { red: true },
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'The network is down.' });
        await c.avanzar(4000);
      },
      comprobar(c) {
        const fallos = [];
        const p = c.peticiones;
        if (p.length !== 4) fallos.push(`se hicieron ${p.length} peticiones y deberían ser 4 (dos rutas, dos intentos)`);
        else if (p[2].inicio - p[1].fin < 1400) fallos.push(`el reintento no esperó: llegó ${p[2].inicio - p[1].fin} ms después del primer intento y debe esperar unos 1500 ms`);
        return fallos;
      },
    },

    // X redibuja el hilo al traducir su post principal: la cita, con botón nuevo, también se traduce.
    redisado: {
      async ejecutar(c) {
        c.crearHilo({ id: 'h1', cita: 'q1' });
        await c.avanzar(3000);
      },
      comprobar(c) {
        const fallos = [];
        for (const id of ['h1', 'q1']) {
          const n = c.clics.filter(({ id: x }) => x === id).length;
          if (n !== 1) fallos.push(`${id} recibió ${n} clics y debería ser uno`);
          if (!c.texto(id)?.startsWith('ES: ')) fallos.push(`${id} no está traducida («${c.texto(id)}»)`);
        }
        return fallos;
      },
    },
  });


  // Tras un 429 se espera lo que diga X, venga en segundos, en fecha HTTP o en la hora de
  // reseteo; si no dice nada, el tiempo de pausa; y nunca más de 15 minutos.
  // [sufijo del escenario, cabeceras del primer 429, espera mínima hasta la 2.ª petición, cuánto esperar]
  const CASOS_429 = [
    ['Segundos', () => ({ 'retry-after': '2' }), 1900, 6500],
    ['FechaHttp', () => ({ 'retry-after': new Date(Date.now() + 3000).toUTCString() }), 1800, 7500],
    ['Reseteo', () => ({ 'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 3) }), 1800, 7500],
    ['SinCabeceras', () => ({}), 1400, 5000],
    ['Tope', () => ({ 'retry-after': '3600' }), 2900, 3200],
  ];
  for (const [sufijo, cabeceras, minimo, espera] of CASOS_429) {
    escenarios[`espera429${sufijo}`] = {
      sesion: true,
      ajustes: { PAUSA_MS: 1500 },
      api: (() => {
        let primera = true;
        return () => (primera ? ((primera = false), { estado: 429, cabeceras: cabeceras() }) : { latenciaMs: 50 });
      })(),
      async ejecutar(c) {
        c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Limited once.' });
        c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Never limited.' });
        await c.avanzar(espera);
      },
      comprobar(c) {
        const fallos = [];
        const [primera, segunda] = c.peticiones;
        if (!segunda) {
          if (minimo < 2900) fallos.push('no hubo segunda petición');
        } else if (segunda.inicio - primera.fin < minimo) {
          fallos.push(`tras el 429 la petición siguiente tardó ${segunda.inicio - primera.fin} ms y debe esperar al menos ${minimo} ms`);
        }
        return fallos;
      },
    };
  }

  // ---- Lo que enseñó la sonda en la X real (26-nov-2026) --------------------------------

  // El objeto de escenarios ya está cerrado (los de los 429 también se añaden así).
  Object.assign(escenarios, {

  // X puede mandar los trozos de Grok separados por espacios y no por saltos de línea: la sonda los
  // imprimió juntos y no dejó distinguirlo. Se montan igual, y un trozo con llaves o comillas
  // dentro no se parte.
  trozosJuntos: {
    sesion: true,
    api: { trozos: 6, separador: ' ' },
    async ejecutar(c) {
      c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'A piece with {braces}, a }{ inside and "quotes", then enough words to split in six.' });
      await c.avanzar(2500);
    },
    comprobar(c) {
      const fallos = [];
      const esperada = 'ES: A piece with {braces}, a }{ inside and "quotes", then enough words to split in six.';
      if (c.traduccionDe('r1') !== esperada) fallos.push(`los trozos separados por espacios no se montaron («${c.traduccionDe('r1')}»)`);
      // Que no la rescate la ruta clásica: en la X real no traduce, así que Grok tiene que montarla sola.
      const rutas = c.peticiones.map(({ ruta }) => ruta);
      if (JSON.stringify(rutas) !== JSON.stringify(['grok'])) fallos.push(`se pidió ${JSON.stringify(rutas)} y Grok debería bastar con una petición`);
      return fallos;
    },
  },

  // X cuenta sus traducciones en ventanas de 15 minutos y lo dice en cabeceras (medido en la sonda:
  // 100 por ventana en Grok). Cuando quedan pocas no se pide nada hasta el reinicio: ni un 429
  // contra la cuenta, ni el botón de X sin cupo.
  reservaDeCupo: {
    sesion: true,
    ajustes: { DIAGNOSTICO_MS: 1500 },
    avisosEsperados: ['cerca de su límite de traducciones', 'cupo de X en esta ventana: 1 de 100'],
    api: (() => {
      let primera = true;
      return () => (primera
        ? ((primera = false), {
          latenciaMs: 50,
          cabeceras: {
            'x-rate-limit-limit': '100',
            'x-rate-limit-remaining': '1',
            'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 3),
          },
        })
        : { latenciaMs: 50 });
    })(),
    async ejecutar(c) {
      c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Almost out of quota.' });
      c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Asked after the window resets.' });
      c.crearPublicacion({ id: 'r3', boton: 'ninguno', texto: 'Asked at the usual pace.' });
      await c.avanzar(8000);
    },
    comprobar(c) {
      const fallos = [];
      const [primera, segunda, tercera] = c.peticiones;
      if (!tercera) {
        fallos.push(`se hicieron ${c.peticiones.length} peticiones y deberían ser 3: lo reservado se libera al reiniciarse la ventana`);
      } else {
        // X da el reinicio con precisión de segundos: quedan de 2 a 3 s, más el margen.
        if (segunda.inicio - primera.fin < 1900) {
          fallos.push(`X dijo que quedaba 1 petición en su ventana y la siguiente salió ${segunda.inicio - primera.fin} ms después: debe esperar al reinicio`);
        }
        if (tercera.inicio - segunda.fin > 1700) {
          fallos.push(`tras el reinicio la petición siguiente tardó ${tercera.inicio - segunda.fin} ms y debe seguir el ritmo de siempre`);
        }
      }
      if (c.traduccionDe('r3') !== 'ES: Asked at the usual pace.') fallos.push(`r3 no está traducida («${c.traduccionDe('r3')}»)`);
      return fallos;
    },
  },

  // Lo que contestó la ruta clásica en la X real (sonda del 26-nov-2026): 200 sin traducción
  // («NotCached»). No se pinta nada y el aviso enseña lo que respondió.
  clasicoVacio: {
    sesion: true,
    avisosEsperados: ['respuesta sin traducción', 'NotCached'],
    api(id, ruta) {
      return ruta === 'clasico'
        ? {
          latenciaMs: 50,
          cuerpo: JSON.stringify({
            id: String(id), id_str: String(id), translation: '',
            entities: { symbols: [], hashtags: [], user_mentions: [], urls: [], media: [], timestamps: [] },
            translationState: 'NotCached', destinationLanguage: '',
          }),
        }
        : { estado: 500 };
    },
    async ejecutar(c) {
      c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Only the classic route answers.' });
      await c.avanzar(2500);
    },
    comprobar(c) {
      const fallos = [];
      if (c.cajaDe('r1') || !c.originalVisible('r1')) fallos.push('una respuesta sin traducción se pintó como si lo fuera');
      return fallos;
    },
  },

  // Tras recargar la extensión, la consola dice qué versión está cargada: la del manifiesto.
  versionEnConsola: {
    sesion: true,
    ajustes: { DIAGNOSTICO_MS: 1500 },
    avisosEsperados: ['[X AutoTranslate] Página: v9.9.9 · bloques de texto'],
    async ejecutar(c) {
      // En una extensión de verdad, chrome.runtime.getManifest() es la del manifiesto.
      Object.defineProperty(window, 'chrome', {
        value: { runtime: { getManifest: () => ({ version: '9.9.9' }) } },
        configurable: true,
      });
      c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Any reply.' });
      await c.avanzar(2000);
    },
    comprobar: () => [],
  },

  // En la X real el texto traducido salía más pequeño y con otra pinta que el de X: X fija el
  // tamaño, la fuente y el interlineado en el propio bloque de texto, no en su padre, y nuestra
  // caja heredaba del padre. El texto toma ahora la tipografía del bloque al que sustituye.
  tipografia: {
    sesion: true,
    api: { latenciaMs: 50 },
    async ejecutar(c) {
      c.crearPublicacion({ id: 'r1', boton: 'ninguno', texto: 'Same type as the original.' });
      c.crearPublicacion({ id: 'r2', boton: 'ninguno', texto: 'Another size, another block.' });
      // Como hace X: la tipografía va en el bloque, y cambia de un bloque a otro.
      c.nodoDe('r1').style.cssText = 'font-size: 19px; line-height: 24px; font-family: Georgia, serif; font-weight: 500; letter-spacing: 0.4px';
      c.nodoDe('r2').style.cssText = 'font-size: 22px; line-height: 28px; font-family: Verdana, sans-serif; font-weight: 700';
      await c.avanzar(2500);
    },
    comprobar(c) {
      const fallos = [];
      const comprobarBloque = (id, tamano, interlineado, familia, peso, espaciado) => {
        const caja = c.cajaDe(id);
        const texto = getComputedStyle(caja.querySelector('.xat-texto'));
        if (texto.fontSize !== tamano || texto.lineHeight !== interlineado || !texto.fontFamily.includes(familia)
          || texto.fontWeight !== peso || texto.letterSpacing !== espaciado) {
          fallos.push(`el texto de ${id} tiene ${texto.fontWeight} ${texto.fontSize}/${texto.lineHeight} ${texto.fontFamily.split(',')[0]} `
            + `(espaciado ${texto.letterSpacing}) y debe tener la tipografía de su bloque: ${peso} ${tamano}/${interlineado} ${familia} (espaciado ${espaciado})`);
        }
        // La barra es de la extensión: conserva su tamaño.
        const barra = getComputedStyle(caja.querySelector('.xat-barra'));
        if (barra.fontSize !== '13px') fallos.push(`la barra de ${id} cambió de tamaño (${barra.fontSize}) y debe seguir en 13px`);
      };
      comprobarBloque('r1', '19px', '24px', 'Georgia', '500', '0.4px');
      comprobarBloque('r2', '22px', '28px', 'Verdana', '700', 'normal');
      return fallos;
    },
  },
  });

  // ---- Arranque----------------------------------------------------------------

  const definicion = escenarios[NOMBRE];
  // Los ajustes del escenario deben estar antes de que cargue la extensión.
  globalThis.__XAT_AJUSTES__ = { ...(definicion?.ajustes ?? {}) };
  // La extensión sortea el hueco entre clics con Math.random(). Para que cada escenario sea
  // reproducible, el simulador le da una secuencia fija (0 → siempre el hueco mínimo).
  const azar = definicion?.azar ?? [0];
  let tirada = 0;
  Math.random = () => azar[tirada++ % azar.length];

  // Sesión: solo el escenario que la pide tiene la cookie ct0 de X.
  document.cookie = 'ct0=; max-age=0; path=/';
  document.cookie = 'lang=; max-age=0; path=/';
  if (definicion?.sesion) {
    document.cookie = 'ct0=prueba-csrf; path=/';
    document.cookie = `lang=${definicion.idioma ?? 'es'}; path=/`;
  }

  // Servicio de traducción de X: sustituye a window.fetch para sus rutas y deja pasar el resto.
  // `api` es la regla de respuesta (o una función del identificador y de la ruta): latenciaMs,
  // trozos, estado, cuerpo, mensaje y cabeceras.
  const api = definicion?.api ?? {};
  const fetchDeVerdad = window.fetch.bind(window);
  const reglasDe = (id, ruta) => (typeof api === 'function' ? api(id, ruta) : api) ?? {};
  window.fetch = async (recurso, init = {}) => {
    const url = typeof recurso === 'string' ? recurso : recurso.url;
    const metodo = (init.method ?? 'GET').toUpperCase();
    const grok = metodo === 'POST' && /\/2\/grok\/translation\.json$/.test(url);
    const clasico = metodo === 'GET' && /\/translation\/service\/translateTweet$/.test(url);
    if (!grok && !clasico) return fetchDeVerdad(recurso, init);
    const id = grok ? JSON.parse(init.body).id : url.match(/tweetId=(\d+)/)?.[1];
    const ruta = grok ? (url.startsWith('https://api.x.com/') ? 'grok-api' : 'grok') : 'clasico';
    const peticion = { id, ruta, cuerpo: init.body ?? null, cabeceras: { ...(init.headers ?? {}) }, inicio: Math.round(performance.now() - t0) };
    peticiones.push(peticion);
    const regla = reglasDe(id, ruta);
    // Como el fetch de verdad: la red puede fallar, y la señal de aborto corta la espera.
    const fin = () => { peticion.fin = Math.round(performance.now() - t0); };
    if (regla.red) {
      await avanzar(5);
      fin();
      throw new TypeError('Failed to fetch');
    }
    // Como el fetch de verdad: corta con el motivo por el que se abortó la señal. Un controlador
    // abortado a mano da «AbortError» y AbortSignal.timeout() da «TimeoutError»: imitar solo el
    // primero taparía un fallo con el segundo.
    const abortada = await new Promise((resolver) => {
      if (init.signal?.aborted) return resolver(true);
      const temporizador = setTimeout(() => resolver(false), regla.latenciaMs ?? 100);
      init.signal?.addEventListener('abort', () => { clearTimeout(temporizador); resolver(true); }, { once: true });
    });
    fin();
    if (abortada) {
      peticion.abortada = true;
      throw init.signal?.reason ?? new DOMException('The user aborted a request.', 'AbortError');
    }
    if (regla.estado && regla.estado !== 200) {
      const cuerpo = regla.cuerpo ?? JSON.stringify({ errors: [{ code: regla.estado, message: regla.mensaje ?? 'error simulado' }] });
      return new Response(cuerpo, { status: regla.estado, headers: regla.cabeceras ?? {} });
    }
    const pub = porNumero.get(String(id));
    if (!pub) return new Response(JSON.stringify({ errors: [{ code: 34, message: 'La publicación no existe' }] }), { status: 404 });
    // El `cuerpo` de la regla vale para cualquier ruta: así se imita lo que X contestó de verdad.
    if (regla.cuerpo !== undefined) return new Response(regla.cuerpo, { status: 200, headers: regla.cabeceras ?? {} });
    const traduccion = pub.traduccion ?? `ES: ${pub.original}`;
    if (clasico) {
      const cuerpo = JSON.stringify({ translation: traduccion, sourceLanguage: pub.lang, destinationLanguage: 'es' });
      return new Response(cuerpo, { status: 200, headers: regla.cabeceras ?? {} });
    }
    // La ruta de Grok contesta en trozos, un objeto JSON cada uno, separados por `separador`.
    const trozos = regla.trozos ?? 1;
    const piezas = trozos > 1 ? (traduccion.match(new RegExp(`[\\s\\S]{1,${Math.ceil(traduccion.length / trozos)}}`, 'g')) ?? []) : [traduccion];
    const cuerpo = piezas.map((texto) => JSON.stringify({ result: { content_type: 'POST', text: texto, entities: {} } })).join(regla.separador ?? '\n');
    return new Response(cuerpo, { status: 200, headers: regla.cabeceras ?? {} });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!definicion) {
      window.__result = { escenario: NOMBRE, ok: false, fallos: [`no existe el escenario «${NOMBRE}»`] };
      return;
    }
    t0 = performance.now();
    await definicion.ejecutar(ctx);
    const fallos = definicion.comprobar(ctx);
    window.__result = {
      escenario: NOMBRE,
      ok: fallos.length === 0,
      fallos,
      avisoEsperado: definicion.avisoEsperado,
      avisosEsperados: definicion.avisosEsperados,
      unSoloAviso: definicion.unSoloAviso,
    };
  });
})();
