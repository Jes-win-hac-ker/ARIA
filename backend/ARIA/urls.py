"""Root URLconf for ARIA."""
from django.http import JsonResponse
from django.urls import include, path


def root(request):
    return JsonResponse(
        {
            'name': 'ARIA',
            'description': 'Financial research and explanation assistant (research-only)',
            'endpoints': {'health': '/api/health', 'ask': '/api/ask'},
        }
    )


urlpatterns = [
    path('', root),
    path('api/', include('api.urls')),
]
