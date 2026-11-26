#!/usr/bin/env node
// Bancada de X AutoTranslate.
//
// Abre cada escenario de test/driver.js en un Chromium sin cabeza y comprueba su
// veredicto. Dirige el navegador por el canal de depuración (--remote-debugging-pipe,
// sin puertos de depuración) y con un perfil temporal que se borra al salir, también si se
// corta con Ctrl+C: nunca toca el perfil del usuario.
//
// Antes de los escenarios comprueba manifest.json: ahí echa raíces lo que la extensión
// promete sobre permisos y sobre dónde corre.
//
// La página de pruebas se sirve por HTTP en 127.0.0.1, con puerto aleatorio y solo mientras
// duran las pruebas, porque las cookies (la sesión simulada de X) no existen sobre file://.
// El servidor solo entrega ficheros .html, .js y .css de este proyecto.
//
// Uso: node test/run.mjs [escenario...]
// El binario se puede cambiar con la variable XAT_CHROME.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const BINARIO = process.env.XAT_CHROME || '/usr/lib/chromium/chromium';
const LIMITE_MS = 40_000;
const ARRANQUE_MS = 15_000;
const pedidos = process.argv.slice(2);

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const servidor = createServer(async (peticion, respuesta) => {
  const rechazar = (codigo) => { respuesta.writeHead(codigo).end(); };
  if (peticion.method !== 'GET') return rechazar(405);
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(peticion.url, 'http://127.0.0.1').pathname);
  } catch {
    return rechazar(400);
  }
  const fichero = resolve(raiz, `.${ruta}`);
  const tipo = tipos[extname(fichero)];
  if (!tipo || !fichero.startsWith(raiz + sep) || ruta.split('/').some((parte) => parte.startsWith('.'))) {
    return rechazar(404);
  }
  try {
    const contenido = await readFile(fichero);
    respuesta.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-store' }).end(contenido);
  } catch {
    rechazar(404);
  }
});
await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
const pagina = `http://127.0.0.1:${servidor.address().port}/test/mock-x.html`;

const perfil = mkdtempSync(join(tmpdir(), 'xat-perfil-'));
const chrome = spawn(BINARIO, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  // Sin esto Chrome trata la página como oculta y ralentiza los temporizadores encadenados.
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  `--user-data-dir=${perfil}`,
  '--remote-debugging-pipe',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
chrome.on('error', () => {});
chrome.stdio[3].on('error', () => {});
chrome.stdio[4].setEncoding('utf8');

// ---- Salida y limpieza ----------------------------------------------------------------
// Nada deja el perfil temporal huérfano: ni un final normal, ni un error, ni un Ctrl+C, ni un
// `kill`. Chromium tiene que haber salido del todo antes de borrar su carpeta.
let limpiando = null;
let interrumpido = null; // código de salida si la pasada se cortó con una señal
async function limpiar() {
  limpiando ??= (async () => {
    const vivo = () => chrome.exitCode === null && chrome.signalCode === null;
    if (vivo()) {
      const salido = new Promise((resolver) => chrome.once('exit', resolver));
      chrome.kill();
      await Promise.race([salido, new Promise((resolver) => setTimeout(resolver, 5_000))]);
      if (vivo()) {
        chrome.kill('SIGKILL');
        await Promise.race([salido, new Promise((resolver) => setTimeout(resolver, 2_000))]);
      }
    }
    rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    servidor.close();
  })();
  return limpiando;
}
for (const [senal, codigo] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(senal, async () => {
    interrumpido = codigo;
    await limpiar();
    process.exit(codigo);
  });
}

// ---- Manifiesto -----------------------------------------------------------------------
// Lo que la extensión promete sobre permisos echa raíces en manifest.json, así que se comprueba
// en cada pasada: sin claves de más (ni `permissions`, ni `host_permissions`, ni un guion en
// otros marcos), corriendo solo en X y con la misma versión que la última del registro de
// cambios. Se lee desde Node porque es un fichero: no hace falta un navegador.
const CLAVES_DEL_MANIFIESTO = ['manifest_version', 'name', 'version', 'description', 'content_scripts'];
const CLAVES_DEL_GUION = ['matches', 'js', 'css', 'run_at'];
const ORIGENES = ['https://x.com/*', 'https://twitter.com/*'];
async function comprobarManifiesto() {
  let manifiesto;
  try {
    manifiesto = JSON.parse(await readFile(join(raiz, 'manifest.json'), 'utf8'));
  } catch (error) {
    return [`manifest.json no se puede leer: ${error.message}`];
  }
  if (!manifiesto || typeof manifiesto !== 'object') return ['manifest.json no es un objeto JSON'];
  const fallos = [];
  const deMas = (objeto, permitidas) => Object.keys(objeto).filter((clave) => !permitidas.includes(clave));
  const sobran = deMas(manifiesto, CLAVES_DEL_MANIFIESTO);
  if (sobran.length) fallos.push(`claves del manifiesto que no debería tener: ${sobran.join(', ')}`);
  if (manifiesto.manifest_version !== 3) fallos.push(`manifest_version vale ${manifiesto.manifest_version} y debería valer 3`);
  if (!/al español/.test(manifiesto.description ?? '')) fallos.push('la descripción no dice que traduce al español');
  const guiones = manifiesto.content_scripts;
  if (!Array.isArray(guiones) || guiones.length !== 1) {
    fallos.push('content_scripts debería tener un único guion');
  } else {
    const [guion] = guiones;
    const sobranDelGuion = deMas(guion, CLAVES_DEL_GUION);
    if (sobranDelGuion.length) fallos.push(`claves del guion que no debería tener: ${sobranDelGuion.join(', ')}`);
    if (JSON.stringify(guion.matches) !== JSON.stringify(ORIGENES)) {
      fallos.push(`el guion corre en ${JSON.stringify(guion.matches)} y debería correr solo en ${JSON.stringify(ORIGENES)}`);
    }
  }
  // La versión del manifiesto y la última del registro de cambios se suben siempre juntas.
  const registro = await readFile(join(raiz, 'CHANGELOG.md'), 'utf8').catch(() => '');
  const ultima = registro.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  if (ultima !== manifiesto.version) {
    fallos.push(`el manifiesto va por la ${manifiesto.version} y la última versión del registro de cambios es la ${ultima ?? '(ninguna)'}`);
  }
  return fallos;
}

// ---- Canal de depuración -------------------------------------------------------------

let siguienteId = 0;
const contestaciones = new Map();
const avisos = [];
const excepciones = [];
let bufer = '';

chrome.stdio[4].on('data', (trozo) => {
  bufer += trozo;
  let fin;
  while ((fin = bufer.indexOf('\0')) !== -1) {
    const mensaje = JSON.parse(bufer.slice(0, fin));
    bufer = bufer.slice(fin + 1);
    if (mensaje.id !== undefined) {
      contestaciones.get(mensaje.id)?.(mensaje);
      contestaciones.delete(mensaje.id);
    } else if (mensaje.method === 'Runtime.consoleAPICalled' && ['warning', 'info'].includes(mensaje.params.type)) {
      avisos.push(mensaje.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (mensaje.method === 'Runtime.exceptionThrown') {
      const { exception, text } = mensaje.params.exceptionDetails;
      excepciones.push(exception?.description ?? text);
    }
  }
});

function enviar(method, params = {}, sessionId) {
  return new Promise((resolver, rechazar) => {
    const id = ++siguienteId;
    contestaciones.set(id, (mensaje) => {
      if (mensaje.error) rechazar(new Error(`${method}: ${mensaje.error.message}`));
      else resolver(mensaje.result);
    });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
  });
}

const conPlazo = (promesa, ms, texto) => Promise.race([
  promesa,
  new Promise((_, rechazar) => setTimeout(() => rechazar(new Error(texto)), ms)),
]);

// ---- Ejecución -----------------------------------------------------------------------

// Manda la pestaña de pruebas a segundo plano (oculta = true) o la trae de vuelta. Un escenario
// lo pide con ctx.ocultarPestania(). Para ocultarla hace falta otra pestaña delante y quitar la
// emulación de foco; para traerla de vuelta, con restaurar la emulación basta.
let pestañaDeCortina = null;
async function fijarOculta(oculta, sesion) {
  await enviar('Emulation.setFocusEmulationEnabled', { enabled: !oculta }, sesion);
  if (oculta) {
    if (!pestañaDeCortina) pestañaDeCortina = (await enviar('Target.createTarget', { url: 'about:blank' })).targetId;
  } else {
    if (pestañaDeCortina) {
      await enviar('Target.closeTarget', { targetId: pestañaDeCortina });
      pestañaDeCortina = null;
    }
    await enviar('Page.bringToFront', {}, sesion);
  }
}

async function ejecutarEscenario(nombre, sesion) {
  avisos.length = 0;
  excepciones.length = 0;
  const inicio = Date.now();
  // about:blank fuerza que la siguiente sea una carga completa y no un cambio de ancla.
  await enviar('Page.navigate', { url: 'about:blank' }, sesion);
  await enviar('Page.navigate', { url: `${pagina}#${encodeURIComponent(nombre)}` }, sesion);
  await enviar('Page.bringToFront', {}, sesion);
  let resultado;
  let visibilidad;
  let oculta = false;
  let ocultaActual = false;
  while (!resultado && Date.now() - inicio < LIMITE_MS) {
    await new Promise((resolver) => setTimeout(resolver, 100));
    ({ json: resultado, visibilidad, oculta } = (await enviar('Runtime.evaluate', {
      expression: '({ json: JSON.stringify(window.__result), visibilidad: document.visibilityState, oculta: window.__xatOculta === true })',
      returnByValue: true,
    }, sesion)).result?.value ?? {});
    if (oculta !== ocultaActual) {
      await fijarOculta(oculta, sesion);
      ocultaActual = oculta;
      await new Promise((resolver) => setTimeout(resolver, 300));
    }
    if (resultado) {
      const candidato = JSON.parse(resultado);
      if (candidato.escenario === nombre) resultado = candidato;
      else resultado = undefined;
    }
  }
  if (ocultaActual) await fijarOculta(false, sesion);
  // Una página que no está en primer plano tiene los tiempos ralentizados: su veredicto no vale.
  const fallos = [...(resultado?.fallos ?? [`sin veredicto tras ${LIMITE_MS} ms`]), ...excepciones.map((e) => `excepción: ${e}`)];
  if (visibilidad !== 'visible') fallos.push(`la página de pruebas no está en primer plano («${visibilidad}»): los tiempos no son fiables`);
  for (const fragmento of [resultado?.avisoEsperado, ...(resultado?.avisosEsperados ?? [])].filter(Boolean)) {
    if (!avisos.some((aviso) => aviso.includes(fragmento))) fallos.push(`no apareció en consola el aviso con «${fragmento}»`);
  }
  if (resultado?.unSoloAviso) {
    const cuantos = avisos.filter((aviso) => aviso.trimStart().startsWith(resultado.unSoloAviso)).length;
    if (cuantos !== 1) fallos.push(`debe haber exactamente un mensaje que empiece por «${resultado.unSoloAviso}» y hay ${cuantos}`);
  }
  return { nombre, ok: fallos.length === 0, fallos, ms: Date.now() - inicio };
}

let codigoDeSalida = 1;
try {
  const fallosDeManifiesto = await comprobarManifiesto();
  console.log(fallosDeManifiesto.length ? `FAIL manifiesto — ${fallosDeManifiesto.join('; ')}` : 'PASS manifiesto');
  // Se usa la pestaña con la que arranca el navegador (la que está en primer plano), no una nueva.
  const { targetInfos } = await conPlazo(enviar('Target.getTargets'), ARRANQUE_MS, `Chromium no arranca (${BINARIO})`);
  const targetId = targetInfos.find((t) => t.type === 'page')?.targetId;
  if (!targetId) throw new Error('Chromium no tiene ninguna pestaña');
  const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  await enviar('Page.enable', {}, sessionId);
  await enviar('Runtime.enable', {}, sessionId);
  await enviar('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false }, sessionId);
  // Unos 2,5 s después de arrancar, el navegador sin cabeza deja la página como oculta: deja de
  // dibujar y ralentiza los temporizadores encadenados. Con la emulación de foco se mantiene visible.
  await enviar('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId);
  await enviar('Page.bringToFront', {}, sessionId);

  await enviar('Page.navigate', { url: `${pagina}#` }, sessionId);
  let nombres;
  for (let intento = 0; !nombres && intento < 100; intento++) {
    await new Promise((resolver) => setTimeout(resolver, 100));
    nombres = (await enviar('Runtime.evaluate', { expression: 'Object.keys(window.__xatEscenarios ?? {})', returnByValue: true }, sessionId)).result?.value;
  }
  if (!nombres?.length) throw new Error('la página de pruebas no expone ningún escenario');
  const desconocidos = pedidos.filter((n) => !nombres.includes(n));
  if (desconocidos.length) throw new Error(`escenarios que no existen: ${desconocidos.join(', ')}. Hay: ${nombres.join(', ')}`);

  let pasados = fallosDeManifiesto.length ? 0 : 1;
  const escenarios = pedidos.length || nombres.length;
  for (const nombre of (pedidos.length ? pedidos : nombres)) {
    const { ok, fallos, ms } = await ejecutarEscenario(nombre, sessionId);
    pasados += ok ? 1 : 0;
    console.log(ok ? `PASS ${nombre} (${(ms / 1000).toFixed(1)} s)` : `FAIL ${nombre} (${(ms / 1000).toFixed(1)} s) — ${fallos.join('; ')}`);
  }
  const total = escenarios + 1; // el manifiesto cuenta como una comprobación más
  console.log(`${pasados}/${total} comprobaciones: el manifiesto y ${escenarios} escenario${escenarios === 1 ? '' : 's'}`);
  codigoDeSalida = pasados === total ? 0 : 1;
} catch (error) {
  console.error(`ERROR ${error.message}`);
} finally {
  await limpiar();
}
process.exit(interrumpido ?? codigoDeSalida);
