from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('ask/', views.ask, name='ask'),
    path('documents/<str:filename>/', views.document, name='document'),
    path('comparison-data/', views.comparison_data, name='comparison-data'),
    path('health', views.health, name='health-alias'),
]
