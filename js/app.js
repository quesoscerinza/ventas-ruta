/* Ventas en Ruta — Quesos Cerinza
   App del vendedor: vende, imprime y al final del día manda un archivo al PC. */

import * as db from './db.js';
import * as impresora from './printer.js';
import * as ticket from './ticket.js';
import { Ticket } from './escpos.js';
import { uuid, pesos, hoyISO, fechaCorta, parecidos, normalizar } from './util.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let cfg = {};
let productos = [];
let clientesPC = [];
let carrito = [];          // [{codigo, nombre, precio, cant, subtotal}]
let clienteActual = null;  // {uuid, nombre, doc, tel, dir, pueblo, dia_ruta, nuevo}
let rutaHoy = null;        // el consolidado que mandó el PC
let subRuta = 'productos'; // pestaña activa dentro de Ruta
let cierreListo = null;    // el archivo del día, armado de antemano

/* ================= Avisos ================= */
function aviso(txt, tipo = 'ok') {
  const caja = $('#aviso');
  caja.textContent = txt;
  caja.className = 'aviso ' + tipo;
  caja.hidden = false;
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => { caja.hidden = true; }, 4500);
}

/* ================= Navegación ================= */
function ir(pantalla) {
  $$('.pantalla').forEach(p => p.hidden = p.dataset.pantalla !== pantalla);
  $$('.nav button').forEach(b => b.classList.toggle('activo', b.dataset.ir === pantalla));
  window.scrollTo(0, 0);
  if (pantalla === 'dia') pintarDia();
  if (pantalla === 'carga') pintarCarga();
  if (pantalla === 'ruta') pintarRuta();
}

/* ================= Estado de la impresora ================= */
impresora.alCambiar(e => {
  const luz = $('#luzImpresora'), txt = $('#estadoImpresora');
  luz.className = 'luz' + (e.conectada ? ' on' : '');
  txt.textContent = e.conectada ? (e.nombre || 'Impresora lista') : 'Impresora sin conectar';
  $('#btnConectar').textContent = e.conectada ? 'Reconectar' : 'Conectar impresora';
});

$('#btnConectar').addEventListener('click', async () => {
  try {
    const n = await impresora.conectar();
    aviso('Conectada: ' + n);
  } catch (e) {
    if (e.name === 'NotFoundError') return;
    aviso(String(e.message).includes('No Services matching')
      ? 'Aparece pero no expone el servicio BLE. Esa unidad es Bluetooth clásico.'
      : 'No se pudo conectar: ' + e.message, 'mal');
  }
});

/* ================= Cliente ================= */
function limpiarCliente() {
  clienteActual = null;
  $('#cliNombre').value = '';
  ['cliDoc', 'cliTel', 'cliDir', 'cliPueblo'].forEach(id => $('#' + id).value = '');
  $('#cliDia').value = '';
  $('#parecidos').hidden = true;
  $('#datosCliente').hidden = true;
}

$('#cliNombre').addEventListener('input', () => {
  const nombre = $('#cliNombre').value.trim();
  const caja = $('#parecidos');
  $('#datosCliente').hidden = nombre.length < 3;

  if (nombre.length < 3) { caja.hidden = true; return; }

  const nuevosHoy = window.__clientesNuevos || [];
  const lista = [...clientesPC.map(c => c.nombre), ...nuevosHoy.map(c => c.nombre)];
  const encontrados = parecidos(nombre, lista);

  if (!encontrados.length) { caja.hidden = true; return; }

  const casiIgual = encontrados.find(p => p.score >= 0.9);
  caja.hidden = false;
  caja.className = 'parecidos ' + (casiIgual ? 'bloquea' : 'advierte');
  caja.innerHTML =
    `<strong>${casiIgual ? 'Ya existe un cliente así' : 'Se parece a estos clientes'}</strong>` +
    encontrados.map(p =>
      `<div class="par"><span>${p.nombre}</span><span class="pct">${Math.round(p.score * 100)}%</span></div>`
    ).join('') +
    (casiIgual
      ? '<div class="nota">Si es el mismo, no lo registre otra vez: la venta se le carga al que ya existe desde el PC.</div>'
      : '<div class="nota">Si es otro cliente distinto, continúe normal.</div>');
});

function tomarCliente() {
  const nombre = $('#cliNombre').value.trim();
  if (!nombre) return null;
  const lista = [...clientesPC.map(c => c.nombre), ...(window.__clientesNuevos || []).map(c => c.nombre)];
  const bloqueado = parecidos(nombre, lista).some(p => p.score >= 0.9);
  return {
    uuid: uuid(),
    nombre,
    doc: $('#cliDoc').value.trim(),
    tel: $('#cliTel').value.trim(),
    dir: $('#cliDir').value.trim(),
    pueblo: $('#cliPueblo').value.trim(),
    dia_ruta: $('#cliDia').value,
    posible_duplicado: bloqueado
  };
}

/* ================= Carrito ================= */
function pintarBuscador(filtro = '') {
  const f = normalizar(filtro);
  const lista = f
    ? productos.filter(p => normalizar(p.nombre).includes(f) || (p.codigo || '').includes(filtro.toUpperCase()))
    : productos;
  $('#listaProductos').innerHTML = lista.slice(0, 40).map(p => {
    // Los que se pesan traen el precio por kilo, no el de la pieza:
    // el vendedor pesa en la calle y escribe el valor en la venta.
    const etiqueta = p.se_pesa
      ? `$${pesos(p.precio_kilo || 0)}/kg`
      : (Number(p.precio) ? `$${pesos(p.precio)}` : 'sin precio');
    const clase = p.se_pesa ? 'pesa' : (Number(p.precio) ? '' : 'sinprecio');
    return `
    <button class="prod" data-id="${p.id}">
      <span class="pnombre">${p.nombre}</span>
      <span class="pprecio ${clase}">${etiqueta}</span>
    </button>`;
  }).join('') || '<p class="vacio">No hay productos. Cargue la semilla en Ajustes.</p>';
}

$('#buscarProducto').addEventListener('input', e => pintarBuscador(e.target.value));

$('#listaProductos').addEventListener('click', e => {
  const btn = e.target.closest('.prod');
  if (!btn) return;
  agregar(btn.dataset.id);
});

function agregar(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const ya = carrito.find(x => x.id === id);
  if (ya) ya.cant += 1;
  else carrito.push({
    id: p.id, codigo: p.codigo, nombre: p.nombre,
    precio: Number(p.precio) || 0, cant: 1,
    se_pesa: !!p.se_pesa, precio_kilo: Number(p.precio_kilo) || 0
  });
  pintarCarrito();
}

function pintarCarrito() {
  carrito.forEach(i => i.subtotal = i.cant * i.precio);
  const total = carrito.reduce((s, i) => s + i.subtotal, 0);

  $('#carrito').innerHTML = carrito.length ? carrito.map((i, n) => `
    <div class="item">
      <div class="inombre">${i.nombre}</div>
      <div class="ictrl">
        <button class="menos" data-n="${n}">−</button>
        <input class="icant" type="number" inputmode="numeric" min="0" value="${i.cant}" data-n="${n}">
        <button class="mas" data-n="${n}">+</button>
        <span class="isub">$${pesos(i.subtotal)}</span>
      </div>
      <div class="iprecio ${i.precio ? '' : 'falta'}">
        <label>${i.se_pesa ? `Precio (pesar · $${pesos(i.precio_kilo)}/kg)` : 'Precio unit.'}</label>
        <input class="ipre" type="number" inputmode="numeric" value="${i.precio}" data-n="${n}"
               placeholder="${i.se_pesa ? 'valor pesado' : 'escriba el precio'}">
      </div>
    </div>`).join('') : '<p class="vacio">Toque un producto para agregarlo.</p>';

  $('#total').textContent = '$' + pesos(total);
  $('#btnCobrar').disabled = !carrito.length;
}

$('#carrito').addEventListener('click', e => {
  const n = e.target.dataset.n;
  if (n === undefined) return;
  if (e.target.classList.contains('mas')) carrito[n].cant += 1;
  else if (e.target.classList.contains('menos')) carrito[n].cant -= 1;
  else return;
  if (carrito[n].cant <= 0) carrito.splice(n, 1);
  pintarCarrito();
});

$('#carrito').addEventListener('change', e => {
  const n = e.target.dataset.n;
  if (n === undefined) return;
  if (e.target.classList.contains('icant')) {
    carrito[n].cant = Math.max(0, Number(e.target.value) || 0);
    if (!carrito[n].cant) carrito.splice(n, 1);
  } else if (e.target.classList.contains('ipre')) {
    carrito[n].precio = Math.max(0, Number(e.target.value) || 0);
  }
  pintarCarrito();
});

/* ================= Guardar e imprimir ================= */
$('#btnCobrar').addEventListener('click', async () => {
  if (!cfg.dispositivo) { aviso('Primero ponga el número de celular (M1, M2…) en Ajustes.', 'mal'); return ir('ajustes'); }
  const cli = tomarCliente();
  if (!cli) { aviso('Falta el nombre del cliente.', 'mal'); return $('#cliNombre').focus(); }
  if (!carrito.length) return;
  const sinPrecio = carrito.filter(i => !Number(i.precio));
  if (sinPrecio.length) {
    aviso('Falta el precio de: ' + sinPrecio.map(i => i.nombre).join(', '), 'mal');
    return;
  }

  const ahora = new Date();
  const venta = {
    uuid: uuid(),
    numero: await db.siguienteNumero(),
    fecha: hoyISO(),
    hora: ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
    creada: ahora.toISOString(),
    dispositivo: cfg.dispositivo,
    vendedor: cfg.vendedor,
    cliente_uuid: cli.uuid,
    cliente_nombre: cli.nombre,
    cliente_doc: cli.doc,
    cliente_tel: cli.tel,
    cliente_dir: cli.dir,
    cliente_pueblo: cli.pueblo,
    cliente_dia_ruta: cli.dia_ruta,
    cliente_posible_duplicado: cli.posible_duplicado,
    items: carrito.map(i => ({ ...i })),
    total: carrito.reduce((s, i) => s + i.subtotal, 0),
    pago: $('#pago').value,
    nota: $('#nota').value.trim(),
    anulada: false
  };

  await db.guardar('ventas', venta);
  await db.guardar('clientes_nuevos', {
    uuid: cli.uuid, nombre: cli.nombre, doc: cli.doc, tel: cli.tel,
    dir: cli.dir, pueblo: cli.pueblo, dia_ruta: cli.dia_ruta,
    fecha: venta.fecha, dispositivo: cfg.dispositivo,
    posible_duplicado: cli.posible_duplicado
  });
  window.__clientesNuevos = await db.todos('clientes_nuevos');

  aviso('Guardada ' + venta.numero);
  try {
    await impresora.imprimir(ticket.remision(venta, cfg));
  } catch (e) {
    aviso('Guardada, pero no se pudo imprimir: ' + e.message, 'mal');
  }

  carrito = [];
  limpiarCliente();
  $('#nota').value = '';
  $('#buscarProducto').value = '';
  pintarBuscador();
  pintarCarrito();
});

/* ================= Pantalla Día ================= */
async function pintarDia() {
  const fecha = hoyISO();
  const ventas = await db.ventasDe(fecha);
  const vivas = ventas.filter(v => !v.anulada);
  const total = vivas.reduce((s, v) => s + v.total, 0);
  const efectivo = vivas.filter(v => v.pago === 'efectivo').reduce((s, v) => s + v.total, 0);

  $('#resumenDia').innerHTML = `
    <div class="metrica"><span>${vivas.length}</span><label>Ventas</label></div>
    <div class="metrica"><span>$${pesos(efectivo)}</span><label>Efectivo</label></div>
    <div class="metrica"><span>$${pesos(total - efectivo)}</span><label>Pendiente</label></div>
    <div class="metrica destacada"><span>$${pesos(total)}</span><label>Total</label></div>`;

  $('#listaVentas').innerHTML = ventas.length ? ventas.map(v => `
    <div class="venta ${v.anulada ? 'anulada' : ''}">
      <div class="vcab">
        <strong>${v.numero}</strong>
        <span>${v.hora}</span>
        <span class="vtotal">$${pesos(v.total)}</span>
      </div>
      <div class="vcli">${v.cliente_nombre}${v.cliente_posible_duplicado ? ' <span class="marca-dup">posible duplicado</span>' : ''}</div>
      <div class="vpago">${v.pago}${v.anulada ? ' · ANULADA' : ''}</div>
      <div class="vacc">
        <button data-reimprimir="${v.uuid}">Reimprimir</button>
        ${v.anulada ? '' : `<button class="peligro" data-anular="${v.uuid}">Anular</button>`}
      </div>
    </div>`).join('') : '<p class="vacio">Todavía no hay ventas hoy.</p>';

  prepararCierre();   // sin await: que el botón nunca tenga que esperar

  const filas = await db.cuadre(fecha);
  $('#cuadre').innerHTML = filas.length ? `
    <table>
      <tr><th>Producto</th><th>Llevó</th><th>Vendió</th><th>Sobra</th></tr>
      ${filas.map(f => `<tr class="${f.alerta ? 'alerta' : ''}">
        <td>${f.nombre}</td><td>${f.cargado}</td><td>${f.vendido}</td><td>${f.sobrante}</td></tr>`).join('')}
    </table>
    ${filas.some(f => f.alerta) ? '<p class="nota mal">Hay productos vendidos que no estaban en la carga. Revise antes de cerrar.</p>' : ''}`
    : '<p class="vacio">No registró la carga del día.</p>';
}

$('#listaVentas').addEventListener('click', async e => {
  const re = e.target.dataset.reimprimir, an = e.target.dataset.anular;
  if (re) {
    const v = await db.obtener('ventas', re);
    try { await impresora.imprimir(ticket.remision(v, cfg)); aviso('Reimpresa ' + v.numero); }
    catch (err) { aviso('No se pudo imprimir: ' + err.message, 'mal'); }
  }
  if (an) {
    const v = await db.obtener('ventas', an);
    const motivo = prompt(`Anular ${v.numero}. ¿Motivo?`);
    if (!motivo) return;
    v.anulada = true; v.motivo_anulacion = motivo;
    await db.guardar('ventas', v);
    aviso('Anulada ' + v.numero);
    pintarDia();   // vuelve a armar el archivo del cierre
  }
});

/* ================= Pantalla Carga ================= */

/** Lo que el PC dice que lleva este celular, según la remisión APP MOVIL. */
async function cargaSugerida() {
  const ruta = await db.rutaDe(hoyISO());
  if (!ruta || !ruta.carga || !ruta.carga.length) return null;
  // Si hay varias, la de este celular; si ninguna trae sufijo, la primera.
  const mia = ruta.carga.find(c => c.dispositivo === cfg.dispositivo)
           || ruta.carga.find(c => !c.dispositivo);
  if (!mia) return null;
  const mapa = new Map();
  for (const it of mia.items) mapa.set(`${it.codigo || ''}|${it.nombre}`, it.cant);
  return { ...mia, mapa, fecha: ruta.fecha };
}

async function pintarCarga() {
  const guardada = await db.cargaDe(hoyISO());
  const yaConfirmada = guardada.items.length > 0;
  const mapaGuardado = new Map(guardada.items.map(i => [i.id, i.cant]));
  const sug = await cargaSugerida();

  // Encabezado: de dónde salen los números que ve
  if (sug) {
    const desfase = sug.fecha !== hoyISO() ? ' (la ruta no es de hoy)' : '';
    $('#cargaOrigen').innerHTML =
      `Viene de la remisión <strong>${sug.numero_remision || sug.nombre}</strong>${desfase}. ` +
      (yaConfirmada
        ? 'Ya la confirmó; puede corregirla si hace falta.'
        : 'Cuente el producto y corrija lo que no cuadre antes de guardar.');
    $('#cargaOrigen').hidden = false;
  } else {
    $('#cargaOrigen').hidden = true;
  }

  // Se muestran primero los productos que trae la remisión
  const conSugerencia = sug
    ? productos.filter(p => sug.mapa.has(p.id))
    : [];
  const resto = productos.filter(p => !conSugerencia.includes(p));
  const orden = [...conSugerencia, ...resto];

  $('#listaCarga').innerHTML = orden.map(p => {
    const propuesto = sug ? sug.mapa.get(p.id) : undefined;
    // Antes de confirmar se propone lo de la remisión; después manda lo contado.
    const valor = yaConfirmada
      ? (mapaGuardado.get(p.id) ?? '')
      : (propuesto ?? '');
    const distinto = yaConfirmada && propuesto !== undefined
      && Number(mapaGuardado.get(p.id) || 0) !== Number(propuesto);
    return `
    <div class="cfila ${propuesto !== undefined ? 'sugerido' : ''}">
      <span>${p.nombre}${propuesto !== undefined
        ? `<em class="sug">remisión: ${propuesto}${distinto ? ' ⚠' : ''}</em>` : ''}</span>
      <input type="number" inputmode="numeric" min="0" data-id="${p.id}"
             value="${valor}" placeholder="0">
    </div>`;
  }).join('') || '<p class="vacio">Cargue la semilla en Ajustes.</p>';
}

$('#btnGuardarCarga').addEventListener('click', async () => {
  const items = $$('#listaCarga input').map(inp => {
    const p = productos.find(x => x.id === inp.dataset.id);
    return { id: inp.dataset.id, codigo: p?.codigo || '', nombre: p?.nombre || inp.dataset.id, cant: Number(inp.value) || 0 };
  }).filter(i => i.cant > 0);
  const sug = await cargaSugerida();
  await db.guardar('carga', {
    fecha: hoyISO(), items,
    remision: sug ? (sug.numero_remision || sug.nombre) : '',
    sugerida: sug ? [...sug.mapa].map(([id, cant]) => ({ id, cant })) : []
  });
  // Si el conteo físico no coincide con la remisión, decirlo en el momento
  let difs = 0;
  if (sug) {
    const contado = new Map(items.map(i => [i.id, i.cant]));
    const llaves = new Set([...sug.mapa.keys(), ...contado.keys()]);
    for (const k of llaves) {
      if (Number(sug.mapa.get(k) || 0) !== Number(contado.get(k) || 0)) difs++;
    }
  }
  aviso(difs
    ? `Carga guardada. ${difs} producto(s) no coinciden con la remisión — el PC lo verá.`
    : `Carga guardada: ${items.length} productos.`);
  pintarCarga();
});

/* ================= Pantalla Ruta ================= */
$$('.subnav button').forEach(b => b.addEventListener('click', () => {
  subRuta = b.dataset.sub;
  $$('.subnav button').forEach(x => x.classList.toggle('activo', x === b));
  $('#subProductos').hidden = subRuta !== 'productos';
  $('#subClientes').hidden = subRuta !== 'clientes';
}));

async function pintarRuta() {
  rutaHoy = await db.rutaDe(hoyISO());
  if (!rutaHoy) {
    $('#rutaCabecera').textContent =
      'Todavía no ha cargado la ruta del día. Se la manda el PC por WhatsApp y se carga en Ajustes.';
    $('#listaRutaProductos').innerHTML = '';
    $('#listaRutaClientes').innerHTML = '';
    return;
  }

  const vieja = rutaHoy.fecha !== hoyISO();
  $('#rutaCabecera').innerHTML =
    `<strong>${rutaHoy.dia_ruta}</strong> · ${fechaCorta(rutaHoy.fecha)}` +
    (vieja ? ' <span class="marca-dup">no es de hoy</span>' : '');

  const marcas = await db.marcasDe(rutaHoy.fecha);
  pintarChequeoProductos(marcas.producto || {});
  pintarChequeoClientes(marcas.cliente || {});
}

function barraAvance(hechos, total, rotulo) {
  return `<div class="avance"><span>${rotulo}</span>
    <strong>${hechos} de ${total}</strong></div>`;
}

function pintarChequeoProductos(marcas) {
  const lista = rutaHoy.productos || [];
  const hechos = lista.filter(p => marcas[p.codigo + '|' + p.nombre]).length;
  $('#listaRutaProductos').innerHTML =
    barraAvance(hechos, lista.length, 'Cargados') +
    '<div class="chequeo">' + (lista.map(p => {
      const id = p.codigo + '|' + p.nombre;
      const ok = !!marcas[id];
      return `<label class="chq ${ok ? 'hecho' : ''}">
        <input type="checkbox" data-tipo="producto" data-id="${id}" ${ok ? 'checked' : ''}>
        <span class="txt"><span class="t1">${p.nombre}</span>
        <span class="t2">${p.codigo || ''}</span></span>
        <span class="cant">${p.cantidad}${p.unidad ? ' ' + p.unidad : ''}</span>
      </label>`;
    }).join('') || '<p class="vacio">La ruta llegó sin productos.</p>') + '</div>';
}

function pintarChequeoClientes(marcas) {
  const lista = rutaHoy.clientes || [];
  const hechos = lista.filter(c => marcas[c.cliente_id]).length;
  $('#listaRutaClientes').innerHTML =
    barraAvance(hechos, lista.length, 'Entregados') +
    '<div class="chequeo">' + (lista.map(c => {
      const ok = !!marcas[c.cliente_id];
      const detalle = (c.items || []).map(i => `${i.cant} ${i.nombre}`).join(', ');
      return `<label class="chq ${ok ? 'hecho' : ''}">
        <input type="checkbox" data-tipo="cliente" data-id="${c.cliente_id}" ${ok ? 'checked' : ''}>
        <span class="txt"><span class="t1">${c.nombre}</span>
        <span class="t2">${[c.pueblo, c.numero_remision].filter(Boolean).join(' · ')}<br>${detalle}</span></span>
        <span class="cant">$${pesos(c.total || 0)}</span>
      </label>`;
    }).join('') || '<p class="vacio">La ruta llegó sin clientes.</p>') + '</div>';
}

async function alMarcar(e) {
  const inp = e.target;
  if (inp.type !== 'checkbox' || !inp.dataset.tipo) return;
  await db.marcar(rutaHoy.fecha, inp.dataset.tipo, inp.dataset.id, inp.checked);
  pintarRuta();
}
$('#listaRutaProductos').addEventListener('change', alMarcar);
$('#listaRutaClientes').addEventListener('change', alMarcar);

/* ================= Cierre y envío ================= */
async function armarCierre() {
  const fecha = hoyISO();
  const ventas = await db.ventasDe(fecha);
  const vivas = ventas.filter(v => !v.anulada);
  const nuevos = (await db.todos('clientes_nuevos')).filter(c => c.fecha === fecha);
  const carga = await db.cargaDe(fecha);
  const filas = await db.cuadre(fecha);
  const ruta = await db.rutaDe(fecha);
  const marcas = await db.marcasDe(fecha);

  const total = vivas.reduce((s, v) => s + v.total, 0);
  const efectivo = vivas.filter(v => v.pago === 'efectivo').reduce((s, v) => s + v.total, 0);

  return {
    formato: 'cerinza-movil-v1',
    dispositivo: cfg.dispositivo,
    vendedor: cfg.vendedor,
    fecha,
    generado: new Date().toISOString(),
    carga: carga.items,
    carga_remision: carga.remision || '',
    carga_sugerida: carga.sugerida || [],
    ventas,                    // incluye las anuladas, con su motivo
    clientes_nuevos: nuevos,
    cuadre: filas,
    entregas: ruta && ruta.fecha === fecha ? {
      dia_ruta: ruta.dia_ruta,
      productos_cargados: Object.keys(marcas.producto || {}),
      clientes_entregados: Object.keys(marcas.cliente || {}),
      clientes_sin_entregar: (ruta.clientes || [])
        .filter(c => !(marcas.cliente || {})[c.cliente_id])
        .map(c => ({ cliente_id: c.cliente_id, nombre: c.nombre,
                     numero_remision: c.numero_remision, total: c.total }))
    } : null,
    resumen: {
      fecha,
      num_ventas: vivas.length,
      clientes_nuevos: nuevos.length,
      total, efectivo,
      pendiente: total - efectivo,
      cuadre: filas
    }
  };
}

/* Android solo permite abrir el menú de Compartir como reacción inmediata
   a un toque. Si el botón se pone a leer la base primero, ese permiso se
   pierde y Android responde "Permission denied". Por eso el archivo se
   arma antes, mientras el vendedor mira la pantalla, y el botón solo
   comparte lo que ya está listo. */
async function prepararCierre() {
  try {
    const datos = await armarCierre();
    const nombre = `cierre_${cfg.dispositivo || 'M?'}_${datos.fecha}.json`;
    const blob = new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' });
    cierreListo = {
      datos, nombre, blob,
      archivo: new File([blob], nombre, { type: 'application/json' })
    };
  } catch (e) {
    cierreListo = null;
  }
}

function descargarCierre(c) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(c.blob);
  a.download = c.nombre;
  a.click();
  URL.revokeObjectURL(a.href);
  aviso('Se descargó ' + c.nombre + '. Adjúntelo por WhatsApp.');
}

$('#btnCerrar').addEventListener('click', () => {
  if (!cfg.dispositivo) { aviso('Falta el número de celular en Ajustes.', 'mal'); return ir('ajustes'); }

  const c = cierreListo;
  if (!c) { aviso('Un momento, todavía estoy armando el archivo.', 'mal'); prepararCierre(); return; }
  if (!c.datos.ventas.length && !c.datos.carga.length) {
    aviso('No hay nada que enviar todavía.', 'mal'); return;
  }

  // Ningún await antes de esta línea: es lo que mantiene vivo el permiso.
  if (navigator.canShare?.({ files: [c.archivo] })) {
    navigator.share({
      files: [c.archivo],
      title: 'Cierre ' + cfg.dispositivo,
      text: `Cierre ${fechaCorta(c.datos.fecha)} · ${c.datos.resumen.num_ventas} ventas · $${pesos(c.datos.resumen.total)}`
    }).then(() => aviso('Enviado.'))
      .catch(e => {
        if (e.name === 'AbortError') return;
        // Si Android igual lo rechaza, queda el camino de siempre.
        descargarCierre(c);
      });
  } else {
    descargarCierre(c);
  }
});

$('#btnImprimirCierre').addEventListener('click', async () => {
  const datos = await armarCierre();
  try { await impresora.imprimir(ticket.cierre(datos.resumen, cfg)); }
  catch (e) { aviso('No se pudo imprimir: ' + e.message, 'mal'); }
});

/* ================= Ajustes ================= */
async function pintarAjustes() {
  $('#ajDispositivo').value = cfg.dispositivo || '';
  $('#ajVendedor').value = cfg.vendedor || '';
  $('#ajNit').value = cfg.empresa_nit || '';
  $('#ajTel').value = cfg.empresa_tel || '';
  $('#ajLugar').value = cfg.empresa_lugar || '';
  $('#ajCodepage').value = cfg.codepage || '0';
  $('#infoSemilla').textContent = cfg.seed_fecha
    ? `${productos.length} productos y ${clientesPC.length} clientes (${new Date(cfg.seed_fecha).toLocaleDateString('es-CO')})`
    : 'Sin cargar. La app no puede vender sin productos.';
  $('#infoConsecutivo').textContent = `Próxima remisión: ${cfg.dispositivo || 'M?'}-${String((Number(cfg.consecutivo) || 0) + 1).padStart(3, '0')}`;
  const r = await db.rutaDe(hoyISO());
  $('#infoRuta').textContent = r
    ? `Ruta cargada: ${r.dia_ruta} del ${fechaCorta(r.fecha)} · ${(r.clientes || []).length} clientes`
    : 'Sin ruta del día cargada.';
}

$('#btnGuardarAjustes').addEventListener('click', async () => {
  await db.ajustar('dispositivo', $('#ajDispositivo').value.trim().toUpperCase());
  await db.ajustar('vendedor', $('#ajVendedor').value.trim());
  await db.ajustar('empresa_nit', $('#ajNit').value.trim());
  await db.ajustar('empresa_tel', $('#ajTel').value.trim());
  await db.ajustar('empresa_lugar', $('#ajLugar').value.trim());
  await db.ajustar('codepage', $('#ajCodepage').value);
  cfg = await db.ajustes();
  pintarAjustes();
  aviso('Ajustes guardados.');
});

async function procesarArchivo(texto) {
  const datos = JSON.parse(texto);
    // Se reconoce por el contenido, no por el nombre: el vendedor no
    // tiene que acordarse de cuál archivo va en cuál botón.
  // Se reconoce por el contenido, no por el nombre: el vendedor no
  // tiene que acordarse de cuál archivo va en cuál botón.
  if (datos.formato === 'cerinza-ruta-v1') {
    const r = await db.cargarRuta(datos);
    await recargar();
    aviso(`Ruta del ${r.dia_ruta} cargada: ${r.productos} productos, ${r.clientes} clientes.`);
    ir('ruta');
  } else if (datos.formato === 'cerinza-seed-v1') {
    const r = await db.cargarSemilla(datos);
    await recargar();
    aviso(`Semilla cargada: ${r.productos} productos, ${r.clientes} clientes.`);
  } else {
    aviso('Ese archivo no lo reconozco. Debe ser la semilla o la ruta del día.', 'mal');
  }
}

$('#archivoSemilla').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    await procesarArchivo(await f.text());
  } catch (err) {
    aviso('No se pudo leer el archivo: ' + err.message, 'mal');
  }
  e.target.value = '';
});

/* Archivo que llegó por el menú Compartir de Android (desde WhatsApp).
   El service worker lo dejó guardado y nos mandó aquí con ?compartido=1. */
async function revisarCompartido() {
  if (!new URLSearchParams(location.search).has('compartido')) return;
  history.replaceState(null, '', location.pathname);   // limpiar la dirección
  try {
    const bandeja = await caches.open('compartido');
    const guardado = await bandeja.match('/ultimo');
    if (!guardado) {
      aviso('No llegó el archivo compartido. Intente de nuevo.', 'mal');
      return;
    }
    const texto = await guardado.text();
    await bandeja.delete('/ultimo');
    await procesarArchivo(texto);
  } catch (err) {
    aviso('No se pudo leer el archivo compartido: ' + err.message, 'mal');
  }
}

$('#btnProbarAcentos').addEventListener('click', async () => {
  const t = new Ticket(cfg.codepage);
  t.linea('PRUEBA DE ACENTOS');
  t.separador();
  t.linea('áéíóú ÁÉÍÓÚ');
  t.linea('ñ Ñ ü Ü');
  t.linea('Cerinza, Boyacá');
  t.linea('Corporación Peña');
  t.linea('¿Cuántos? ¡Listo!');
  t.linea('Cra 5 # 4-20  $18.000');
  t.separador();
  t.linea('Si salen simbolos raros,');
  t.linea('cambie la tabla y repita.');
  t.avanzar(4);
  try { await impresora.imprimir(t.bytes()); }
  catch (e) { aviso('No se pudo imprimir: ' + e.message, 'mal'); }
});

/* ================= Arranque ================= */
async function recargar() {
  cfg = await db.ajustes();
  productos = (await db.todos('productos')).filter(p => p.activo !== false);
  clientesPC = await db.todos('clientes_pc');
  window.__clientesNuevos = await db.todos('clientes_nuevos');
  const dias = cfg.dias_ruta || ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  $('#cliDia').innerHTML = '<option value="">Día de ruta sugerido…</option>' +
    dias.map(d => `<option>${d}</option>`).join('');
  $('#cabDispositivo').textContent = cfg.dispositivo || 'sin configurar';
  pintarBuscador();
  pintarCarrito();
  pintarAjustes();
}

$$('.nav button').forEach(b => b.addEventListener('click', () => ir(b.dataset.ir)));

recargar().then(async () => {
  if (!cfg.dispositivo) { ir('ajustes'); aviso('Configure el número de este celular para empezar.', 'mal'); }
  else ir('vender');
  await revisarCompartido();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}
