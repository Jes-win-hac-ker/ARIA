"""Tests for the ARIA API skeleton."""
from django.test import TestCase


class HealthTests(TestCase):
    def test_health_ok(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')
        self.assertTrue(data['database'])

    def test_root_metadata(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'ARIA')


class AskTests(TestCase):
    def test_ask_requires_question(self):
        response = self.client.post('/api/ask/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_ask_returns_validated_stub(self):
        response = self.client.post(
            '/api/ask/',
            data={'question': 'What was Reliance FY2024 net profit margin?'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Contract fields from AGENTS.md section 6 must always be present.
        for field in (
            'answer', 'refused', 'refusal_reason', 'citations',
            'tool_outputs', 'warnings', 'token_usage',
            'correlation_id', 'latency_ms',
        ):
            self.assertIn(field, data)
        self.assertIsInstance(data['warnings'], list)

    def test_ask_creates_session_memory(self):
        from api.models import ChatSession

        self.client.post('/api/ask/', data={'question': 'hi'}, content_type='application/json')
        self.assertEqual(ChatSession.objects.count(), 1)
