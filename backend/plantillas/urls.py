from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet, basename='categorias')
router.register(r'plantillas', PlantillaViewSet, basename='plantillas')
router.register(r'variables', VariableCategoriaViewSet, basename='variables')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', RegisterView.as_view(), name='register'),
    path('upload-plantilla/', PlantillaUploadView.as_view(), name='upload-plantilla'),
    path('generar-categoria/', GenerateCategoryDocumentsAPIView.as_view(), name='generar-categoria'),
    path('variables-filtradas/', VariableCategoriaListAPIView.as_view(), name='variables-filtradas'),
    path('documentos-generados/', DocumentoGeneradoListAPIView.as_view(), name='documentos-generados'),
    path('archivos-generados/', ArchivoGeneradoListAPIView.as_view(), name='archivos-generados'),
    path('archivo/<int:pk>/eliminar/', EliminarArchivoAPIView.as_view(), name='eliminar-archivo'),
    path('archivo/<int:pk>/descargar/', DescargarArchivoAPIView.as_view(), name='descargar-archivo'),
    path('documento/<int:pk>/editar/', EditarDocumentoAPIView.as_view(), name='editar-documento'),
    path('categorias/<int:categoria_id>/plantillas/', PlantillasPorCategoriaAPIView.as_view(), name='plantillas-por-categoria'),
    path('plantillas/<int:plantilla_id>/archivos/', ArchivosPorPlantillaAPIView.as_view(), name='archivos-por-plantilla'),
    path('conversor/', ConversorPlantillaView.as_view(), name='conversor'),
]
