/* ESC/POS para PT-210 (58 mm, 384 puntos, 32 columnas en fuente A) */

export const COLUMNAS = 32;

/* Acentos: en CP437 y CP850 las minúsculas acentuadas coinciden */
const MAPA = {
  'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3,
  'ñ': 0xA4, 'Ñ': 0xA5, 'ü': 0x81, 'Ü': 0x9A,
  '¿': 0xA8, '¡': 0xAD, '°': 0xF8, 'º': 0xF8, 'ª': 0xA6
};
const PLANO = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
  'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
  'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U',
  '¿': '?', '¡': '!', '°': 'o', 'º': 'o', 'ª': 'a', '#': 'No.'
};

function bytesDeTexto(texto, codepage) {
  const salida = [];
  for (const ch of String(texto)) {
    const cod = ch.codePointAt(0);
    if (cod < 128) { salida.push(cod); continue; }
    if (codepage === '-1') {
      for (const c of (PLANO[ch] || '?')) salida.push(c.charCodeAt(0));
    } else if (codepage === '16') {
      salida.push(cod <= 0xFF ? cod : 0x3F);          // Windows-1252
    } else if (MAPA[ch] !== undefined) {
      salida.push(MAPA[ch]);
    } else {
      for (const c of (PLANO[ch] || '?')) salida.push(c.charCodeAt(0));
    }
  }
  return salida;
}

export class Ticket {
  constructor(codepage = '0') {
    this.cp = String(codepage);
    this.b = [];
    this.crudo(0x1B, 0x40);                                       // ESC @ — reiniciar
    if (this.cp !== '-1') this.crudo(0x1B, 0x74, parseInt(this.cp, 10)); // ESC t — tabla
    this.crudo(0x1B, 0x4D, 0);                                    // ESC M — fuente A
  }
  crudo(...b) { this.b.push(...b); return this; }
  centrar() { return this.crudo(0x1B, 0x61, 1); }
  izquierda() { return this.crudo(0x1B, 0x61, 0); }
  grande(on) { return this.crudo(0x1D, 0x21, on ? 0x11 : 0x00); } // doble alto y ancho
  alto(on) { return this.crudo(0x1D, 0x21, on ? 0x01 : 0x00); }   // solo doble alto
  negrita(on) { return this.crudo(0x1B, 0x45, on ? 1 : 0); }
  linea(txt = '') { this.b.push(...bytesDeTexto(txt, this.cp), 0x0A); return this; }
  separador(ch = '-') { return this.linea(ch.repeat(COLUMNAS)); }
  avanzar(n = 4) { return this.crudo(0x1B, 0x64, n); }
  bytes() { return new Uint8Array(this.b); }
}
