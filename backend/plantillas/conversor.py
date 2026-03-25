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

# Patrones de fecha con contexto — (patron_contexto, patron_fecha, variable)
# El contexto es texto que aparece ANTES de la fecha en la misma frase
FECHAS_CON_CONTEXTO = [
    # Vencimiento
    (r'[Vv]enc\w*|[Ee]xpira\w*|[Hh]asta el|[Vv]igente hasta',        r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', 'fecha_vencimiento'),
    (r'[Vv]enc\w*|[Ee]xpira\w*',                                       r'\b\w+\s+\d{1,2}\s+de\s+\d{4}\b',       'fecha_vencimiento'),
    # Radicación
    (r'[Rr]adic\w*|[Rr]ecib\w*|[Pp]resentó|[Ss]e recibió',           r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', 'fecha_radicacion'),
    # Notificación
    (r'[Nn]otific\w*|[Nn]otifiqué',                                    r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', 'fecha_notificacion'),
    # Expedición / firma
    (r'[Ee]xpid\w*|[Ff]irm\w*|[Ee]xpedición|[Ff]echa de',            r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b', 'fecha_expedicion'),
    (r'[Ee]xpid\w*|[Ff]irm\w*',                                       r'\b\w+\s+\d{1,2}\s+de\s+\d{4}\b',       'fecha_expedicion'),
]

# Patrones sin contexto — se aplican al texto del run solo
PATRONES = [
    # Radicado municipal (ej: 70670-0-25-0127)
    (r'\b\d{5}-\d{1,2}-\d{2,4}-\d{3,6}\b',                           'radicado'),
    # Número de resolución
    (r'N[°oº\.]\s*\d{1,4}\b',                                         'numero_resolucion'),
    # Cédula
    (r'\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}\b',                           'cedula_solicitante'),
    # Matrícula inmobiliaria
    (r'\b\d{3}-\d{4,6}\b',                                            'matricula_inmobiliaria'),
    # Código catastral (16+ dígitos)
    (r'\b\d{16,30}\b',                                                 'codigo_catastral'),
    # Fechas escritas — genérico (fallback si no hay contexto)
    (r'\b\d{1,2}\s+de\s+\w+\s+de\s+\d{4}\b',                        'fecha_expedicion'),
    (r'\b\w+\s+\d{1,2}\s+de\s+\d{4}\b',                              'fecha_expedicion'),
    # Año en contexto
    (r'\bDEL\s+20\d{2}\b',                                            'anio_resolucion'),
    # Matrícula profesional
    (r'\b\d{2,6}-\d{4,6}\s*C\.?P\.?[A-Z\.]*\b',                     'matricula_prof'),
    # Áreas
    (r'\d+\s*HAS\s*\+?\s*[\d\.,]*\s*M2?',                            'area_total_predio'),
    (r'\d+\s*HAS\b',                                                   'area_lote'),
]

def _nombre_unico(base, contadores):
    contadores[base] = contadores.get(base, 0) + 1
    sufijo = f"_{contadores[base]}" if contadores[base] > 1 else ""
    return base + sufijo

def aplicar_patrones_con_contexto(parrafo_texto, contadores):
    """Aplica detección de fechas usando contexto del párrafo completo."""
    resultado = parrafo_texto
    for ctx_patron, fecha_patron, variable in FECHAS_CON_CONTEXTO:
        # Buscar si hay contexto en el párrafo
        if re.search(ctx_patron, parrafo_texto):
            def reemplazar_fecha(m, var=variable):
                matched = m.group(0)
                if '{{' in matched:
                    return matched
                return '{{' + _nombre_unico(var, contadores) + '}}'
            resultado = re.sub(fecha_patron, reemplazar_fecha, resultado)
    return resultado

def aplicar_patrones(texto, contadores):
    """Aplica fijos y patrones regex al texto de un run."""
    for original, variable in FIJOS.items():
        texto = texto.replace(original, variable)
    for patron, nombre_base in PATRONES:
        def reemplazar(m, nb=nombre_base):
            matched = m.group(0)
            if '{{' in matched:
                return matched
            return '{{' + _nombre_unico(nb, contadores) + '}}'
        texto = re.sub(patron, reemplazar, texto)
    return texto

def _texto_parrafo(parrafo):
    return ''.join(r.text for r in parrafo.runs)

def procesar_parrafo(parrafo, contadores):
    texto_completo = _texto_parrafo(parrafo)
    if not texto_completo.strip():
        return

    # Primero aplicar contexto al texto completo del párrafo
    texto_con_ctx = aplicar_patrones_con_contexto(texto_completo, dict(contadores))

    # Si hubo cambios por contexto, actualizar contadores y aplicar run a run
    if texto_con_ctx != texto_completo:
        # Recalcular contadores con el contexto
        aplicar_patrones_con_contexto(texto_completo, contadores)

    # Aplicar run a run (fijos + patrones sin contexto)
    for run in parrafo.runs:
        if run.text.strip():
            run.text = aplicar_patrones(run.text, contadores)

def convertir_a_plantilla(input_buffer):
    """Recibe un BytesIO con el .docx y devuelve un BytesIO con la plantilla."""
    doc = Document(input_buffer)
    contadores = {}

    for parrafo in doc.paragraphs:
        procesar_parrafo(parrafo, contadores)

    for tabla in doc.tables:
        for fila in tabla.rows:
            for celda in fila.cells:
                for parrafo in celda.paragraphs:
                    procesar_parrafo(parrafo, contadores)

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output, list(contadores.keys())
