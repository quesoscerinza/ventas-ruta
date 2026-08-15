/* Diseño del ticket a 32 columnas — Ventas en Ruta / Quesos Cerinza */
import { Ticket, COLUMNAS } from './escpos.js';
import { alinear, envolver, pesos, fechaCorta } from './util.js';

const PAGOS = { efectivo: 'EFECTIVO', pendiente: 'PENDIENTE DE PAGO', consignacion: 'CONSIGNACION' };

export function remision(venta, cfg) {
  const t = new Ticket(cfg.codepage);

  t.centrar();
  t.grande(true).negrita(true).linea(cfg.empresa_nombre || 'QUESOS CERINZA').grande(false).negrita(false);
  if (cfg.empresa_nit) t.linea('NIT ' + cfg.empresa_nit);
  if (cfg.empresa_lugar) t.linea(cfg.empresa_lugar);
  if (cfg.empresa_tel) t.linea('Tel. ' + cfg.empresa_tel);
  t.linea('');
  t.negrita(true).linea('REMISION ' + venta.numero).negrita(false);
  t.linea('');

  t.izquierda().separador();
  t.linea(alinear(fechaCorta(venta.fecha), venta.hora || '', COLUMNAS));
  for (const l of envolver('CLIENTE: ' + venta.cliente_nombre, COLUMNAS)) t.linea(l);
  if (venta.cliente_doc) t.linea('CC/NIT: ' + venta.cliente_doc);
  if (venta.cliente_tel) t.linea('TEL: ' + venta.cliente_tel);
  if (venta.cliente_dir) for (const l of envolver('DIR: ' + venta.cliente_dir, COLUMNAS)) t.linea(l);
  if (venta.cliente_pueblo) t.linea('LUGAR: ' + venta.cliente_pueblo);
  t.linea('VENDEDOR: ' + (cfg.vendedor || cfg.dispositivo || ''));
  t.separador();

  for (const it of venta.items) {
    for (const l of envolver(it.nombre, COLUMNAS)) t.linea(l);
    t.linea(alinear(`  ${it.cant} x ${pesos(it.precio)}`, pesos(it.subtotal), COLUMNAS));
  }

  t.separador();
  t.negrita(true).alto(true);
  t.linea(alinear('TOTAL', '$' + pesos(venta.total), COLUMNAS / 2));
  t.alto(false).negrita(false);
  t.linea('');
  t.linea('Pago: ' + (PAGOS[venta.pago] || venta.pago));
  if (venta.nota) for (const l of envolver('Nota: ' + venta.nota, COLUMNAS)) t.linea(l);

  t.linea('');
  t.centrar();
  t.linea('Gracias por su compra');
  t.linea('Documento no tributario');
  t.izquierda();
  t.avanzar(4);
  return t.bytes();
}

/* Tira de control que el vendedor imprime al cerrar el día */
export function cierre(resumen, cfg) {
  const t = new Ticket(cfg.codepage);
  t.centrar().negrita(true).linea('CIERRE DEL DIA').negrita(false);
  t.linea(cfg.empresa_nombre || 'QUESOS CERINZA');
  t.izquierda().linea('');
  t.linea(alinear('Fecha', fechaCorta(resumen.fecha), COLUMNAS));
  t.linea(alinear('Vendedor', cfg.vendedor || cfg.dispositivo, COLUMNAS));
  t.separador();
  t.linea(alinear('Ventas', String(resumen.num_ventas), COLUMNAS));
  t.linea(alinear('Clientes nuevos', String(resumen.clientes_nuevos), COLUMNAS));
  t.separador();
  t.linea(alinear('Efectivo', '$' + pesos(resumen.efectivo), COLUMNAS));
  t.linea(alinear('Pendiente', '$' + pesos(resumen.pendiente), COLUMNAS));
  t.negrita(true).linea(alinear('TOTAL', '$' + pesos(resumen.total), COLUMNAS)).negrita(false);
  t.separador();
  t.linea('CUADRE DE PRODUCTO');
  t.linea(alinear('Producto', 'Sob.', COLUMNAS));
  for (const f of resumen.cuadre) {
    const nom = f.nombre.length > 24 ? f.nombre.slice(0, 24) : f.nombre;
    t.linea(alinear(nom, String(f.sobrante), COLUMNAS));
  }
  t.separador();
  t.linea('Firma: ______________________');
  t.avanzar(4);
  return t.bytes();
}
