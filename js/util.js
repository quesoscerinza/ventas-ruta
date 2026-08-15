/* Utilidades compartidas — Ventas en Ruta / Quesos Cerinza */

export const uuid = () =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }));

export const pesos = n => Math.round(n).toLocaleString('es-CO');

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fechaCorta = iso => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

/* --- Normalización de nombres: mismo criterio que clientes_parecidos() del PC --- */
export function normalizar(txt) {
  return (txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes, deja la ñ como n
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')       // fuera puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

/* Similitud por bigramas (coeficiente de Dice): 0 = distintos, 1 = idénticos */
function bigramas(s) {
  const set = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const par = s.slice(i, i + 2);
    set.set(par, (set.get(par) || 0) + 1);
  }
  return set;
}

function dice(x, y) {
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;
  const ba = bigramas(x), bb = bigramas(y);
  let comunes = 0, totalA = 0, totalB = 0;
  for (const [k, v] of ba) { totalA += v; if (bb.has(k)) comunes += Math.min(v, bb.get(k)); }
  for (const v of bb.values()) totalB += v;
  return (2 * comunes) / (totalA + totalB);
}

/**
 * Similitud entre dos nombres. Mira tres cosas y se queda con la peor sospecha:
 *  1. el nombre completo contra el completo
 *  2. los dos sin espacios — atrapa "AIDA LUZ" contra "AHIDALUZ"
 *  3. el nombre corto contra cada pedazo del largo — atrapa el nombre
 *     que quedó escondido dentro de otro con apellidos o paréntesis de más
 */
export function similitud(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  let mejor = dice(x, y);
  mejor = Math.max(mejor, dice(x.replace(/ /g, ''), y.replace(/ /g, '')));

  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  const c = corto.replace(/ /g, ''), l = largo.replace(/ /g, '');
  if (c.length >= 4 && l.length > c.length) {
    const ancho = c.length;
    for (let i = 0; i + 2 <= l.length; i++) {
      const trozo = l.slice(i, i + ancho + 1);
      if (trozo.length < ancho - 1) break;
      mejor = Math.max(mejor, dice(c, trozo));
    }
  }
  return mejor;
}

/**
 * Busca nombres parecidos en una lista.
 * Devuelve [{nombre, score, contenido}] ordenado de mayor a menor.
 * `contenido` = uno de los dos nombres está completo dentro del otro
 * (el caso "AIDA LUZ" vs "AIDA LUZ (WILLIAM DIAZ)").
 */
export function parecidos(nombre, lista, umbral = 0.75) {
  const n = normalizar(nombre);
  if (n.length < 3) return [];
  const salida = [];
  for (const item of lista) {
    const otro = typeof item === 'string' ? item : item.nombre;
    const o = normalizar(otro);
    if (!o) continue;
    const contenido = o.includes(n) || n.includes(o);
    const score = contenido ? Math.max(0.9, similitud(n, o)) : similitud(n, o);
    if (score >= umbral) salida.push({ nombre: otro, score, contenido });
  }
  return salida.sort((a, b) => b.score - a.score).slice(0, 6);
}

/* Alinea texto a izquierda y derecha dentro de N columnas del ticket */
export function alinear(izq, der, columnas = 32) {
  izq = String(izq); der = String(der);
  const hueco = columnas - izq.length - der.length;
  if (hueco >= 1) return izq + ' '.repeat(hueco) + der;
  // No cabe: recorta la parte izquierda para no perder el valor
  const disponible = columnas - der.length - 1;
  return izq.slice(0, Math.max(0, disponible)) + ' ' + der;
}

/* Parte un texto largo en varias líneas de N columnas, sin cortar palabras */
export function envolver(txt, columnas = 32) {
  const palabras = String(txt).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if (!actual.length) { actual = p.slice(0, columnas); continue; }
    if (actual.length + 1 + p.length <= columnas) actual += ' ' + p;
    else { lineas.push(actual); actual = p.slice(0, columnas); }
  }
  if (actual) lineas.push(actual);
  return lineas;
}
