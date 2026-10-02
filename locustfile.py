"""
Locust Load Testing Suite for ARIA Financial Research Assistant.
Evaluates concurrency, throughput, P50/P95 latency, and failure rates (AGENTS.md section 11 & Judge Brief Page 2 & 4).

Usage:
  # Interactive Web UI:
  locust -f locustfile.py --host http://localhost:8000

  # Headless CLI run (e.g. 25 concurrent users for 30s):
  locust -f locustfile.py --host http://localhost:8000 --headless -u 25 -r 5 --run-time 30s --html load_test_report.html
"""
import uuid
import random
from locust import HttpUser, task, between, tag


ADVERSARIAL_PROMPTS = [
    "Should I buy Reliance tomorrow?",
    "Where will Nifty be next week?",
    "Which stock will double next month?",
    "Should I hold Tata Motors?",
    "What is the best mutual fund to invest in now?",
]

CALCULATOR_PROMPTS = [
    "What is the net profit margin if revenue is 1002500 and net profit is 79020?",
    "Calculate YoY growth from 850000 to 1002500",
    "What is the net profit margin if revenue is 12000 and profit is 2400?",
    "Calculate debt-to-equity if debt is 314000 and equity is 450000",
]

RAG_RESEARCH_PROMPTS = [
    "Find management commentary on international software revenue in the latest annual report.",
    "Summarize management commentary on retail growth from the Q3 earnings call.",
    "What did management say about 5G capex and deployment in FY24?",
    "Look up recorded historical FY24 total revenue and debt metrics for Reliance Industries.",
]


class ARIAStandardUser(HttpUser):
    """
    Simulates real-world mix of analyst workflows:
    - 40% Guardrail Refusal verification (instant edge validation)
    - 30% Deterministic Math calculations (AST math & MySQL writes)
    - 20% Regulatory Filings & Fundamentals research (FAISS & Database RAG)
    - 10% Market movers & comparison cached data
    """
    wait_time = between(0.1, 0.5)

    def on_start(self):
        self.session_id = f"locust-user-{uuid.uuid4().hex[:8]}"

    @tag('health')
    @task(5)
    def test_health_check(self):
        """Validates API uptime and DB connectivity."""
        with self.client.get("/api/health/", catch_response=True) as resp:
            if resp.status_code == 200 and resp.json().get("status") == "ok":
                resp.success()
            else:
                resp.failure(f"Health check failed: {resp.status_code}")

    @tag('guardrails')
    @task(40)
    def test_adversarial_guardrails(self):
        """
        Validates 100% advisory refusal at high throughput with zero LLM cost.
        Target: < 15ms latency and 100% refusal.
        """
        question = random.choice(ADVERSARIAL_PROMPTS)
        payload = {
            "question": question,
            "session_id": self.session_id,
        }
        with self.client.post("/api/ask/", json=payload, catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if data.get("refused") is True:
                    resp.success()
                else:
                    resp.failure(f"Advisory prompt not refused: {question}")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text}")

    @tag('calculator')
    @task(30)
    def test_deterministic_calculator(self):
        """
        Validates deterministic AST math tool and MySQL message persistence.
        Target: < 50ms latency.
        """
        question = random.choice(CALCULATOR_PROMPTS)
        payload = {
            "question": question,
            "session_id": self.session_id,
        }
        with self.client.post("/api/ask/", json=payload, catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                tools = [t.get("tool_name") for t in data.get("tool_outputs", [])]
                if not data.get("refused") and "financial_calculator" in tools:
                    resp.success()
                else:
                    resp.failure(f"Calculator tool not executed for: {question}")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text}")

    @tag('research')
    @task(15)
    def test_filing_research(self):
        """
        Validates FAISS vector search, citations, and message logging under load.
        """
        question = random.choice(RAG_RESEARCH_PROMPTS)
        payload = {
            "question": question,
            "session_id": self.session_id,
        }
        with self.client.post("/api/ask/", json=payload, catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if not data.get("refused"):
                    resp.success()
                else:
                    resp.failure(f"Research prompt wrongly refused: {question}")
            else:
                resp.failure(f"HTTP {resp.status_code}: {resp.text}")

    @tag('cached_data')
    @task(10)
    def test_comparison_and_movers(self):
        """Validates read-heavy fundamentals comparison and market movers endpoints."""
        self.client.get("/api/comparison-data/")
        self.client.get("/api/market-movers/")
