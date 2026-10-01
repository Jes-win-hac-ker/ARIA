"""
Comprehensive test suite for ARIA Backend API and Agent Pipeline.
Verifies all hackathon requirements (AGENTS.md):
- Django project health (/api/health/)
- Session memory, message, and tool-call MySQL persistence
- Advisory/prediction refusal guardrails (100% target)
- Deterministic financial calculator tool
- MySQL fundamentals & Bhavcopy price lookup tool with staleness
- FAISS RAG filing search tool with citations & timestamps
- Pydantic validation on all responses
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from api.models import Bhavcopy, ChatSession, CompanyFundamental, Message, ToolCall
from agent.tools import financial_calculator, fundamentals_lookup, search_filings


class HealthTests(TestCase):
    def test_health_ok(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')
        self.assertTrue(data['database'])

    def test_health_without_slash(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'ok')

    def test_root_metadata(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'ARIA')


class ToolUnitTests(TestCase):
    def setUp(self):
        # Create test records
        Bhavcopy.objects.create(
            trad_dt='2026-04-29',
            tckr_symb='RELIANCE',
            isin='INE002A01018',
            fin_instrm_nm='RELIANCE INDUSTRIES LTD',
            cls_pric=Decimal('1425.40'),
            prvs_clsg_pric=Decimal('1388.90'),
            ttl_tradg_vol=30542143,
            ttl_trf_val=Decimal('43315858969.90'),
            scty_srs='EQ',
        )
        CompanyFundamental.objects.create(
            tckr_symb='RELIANCE',
            company_name='Reliance Industries Limited',
            sector='Oil, Gas & Energy',
            market_cap_cr=Decimal('1985000.00'),
            pe_ratio=Decimal('27.20'),
            pb_ratio=Decimal('2.15'),
            debt_to_equity=Decimal('0.38'),
            roe_pct=Decimal('9.60'),
            eps=Decimal('104.50'),
            dividend_yield_pct=Decimal('0.35'),
            revenue_cr=Decimal('1002500.00'),
            net_profit_cr=Decimal('79020.00'),
            operating_margin_pct=Decimal('17.80'),
            fiscal_year='FY2025-26',
            as_of_date='2026-03-31',
            source='Audited Financial Statements FY26',
        )

    def test_financial_calculator_ratios(self):
        # Net Profit Margin
        npm = financial_calculator('net_profit_margin', net_profit=79020, revenue=1002500)
        self.assertEqual(npm['result'], 7.88)
        self.assertIn('%', npm['formatted_result'])
        self.assertIn('timestamp', npm)

        # YoY Growth
        yoy = financial_calculator('yoy_growth', current=1002500, previous=892000)
        self.assertEqual(yoy['result'], 12.39)

        # Debt to Equity
        de = financial_calculator('debt_to_equity', total_debt=380000, total_equity=1000000)
        self.assertEqual(de['result'], 0.38)

        # P/E Ratio
        pe = financial_calculator('pe_ratio', price=2840, eps=104.5)
        self.assertEqual(pe['result'], 27.18)

        # Safe math expression
        expr = financial_calculator('expression', expression='(100 + 20) * 5 / 2')
        self.assertEqual(expr['result'], 300.0)

    def test_financial_calculator_zero_division(self):
        res = financial_calculator('net_profit_margin', net_profit=500, revenue=0)
        self.assertIn('error', res)

    def test_fundamentals_lookup_stored_data(self):
        res = fundamentals_lookup('RELIANCE')
        self.assertTrue(res['found'])
        self.assertEqual(res['ticker'], 'RELIANCE')
        self.assertEqual(res['price_data']['closing_price'], 1425.40)
        self.assertEqual(res['fundamentals']['pe_ratio'], 27.20)
        self.assertTrue(res['is_stale'])
        self.assertIn('2026-04-29', res['staleness_note'])
        self.assertIn('timestamp', res)

    def test_fundamentals_lookup_unknown_ticker(self):
        res = fundamentals_lookup('UNKNOWN_TICKER_XYZ')
        self.assertFalse(res['found'])

    def test_search_filings_citations(self):
        res = search_filings('Reliance EBITDA revenue', top_k=2)
        self.assertIn('citations', res)
        self.assertIn('timestamp', res)
        if res['citations']:
            cit = res['citations'][0]
            self.assertIn('document', cit)
            self.assertIn('locator', cit)
            self.assertIn('snippet', cit)
            self.assertIn('source', cit)
            self.assertIn('timestamp', cit)


class AskEndpointTests(TestCase):
    def setUp(self):
        CompanyFundamental.objects.create(
            tckr_symb='RELIANCE',
            company_name='Reliance Industries Limited',
            sector='Energy & Conglomerate',
            market_cap_cr=Decimal('1985000.00'),
            pe_ratio=Decimal('27.20'),
            pb_ratio=Decimal('2.15'),
            debt_to_equity=Decimal('0.38'),
            roe_pct=Decimal('9.60'),
            eps=Decimal('104.50'),
            dividend_yield_pct=Decimal('0.35'),
            revenue_cr=Decimal('1002500.00'),
            net_profit_cr=Decimal('79020.00'),
            operating_margin_pct=Decimal('17.80'),
            fiscal_year='FY2025-26',
            as_of_date='2026-03-31',
            source='Audited Financial Statements FY26',
        )

    def test_ask_requires_question(self):
        response = self.client.post('/api/ask/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_ask_advisory_refusal(self):
        """Must refuse buy/sell/hold prompts with refused=True (AGENTS.md section 3 & 11)."""
        advisory_prompts = [
            'Should I buy Reliance tomorrow?',
            'Where will Nifty be next week?',
            'Which stock will double next month?',
            'Should I hold this stock?',
            'What is the best mutual fund to invest in now?',
        ]
        for prompt in advisory_prompts:
            response = self.client.post(
                '/api/ask/',
                data={'question': prompt},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data['refused'], f"Failed to refuse: {prompt}")
            self.assertIsNotNone(data['refusal_reason'])
            self.assertIn('cannot provide buy, sell, or hold', data['answer'])

    def test_ask_research_query_pydantic_contract(self):
        """Research query returns fully validated schema with citations and tools."""
        response = self.client.post(
            '/api/ask/',
            data={'question': 'What was Reliance FY2026 net profit margin?'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Check required schema fields
        for field in (
            'answer', 'refused', 'refusal_reason', 'citations',
            'tool_outputs', 'warnings', 'token_usage',
            'correlation_id', 'latency_ms',
        ):
            self.assertIn(field, data)

        self.assertFalse(data['refused'])
        self.assertGreater(len(data['tool_outputs']), 0)
        self.assertGreater(data['token_usage'], 0)

    def test_ask_session_memory_persistence(self):
        """Verifies ChatSession, user/assistant Messages, and ToolCalls are stored in DB."""
        session_id = 'test-session-12345'
        response = self.client.post(
            '/api/ask/',
            data={'question': 'What was Reliance net profit margin?', 'session_id': session_id},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

        # 1. ChatSession exists
        session = ChatSession.objects.filter(session_id=session_id).first()
        self.assertIsNotNone(session)
        self.assertGreater(session.token_usage, 0)

        # 2. Both user and assistant messages exist
        messages = Message.objects.filter(session=session).order_by('created_at')
        self.assertEqual(messages.count(), 2)
        self.assertEqual(messages[0].role, 'user')
        self.assertEqual(messages[1].role, 'assistant')

        # 3. ToolCalls are recorded and linked to user message
        tool_calls = ToolCall.objects.filter(message=messages[0])
        self.assertGreater(tool_calls.count(), 0)
        for tc in tool_calls:
            self.assertIn(tc.tool_name, ['fundamentals_lookup', 'financial_calculator', 'search_filings'])
            self.assertIsNotNone(tc.input_args)
            self.assertIsNotNone(tc.output_result)
            self.assertGreaterEqual(tc.latency_ms, 0)
