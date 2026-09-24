/* LA GENTE — Quesos Cerinza
   ══════════════════════════════════════════════════════════════════

   ESTE ARCHIVO ES SUYO. No lo reemplace por uno que le manden: es el
   único que contiene los usuarios reales de la empresa y sus códigos.

   Vive aparte de usuarios.js justamente por eso. usuarios.js tiene la
   maquinaria —perfiles, grupos, la cuenta del hash— y se actualiza cada
   vez que la app cambia. Esta lista no cambia con la app, solo cuando
   entra o sale alguien. Teniéndolos separados, una actualización nunca
   puede llevarse por delante a la gente.

   Para agregar o cambiar a alguien, corra en el PC:

       python generar_usuario.py

   y pegue acá abajo la línea que le imprima. Requiere autorización de
   gerencia (formato FO-APP-01).

   Cuando alguien se retira, borre su renglón el mismo día y suba el
   cambio.

   El código NO se guarda en texto: se guarda su huella SHA-256, y de
   una huella no se saca el código de vuelta. Si alguien lo olvida, se
   le genera uno nuevo.

   Perfiles disponibles: 'analista', 'administrativo', 'vendedor'.
   Si no se pone perfil, se asume 'vendedor', que es el más limitado.  */

export const USUARIOS = [
  // ── Reemplace estos renglones por los de su empresa ──────────────
  // El código de ingreso de este ejemplo es: cerinza2026
  { usuario: 'ejemplo', nombre: 'Ejemplo', dispositivo: 'M0', perfil: 'vendedor',
    hash: '7e2f4b0d6c1a8e3f5b9d2c4a6e8f0b1d3c5a7e9f2b4d6c8a0e2f4b6d8c0a2e4f' },
];
