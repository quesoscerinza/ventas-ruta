/* Vendedores de la app — Quesos Cerinza

   Cada vendedor queda amarrado a su celular (M1, M2, M3). Al ingresar,
   la app se configura sola con ese número y con su nombre, así nadie
   tiene que escribirlos a mano ni puede equivocarse.

   La clave NO se guarda aquí en texto: se guarda su huella SHA-256.
   Para agregar o cambiar un vendedor, corra en el PC:

       python generar_usuario.py

   y pegue abajo la línea que le imprima.

   OJO con lo que esto es y lo que no es: sirve para saber quién hizo
   cada venta y para que el celular se configure solo. NO protege los
   datos: todo corre dentro del celular y el código es público. Lo que
   de verdad protege un celular perdido es el bloqueo de pantalla de
   Android. */

export const USUARIOS = [
  // Ejemplo — reemplácelo por los vendedores reales.
  // La clave de este ejemplo es: cerinza2026
  {
    usuario: 'demo',
    nombre: 'Vendedor de prueba',
    dispositivo: 'M1',
    hash: '4441022d136dbf6500209580122568d0704f1f0742720f5c18aa5a4778a4c191'
  },
];

/** Huella de la clave. Se le mezcla el usuario para que dos vendedores
    con la misma clave no tengan la misma huella. */
export async function huella(usuario, clave) {
  const texto = `${String(usuario).trim().toLowerCase()}:${clave}`;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Devuelve el vendedor si la clave coincide, o null. */
export async function verificar(usuario, clave) {
  const u = String(usuario || '').trim().toLowerCase();
  const encontrado = USUARIOS.find(x => x.usuario.toLowerCase() === u);
  if (!encontrado) return null;
  const h = await huella(u, clave);
  // Comparación de largo constante: no revela por dónde falló
  if (h.length !== encontrado.hash.length) return null;
  let dif = 0;
  for (let i = 0; i < h.length; i++) dif |= h.charCodeAt(i) ^ encontrado.hash.charCodeAt(i);
  return dif === 0 ? encontrado : null;
}

export const hayUsuarios = () => USUARIOS.length > 0;
