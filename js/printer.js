/* Bluetooth BLE con la PT-210 — servicio 18F0, característica 2AF1 */

const SERVICIO = 0x18f0;
const CARACTERISTICA = 0x2af1;
const TROZO = 180;   // el MTU del BLE es chico: hay que partir el envío
const PAUSA = 25;    // ms entre trozos, si no se atora el buffer

let caracteristica = null;
let dispositivo = null;
const oyentes = new Set();

export const alCambiar = fn => { oyentes.add(fn); fn(estado()); };
const avisar = () => oyentes.forEach(fn => fn(estado()));

export function estado() {
  return {
    conectada: !!caracteristica,
    nombre: dispositivo?.name || '',
    soportado: !!navigator.bluetooth,
    seguro: window.isSecureContext
  };
}

export async function conectar() {
  if (!navigator.bluetooth)
    throw new Error('Este navegador no tiene Bluetooth web. Use Chrome en Android.');
  if (!window.isSecureContext)
    throw new Error('La página debe abrirse con https:// para poder usar Bluetooth.');

  dispositivo = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERVICIO]
  });
  dispositivo.addEventListener('gattserverdisconnected', () => {
    caracteristica = null;
    avisar();
  });
  const servidor = await dispositivo.gatt.connect();
  const servicio = await servidor.getPrimaryService(SERVICIO);
  caracteristica = await servicio.getCharacteristic(CARACTERISTICA);
  avisar();
  return dispositivo.name || 'PT-210';
}

/* Si el celular ya conoce la impresora, reconecta sin volver a mostrar el selector */
export async function reconectar() {
  if (caracteristica) return true;
  if (!dispositivo?.gatt) return false;
  try {
    const servidor = await dispositivo.gatt.connect();
    const servicio = await servidor.getPrimaryService(SERVICIO);
    caracteristica = await servicio.getCharacteristic(CARACTERISTICA);
    avisar();
    return true;
  } catch { return false; }
}

export function desconectar() {
  try { dispositivo?.gatt?.disconnect(); } catch { }
  caracteristica = null;
  avisar();
}

export async function imprimir(bytes) {
  if (!caracteristica && !(await reconectar()))
    throw new Error('No hay impresora conectada.');
  for (let i = 0; i < bytes.length; i += TROZO) {
    await caracteristica.writeValueWithoutResponse(bytes.slice(i, i + TROZO));
    await new Promise(r => setTimeout(r, PAUSA));
  }
}
