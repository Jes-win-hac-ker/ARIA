# ARIA: Financial Research & Explanation Assistant
*Ask, Retrieve, Interrupt, Augment*

A research-only financial analyst assistant built for the **AI & Agentic Systems Hackathon (Fintech: Stock Market Track)**.

Strictly follows **[AGENTS.md](AGENTS.md)**:
> *"The LLM handles language. Tools handle facts, math, and decisions."*

---

## 1. Problem Statement & Target User

### Problem
Investors and research analysts spending hours manually reading 100+ page annual reports, earnings call transcripts, and exchange filings often face:
1. **Hallucination risks** with standard LLMs that invent ratios, percentages, and historical facts.
2. **Regulatory violations**: Recommending buy/sell actions without SEBI registration is illegal under Indian regulations.
3. **Traceability gaps**: Answers that do not prove which page, line, or regulatory filing a number came from.

### Target User
* **Equity Research Analysts & Retail Financial Researchers** who need verified, citation-backed numbers, management commentary summaries, and deterministic ratio calculations without advisory risk.

---

## 2. Architecture Diagram

```mermaid
graph TD
    User([User / Web UI]) -->|HTTP POST /api/ask/| API[Django REST Framework API]
    API --> Guardrails{Advisory & Prediction Guardrails}

    Guardrails -->|Advice/Prediction detected| Refusal[100% Polite Refusal & Research Redirect]
    Refusal --> Pydantic[Pydantic Schema Validation]

    Guardrails -->|Safe Research Query| Orchestrator[Agent Orchestration Layer]

    Orchestrator -->|1. Regulatory Filings Search| ToolRAG[search_filings Tool]
    ToolRAG --> FAISS[(FAISS Vector Store\nIndexFlatIP over 140+ pages)]

    Orchestrator -->|2. Deterministic Arithmetic| ToolCalc[financial_calculator Tool]
    ToolCalc --> ASTMath[AST-based Math Engine\nNo LLM Arithmetic]

    Orchestrator -->|3. Local Stock/Fundamentals| ToolFund[fundamentals_lookup Tool]
    ToolFund --> MySQL[(MySQL 8.4 Database\nBhavcopy + Fundamentals)]

    Orchestrator --> Memory[(MySQL Session Memory\nChatSession + Message + ToolCall)]

    ToolRAG --> Citations[Page-level Citations + Timestamps]
    ToolCalc --> MathResult[Deterministic Result + Formula + Timestamp]
    ToolFund --> StockData[Stored EOD Prices + Staleness Flags]

    Citations & MathResult & StockData --> Synthesizer[Response Assembly]
    Synthesizer --> Pydantic
    Pydantic -->|Validated JSON Response| User
```

---

## 3. Core Capabilities & Backend Tools

ARIA provides three deterministic tools with 100% verifiable outputs:

| Tool | Purpose | Sourced From | Traceability Output |
|---|---|---|---|
| `search_filings` | Search annual reports, concalls, and presentations | FAISS Vector Store over RIL filings | Document, Page Locator, Snippet, Timestamp |
| `financial_calculator` | Deterministic computation of margins, growth, D/E, P/E, CAGR | Python AST Evaluator (Zero LLM Math) | Formula, Input Operands, Timestamp |
| `fundamentals_lookup` | Query closing prices, volume, P/E, market cap, and debt | MySQL `api_bhavcopy` & `api_companyfundamental` | Trade Date, Staleness Flag, Stored Cache Note |

### Document Ingestion & RAG Architecture (Graceful Degradation)
ARIA employs a two-tier graceful degradation parser pipeline in `backend/rag/indexer.py`:
* **Tier 1 (Deep Document Understanding)**: Integrates **IBM Docling** (`DocumentConverter`) for extracting rich layout structure, headers, and complex financial tables.
* **Tier 2 (High-Speed Fallback)**: Automatically falls back to **PyPDF** extraction when Docling is absent, in low-memory environments, or during high-throughput containerized deployments.
* **FAISS Vector Indexing**: All extracted chunks are indexed with cosine similarity (`IndexFlatIP`), strictly preserving page locators (`Page X`), document titles, sources, and filing timestamps.

### Non-Negotiable Guardrails
If a user submits advisory queries (*"Should I buy Reliance tomorrow?"*, *"Where will Nifty be next week?"*):
* `refused = True` (100% refusal target)
* `refusal_reason` explaining compliance policy
* Polite redirection to safe historical research

---

## 4. Data Sources & Licenses

Full compliance documentation is available in **[backend/DATA_SOURCES.md](backend/DATA_SOURCES.md)**.

1. **NSE Daily Bhavcopy**:
   * Official capital market segment trading data from National Stock Exchange of India (24-Apr-2026 to 29-Apr-2026).
   * Ingested into MySQL (`api_bhavcopy`) to prevent live exchange scraping.
2. **Reliance Industries Limited (RIL) Corporate Disclosures**:
   * `rag_1.pdf`: Audited Financial Statements (Consolidated & Standalone) FY2025-26 (Deloitte Haskins & Sells LLP).
   * `RAG_2.pdf`: Q4 & FY2025-26 Earnings Call Discussion Transcript.
   * `RAG_3.pdf`: Q4 & FY2025-26 Financial Results Investor Presentation.
3. **FinQA Financial Reasoning Dataset**:
   * Open academic benchmark for evaluating multi-step financial arithmetic.

---

## 5. Quick Start (Docker)

### Prerequisites
* Docker Desktop (or any Docker with Compose v2+)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start MySQL, Django API, and Vite Frontend
docker compose up --build
```

`docker compose up` automatically:
1. Runs database migrations (`migrate`).
2. Ingests NSE Bhavcopy files and seeds fundamental benchmarks (`load_market_data`).
3. Chunks domain documents and builds the FAISS vector index (`build_rag_index`).
4. Starts the API server with health probes.

### Key Endpoints

| URL | Method | Purpose |
|---|---|---|
| `http://localhost:8000/api/health/` | `GET` | Health check probe (verifies MySQL connectivity) |
| `http://localhost:8000/api/ask/` | `POST` | Agent query endpoint (validated with Pydantic) |
| `http://localhost:3000/` | `GET` | Vite + React Frontend |

---

## 6. Running Backend Checks and Tests

```bash
# Inside Docker:
docker compose exec web python manage.py check
docker compose exec web python manage.py test

# Or locally with SQLite:
DJANGO_DB_ENGINE=sqlite python backend/manage.py test backend
```

---

## 7. Known Limitations

* **Historical Data Boundary**: Data reflects the hackathon dataset window (April 2026). Stored market data is explicitly flagged as `is_stale: true` with corresponding trade dates.
* **Research-Only Scope**: The system deliberately refuses all buy/sell/hold recommendations and price forecasts.
