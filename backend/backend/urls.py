from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from plantillas.views import ConversorPlantillaView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('plantillas.urls')),
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('conversor/', ConversorPlantillaView.as_view(), name='conversor'),
]
