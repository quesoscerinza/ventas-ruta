"""
generar_semilla.py — Quesos Cerinza
Genera el archivo que se le pasa a los celulares de la ruta.

Se corre desde la MISMA carpeta de la app de Remisiones (donde está database.py
y remisiones.db), con la app cerrada o abierta, da igual: solo lee.

    python generar_semilla.py

Deja un archivo semilla_AAAA-MM-DD.json listo para mandar por WhatsApp
a los celulares. En el celular: Ajustes -> Cargar archivo generado en el PC.

Cuando esté probado, esto mismo se mete como botón en la pestaña
Configuración de la app Streamlit.
"""

import json
import sqlite3
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent / "remisiones.db"
SALIDA = Path(__file__).resolve().parent / f"semilla_{date.today().isoformat()}.json"


def filas(con, sql):
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql).fetchall()]
    except sqlite3.Error as e:
        print(f"  aviso: {e}")
        return []


def primera_clave(fila, *candidatas, por_defecto=None):
    """Los nombres de columna cambian entre versiones: probamos varias."""
    for c in candidatas:
        if c in fila and fila[c] not in (None, ""):
            return fila[c]
    return por_defecto


def main():
    if not BASE.exists():
        raise SystemExit(f"No encuentro la base en {BASE}")

    con = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)

    # --- Productos ---
    crudos = filas(con, "SELECT * FROM productos ORDER BY orden, id")
    if not crudos:
        crudos = filas(con, "SELECT * FROM productos")

    productos = []
    for p in crudos:
        if primera_clave(p, "activo", por_defecto=1) in (0, "0", False):
            continue
        productos.append({
            "codigo": primera_clave(p, "codigo_producto", "codigo", por_defecto=""),
            "nombre": primera_clave(p, "nombre", "descripcion", por_defecto=""),
            "precio": float(primera_clave(p, "precio_base", "precio", por_defecto=0) or 0),
            "se_pesa": bool(primera_clave(p, "precio_por_peso", por_defecto=0)),
            "destacado": bool(primera_clave(p, "destacado", por_defecto=0)),
        })
    productos = [p for p in productos if p["nombre"]]

    # --- Clientes: solo el nombre. En la calle únicamente sirve para
    #     avisarle al vendedor que ese cliente ya existe. ---
    cli = filas(con, "SELECT nombre FROM clientes ORDER BY nombre")
    clientes = sorted({(c.get("nombre") or "").strip() for c in cli} - {""})

    # --- Pueblos y rutas ---
    pueblos = sorted({
        (m.get("nombre") or "").strip()
        for m in filas(con, "SELECT nombre FROM municipios")
    } - {""})

    dias = [d.get("nombre") or d.get("dia") for d in filas(con, "SELECT * FROM dias_ruta ORDER BY id")]
    dias = [d for d in dias if d]

    con.close()

    semilla = {
        "formato": "cerinza-seed-v1",
        "generado": date.today().isoformat(),
        "productos": productos,
        "clientes": clientes,
        "pueblos": pueblos,
        "dias_ruta": dias,
    }

    SALIDA.write_text(json.dumps(semilla, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Listo: {SALIDA.name}")
    print(f"  {len(productos)} productos")
    print(f"  {len(clientes)} clientes")
    print(f"  {len(pueblos)} pueblos, {len(dias)} rutas")
    print(f"  {SALIDA.stat().st_size / 1024:.0f} KB — mándelo por WhatsApp a los celulares")


if __name__ == "__main__":
    main()
