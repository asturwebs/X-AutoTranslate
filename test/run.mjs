#!/usr/bin/env node
// Bancada de X AutoTranslate.
//
// Abre cada escenario de test/driver.js en un Chromium sin cabeza y comprueba su
// veredicto. Dirige el navegador por el canal de depuración (--remote-debugging-pipe,
// sin puertos abiertos) y con un perfil temporal que se borra al salir: nunca toca el
// perfil del usuario.
//
// Uso: node test/run.mjs [escenario...]
// El binario se puede cambiar con la variable XAT_CHROME.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BINARIO = process.env.XAT_CHROME || '/usr/lib/chromium/chromium';
const LIMITE_MS = 40_000;
const ARRANQUE_MS = 15_000;
const pagina = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'mock-x.html')).href;
const pedidos = process.argv.slice(2);

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
    } else if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'warning') {
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
  while (!resultado && Date.now() - inicio < LIMITE_MS) {
    await new Promise((resolver) => setTimeout(resolver, 100));
    ({ json: resultado, visibilidad } = (await enviar('Runtime.evaluate', {
      expression: '({ json: JSON.stringify(window.__result), visibilidad: document.visibilityState })',
      returnByValue: true,
    }, sesion)).result?.value ?? {});
    if (resultado) {
      const candidato = JSON.parse(resultado);
      if (candidato.escenario === nombre) resultado = candidato;
      else resultado = undefined;
    }
  }
  // Una página que no está en primer plano tiene los tiempos ralentizados: su veredicto no vale.
  const fallos = [...(resultado?.fallos ?? [`sin veredicto tras ${LIMITE_MS} ms`]), ...excepciones.map((e) => `excepción: ${e}`)];
  if (visibilidad !== 'visible') fallos.push(`la página de pruebas no está en primer plano («${visibilidad}»): los tiempos no son fiables`);
  if (resultado?.avisoEsperado && !avisos.some((aviso) => aviso.includes(resultado.avisoEsperado))) {
    fallos.push(`no apareció en consola el aviso con «${resultado.avisoEsperado}»`);
  }
  return { nombre, ok: fallos.length === 0, fallos, ms: Date.now() - inicio };
}

let codigoDeSalida = 1;
try {
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

  let pasados = 0;
  for (const nombre of (pedidos.length ? pedidos : nombres)) {
    const { ok, fallos, ms } = await ejecutarEscenario(nombre, sessionId);
    pasados += ok ? 1 : 0;
    console.log(ok ? `PASS ${nombre} (${(ms / 1000).toFixed(1)} s)` : `FAIL ${nombre} (${(ms / 1000).toFixed(1)} s) — ${fallos.join('; ')}`);
  }
  console.log(`${pasados}/${pedidos.length || nombres.length} escenarios`);
  codigoDeSalida = pasados === (pedidos.length || nombres.length) ? 0 : 1;
} catch (error) {
  console.error(`ERROR ${error.message}`);
} finally {
  // Esperar a que Chromium haya salido del todo antes de borrar su perfil.
  const salido = new Promise((resolver) => chrome.once('exit', resolver));
  chrome.kill();
  await Promise.race([salido, new Promise((resolver) => setTimeout(resolver, 5_000))]);
  rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
process.exit(codigoDeSalida);
