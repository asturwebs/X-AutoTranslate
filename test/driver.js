// Simulador de X para la bancada de X AutoTranslate.
//
// Carga antes que ../content.js para fijar los ajustes del escenario antes de que
// arranque la extensión. El nombre del escenario llega en el ancla de la URL
// (mock-x.html#visible). Cada escenario recibe un contexto `ctx`, monta sus
// publicaciones, espera lo que necesite y deja su veredicto en window.__result.
(() => {
  'use strict';

  const NOMBRE = decodeURIComponent(location.hash.slice(1));
  const escenarios = {};
  window.__xatEscenarios = escenarios;

  const publicaciones = new Map();
  const clics = [];
  let t0 = 0;

  const avanzar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

  // ---- Simulación de X ------------------------------------------------------------

  function traducir(pub) {
    if (pub.traducida) return;
    pub.traducida = true;
    pub.texto.textContent = `ES: ${pub.original}`;
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

  // Hilo cuyo post principal cita otra publicación. Cada uno lleva su botón de traducir.
  // Traducir el principal redibuja el contenido del artículo: el <article> es el mismo
  // elemento, pero todos sus hijos son nuevos.
  function crearHilo({ id, cita, retrasoMs = 50 }) {
    const principal = { id, original: `Original ${id}`, retrasoMs, falla: false, traducida: false };
    const citada = { id: cita, original: `Original ${cita}`, retrasoMs, falla: false, traducida: false };
    const articulo = document.createElement('article');
    articulo.className = 'xat-pub xat-hilo';
    const bloque = (pub) => {
      const texto = document.createElement('div');
      texto.setAttribute('data-testid', 'tweetText');
      texto.lang = pub.traducida ? 'es' : 'en';
      texto.textContent = pub.traducida ? `ES: ${pub.original}` : pub.original;
      const hueco = document.createElement('div');
      hueco.className = 'xat-control';
      pub.texto = texto;
      pub.hueco = hueco;
      pub.control = null;
      const caja = document.createElement('div');
      caja.className = 'xat-bloque';
      caja.append(texto, hueco);
      if (pub.traducida) ponerControl(pub, botonDeTexto('Mostrar original'));
      else ponerControl(pub, botonDeTraducir('texto', () => alClic(pub)));
      return caja;
    };
    const montar = () => {
      const marco = document.createElement('div');
      marco.setAttribute('role', 'link');
      marco.className = 'xat-cita';
      marco.append(bloque(citada));
      articulo.replaceChildren(bloque(principal), marco);
    };
    principal.redibuja = () => {
      principal.traducida = true;
      montar();
    };
    montar();
    for (const pub of [principal, citada]) {
      pub.articulo = articulo;
      publicaciones.set(pub.id, pub);
    }
    document.querySelector('main').append(articulo);
    return articulo;
  }

  function ponerControl(pub, boton) {
    pub.control?.remove();
    pub.control = boton;
    pub.hueco.append(boton);
  }

  function crearPublicacion({
    id, lang = 'en', boton = 'texto', retrasoMs = 50, falla = false, yaTraducida = false, etiqueta,
    quitaControl = false,
  }) {
    const articulo = document.createElement('article');
    articulo.className = 'xat-pub';
    articulo.dataset.xatId = id;
    const texto = document.createElement('div');
    texto.setAttribute('data-testid', 'tweetText');
    texto.lang = lang;
    const original = `Original ${id}`;
    texto.textContent = original;
    const hueco = document.createElement('div');
    hueco.className = 'xat-control';
    articulo.append(texto, hueco);
    const pub = {
      id, articulo, texto, hueco, original, retrasoMs, falla, traducida: false, control: null, lang, quitaControl,
    };
    if (yaTraducida) {
      // X ya la tradujo: texto en español y «Mostrar original».
      pub.traducida = true;
      texto.textContent = `ES: ${original}`;
      texto.lang = 'es';
      ponerControl(pub, botonDeTexto('Mostrar original'));
    } else if (boton !== 'ninguno') {
      ponerControl(pub, botonDeTraducir(boton, () => alClic(pub), etiqueta));
    }
    publicaciones.set(id, pub);
    document.querySelector('main').append(articulo);
    return pub;
  }

  // ---- Contexto que reciben los escenarios -----------------------------------------

  function calcularVisibleAlInicio() {
    return [...publicaciones.values()]
      .filter(({ control }) => control && !control.textContent.includes('Mostrar original'))
      .filter(({ control }) => {
        const r = control.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      })
      .map(({ id }) => id);
  }

  const ctx = {
    clics,
    avanzar,
    memo: {},
    crearPublicacion,
    crearHilo,
    texto: (id) => publicaciones.get(id)?.texto.textContent ?? null,
    // El Socio pulsa «Mostrar original».
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
    get visibleAlInicio() {
      const valor = calcularVisibleAlInicio();
      Object.defineProperty(this, 'visibleAlInicio', { value: valor, enumerable: true });
      return valor;
    },
  };

  // ---- Escenarios ------------------------------------------------------------------

  const recuentos = (lista) => lista.reduce((mapa, { id }) => ((mapa[id] = (mapa[id] ?? 0) + 1), mapa), {});

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

    // Si el Socio pulsa «Mostrar original», esa publicación no se vuelve a traducir.
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

  // ---- Arranque --------------------------------------------------------------------

  // Los ajustes del escenario deben estar antes de que cargue la extensión.
  globalThis.__XAT_AJUSTES__ = { ...(escenarios[NOMBRE]?.ajustes ?? {}) };
  // La extensión sortea el hueco entre clics con Math.random(). Para que cada escenario sea
  // reproducible, el simulador le da una secuencia fija (0 → siempre el hueco mínimo).
  const azar = escenarios[NOMBRE]?.azar ?? [0];
  let tirada = 0;
  Math.random = () => azar[tirada++ % azar.length];

  document.addEventListener('DOMContentLoaded', async () => {
    const definicion = escenarios[NOMBRE];
    if (!definicion) {
      window.__result = { escenario: NOMBRE, ok: false, fallos: [`no existe el escenario «${NOMBRE}»`] };
      return;
    }
    t0 = performance.now();
    await definicion.ejecutar(ctx);
    const fallos = definicion.comprobar(ctx);
    window.__result = { escenario: NOMBRE, ok: fallos.length === 0, fallos, avisoEsperado: definicion.avisoEsperado };
  });
})();
