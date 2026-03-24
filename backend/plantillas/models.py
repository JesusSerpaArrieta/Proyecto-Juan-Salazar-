from django.db import models
from django.conf import settings


class CategoriaPlantilla(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre


class Plantilla(models.Model):
    categoria = models.ForeignKey(CategoriaPlantilla, on_delete=models.CASCADE, related_name='plantillas')
    nombre = models.CharField(max_length=150)
    archivo = models.FileField(upload_to='plantillas/')
    variables_detectadas = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.categoria.nombre} - {self.nombre}"


class VariableCategoria(models.Model):
    TIPO_CHOICES = [
        ('text', 'Texto'),
        ('date', 'Fecha'),
        ('number', 'Número'),
        ('percent', 'Porcentaje'),
        ('auto', 'Automático'),  # ej. valores derivados (como área libre)
    ]
    categoria = models.ForeignKey(CategoriaPlantilla, on_delete=models.CASCADE, related_name='variables')
    nombre_variable = models.CharField(max_length=100)
    tipo_dato = models.CharField(max_length=20, choices=TIPO_CHOICES, default='text')
    obligatoria = models.BooleanField(default=False)

    class Meta:
        unique_together = ('categoria', 'nombre_variable')

    def __str__(self):
        return f"{self.categoria.nombre} - {self.nombre_variable}"


class DocumentoGenerado(models.Model):
    categoria = models.ForeignKey(CategoriaPlantilla, on_delete=models.SET_NULL, null=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    datos_utilizados = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        radicado = self.datos_utilizados.get('radicado', 'Sin radicado')
        categoria = self.categoria.nombre if self.categoria else ''
        return f"Radicado {radicado} - {categoria}"


class ArchivoGenerado(models.Model):
    documento = models.ForeignKey(DocumentoGenerado, on_delete=models.CASCADE, related_name="archivos")
    plantilla = models.ForeignKey(Plantilla, on_delete=models.SET_NULL, null=True, blank=True)
    nombre_archivo = models.CharField(max_length=255)
    ruta = models.CharField(max_length=500)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre_archivo
