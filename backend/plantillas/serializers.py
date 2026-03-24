from rest_framework import serializers
from .models import (
    CategoriaPlantilla,
    Plantilla,
    VariableCategoria,
    DocumentoGenerado,
    ArchivoGenerado,
)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaPlantilla
        fields = "__all__"


class PlantillaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plantilla
        fields = "__all__"


class VariableCategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariableCategoria
        fields = "__all__"


class ArchivoGeneradoSerializer(serializers.ModelSerializer):
    plantilla_nombre = serializers.CharField(source="plantilla.nombre", read_only=True)

    class Meta:
        model = ArchivoGenerado
        fields = "__all__"


class DocumentoGeneradoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    archivos = ArchivoGeneradoSerializer(many=True, read_only=True)

    class Meta:
        model = DocumentoGenerado
        fields = "__all__"
