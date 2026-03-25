from django.contrib import admin
from .models import CategoriaPlantilla, Plantilla, VariableCategoria, DocumentoGenerado, ArchivoGenerado

@admin.register(CategoriaPlantilla)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre']

@admin.register(Plantilla)
class PlantillaAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre', 'categoria', 'archivo']

@admin.register(VariableCategoria)
class VariableAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre_variable', 'categoria', 'tipo_dato']

@admin.register(DocumentoGenerado)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ['id', 'categoria', 'usuario', 'created_at']

@admin.register(ArchivoGenerado)
class ArchivoAdmin(admin.ModelAdmin):
    list_display = ['id', 'nombre_archivo', 'plantilla', 'fecha_creacion']
