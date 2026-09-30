from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('ask/', views.ask, name='ask'),
]
