/* Perfiles e ingreso — Quesos Cerinza

   La maquinaria: qué ve cada perfil, cómo se arma la navegación y cómo
   se verifica un código. Este archivo se actualiza cuando cambia la app.

   LA LISTA DE PERSONAS NO ESTÁ ACÁ: está en js/gente.js, que es el
   archivo que nunca hay que reemplazar por uno de afuera. Se separaron
   porque una actualización de la app no tiene por qué tocar —ni borrar—
   los usuarios reales de la empresa.

   Cada persona queda amarrada a su celular (M1, M2, …) y a un PERFIL.
   Al ingresar, la app se configura sola con ese número y con su nombre,
   y se arma la pantalla que le corresponde. Nadie escribe nada a mano. */

import { USUARIOS } from './gente.js';
export { USUARIOS };

/* OJO con lo que esto es y lo que no es: sirve para saber quién hizo
   cada cosa, para que el celular se configure solo y para que a cada
   quien le aparezca únicamente lo suyo. NO protege los datos: todo
   corre dentro del celular y el código fuente es público. Lo que de
   verdad protege un celular perdido es el bloqueo de pantalla de
   Android. Y lo que de verdad limita lo que alguien puede ver es lo
   que se le manda a ese celular: sin archivo no hay datos. */


/* ══════════════════════════════════════════════════════════════════
   GRUPOS: la navegación de toda la app
   ══════════════════════════════════════════════════════════════════
   Abajo hay pocas pestañas, y cada una agrupa las pantallas del mismo
   momento del día. Las partes se cambian con la barra de arriba.

   La razón: un celular no aguanta seis botones abajo sin que el texto
   empiece a cortarse, y «Vender» y «Hoy» —o «Ruta» y «Carga»— son el
   mismo momento partido en dos. Cargar el carro es una sola escena:
   lo que va despachado, lo que se lleva de más y a quién se le entrega.

   `id` de cada parte = el data-pantalla de su <section> en index.html.
   `soloLotes` marca las partes que solo ve quien maneja el cuarto frío
   etiqueta por etiqueta (el Analista), no quien solo consulta totales. */

export const GRUPOS = {
  ventas: {
    etiqueta: 'Ventas',
    partes: [
      { id: 'vender', etiqueta: 'Vender' },
      { id: 'dia', etiqueta: 'Hoy' },
    ],
  },
  ruta: {
    etiqueta: 'Ruta',
    partes: [
      { id: 'ruta', etiqueta: 'Productos' },
      { id: 'carga', etiqueta: 'Carga' },
      { id: 'entregas', etiqueta: 'Clientes' },
    ],
  },
  cf2: {
    etiqueta: 'CF2',
    partes: [
      { id: 'inventario', etiqueta: 'Producto' },
      { id: 'insumos', etiqueta: 'Insumos', soloLotes: true },
    ],
  },
  ajustes: {
    etiqueta: 'Ajustes',
    partes: [{ id: 'ajustes', etiqueta: 'Ajustes' }],
  },
};


/* ══════════════════════════════════════════════════════════════════
   PERFILES
   ══════════════════════════════════════════════════════════════════
   Un solo lugar donde se declara qué ve y qué puede hacer cada quien.
   Agregar a alguien es una línea en USUARIOS; cambiar lo que ve un
   perfil es una línea acá. Los reportes que vengan después se cuelgan
   de esta misma tabla.

   grupos      → las pestañas de abajo, en ese orden.
   inicio      → en cuál grupo abre la app al ingresar.
   inventario  → 'lotes'  ve etiqueta por etiqueta y puede contar
                 'total'  ve solo el total por producto
                 null     no ve el cuarto frío
   soloLectura → true: no se pinta ningún campo editable y además se
                 bloquea el guardado. Dos candados, no uno.
   verComo     → otros perfiles que puede previsualizar sin salirse.  */

export const PERFILES = {
  analista: {
    etiqueta: 'Analista',
    grupos: ['ventas', 'ruta', 'cf2', 'ajustes'],
    inicio: 'ventas',
    inventario: 'lotes',
    soloLectura: false,
    verComo: ['administrativo'],
  },
  administrativo: {
    etiqueta: 'Administrativo',
    grupos: ['cf2', 'ajustes'],
    inicio: 'cf2',
    inventario: 'total',
    soloLectura: true,
    verComo: [],
  },
  vendedor: {
    etiqueta: 'Vendedor',
    grupos: ['ventas', 'ruta', 'ajustes'],
    inicio: 'ventas',
    inventario: null,
    soloLectura: false,
    verComo: [],
  },
};

export const PERFIL_POR_DEFECTO = 'vendedor';


/* ══════════════════════════════════════════════════════════════════
   INGRESO
   ══════════════════════════════════════════════════════════════════ */

/** Huella del código. Se le mezcla el usuario para que dos personas
    con el mismo código no tengan la misma huella. */
export async function huella(usuario, codigo) {
  const texto = `${String(usuario).trim().toLowerCase()}:${codigo}`;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación de largo constante: no revela por dónde falló. */
function iguales(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Ingreso con un solo código: no se escribe el usuario.
 *
 * El código se prueba contra la huella de cada persona hasta que una
 * coincide. Son cinco cuentas, es instantáneo, y a cambio en el celular
 * se escribe un solo campo numérico. Eso elimina de raíz el problema
 * del teclado de Android, que en los campos de texto mete mayúscula
 * inicial y a veces un espacio al final.
 *
 * Devuelve { ok, usuario, motivo }:
 *   motivo 'vacio'     → no escribió nada
 *   motivo 'malo'      → no coincide con nadie
 *   motivo 'repetido'  → dos personas tienen el mismo código. No se deja
 *                        entrar: entraría con la identidad equivocada y
 *                        las ventas quedarían a nombre de otro.
 */
export async function verificarCodigo(codigo) {
  const c = String(codigo ?? '').trim();
  if (!c) return { ok: false, motivo: 'vacio' };

  const hallados = [];
  for (const u of USUARIOS) {
    if (iguales(await huella(u.usuario, c), u.hash)) hallados.push(u);
  }
  if (hallados.length === 1) return { ok: true, usuario: hallados[0] };
  if (hallados.length > 1) return { ok: false, motivo: 'repetido' };
  return { ok: false, motivo: 'malo' };
}

export const hayUsuarios = () => USUARIOS.length > 0;


/* ══════════════════════════════════════════════════════════════════
   CONSULTAS SOBRE EL PERFIL
   ══════════════════════════════════════════════════════════════════ */

/** El nombre del perfil de un usuario. Desconocido o ausente: vendedor. */
export function perfilDe(u) {
  const p = u && u.perfil;
  return (p && PERFILES[p]) ? p : PERFIL_POR_DEFECTO;
}

/** La definición completa del perfil. Acepta el usuario o el nombre. */
export function reglasDe(algo) {
  if (typeof algo === 'string') return PERFILES[algo] || PERFILES[PERFIL_POR_DEFECTO];
  return PERFILES[perfilDe(algo)];
}

/** Las partes de un grupo que este perfil puede ver. */
export function partesDe(perfil, grupo) {
  const g = GRUPOS[grupo];
  if (!g) return [];
  const conLotes = reglasDe(perfil).inventario === 'lotes';
  return g.partes.filter(p => !p.soloLotes || conLotes);
}

/** ¿Este perfil ve esta pantalla? Busca en todos sus grupos. */
export function veLa(perfil, pantalla) {
  return reglasDe(perfil).grupos
    .some(g => partesDe(perfil, g).some(p => p.id === pantalla));
}

/** El grupo al que pertenece una pantalla, o null. */
export function grupoDe(pantalla) {
  for (const [id, g] of Object.entries(GRUPOS)) {
    if (g.partes.some(p => p.id === pantalla)) return id;
  }
  return null;
}
