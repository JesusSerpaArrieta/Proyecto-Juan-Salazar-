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
import platform
import subprocess
import zipfile
import io

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

        try:
            vars_set = extract_variables_from_docx(plantilla.archivo.path)
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
                    tpl = DocxTemplate(p.archivo.path)
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
            tpl = DocxTemplate(archivo.plantilla.archivo.path)
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
