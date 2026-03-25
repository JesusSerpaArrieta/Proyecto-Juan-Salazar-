"""Lógica del conversor inteligente de .docx a plantilla docxtpl."""
import re
import io
from docx import Document

FIJOS = {
    "SAMPUÉS": "{{municipio}}", "Sampués": "{{municipio}}",
    "SAMPUES": "{{municipio}}", "Sampues": "{{municipio}}",
    "SUCRE": "{{departamento}}", "Sucre": "{{departamento}}",
    "CARLOS HUGO MONTOYA ARIAS": "{{nombre_secretario}}",
    "Milta Lambraño Pérez": "{{nombre_elaboro}}",
    "Iván Flórez": "{{nombre_juridico}}",
    "secretariadeplaneacion@sampues-sucre.gov.co": "{{correo_secretaria}}",
    "www.sampues-sucre.gov.co": "{{web_alcaldia}}",
    "283 01 71": "{{telefono_secretaria}}",
    "calle 23 # 19 B-22sector centro": "{{direccion_secretaria}}",
    "705070": "{{codigo_postal}}",
}

PATRONES = [
    (r'\b\d{5}-\d{1,2}-\d{2,4}-\d{3,6}\b', 'radicado'),
    (r'N[°oº\.]\s*\d{1,4}\b', 'numero_resolucion'),
    (r'\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}\b', 'cedula_solicitante'),
    (r'\b\d{3}-\d{4,6}\b', 'matricula_inmobiliaria'),
    (r'\b\d{16,30}\b', 'codigo_catastral'),
    (r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', 'fecha_expedicion'),
    (r'\bDEL\s+20\d{2}\b', 'anio_resolucion'),
    (r'\b\d{2,6}-\d{4,6}\s*C\.?P\.?[A-Z\.]*\b', 'matricula_prof'),
    (r'\d+\s*HAS\s*\+?\s*[\d\.,]*\s*M2?', 'area_total_predio'),
    (r'\d+\s*HAS\b', 'area_lote'),
]

def aplicar_patrones(texto, contadores):
    for original, variable in FIJOS.items():
        texto = texto.replace(original, variable)
    for patron, nombre_base in PATRONES:
        def reemplazar(m, nb=nombre_base):
            matched = m.group(0)
            if '{{' in matched:
                return matched
            contadores[nb] = contadores.get(nb, 0) + 1
            sufijo = f"_{contadores[nb]}" if contadores[nb] > 1 else ""
            return '{{' + nb + sufijo + '}}'
        texto = re.sub(patron, reemplazar, texto)
    return texto

def convertir_a_plantilla(input_buffer):
    """Recibe un BytesIO con el .docx y devuelve un BytesIO con la plantilla."""
    doc = Document(input_buffer)
    contadores = {}

    for parrafo in doc.paragraphs:
        for run in parrafo.runs:
            if run.text.strip():
                run.text = aplicar_patrones(run.text, contadores)

    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                for parrafo in celda.paragraphs:
                    for run in parrafo.runs:
                        if run.text.strip():
                            run.text = aplicar_patrones(run.text, contadores)

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output, list(contadores.keys())
