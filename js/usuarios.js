/* Usuarios y perfiles — Quesos Cerinza

   Cada persona queda amarrada a su celular (M1, M2, …) y a un PERFIL.
   Al ingresar, la app se configura sola con ese número y con su nombre,
   y se arma la pantalla que le corresponde a ese perfil. Nadie escribe
   nada a mano ni puede equivocarse.

   El código NO se guarda aquí en texto: se guarda su huella SHA-256.
   Para agregar o cambiar a alguien, corra en el PC:

       python generar_usuario.py

   y pegue abajo la línea que le imprima.

   OJO con lo que esto es y lo que no es: sirve para saber quién hizo
   cada cosa, para que el celular se configure solo y para que a cada
   quien le aparezca únicamente lo suyo. NO protege los datos: todo
   corre dentro del celular y el código fuente es público. Lo que de
   verdad protege un celular perdido es el bloqueo de pantalla de
   Android. Y lo que de verdad limita lo que alguien puede ver es lo
   que se le manda a ese celular: sin archivo no hay datos. */


/* ══════════════════════════════════════════════════════════════════
   PERFILES
   ══════════════════════════════════════════════════════════════════
   Un solo lugar donde se declara qué ve y qué puede hacer cada quien.
   Agregar a alguien es una línea en USUARIOS; cambiar lo que ve un
   perfil es una línea acá. Los reportes que vengan después se cuelgan
   de esta misma tabla.

   pantallas   → las pestañas que aparecen, en ese orden.
   inicio      → en cuál abre la app al ingresar.
   inventario  → 'lotes'  ve etiqueta por etiqueta y puede contar
                 'total'  ve solo el total por producto
                 null     no ve el cuarto frío
   soloLectura → true: no se pinta ningún campo editable y además se
                 bloquea el guardado. Dos candados, no uno.
   verComo     → otros perfiles que puede previsualizar sin salirse.  */

export const PERFILES = {
  analista: {
    etiqueta: 'Analista',
    pantallas: ['vender', 'ruta', 'dia', 'carga', 'inventario', 'ajustes'],
    inicio: 'vender',
    inventario: 'lotes',
    soloLectura: false,
    verComo: ['administrativo'],
  },
  administrativo: {
    etiqueta: 'Administrativo',
    pantallas: ['inventario', 'ajustes'],
    inicio: 'inventario',
    inventario: 'total',
    soloLectura: true,
    verComo: [],
  },
  vendedor: {
    etiqueta: 'Vendedor',
    pantallas: ['vender', 'ruta', 'dia', 'carga', 'ajustes'],
    inicio: 'vender',
    inventario: null,
    soloLectura: false,
    verComo: [],
  },
};

export const PERFIL_POR_DEFECTO = 'vendedor';


/* ══════════════════════════════════════════════════════════════════
   USUARIOS
   ══════════════════════════════════════════════════════════════════
   Un renglón por persona. Si no trae `perfil`, se asume 'vendedor':
   así nadie termina viendo de más por un olvido.

   El código de ingreso de este ejemplo es: cerinza2026                */

export const USUARIOS = [
  {
    usuario: 'alvaro',
    nombre: 'Alvaro',
    dispositivo: 'M1',
    perfil: 'vendedor',
    hash: 'c7581b3021aada5f32fa1b97c06ae97920d86ddfd1d9449a3721a595a34477ef'
  },
  {
    usuario: 'paula',
    nombre: 'paula',
    dispositivo: 'M2',
    perfil: 'vendedor',
    hash: 'b2f5717460f9e32d7938944fa7b3f518aa0c448f0f55603d249f72ff7cb81c20'
  },
  {
    usuario: 'diana',
    nombre: 'diana',
    dispositivo: 'M3',
    perfil: 'vendedor',
    hash: '594548d8744549dd581dcea4ae0a30434eead72e07d4adc48ad885a6127cbfc1'
  },
  {
    usuario: 'pedro',
    nombre: 'pedro',
    dispositivo: 'M4',
    perfil: 'vendedor',
    hash: '0a7a5e5e0b6b44e64095ebd9c66f03cc0ea0fcc3c17fe003f64d8aed84003a38'
  },
  {
    usuario: 'daniel',
    nombre: 'daniel',
    dispositivo: 'M5',
    perfil: 'analista',
    hash: 'c6055aa50767472d3c2c47bcd88f9041ec84ae5a03f1a5054943862e046b3be0'
  },
];


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

/** ¿Este perfil ve esta pantalla? */
export const veLa = (perfil, pantalla) => reglasDe(perfil).pantallas.includes(pantalla);
