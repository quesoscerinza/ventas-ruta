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
    usuario: 'alvaro',
    nombre: 'Alvaro',
    dispositivo: 'M1',
    hash: 'c7581b3021aada5f32fa1b97c06ae97920d86ddfd1d9449a3721a595a34477ef'
  },
   {
    usuario: 'paula',
    nombre: 'paula',
    dispositivo: 'M2',
    hash: 'b2f5717460f9e32d7938944fa7b3f518aa0c448f0f55603d249f72ff7cb81c20'
  },
   {
    usuario: 'diana',
    nombre: 'diana',
    dispositivo: 'M3',
    hash: '594548d8744549dd581dcea4ae0a30434eead72e07d4adc48ad885a6127cbfc1'
  },
    {
    usuario: 'pedro',
    nombre: 'pedro',
    dispositivo: 'M4',
    hash: '0a7a5e5e0b6b44e64095ebd9c66f03cc0ea0fcc3c17fe003f64d8aed84003a38'
  },
   {
    usuario: 'daniel',
    nombre: 'daniel',
    dispositivo: 'M5',
    hash: 'c6055aa50767472d3c2c47bcd88f9041ec84ae5a03f1a5054943862e046b3be0'
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
