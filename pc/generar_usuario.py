#!/usr/bin/env python3
"""
generar_usuario.py — Quesos Cerinza, app móvil

Genera el renglón que va en js/usuarios.js para una persona nueva, o para
cambiarle el código a alguien que ya está.

    python generar_usuario.py

Pide el nombre, el celular, el perfil y el código, e imprime el renglón
listo para pegar. El código NO queda escrito en ninguna parte: lo que se
guarda es su huella SHA-256, y de una huella no se saca el código de
vuelta. Por eso, si alguien lo olvida, no hay cómo recuperarlo — se le
genera uno nuevo y ya.

ANTES DE CREAR UN USUARIO hace falta la autorización de gerencia
(formato FO-APP-01, aprobado por la Sra. Ilma Johana Medina).

Cuando una persona se retira, se borra su renglón de js/usuarios.js el
mismo día y se sube el cambio.
"""

import hashlib
import secrets
import sys

PERFILES = {
    "1": ("analista", "Analista — ve todo: ventas, ruta y CF2 lote por lote"),
    "2": ("administrativo", "Administrativo — solo CF2 por total, sin editar"),
    "3": ("vendedor", "Vendedor — vender, ruta, hoy, carga y ajustes"),
}

LARGO_MINIMO = 6


def huella(usuario: str, codigo: str) -> str:
    """La misma cuenta que hace la app: SHA-256 de 'usuario:codigo'."""
    return hashlib.sha256(f"{usuario.strip().lower()}:{codigo}".encode()).hexdigest()


def preguntar(texto: str, obligatorio: bool = True) -> str:
    while True:
        v = input(texto).strip()
        if v or not obligatorio:
            return v
        print("  → No puede quedar vacío.")


def main() -> int:
    print()
    print("═" * 62)
    print("  Nuevo usuario de la app móvil — Quesos Cerinza")
    print("═" * 62)
    print("  Requiere autorización de gerencia (formato FO-APP-01).")
    print()

    usuario = preguntar("Usuario (una sola palabra, sin tildes): ").lower()
    if " " in usuario:
        print("\n⚠ El usuario va en una sola palabra. Vuelva a correr el script.")
        return 1

    nombre = preguntar("Nombre como debe salir en pantalla: ")
    dispositivo = preguntar("Celular asignado (M1, M2, M3…): ").upper()

    print("\nPerfil:")
    for k, (_, desc) in PERFILES.items():
        print(f"  {k}. {desc}")
    opcion = preguntar("Número del perfil: ")
    if opcion not in PERFILES:
        print("\n⚠ Ese perfil no existe. Vuelva a correr el script.")
        return 1
    perfil = PERFILES[opcion][0]

    print(f"\nCódigo de ingreso (mínimo {LARGO_MINIMO} caracteres).")
    print("Enter en blanco para que se genere uno de 8 dígitos.")
    codigo = preguntar("Código: ", obligatorio=False)
    if not codigo:
        # secrets, no random: random es predecible si se conoce la semilla.
        codigo = "".join(secrets.choice("0123456789") for _ in range(8))
        print(f"  → Código generado: {codigo}")
    elif len(codigo) < LARGO_MINIMO:
        print(f"\n⚠ Muy corto: mínimo {LARGO_MINIMO} caracteres.")
        return 1

    if codigo != codigo.strip():
        print("\n⚠ El código empieza o termina en espacio. Quítelo: en el celular "
              "sería imposible de notar.")
        return 1

    linea = (f"  {{ usuario: '{usuario}', nombre: '{nombre}', "
             f"dispositivo: '{dispositivo}', perfil: '{perfil}', "
             f"hash: '{huella(usuario, codigo)}' }},")

    print()
    print("═" * 62)
    print("  Pegue este renglón dentro de USUARIOS, en js/usuarios.js:")
    print("═" * 62)
    print()
    print(linea)
    print()
    print("═" * 62)
    print(f"  Código para entregarle a {nombre}: {codigo}")
    print("═" * 62)
    print()
    print("  · Entrégueselo en persona, no por WhatsApp.")
    print("  · Revise que ese código no lo tenga ya otra persona: si dos lo")
    print("    comparten, la app no deja entrar a ninguno de los dos.")
    print("  · Suba js/usuarios.js y sume 1 a VERSION en sw.js, o el celular")
    print("    seguirá usando la lista vieja.")
    print()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelado.")
        sys.exit(1)
