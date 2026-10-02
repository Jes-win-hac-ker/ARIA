from django.urls import path

from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('market-movers/', views.market_movers, name='market-movers'),
    path('ask/', views.ask, name='ask'),
    path('sessions/<str:session_id>/', views.delete_session, name='delete_session'),
    path('sessions/<str:session_id>', views.delete_session, name='delete_session_no_slash'),
    path('documents/<str:filename>/', views.document, name='document'),
    path('comparison-data/', views.comparison_data, name='comparison-data'),
    path('health', views.health, name='health-alias'),
]
