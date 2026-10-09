/* LISTA DE EXISTENCIAS PARA LA SRA. ISA
   ══════════════════════════════════════════════════════════════════

   Los productos que ella revisa, y cuánto se vende de cada uno en un
   día normal. Es el único archivo que hay que tocar para cambiar ese
   reporte: agregar un producto, sacarlo, o corregir un promedio.

   NOMBRE: tiene que ser el mismo que usa inQC. No tiene que coincidir
   letra por letra en mayúsculas, tildes ni puntos —al comparar se
   ignoran— pero sí en las palabras. Si un nombre no aparece en el
   inventario que mandó inQC, el reporte lo dice al final en vez de
   callárselo: así un producto renombrado se nota de una, y no se
   descubre por la ausencia de un renglón.

   PROMEDIO_DIA: lo que sale en un día normal. Sirve para la columna
   DIAS del reporte (existencia ÷ promedio = para cuántos días
   alcanza). Si se deja en 0, ese renglón sale sin días, sin estorbar
   a los demás.

   Cuando cambie este archivo, suba 1 a VERSION en sw.js — si no, los
   celulares siguen con la lista vieja.                                */

export const TITULO = 'EXISTENCIAS CF2';
export const SUBTITULO = 'Lista Sra. ISA';

export const PRODUCTOS = [
  { nombre: 'CUARTO D.C. U/D VACIO',           promedio_dia: 24 },
  { nombre: 'CUARTOS D.C. x 6 U/D VINIPEL',    promedio_dia: 16 },
  { nombre: 'DOBLECREMA 225g VINIPEL',         promedio_dia: 86 },
  { nombre: 'DOBLECREMA 450g VINIPEL',         promedio_dia: 239 },
  { nombre: 'DOBLECREMA. PLATO 450g VINIPEL',  promedio_dia: 58 },
  { nombre: 'LONCHERO x 12 U/D VINIPEL',       promedio_dia: 2 },
  { nombre: 'MANTEQUILLA 250g',                promedio_dia: 16 },
  { nombre: 'MANTEQUILLA 500g',                promedio_dia: 91 },
  { nombre: 'MEDIOBLOQUE D.C. 1.250g',         promedio_dia: 20 },
  { nombre: 'PERA 100g',                       promedio_dia: 10 },
  { nombre: 'QUESADILLO U/D VACIO',            promedio_dia: 66 },
  { nombre: 'QUESADILLO x 12 U/D VINIPEL',     promedio_dia: 9 },
];
