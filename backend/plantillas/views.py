from django.views.generic import TemplateView
from django.http import HttpResponse as DjangoHttpResponse
from .conversor import convertir_a_plantilla
from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.serializers import ModelSerializer
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from pathlib import Path
from docxtpl import DocxTemplate
import os
import zipfile
import io
import requests
import cloudinary.uploader

from .models import (
    CategoriaPlantilla,
    Plantilla,
    VariableCategoria,
    DocumentoGenerado,
    ArchivoGenerado,
)
from .serializers import (
    CategoriaSerializer,
    PlantillaSerializer,
    VariableCategoriaSerializer,
    DocumentoGeneradoSerializer,
    ArchivoGeneradoSerializer,
)
from .utils import *


def get_docx_buffer_from_plantilla(plantilla):
    """Descarga el .docx desde Cloudinary o lo lee desde disco local."""
    if plantilla.cloudinary_url:
        r = requests.get(plantilla.cloudinary_url)
        r.raise_for_status()
        return io.BytesIO(r.content)
    # fallback local
    with open(plantilla.archivo.path, 'rb') as f:
        return io.BytesIO(f.read())


class RegisterSerializer(ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'password', 'email']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAuthenticated]


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = CategoriaPlantilla.objects.all()
    serializer_class = CategoriaSerializer


class PlantillaViewSet(viewsets.ModelViewSet):
    queryset = Plantilla.objects.all()
    serializer_class = PlantillaSerializer


class VariableCategoriaViewSet(viewsets.ModelViewSet):
    serializer_class = VariableCategoriaSerializer

    def get_queryset(self):
        queryset = VariableCategoria.objects.all()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            queryset = queryset.filter(categoria_id=categoria_id)
        return queryset


class VariableCategoriaListAPIView(generics.ListAPIView):
    serializer_class = VariableCategoriaSerializer

    def get_queryset(self):
        queryset = VariableCategoria.objects.all()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            queryset = queryset.filter(categoria_id=categoria_id)
        return queryset


class PlantillaUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        categoria_id = request.data.get('categoria')
        nombre = request.data.get('nombre')
        archivo = request.FILES.get('archivo')

        if not all([categoria_id, nombre, archivo]):
            return Response({'detail': 'categoria, nombre y archivo son requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        categoria = get_object_or_404(CategoriaPlantilla, pk=categoria_id)
        plantilla = Plantilla.objects.create(categoria=categoria, nombre=nombre, archivo=archivo)

        # Subir a Cloudinary
        try:
            archivo.seek(0)
            result = cloudinary.uploader.upload(
                archivo,
                resource_type="raw",
                folder="sisdoc/plantillas",
                public_id=f"{categoria.nombre}-{nombre}",
                overwrite=True,
            )
            plantilla.cloudinary_url = result.get("secure_url", "")
            plantilla.cloudinary_public_id = result.get("public_id", "")
        except Exception as e:
            print(f"Error subiendo a Cloudinary: {e}")

        try:
            buf = get_docx_buffer_from_plantilla(plantilla)
            vars_set = extract_variables_from_docx_buffer(buf)
            plantilla.variables_detectadas = list(vars_set)
        except Exception:
            plantilla.variables_detectadas = []
        plantilla.save()

        all_vars = set()
        for p in categoria.plantillas.all():
            all_vars.update(p.variables_detectadas or [])

        for v in all_vars:
            tipo = inferir_tipo_variable(v)
            VariableCategoria.objects.get_or_create(
                categoria=categoria,
                nombre_variable=v,
                defaults={"tipo_dato": tipo}
            )

        return Response(PlantillaSerializer(plantilla).data, status=status.HTTP_201_CREATED)


class GenerateCategoryDocumentsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (JSONParser,)

    def post(self, request, *args, **kwargs):
        from .utils import inferir_tipo_variable
        from datetime import datetime

        categoria_id = request.data.get("categoria")
        datos = request.data.get("datos", {})

        if not categoria_id:
            return Response({"detail": "categoria es requerida"}, status=status.HTTP_400_BAD_REQUEST)

        categoria = get_object_or_404(CategoriaPlantilla, pk=categoria_id)
        plantillas = categoria.plantillas.all()
        if not plantillas.exists():
            return Response({"detail": "No hay plantillas en la categoría"}, status=status.HTTP_400_BAD_REQUEST)

        # --- Inferencia de tipos y normalización ---
        variables = VariableCategoria.objects.filter(categoria_id=categoria_id)

        for var in variables:
            nombre = var.nombre_variable
            tipo = inferir_tipo_variable(nombre)
            valor = datos.get(nombre)

            if tipo == "percent":
                continue
            if tipo == "number" and valor is not None:
                try: datos[nombre] = int(valor)
                except ValueError: datos[nombre] = 0
            elif tipo == "float" and valor is not None:
                try: datos[nombre] = float(valor)
                except ValueError: datos[nombre] = 0.0
            elif tipo == "date" and valor:
                try: datos[nombre] = datetime.strptime(valor, "%Y-%m-%d").date().isoformat()
                except Exception: pass

        # --- Cálculos automáticos ---
        area_total = datos.get("area_lote_cara_num", 0)
        area_construida = datos.get("area_construccion_cara", 0)
        area_libre = datos.get("area_libre_cara", area_total - area_construida)
        datos["area_libre_cara"] = area_libre
        if area_total:
            datos["por_total"] = 100
            datos["por_cons"] = round((area_construida / area_total) * 100, 2)
            datos["por_libre"] = round((area_libre / area_total) * 100, 2)
        else:
            datos["por_total"] = datos["por_cons"] = datos["por_libre"] = 0

        # --- Guardar documento en BD ---
        radicado = datos.get("radicado", "SIN-RADICADO")
        nombre_solicitante = datos.get("nombre_solicitante", "SIN_NOMBRE").replace(" ", "_")

        documento = DocumentoGenerado.objects.create(
            categoria=categoria,
            usuario=request.user,
            datos_utilizados=datos,
        )

        # --- Generar archivos en memoria y empaquetar en ZIP ---
        zip_buffer = io.BytesIO()
        archivos_generados = 0

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in plantillas:
                try:
                    docx_buffer = io.BytesIO()
                    src = get_docx_buffer_from_plantilla(p)
                    tpl = DocxTemplate(src)
                    tpl.render(datos)
                    tpl.save(docx_buffer)
                    docx_buffer.seek(0)

                    base_name = f"{p.nombre.capitalize()}-{radicado}-{nombre_solicitante}.docx"
                    zf.writestr(base_name, docx_buffer.read())

                    ArchivoGenerado.objects.create(
                        documento=documento,
                        plantilla=p,
                        nombre_archivo=base_name.replace(".docx", ""),
                        ruta=""
                    )
                    archivos_generados += 1
                except Exception as e:
                    print(f"Error procesando plantilla {p.nombre}: {e}")

        zip_buffer.seek(0)
        zip_name = f"{categoria.nombre}-{radicado}-{nombre_solicitante}.zip"
        response = HttpResponse(zip_buffer.read(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{zip_name}"'
        response["X-Documento-Id"] = str(documento.id)
        return response



class DescargarArchivoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        archivo = get_object_or_404(ArchivoGenerado, pk=pk)
        datos = archivo.documento.datos_utilizados

        try:
            docx_buffer = io.BytesIO()
            src = get_docx_buffer_from_plantilla(archivo.plantilla)
            tpl = DocxTemplate(src)
            tpl.render(datos)
            tpl.save(docx_buffer)
            docx_buffer.seek(0)

            nombre = f"{archivo.nombre_archivo}.docx"
            response = HttpResponse(
                docx_buffer.read(),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            )
            response["Content-Disposition"] = f'attachment; filename="{nombre}"'
            return response
        except Exception as e:
            return Response({"detail": f"Error al generar: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DocumentoGeneradoListAPIView(generics.ListAPIView):
    queryset = DocumentoGenerado.objects.all().order_by('-created_at')[:10]
    serializer_class = DocumentoGeneradoSerializer


class ArchivoGeneradoListAPIView(generics.ListAPIView):
    queryset = ArchivoGenerado.objects.all().order_by("-fecha_creacion")
    serializer_class = ArchivoGeneradoSerializer
    pagination_class = None


class EliminarArchivoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        archivo = get_object_or_404(ArchivoGenerado, pk=pk)

        if archivo.documento.usuario != request.user:
            return Response({"detail": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)

        ruta = archivo.ruta
        if ruta and os.path.exists(ruta):
            try:
                os.remove(ruta)
            except Exception:
                pass

        documento = archivo.documento
        archivo.delete()

        if not documento.archivos.exists():
            documento.delete()

        return Response({"detail": "Archivo eliminado correctamente"}, status=status.HTTP_204_NO_CONTENT)


class EditarDocumentoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        documento = get_object_or_404(DocumentoGenerado, pk=pk)
        if not documento.datos_utilizados:
            return Response({"detail": "No hay datos para editar"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "categoria": documento.categoria.id,
            "datos": documento.datos_utilizados
        })

    def put(self, request, pk):
        documento = get_object_or_404(DocumentoGenerado, pk=pk)
        nuevos_datos = request.data.get("datos")

        if not nuevos_datos:
            return Response({"detail": "No se enviaron datos para actualizar"}, status=status.HTTP_400_BAD_REQUEST)

        documento.datos_utilizados = nuevos_datos
        documento.save()

        return Response({"status": "ok", "mensaje": "Datos actualizados correctamente"})

class PlantillasPorCategoriaAPIView(generics.ListAPIView):
    serializer_class = PlantillaSerializer

    def get_queryset(self):
        categoria_id = self.kwargs.get("categoria_id")
        return Plantilla.objects.filter(categoria_id=categoria_id)
    
class ArchivosPorPlantillaAPIView(generics.ListAPIView):
    serializer_class = ArchivoGeneradoSerializer

    def get_queryset(self):
        plantilla_id = self.kwargs.get("plantilla_id")
        return ArchivoGenerado.objects.filter(plantilla_id=plantilla_id)


class ConversorPlantillaView(APIView):
    permission_classes = []  # acceso libre — es una herramienta interna
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        html = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conversor de Plantillas — SisDoc</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0F172A; color: #E5E7EB; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 100%; max-width: 520px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
  .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  .logo-icon { width: 44px; height: 44px; background: #1E3A8A; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; color: white; }
  h1 { font-size: 20px; font-weight: 700; color: #F1F5F9; }
  p.sub { font-size: 13px; color: #94A3B8; margin-top: 2px; }
  .drop-zone { border: 2px dashed #334155; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; margin: 24px 0; position: relative; }
  .drop-zone:hover, .drop-zone.over { border-color: #3B82F6; background: rgba(59,130,246,0.05); }
  .drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .drop-icon { font-size: 36px; margin-bottom: 10px; }
  .drop-zone p { font-size: 14px; color: #94A3B8; }
  .drop-zone .filename { font-size: 13px; color: #3B82F6; margin-top: 8px; font-weight: 600; }
  button { width: 100%; padding: 13px; background: #1E3A8A; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  button:hover { background: #2563EB; }
  button:disabled { background: #334155; color: #64748B; cursor: not-allowed; }
  .result { margin-top: 20px; padding: 16px; background: #0F172A; border-radius: 10px; border: 1px solid #1E3A8A; display: none; }
  .result p { font-size: 13px; color: #94A3B8; margin-bottom: 8px; }
  .vars { display: flex; flex-wrap: wrap; gap: 6px; }
  .var-tag { background: #1E3A8A; color: #93C5FD; font-size: 11px; padding: 3px 8px; border-radius: 20px; font-family: monospace; }
  .success { color: #4ADE80; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .error-msg { color: #F87171; font-size: 13px; margin-top: 12px; display: none; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">S</div>
    <div>
      <h1>Conversor de Plantillas</h1>
      <p class="sub">SisDoc — Alcaldía Municipal</p>
    </div>
  </div>
  <p style="font-size:14px;color:#94A3B8;line-height:1.6;">
    Sube un documento Word con datos reales y lo convertimos automáticamente en una plantilla con variables <code style="color:#3B82F6">{{variable}}</code> lista para usar en SisDoc.
  </p>
  <div class="drop-zone" id="dropZone">
    <input type="file" id="fileInput" accept=".docx" />
    <div class="drop-icon">📄</div>
    <p>Arrastra tu <strong>.docx</strong> aquí o haz clic para seleccionar</p>
    <div class="filename" id="fileName"></div>
  </div>
  <button id="btnConvertir" disabled onclick="convertir()">Convertir a plantilla</button>
  <div class="error-msg" id="errorMsg"></div>
  <div class="result" id="result">
    <p class="success">✅ Plantilla generada correctamente</p>
    <p>Variables detectadas:</p>
    <div class="vars" id="varsList"></div>
  </div>
</div>
<script>
  const input = document.getElementById('fileInput');
  const btn = document.getElementById('btnConvertir');
  const fileName = document.getElementById('fileName');
  const dropZone = document.getElementById('dropZone');

  input.addEventListener('change', () => {
    if (input.files[0]) {
      fileName.textContent = input.files[0].name;
      btn.disabled = false;
    }
  });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('over');
    input.files = e.dataTransfer.files;
    if (input.files[0]) { fileName.textContent = input.files[0].name; btn.disabled = false; }
  });

  async function convertir() {
    const file = input.files[0];
    if (!file) return;
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('result').style.display = 'none';

    const form = new FormData();
    form.append('archivo', file);

    try {
      const res = await fetch('/conversor/', { method: 'POST', body: form });
      if (!res.ok) { throw new Error(await res.text()); }
      const blob = await res.blob();
      const vars = res.headers.get('X-Variables') || '';

      // Descargar
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace('.docx', '-plantilla.docx');
      a.click(); URL.revokeObjectURL(url);

      // Mostrar variables
      const lista = document.getElementById('varsList');
      lista.innerHTML = '';
      vars.split(',').filter(Boolean).forEach(v => {
        const tag = document.createElement('span');
        tag.className = 'var-tag'; tag.textContent = '{{' + v + '}}';
        lista.appendChild(tag);
      });
      document.getElementById('result').style.display = 'block';
    } catch(e) {
      document.getElementById('errorMsg').textContent = 'Error: ' + e.message;
      document.getElementById('errorMsg').style.display = 'block';
    }
    btn.disabled = false; btn.textContent = 'Convertir a plantilla';
  }
</script>
</body>
</html>"""
        return DjangoHttpResponse(html, content_type='text/html')

    def post(self, request):
        archivo = request.FILES.get('archivo')
        if not archivo:
            return DjangoHttpResponse('Archivo requerido', status=400)
        try:
            buf = io.BytesIO(archivo.read())
            resultado, variables = convertir_a_plantilla(buf)
            nombre = archivo.name.replace('.docx', '-plantilla.docx')
            response = DjangoHttpResponse(
                resultado.read(),
                content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
            response['Content-Disposition'] = f'attachment; filename="{nombre}"'
            response['X-Variables'] = ','.join(variables)
            return response
        except Exception as e:
            return DjangoHttpResponse(str(e), status=500)
