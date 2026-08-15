# Ventas en Ruta — Quesos Cerinza

App del celular para que los vendedores de ruta le vendan a clientes nuevos,
impriman la remisión en la PT-210 y manden todo al PC al final del día.

Funciona sin señal. Solo necesita internet para abrirse la primera vez
y para mandar el cierre por WhatsApp.

---

## 1. Subirla a GitHub Pages

Web Bluetooth exige `https://`. Un archivo abierto directo en el celular no sirve.

1. Cree un repositorio nuevo, por ejemplo `ventas-ruta`.
2. Suba **todo el contenido de esta carpeta** a la raíz del repositorio
   (`index.html` tiene que quedar arriba, no dentro de otra carpeta).
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
4. A los dos minutos queda en `https://SU-USUARIO.github.io/ventas-ruta/`.

Para actualizar después: sube los archivos nuevos y listo. Los celulares
recogen la versión nueva la próxima vez que abran con señal.

## 2. Instalarla en el celular

Abrir esa dirección en **Chrome de Android** → menú de los tres puntos →
*Instalar aplicación* / *Agregar a pantalla de inicio*. Queda con ícono propio.

> En iPhone no funciona: Safari no tiene Web Bluetooth. Tiene que ser Android.

## 3. Configurar cada celular (una sola vez)

En **Ajustes**:

- **Número del celular**: `M1` en el primero, `M2` en el segundo, `M3` en el tercero.
  Esto es lo que evita que dos vendedores generen la misma remisión.
  La numeración queda `M1-001`, `M1-002`… y nunca choca con las `L1001`
  del PC.
- **Nombre del vendedor**, NIT, teléfono y ubicación de la empresa.
- **Cargar archivo generado en el PC**: el `semilla_*.json` con productos y
  clientes. Sin esto la app no tiene qué vender.
  Para probar de una, use el `semilla_ejemplo.json` que viene aquí.

## 4. Generar la semilla desde el PC

Copie `pc/generar_semilla.py` a la carpeta de la app de Remisiones
(donde está `remisiones.db`) y corra:

```
python generar_semilla.py
```

Deja un `semilla_AAAA-MM-DD.json` que se manda por WhatsApp a los celulares.
Cuando esté probado lo pasamos a un botón dentro de la pestaña Configuración.

## 5. El día del vendedor

1. **Carga** — anota cuánto producto adicional lleva.
2. **Vender** — nombre del cliente (avisa si ya existe uno parecido),
   productos, forma de pago, *Guardar e imprimir*.
3. **Hoy** — ve sus ventas, el total, y el cuadre de lo que le sobra.
4. **Cerrar y enviar al PC** — sale el selector de WhatsApp con el archivo
   `cierre_M1_AAAA-MM-DD.json` adjunto.

---

## Detalles que importan

**Numeración.** Cada celular lleva su propio consecutivo. Si se reinstala la
app en un celular hay que volver a poner el consecutivo donde iba, o va a
repetir números.

**Duplicados de clientes.** Compara contra los clientes del PC y contra los
capturados en la calle. Sobre 90% de parecido lo marca en rojo como ya
existente; entre 75% y 90% solo advierte. No bloquea la venta: en la calle
lo importante es vender, y el PC decide al importar.

**El código de producto no es único.** QC059 lo comparten los yogures, así
que la app cruza por código + nombre. El archivo de cierre manda los dos.

**Cuadre.** El cierre incluye qué se llevó, qué se vendió y qué sobra.
Es lo que le va a permitir a inQC descontar bien.

**Acentos.** La PT-210 puede necesitar una tabla de caracteres distinta.
En Ajustes hay tres opciones y un botón de prueba: imprima y quédese con la
que saque bien la ñ y las tildes. La opción *Sin acentos* siempre funciona.

## Falta (siguiente paso)

La pantalla del PC que lee el `cierre_*.json`: previo de lo que va a entrar,
clientes nuevos con sus posibles duplicados marcados, y confirmación.
Idempotente por el UUID de cada venta, así que reimportar el mismo archivo
no duplica nada.
