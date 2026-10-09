/* Diseño del ticket a 32 columnas — Ventas en Ruta / Quesos Cerinza
   Sigue la misma estructura del ticket de la app de escritorio
   (ticket_print.py): título, doble línea, bloque del cliente con el
   nombre en negrita, ítems en dos renglones y el total destacado.
   Sin datos de la empresa: en la calle el cliente ya sabe de quién
   está comprando, y el papel de 58 mm no sobra. */
import { Ticket, COLUMNAS } from './escpos.js';
import { alinear, envolver, pesos, fechaCorta } from './util.js';
import { valorLinea } from './db.js';

const PAGOS = {
  efectivo: 'EFECTIVO', pendiente: 'PENDIENTE DE PAGO',
  consignacion: 'CONSIGNACION', mixto: 'MIXTO',
};

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

/* ══════════════════════════════════════════════════════════════════
   EXISTENCIAS — LISTA DE LA SRA. ISA
   ══════════════════════════════════════════════════════════════════
   El papelito que se le entrega después de hacer el inventario físico:
   solo los productos de su lista, con lo que hay y para cuántos días
   alcanza.

   Dos cosas que el ticket dice en voz alta, porque callarlas sería
   peor que no imprimirlo:

   · Un renglón CONTADO vale distinto a uno que sale del sistema. Lo que
     todavía no se ha contado va marcado con * — es un dato sin
     verificar, y quien decida producir tiene derecho a saberlo.
   · Si un producto de la lista no está en el archivo de inQC (porque lo
     renombraron o lo desactivaron), sale nombrado al final. Un reporte
     al que le falta un renglón en silencio es una trampa.             */

export function existencias(reporte, cfg) {
  const t = new Ticket(cfg.codepage);
  t.izquierda();

  t.negrita(true);
  t.linea(centrar(reporte.titulo));
  t.negrita(false);
  if (reporte.subtitulo) t.linea(centrar(reporte.subtitulo));
  t.separador('=');

  t.linea('Inventario del ' + fechaCorta(reporte.fecha));
  if (cfg.vendedor) t.linea('Contado por: ' + cfg.vendedor);
  t.linea('Impreso: ' + reporte.impreso);
  t.separador('-');

  // Las dos columnas numéricas se arman SIEMPRE con esta función, el
  // encabezado incluido: con campos de ancho fijo no se pueden correr
  // uno respecto del otro. La marca va en su propia casilla para que el
  // asterisco no empuje los dígitos y los números queden en columna.
  const cifras = (hay, marca, dias) =>
    (hay.padStart(7) + marca + dias.padStart(7)).padStart(COLUMNAS);

  // El nombre va en su propio renglón: a 32 columnas no cabe al lado.
  t.linea('PRODUCTO' + cifras('HAY', ' ', 'DIAS').slice(8));
  t.separador('-');

  for (const f of reporte.filas) {
    for (const l of envolver(f.nombre, COLUMNAS)) t.linea(l);
    t.linea(cifras(num(f.existencia),
                   f.verificado ? ' ' : '*',
                   f.dias === null ? '-' : num(f.dias)));
  }

  t.separador('-');

  // El renglón que de verdad busca: cuánto de esto ya está contado.
  t.linea(alinear('Productos', `${reporte.filas.length}`, COLUMNAS));
  t.linea(alinear('Verificados', `${reporte.verificados} de ${reporte.filas.length}`,
                  COLUMNAS));

  if (reporte.verificados < reporte.filas.length) {
    t.linea('');
    for (const l of envolver(
      '* El numero con asterisco NO se ha contado: es lo que dice el '
      + 'sistema. Falta verificarlo en el cuarto frio.', COLUMNAS)) t.linea(l);
  }

  if (reporte.faltantes.length) {
    t.separador('-');
    t.negrita(true);
    t.linea('NO ESTAN EN EL INVENTARIO');
    t.negrita(false);
    for (const n of reporte.faltantes) {
      for (const l of envolver('- ' + n, COLUMNAS)) t.linea(l);
    }
    for (const l of envolver(
      'Revise si los renombraron o los desactivaron en inQC.',
      COLUMNAS)) t.linea(l);
  }

  t.separador('=');
  for (const l of envolver(
    'DIAS = para cuantos dias alcanza lo que hay, segun lo que se vende '
    + 'en un dia normal.', COLUMNAS)) t.linea(l);
  t.avanzar(4);
  return t.bytes();
}


/* ══════════════════════════════════════════════════════════════════
   REMISIÓN DE LA RUTA
   ══════════════════════════════════════════════════════════════════
   El pedido que viene del PC, impreso con la misma estructura que
   ticket_print.py: REMISION + número arriba, cliente en negrita,
   pueblo, celular, dirección, día y fecha, los ítems con su precio y
   el TOTAL destacado.

   No sale idéntico carácter por carácter, y no puede: el PC imprime a
   42 columnas en papel de 80 mm y esta es de 58 mm, que son 32. Lo que
   se conserva es el orden y la jerarquía, para que se reconozca como la
   misma remisión.

   La diferencia de fondo con remision(): acá se imprime lo que DE
   VERDAD se entregó. Si el cliente recibió menos, las líneas devueltas
   salen listadas y el TOTAL es el neto a cobrar — que es el mismo que
   va a quedar en cartera. El papel que firma el cliente y la cuenta que
   se le cobra tienen que decir lo mismo.                              */

export function remisionRuta(pedido, cuentas, cliente, cfg) {
  const t = new Ticket(cfg.codepage);
  t.izquierda();

  t.linea(centrar('REMISION ' + (pedido.numero_remision || '')));
  t.separador('=');

  t.negrita(true);
  for (const l of envolver('Cliente: ' + (cliente.nombre || ''), COLUMNAS)) t.linea(l);
  t.negrita(false);

  if (cliente.pueblo) t.linea('Pueblo: ' + cliente.pueblo);
  const cel = [cliente.telefono, cliente.telefono2].filter(Boolean).join(' / ');
  if (cel) t.linea('Cel: ' + cel);
  if (cliente.direccion) {
    for (const l of envolver('Dir: ' + cliente.direccion, COLUMNAS)) t.linea(l);
  }
  t.linea([cliente.dia_ruta, fechaCorta(pedido.fecha)].filter(Boolean).join(' - '));
  t.separador('-');

  if (pedido.estado === 'no_entregado') {
    t.linea('');
    t.negrita(true);
    t.linea(centrar('NO ENTREGADA'));
    t.negrita(false);
    if (pedido.nota) for (const l of envolver(pedido.nota, COLUMNAS)) t.linea(l);
    t.linea('');
    t.separador('=');
    t.avanzar(4);
    return t.bytes();
  }

  // --- Lo entregado ---
  for (const l of pedido.lineas) {
    const cant = Number(l.entregado) || 0;
    if (cant <= 0 && !l.cambios) continue;
    for (const x of envolver(l.nombre, COLUMNAS)) t.linea(x);

    let detalle = '  ' + num(cant);
    if (l.cambios) detalle += ` (+${num(l.cambios)} cambio)`;

    if (l.obsequio) {
      t.linea(detalle + '  OBSEQUIO');
    } else if (l.por_peso && !l.peso_kg) {
      t.linea(detalle + '  ** PENDIENTE POR PESAR **');
    } else if (l.por_peso) {
      t.linea(`  ${num(l.peso_kg)} kg x ${pesos(l.precio)}/kg`);
      t.linea(alinear(detalle, pesos(valorLinea(l)), COLUMNAS));
    } else {
      t.linea(alinear(`${detalle} x ${pesos(l.precio)}`,
                      pesos(valorLinea(l)), COLUMNAS));
    }
  }

  // --- Lo que no se entregó, si lo hubo ---
  if (cuentas.devueltos.length) {
    t.separador('-');
    t.linea('NO ENTREGADO');
    for (const d of cuentas.devueltos) {
      for (const x of envolver(d.nombre, COLUMNAS)) t.linea(x);
      t.linea(alinear('  ' + num(d.cantidad), '-' + pesos(d.monto), COLUMNAS));
    }
  }

  t.separador('-');
  t.linea('');
  t.negrita(true).grande(true);
  t.linea(('TOTAL: $' + pesos(cuentas.neto)).padStart(COLUMNAS / 2));
  t.grande(false).negrita(false);
  t.linea('');

  // El mismo aviso que pone el PC. Sin él, alguien puede cobrar este
  // total creyendo que está completo cuando falta pesar un bloque.
  if (cuentas.pendientes) {
    for (const l of envolver(
      '** OJO: este total NO incluye los productos pendientes por pesar. '
      + 'No cobrar aun, falta el peso real. **', COLUMNAS)) t.linea(l);
  }

  if (cuentas.bruto !== cuentas.neto) {
    t.linea(alinear('Decia el pedido', '$' + pesos(cuentas.bruto), COLUMNAS));
  }

  if (pedido.pago === 'mixto') {
    const efe = Number(pedido.monto_efectivo) || 0;
    const con = Number(pedido.monto_consignado) || 0;
    const falta = Math.max(0, cuentas.neto - efe - con);
    t.linea('Pago:');
    if (efe) t.linea(alinear('  Efectivo', '$' + pesos(efe), COLUMNAS));
    if (con) t.linea(alinear('  Consignacion', '$' + pesos(con), COLUMNAS));
    if (falta) {
      t.negrita(true);
      t.linea(alinear('  QUEDA DEBIENDO', '$' + pesos(falta), COLUMNAS));
      t.negrita(false);
    }
  } else {
    t.linea('Pago: ' + (PAGOS[pedido.pago] || pedido.pago));
  }
  // Dos notas distintas: la del pedido viene del PC (una instrucción
  // para la entrega) y la del vendedor es lo que pasó en la calle.
  if (cliente.observaciones) {
    for (const l of envolver('Obs: ' + cliente.observaciones, COLUMNAS)) t.linea(l);
  }
  if (pedido.nota) for (const l of envolver('Nota: ' + pedido.nota, COLUMNAS)) t.linea(l);

  t.separador('=');
  t.linea(centrar('Gracias por su compra'));
  t.avanzar(4);
  return t.bytes();
}
