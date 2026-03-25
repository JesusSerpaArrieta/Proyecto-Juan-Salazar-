import os
import subprocess
from pathlib import Path
from docxtpl import DocxTemplate
import re
from datetime import datetime

def inferir_tipo_variable(nombre: str) -> str:
    nombre = nombre.lower()
    if any(p in nombre for p in ["fecha", "expedicion", "vencimiento", "radicacion"]):
        return "date"
    if any(p in nombre for p in ["num", "cedula", "matricula", "anio", "ref", "resolucion"]):
        return "number"
    if any(p in nombre for p in ["area"]):
        return "float"
    if nombre.startswith("por"):
        return "percent"
    if nombre in ["area_libre_cara", "por_libre", "por_total", "por_cons"]:
        return "auto"
    return "text"


def extract_variables_from_docx(path):
    tpl = DocxTemplate(path)
    try:
        vars_set = tpl.get_undeclared_template_variables()
        return set(vars_set)
    except Exception:
        return set()


def extract_variables_from_docx_buffer(buf):
    tpl = DocxTemplate(buf)
    try:
        return set(tpl.get_undeclared_template_variables())
    except Exception:
        return set()


def render_docx_from_template(template_path, context, out_path):
    tpl = DocxTemplate(template_path)
    tpl.render(context)
    tpl.save(out_path)
    return out_path


def docx_to_pdf_libreoffice(input_path, outdir):
    subprocess.run([
        "libreoffice", "--headless", "--convert-to", "pdf",
        input_path, "--outdir", outdir
    ], check=True)
    filename = os.path.splitext(os.path.basename(input_path))[0] + ".pdf"
    return os.path.join(outdir, filename)


def safe_render_and_convert(template_path, context, categoria_nombre):
    desktop = Path.home() / "Desktop"
    categoria_folder = desktop / categoria_nombre.capitalize()
    categoria_folder.mkdir(parents=True, exist_ok=True)

    radicado = context.get("radicado", "SIN-RADICADO")
    nombre_archivo = f"{categoria_nombre.capitalize()}-{radicado}.docx"
    out_docx = categoria_folder / nombre_archivo

    tpl = DocxTemplate(template_path)
    tpl.render(context)
    tpl.save(out_docx)

    try:
        pdf_path = docx_to_pdf_libreoffice(str(out_docx), str(categoria_folder))
    except Exception:
        pdf_path = None

    return str(out_docx), pdf_path
