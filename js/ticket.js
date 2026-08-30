/* Diseño del ticket a 32 columnas — Ventas en Ruta / Quesos Cerinza
   Sigue la misma estructura del ticket de la app de escritorio
   (ticket_print.py): título, doble línea, bloque del cliente con el
   nombre en negrita, ítems en dos renglones y el total destacado.
   Sin datos de la empresa: en la calle el cliente ya sabe de quién
   está comprando, y el papel de 58 mm no sobra. */
import { Ticket, COLUMNAS } from './escpos.js';
import { alinear, envolver, pesos, fechaCorta } from './util.js';

const PAGOS = { efectivo: 'EFECTIVO', pendiente: 'PENDIENTE DE PAGO', consignacion: 'CONSIGNACION' };

/* Cantidades sin decimales de sobra: 3 en vez de 3.0, pero 2.5 se respeta */
const num = v => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : String(n);
};

const centrar = txt => {
  const sobra = COLUMNAS - txt.length;
  return sobra > 0 ? ' '.repeat(Math.floor(sobra / 2)) + txt : txt;
};

export function remision(venta, cfg) {
  const t = new Ticket(cfg.codepage);

  // --- Encabezado: solo el título y el número ---
  t.izquierda();
  t.linea(centrar('REMISION ' + venta.numero));
  t.separador('=');

  // --- Cliente ---
  t.negrita(true);
  for (const l of envolver('Cliente: ' + venta.cliente_nombre, COLUMNAS)) t.linea(l);
  t.negrita(false);

  if (venta.cliente_pueblo) t.linea('Pueblo: ' + venta.cliente_pueblo);
  if (venta.cliente_tel) t.linea('Cel: ' + venta.cliente_tel);
  if (venta.cliente_doc) t.linea('CC/NIT: ' + venta.cliente_doc);
  if (venta.cliente_dir) {
    for (const l of envolver('Dir: ' + venta.cliente_dir, COLUMNAS)) t.linea(l);
  }
  t.linea(fechaCorta(venta.fecha) + (venta.hora ? ' - ' + venta.hora : ''));
  if (cfg.vendedor) t.linea('Vendedor: ' + cfg.vendedor);
  t.separador('-');

  // --- Productos: nombre arriba, cantidad y valor abajo ---
  t.linea(alinear('PRODUCTOS', 'PRECIO', COLUMNAS));
  t.separador('-');
  for (const it of venta.items) {
    for (const l of envolver(it.nombre, COLUMNAS)) t.linea(l);
    t.linea(alinear(`  ${num(it.cant)} x ${pesos(it.precio)}`, pesos(it.subtotal), COLUMNAS));
  }

  // --- Total: doble tamaño, así que la línea cuenta como 16 columnas.
  //     Va aislado entre renglones en blanco: es el número que la gente
  //     busca primero y tiene que encontrarse solo. ---
  t.separador('-');
  t.linea('');
  t.negrita(true).grande(true);
  t.linea(('TOTAL: $' + pesos(venta.total)).padStart(COLUMNAS / 2));
  t.grande(false).negrita(false);
  t.linea('');

  // --- Cierre ---
  t.linea('Pago: ' + (PAGOS[venta.pago] || venta.pago));
  if (venta.nota) {
    for (const l of envolver('Nota: ' + venta.nota, COLUMNAS)) t.linea(l);
  }
  t.separador('=');
  t.linea(centrar('Gracias por su compra'));

  // Espacio para rasgar sin cortar el ticket siguiente
  t.avanzar(4);
  return t.bytes();
}

/* Tira de control que el vendedor imprime al cerrar el día */
export function cierre(resumen, cfg) {
  const t = new Ticket(cfg.codepage);
  t.izquierda();
  t.linea(centrar('CIERRE DEL DIA'));
  t.separador('=');
  t.linea(alinear('Fecha', fechaCorta(resumen.fecha), COLUMNAS));
  t.linea(alinear('Vendedor', cfg.vendedor || cfg.dispositivo, COLUMNAS));
  t.separador('-');
  t.linea(alinear('Ventas', String(resumen.num_ventas), COLUMNAS));
  t.linea(alinear('Clientes nuevos', String(resumen.clientes_nuevos), COLUMNAS));
  t.linea(alinear('Efectivo', '$' + pesos(resumen.efectivo), COLUMNAS));
  t.linea(alinear('Pendiente', '$' + pesos(resumen.pendiente), COLUMNAS));
  t.separador('-');
  t.linea('');
  t.negrita(true).grande(true);
  t.linea(('TOTAL: $' + pesos(resumen.total)).padStart(COLUMNAS / 2));
  t.grande(false).negrita(false);
  t.linea('');
  t.separador('-');
  t.linea('CUADRE DE PRODUCTO');
  t.linea(alinear('Producto', 'Sobra', COLUMNAS));
  for (const f of resumen.cuadre) {
    const nom = f.nombre.length > 24 ? f.nombre.slice(0, 24) : f.nombre;
    t.linea(alinear(nom, String(f.sobrante), COLUMNAS));
  }
  t.separador('=');
  t.linea('Firma: ______________________');
  t.avanzar(4);
  return t.bytes();
}
