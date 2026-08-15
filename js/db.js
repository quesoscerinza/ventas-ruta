/* Base local del celular (IndexedDB) — Ventas en Ruta / Quesos Cerinza
   Todo vive aquí: la app funciona sin señal y solo sale a internet
   cuando el vendedor comparte el cierre del día. */

const NOMBRE = 'cerinza_ruta';
const VERSION = 1;

const TIENDAS = {
  ajustes: { keyPath: 'clave' },
  productos: { keyPath: 'id' },   // id = codigo|nombre — QC059 lo comparten varios yogures
  clientes_pc: { keyPath: 'id', autoIncrement: true },   // los que ya existen en el PC
  clientes_nuevos: { keyPath: 'uuid' },                  // capturados en la calle
  carga: { keyPath: 'fecha' },                           // lo que se lleva por día
  ventas: { keyPath: 'uuid' }
};

let _db = null;

export function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, VERSION);
    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      for (const [nombre, opts] of Object.entries(TIENDAS)) {
        if (!db.objectStoreNames.contains(nombre)) {
          const t = db.createObjectStore(nombre, opts);
          if (nombre === 'ventas') t.createIndex('fecha', 'fecha');
        }
      }
    };
    req.onsuccess = () => { _db = req.result; ok(_db); };
    req.onerror = () => mal(req.error);
  });
}

function tx(tienda, modo = 'readonly') {
  return abrir().then(db => db.transaction(tienda, modo).objectStore(tienda));
}
const promesa = req => new Promise((ok, mal) => {
  req.onsuccess = () => ok(req.result);
  req.onerror = () => mal(req.error);
});

export const todos = tienda => tx(tienda).then(t => promesa(t.getAll()));
export const obtener = (tienda, clave) => tx(tienda).then(t => promesa(t.get(clave)));
export const guardar = (tienda, valor) => tx(tienda, 'readwrite').then(t => promesa(t.put(valor)));
export const borrar = (tienda, clave) => tx(tienda, 'readwrite').then(t => promesa(t.delete(clave)));
export const vaciar = tienda => tx(tienda, 'readwrite').then(t => promesa(t.clear()));

export async function guardarVarios(tienda, lista) {
  const t = await tx(tienda, 'readwrite');
  await Promise.all(lista.map(v => promesa(t.put(v))));
  return lista.length;
}

/* ---------- Ajustes ---------- */
const AJUSTES_POR_DEFECTO = {
  dispositivo: '',            // M1, M2, M3 — se configura una sola vez por celular
  vendedor: '',
  consecutivo: 0,
  codepage: '0',
  empresa_nombre: 'QUESOS CERINZA',
  empresa_nit: '',
  empresa_tel: '',
  empresa_lugar: 'Cerinza - Boyacá',
  impresora_id: '',
  seed_fecha: ''
};

export async function ajustes() {
  const filas = await todos('ajustes');
  const mapa = { ...AJUSTES_POR_DEFECTO };
  for (const f of filas) mapa[f.clave] = f.valor;
  return mapa;
}
export const ajustar = (clave, valor) => guardar('ajustes', { clave, valor });

/* ---------- Numeración: serie propia por celular, nunca choca con la del PC ---------- */
export async function siguienteNumero() {
  const a = await ajustes();
  const n = (Number(a.consecutivo) || 0) + 1;
  await ajustar('consecutivo', n);
  return `${a.dispositivo || 'M?'}-${String(n).padStart(3, '0')}`;
}

/* ---------- Semilla que viene del PC ---------- */
export async function cargarSemilla(datos) {
  if (datos.formato !== 'cerinza-seed-v1') {
    throw new Error('El archivo no es una semilla de Remisiones (falta cerinza-seed-v1).');
  }
  await vaciar('productos');
  await vaciar('clientes_pc');
  // El código NO es único (QC059 = los 4 yogures): la llave es codigo + nombre
  await guardarVarios('productos', (datos.productos || []).map(p => ({
    ...p, id: `${p.codigo || ''}|${p.nombre}`
  })));
  await guardarVarios('clientes_pc', (datos.clientes || []).map(c =>
    typeof c === 'string' ? { nombre: c } : c
  ));
  await ajustar('pueblos', datos.pueblos || []);
  await ajustar('dias_ruta', datos.dias_ruta || []);
  await ajustar('seed_fecha', datos.generado || new Date().toISOString());
  return {
    productos: (datos.productos || []).length,
    clientes: (datos.clientes || []).length
  };
}

/* ---------- Consultas del día ---------- */
export async function ventasDe(fecha) {
  const t = await tx('ventas');
  const todas = await promesa(t.index('fecha').getAll(fecha));
  return todas.sort((a, b) => a.creada.localeCompare(b.creada));
}

export async function cargaDe(fecha) {
  return (await obtener('carga', fecha)) || { fecha, items: [] };
}

/**
 * Cuadre del queso extra: lo que se llevó, lo que se vendió y lo que debe volver.
 * Sin esto el inventario del PC queda descuadrado.
 */
export async function cuadre(fecha) {
  const carga = await cargaDe(fecha);
  const ventas = (await ventasDe(fecha)).filter(v => !v.anulada);
  const vendido = new Map();
  for (const v of ventas)
    for (const it of v.items)
      vendido.set(it.id, (vendido.get(it.id) || 0) + it.cant);

  const filas = [];
  for (const c of carga.items) {
    const vend = vendido.get(c.id) || 0;
    filas.push({ id: c.id, codigo: c.codigo, nombre: c.nombre, cargado: c.cant, vendido: vend, sobrante: c.cant - vend });
    vendido.delete(c.id);
  }
  // Vendido sin haberse cargado: descuadre que hay que revisar antes de cerrar
  for (const [id, vend] of vendido) {
    const it = ventas.flatMap(v => v.items).find(i => i.id === id);
    filas.push({ id, codigo: it?.codigo || '', nombre: it?.nombre || id, cargado: 0, vendido: vend, sobrante: -vend, alerta: true });
  }
  return filas;
}
