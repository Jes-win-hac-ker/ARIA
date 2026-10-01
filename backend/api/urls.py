from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('ask/', views.ask, name='ask'),
    path('documents/<str:filename>/', views.document, name='document'),
    path('health', views.health, name='health-alias'),
]
