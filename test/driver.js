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
    // El mismo elemento pasa a «Mostrar original».
    pub.control.setAttribute('aria-label', 'Mostrar original');
    pub.control.textContent = 'Mostrar original';
  }

  function alClic(pub) {
    clics.push({ id: pub.id, t: Math.round(performance.now() - t0) });
    if (pub.falla) return;
    setTimeout(() => traducir(pub), pub.retrasoMs);
  }

  function botonDeTraducir(variante, alPulsar) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'xat-traducir';
    const texto = document.createElement('span');
    if (variante !== 'aria') texto.textContent = 'Traducir publicación';
    if (variante === 'aria' || variante === 'ambos') boton.setAttribute('aria-label', 'Traducir publicación');
    if (variante === 'mixto') boton.setAttribute('aria-label', 'Traducir');
    boton.append(texto);
    boton.addEventListener('click', alPulsar);
    return boton;
  }

  function ponerControl(pub, boton) {
    pub.control?.remove();
    pub.control = boton;
    pub.hueco.append(boton);
  }

  function crearPublicacion({ id, lang = 'en', boton = 'texto', retrasoMs = 50, falla = false }) {
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
    const pub = { id, articulo, texto, hueco, original, retrasoMs, falla, traducida: false, control: null };
    if (boton !== 'ninguno') ponerControl(pub, botonDeTraducir(boton, () => alClic(pub)));
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
    texto: (id) => publicaciones.get(id)?.texto.textContent ?? null,
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
        await c.avanzar(1500);
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
          if (tiempos[i] - tiempos[i - 1] < 280) fallos.push(`dos clics seguidos distan ${tiempos[i] - tiempos[i - 1]} ms (mínimo 280)`);
        }
        for (const [id, n] of Object.entries(recuentos(c.clics))) {
          if (n > 1) fallos.push(`${id} recibió ${n} clics`);
        }
        if (!c.texto('r11')?.startsWith('ES: ')) fallos.push(`tras scrollear, r11 no está traducida («${c.texto('r11')}»)`);
        return fallos;
      },
    },

    // Lo que solo se cruza por pantalla, sin detenerse, no se traduce.
    vuelo: {
      async ejecutar(c) {
        for (let i = 1; i <= 20; i++) c.crearPublicacion({ id: `r${i}` });
        await c.recorrerRapido(60);
        await c.avanzar(1000);
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
  });

  // ---- Arranque --------------------------------------------------------------------

  // Los ajustes del escenario deben estar antes de que cargue la extensión.
  globalThis.__XAT_AJUSTES__ = { ...(escenarios[NOMBRE]?.ajustes ?? {}) };

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
