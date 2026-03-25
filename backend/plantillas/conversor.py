"""
Conversor interactivo de documentos Word a plantillas docxtpl.
Flujo: analizar (extrae segmentos) → generar (aplica mapeo y produce plantilla).
"""
import re
import io
import json
from docx import Document
from docx.oxml.ns import qn
from copy import deepcopy


# ─── Análisis: extrae segmentos únicos de texto del documento ────────────────

def _runs_de_parrafo(parrafo):
    """Devuelve lista de (run_index, texto) para runs con texto real."""
    return [(i, r.text) for i, r in enumerate(parrafo.runs) if r.text.strip()]


def _segmentos_de_parrafo(parrafo, parrafo_idx, origen):
    """Extrae segmentos de texto de un párrafo con su ubicación."""
    segmentos = []
    texto_completo = "".join(r.text for r in parrafo.runs)
    if not texto_completo.strip():
        return segmentos

    # Dividir en tokens por espacios/puntuación para granularidad
    # Pero devolver el párrafo completo como un segmento editable
    segmentos.append({
        "id": f"{origen}-p{parrafo_idx}",
        "texto": texto_completo,
        "origen": origen,
        "parrafo_idx": parrafo_idx,
        "celda_idx": None,
        "fila_idx": None,
        "tabla_idx": None,
    })
    return segmentos


def analizar_documento(input_buffer):
    """
    Parsea el .docx y devuelve una lista de segmentos de texto con su ubicación.
    Cada segmento tiene: id, texto, origen (body/tabla), índices de posición.
    """
    doc = Document(input_buffer)
    segmentos = []

    # Párrafos del cuerpo
    for i, parrafo in enumerate(doc.paragraphs):
        segs = _segmentos_de_parrafo(parrafo, i, "body")
        segmentos.extend(segs)

    # Celdas de tablas
    for t_idx, tabla in enumerate(doc.tables):
        for f_idx, fila in enumerate(tabla.rows):
            for c_idx, celda in enumerate(fila.cells):
                for p_idx, parrafo in enumerate(celda.paragraphs):
                    texto_completo = "".join(r.text for r in parrafo.runs)
                    if not texto_completo.strip():
                        continue
                    segmentos.append({
                        "id": f"tabla{t_idx}-f{f_idx}-c{c_idx}-p{p_idx}",
                        "texto": texto_completo,
                        "origen": "tabla",
                        "parrafo_idx": p_idx,
                        "celda_idx": c_idx,
                        "fila_idx": f_idx,
                        "tabla_idx": t_idx,
                    })

    # Eliminar duplicados exactos de texto (mismo texto en múltiples lugares)
    # pero conservar todos para el mapeo correcto
    return segmentos


# ─── Generación: aplica el mapeo texto→variable al documento ─────────────────

def _reemplazar_en_run(run_text, mapeo):
    """
    Reemplaza ocurrencias de textos mapeados en el texto de un run.
    mapeo: {texto_original: nombre_variable}
    """
    resultado = run_text
    # Ordenar por longitud descendente para evitar reemplazos parciales
    for original, variable in sorted(mapeo.items(), key=lambda x: -len(x[0])):
        if original in resultado:
            resultado = resultado.replace(original, "{{" + variable + "}}")
    return resultado


def _procesar_parrafo_con_mapeo(parrafo, mapeo):
    """Aplica el mapeo a todos los runs de un párrafo."""
    for run in parrafo.runs:
        if run.text:
            run.text = _reemplazar_en_run(run.text, mapeo)


def generar_plantilla(input_buffer, mapeo):
    """
    Recibe el .docx original y un mapeo {texto_original: nombre_variable}.
    Devuelve un BytesIO con el .docx plantilla y la lista de variables usadas.
    """
    doc = Document(input_buffer)

    for parrafo in doc.paragraphs:
        _procesar_parrafo_con_mapeo(parrafo, mapeo)

    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                for parrafo in celda.paragraphs:
                    _procesar_parrafo_con_mapeo(parrafo, mapeo)

    # Recolectar variables insertadas
    patron_var = re.compile(r'\{\{(\w+)\}\}')
    variables = set()
    for parrafo in doc.paragraphs:
        texto = "".join(r.text for r in parrafo.runs)
        variables.update(patron_var.findall(texto))
    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                for parrafo in celda.paragraphs:
                    texto = "".join(r.text for r in parrafo.runs)
                    variables.update(patron_var.findall(texto))

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output, sorted(variables)
