# ARIA Data Sources and Compliance Documentation

In strict accordance with **AGENTS.md (Section 7: Data Rules)** and the Hackathon Ground Rules (DPDP Act 2023 compliance), ARIA uses only public, non-personal financial data and regulatory disclosures. All external exchange data is stored locally in MySQL and vector indexed locally in FAISS to prevent aggressive scraping of exchange servers.

---

## 1. National Stock Exchange of India (NSE) Bhavcopy

* **Source**: National Stock Exchange of India Ltd. ([NSE India](https://www.nseindia.com)) — Capital Market (CM) Segment.
* **Format**: End-of-day official trading CSVs (`BhavCopy_NSE_CM_*.csv`).
* **Ingested Files**:
  * `BhavCopy_NSE_CM_0_0_0_20260424_F_0000.csv` (Trading Date: 24-Apr-2026)
  * `BhavCopy_NSE_CM_0_0_0_20260427_F_0000.csv` (Trading Date: 27-Apr-2026)
  * `BhavCopy_NSE_CM_0_0_0_20260428_F_0000.csv` (Trading Date: 28-Apr-2026)
  * `BhavCopy_NSE_CM_0_0_0_20260429_F_0000.csv` (Trading Date: 29-Apr-2026)
* **Fields Captured**:
  * `trad_dt`: Trade Date
  * `tckr_symb`: Ticker Symbol (e.g. `RELIANCE`, `TCS`, `INFY`)
  * `isin`: International Securities Identification Number
  * `fin_instrm_nm`: Full Company / Security Name
  * `cls_pric`: Closing Price
  * `prvs_clsg_pric`: Previous Closing Price
  * `ttl_tradg_vol`: Total Traded Volume (Shares)
  * `ttl_trf_val`: Total Turnover Value (INR)
  * `scty_srs`: Security Series (e.g. `EQ`, `BE`, `GB`)
* **Usage & Storage**:
  * Parsed and loaded into the MySQL `api_bhavcopy` table via `python manage.py load_market_data`.
  * Queried locally by the `fundamentals_lookup` tool.
  * Clearly marked as historical/stale with exact trade timestamps.
* **License & Terms**:
  * Publicly distributed daily market report published by NSE for investors and market participants.
  * Used for educational and research purposes during the hackathon.

---

## 2. Regulatory Corporate Disclosures & Filings

Official statutory disclosures filed by listed entities with BSE / NSE under SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015.

### Document 1: `rag_1.pdf`
* **Title**: Reliance Industries Limited — Audited Financial Results (Consolidated and Standalone) for the Quarter and Year Ended 31st March, 2026.
* **Filing Date / Timestamp**: `2026-04-24T18:00:00+05:30`
* **Source**: BSE/NSE Regulatory Filings — Reliance Industries Limited ([RIL Investor Relations](https://www.ril.com)).
* **Content**: Independent Auditor's Report (Deloitte Haskins & Sells LLP), Audited Consolidated & Standalone Balance Sheets, Statements of Profit and Loss, Cash Flow Statements, and Segment Performance (Jio, Retail, Oil-to-Chemicals, Oil & Gas).
* **Processing**: Extracted page-by-page (37 pages), chunked, and embedded into FAISS index.

### Document 2: `RAG_2.pdf`
* **Title**: Reliance Industries Limited — Transcript of Discussion on Audited Financial Results (Consolidated & Standalone) for Q4 & FY 2025-26.
* **Concall Date / Timestamp**: `2026-04-24T20:30:00+05:30`
* **Source**: Investor Relations Concall Transcript — Reliance Industries Limited.
* **Content**: Management commentary by leadership (Srini, V. Srikanth, Kiran Thomas, Gaurav Jain) regarding retail store expansion, 5G monetization, petrochemical margins, and guidance.
* **Processing**: Extracted page-by-page (31 pages) and indexed into FAISS.

### Document 3: `RAG_3.pdf`
* **Title**: Reliance Industries Limited — Financial Results Presentation (FY 2025-26 / Q4 FY 2025-26).
* **Presentation Date / Timestamp**: `2026-04-24T17:30:00+05:30`
* **Source**: Official Investor Presentation filed with BSE/NSE.
* **Content**: Segment EBITDA breakdowns, capex progression, balance sheet leverage, and operating highlights.
* **Processing**: Extracted page-by-page (72 pages) and indexed into FAISS.

### Document 4: `RIL_Annual_Report_FY24.pdf`
* **Title**: Reliance Industries Limited — Integrated Annual Report FY 2023-24.
* **Filing Date / Timestamp**: `2024-08-07T12:00:00+05:30`
* **Source**: Official Annual Statutory Filing submitted to BSE/NSE.
* **Content**: Management's Discussion and Analysis (MD&A), Independent Auditor's Report, Standalone & Consolidated Financial Statements for FY 2023-24.
* **Processing**: Extracted page-by-page (181 pages) and indexed into FAISS.

### Document 5: `RIL_Annual_Report_FY23.pdf`
* **Title**: Reliance Industries Limited — Integrated Annual Report FY 2022-23.
* **Filing Date / Timestamp**: `2023-08-05T12:00:00+05:30`
* **Source**: Official Annual Statutory Filing submitted to BSE/NSE.
* **Content**: Management's Discussion and Analysis (MD&A), Independent Auditor's Report, Standalone & Consolidated Financial Statements for FY 2022-23.
* **Processing**: Extracted page-by-page (320 pages) and indexed into FAISS.

### Document 6: `RIL_Concall_Transcript_Q4_FY24.pdf`
* **Title**: Reliance Industries Limited — Q4 FY 2023-24 Earnings Call Transcript.
* **Concall Date / Timestamp**: `2024-04-22T20:30:00+05:30`
* **Source**: BSE India Corporate Announcements / RIL Investor Relations.
* **Content**: Management review of full-year FY24 performance, retail segment profitability, O2C demand trends, and capital allocation.

### Document 7: `RIL_Concall_Transcript_Q3_FY24.pdf`
* **Title**: Reliance Industries Limited — Q3 FY 2023-24 Earnings Call Transcript.
* **Concall Date / Timestamp**: `2024-01-19T20:30:00+05:30`
* **Source**: BSE India Corporate Announcements / RIL Investor Relations.
* **Content**: Detailed executive commentary on True 5G capex rollout and subscriber migration (tested in benchmark question 14).

### Document 8: `RIL_Concall_Transcript_Q4_FY23.pdf`
* **Title**: Reliance Industries Limited — Q4 FY 2022-23 Earnings Call Transcript.
* **Concall Date / Timestamp**: `2023-04-21T20:30:00+05:30`
* **Source**: BSE India Corporate Announcements / RIL Investor Relations.
* **Content**: Management discussion on FY23 operating margins, Jio 5G launch phases, and energy transition progress.

---

## 3. FinQA Financial Reasoning Benchmark Dataset

* **Source**: *FinQA: A Dataset of Numerical Reasoning over Financial Data* (Chen et al., EMNLP 2021).
* **Files**: `dev.json`, `test.json`, `private_test.json` (Reference sets).
* **Optimization Note**: The 80.1 MB raw model-training split (`train.json`) was pruned from the repository footprint as the system operates via agentic RAG and deterministic tools without training weights. The 20-question evaluation benchmark is packaged in `backend/evals/questions.json`.
* **License**: MIT License / Open Academic Research License.
* **Purpose**:
  * Ground-truth evaluation set for evaluating whether financial questions requiring multi-step arithmetic are executed using deterministic tools (`financial_calculator`) rather than hallucinatory LLM math.
  * Verified to ensure adherence to AGENTS.md Section 1: "The LLM handles language. Tools handle facts, math, and decisions."

---

## 4. Timestamps & Traceability Policy

Every number, fact, and citation returned by the system includes:
1. **Source**: Explicit document name or database table.
2. **Locator**: Exact page number or section.
3. **Timestamp**: ISO 8601 formatted timestamp recording when the data was filed, traded, or calculated.
4. **Staleness Flag**: Stored market records older than the current session are explicitly flagged as stale with context.
