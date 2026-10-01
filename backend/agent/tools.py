"""
Deterministic tools for ARIA agent (AGENTS.md sections 1, 3, 5).

Tools handle facts, math, and decisions. The LLM handles language only.
All arithmetic is performed deterministically here; no arithmetic in the LLM.
All queries return explicit sources and ISO timestamps.
"""
import ast
import operator
from datetime import datetime
from decimal import Decimal
from typing import Any
from django.utils import timezone
from api.models import Bhavcopy, CompanyFundamental


# ============================================================
# 1. Filing Retrieval Tool (AGENTS.md section 5)
# ============================================================

def search_filings(query: str, top_k: int = 4) -> dict[str, Any]:
    """
    Search annual reports, earnings call transcripts, and corporate filings.

    Returns structured citations with document name, locator (page),
    snippet, source, and timestamp.
    """
    try:
        from rag.vector_store import get_vector_store
        store = get_vector_store()
        raw_results = store.search(query, top_k=top_k) if store else []
    except Exception:
        raw_results = []

    citations = []
    for r in raw_results:
        citations.append({
            'document': r.get('document', 'Unknown Document'),
            'locator': r.get('locator', 'Page 1'),
            'snippet': r.get('snippet', ''),
            'source': r.get('source', 'Corporate Filing / Official Disclosure'),
            'timestamp': r.get('timestamp', timezone.now().isoformat()),
            'doc_type': r.get('doc_type', 'Regulatory Filing'),
        })

    return {
        'tool_name': 'search_filings',
        'query': query,
        'count': len(citations),
        'citations': citations,
        'source': 'FAISS Vector Index over Official Corporate Filings',
        'timestamp': timezone.now().isoformat(),
    }


# ============================================================
# 2. Financial Calculator Tool (AGENTS.md sections 3 & 5)
# ============================================================

_SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def _safe_eval_node(node):
    """Safely evaluate AST arithmetic expressions without python eval."""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value)}")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _SAFE_OPERATORS:
            raise ValueError(f"Unsupported operator: {op_type}")
        left = _safe_eval_node(node.left)
        right = _safe_eval_node(node.right)
        if op_type is ast.Div and right == 0:
            raise ZeroDivisionError("Division by zero in formula evaluation.")
        if op_type is ast.Pow and (right > 100 or left > 1e12):
            raise OverflowError("Exponentiation exceeds safety limits.")
        return _SAFE_OPERATORS[op_type](left, right)
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _SAFE_OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type}")
        operand = _safe_eval_node(node.operand)
        return _SAFE_OPERATORS[op_type](operand)
    else:
        raise ValueError(f"Unsupported expression node: {type(node)}")


def financial_calculator(operation: str, **kwargs) -> dict[str, Any]:
    """
    Perform all arithmetic and ratio computations deterministically.
    The LLM must never calculate ratios, growth rates, margins, or formulas directly.
    """
    op = operation.lower().strip()
    result = None
    formula = ""
    formatted_result = ""

    try:
        if op in ('net_profit_margin', 'profit_margin'):
            net_profit = float(kwargs['net_profit'])
            revenue = float(kwargs['revenue'])
            if revenue == 0:
                raise ZeroDivisionError("Revenue cannot be zero.")
            val = (net_profit / revenue) * 100.0
            result = round(val, 2)
            formula = f"({net_profit} / {revenue}) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('operating_margin', 'ebitda_margin'):
            operating_profit = float(kwargs.get('operating_profit') or kwargs.get('ebitda', 0))
            revenue = float(kwargs['revenue'])
            if revenue == 0:
                raise ZeroDivisionError("Revenue cannot be zero.")
            val = (operating_profit / revenue) * 100.0
            result = round(val, 2)
            formula = f"({operating_profit} / {revenue}) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('yoy_growth', 'growth_rate'):
            current = float(kwargs['current'])
            previous = float(kwargs['previous'])
            if previous == 0:
                raise ZeroDivisionError("Previous period base cannot be zero.")
            val = ((current - previous) / previous) * 100.0
            result = round(val, 2)
            formula = f"(({current} - {previous}) / {previous}) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('debt_to_equity', 'de_ratio'):
            total_debt = float(kwargs['total_debt'])
            total_equity = float(kwargs['total_equity'])
            if total_equity == 0:
                raise ZeroDivisionError("Total equity cannot be zero.")
            val = total_debt / total_equity
            result = round(val, 2)
            formula = f"{total_debt} / {total_equity} = {result}"
            formatted_result = str(result)

        elif op in ('pe_ratio', 'price_to_earnings'):
            price = float(kwargs['price'])
            eps = float(kwargs['eps'])
            if eps == 0:
                raise ZeroDivisionError("EPS cannot be zero.")
            val = price / eps
            result = round(val, 2)
            formula = f"{price} / {eps} = {result}"
            formatted_result = str(result)

        elif op in ('pb_ratio', 'price_to_book'):
            price = float(kwargs['price'])
            book_value = float(kwargs['book_value_per_share'])
            if book_value == 0:
                raise ZeroDivisionError("Book value per share cannot be zero.")
            val = price / book_value
            result = round(val, 2)
            formula = f"{price} / {book_value} = {result}"
            formatted_result = str(result)

        elif op in ('sector_exposure', 'exposure'):
            sector_value = float(kwargs['sector_value'])
            total_portfolio = float(kwargs['total_portfolio'])
            if total_portfolio == 0:
                raise ZeroDivisionError("Total portfolio value cannot be zero.")
            val = (sector_value / total_portfolio) * 100.0
            result = round(val, 2)
            formula = f"({sector_value} / {total_portfolio}) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('expense_ratio_comparison', 'expense_difference'):
            expense_a = float(kwargs['expense_a'])
            expense_b = float(kwargs['expense_b'])
            val = expense_a - expense_b
            result = round(val, 4)
            formula = f"{expense_a}% - {expense_b}% = {result}%"
            formatted_result = f"{result}%"

        elif op in ('portfolio_concentration', 'concentration'):
            top_holdings = float(kwargs['top_holdings_sum'])
            total_portfolio = float(kwargs['total_portfolio'])
            if total_portfolio == 0:
                raise ZeroDivisionError("Total portfolio value cannot be zero.")
            val = (top_holdings / total_portfolio) * 100.0
            result = round(val, 2)
            formula = f"({top_holdings} / {total_portfolio}) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('cagr', 'compound_annual_growth'):
            beginning_value = float(kwargs['beginning_value'])
            ending_value = float(kwargs['ending_value'])
            periods = float(kwargs['periods'])
            if beginning_value <= 0 or periods <= 0:
                raise ValueError("Beginning value and periods must be positive.")
            val = ((ending_value / beginning_value) ** (1.0 / periods) - 1.0) * 100.0
            result = round(val, 2)
            formula = f"(({ending_value} / {beginning_value}) ** (1 / {periods}) - 1) * 100 = {result}%"
            formatted_result = f"{result}%"

        elif op in ('expression', 'evaluate', 'math'):
            expr = str(kwargs.get('expression', '')).strip()
            if not expr:
                raise ValueError("Expression string is required.")
            parsed = ast.parse(expr, mode='eval')
            val = _safe_eval_node(parsed.body)
            result = round(float(val), 4) if isinstance(val, (int, float)) else val
            formula = f"{expr} = {result}"
            formatted_result = str(result)

        else:
            raise ValueError(f"Unknown operation: '{operation}'. Supported operations: net_profit_margin, operating_margin, yoy_growth, debt_to_equity, pe_ratio, pb_ratio, sector_exposure, expense_ratio_comparison, portfolio_concentration, cagr, expression.")

        return {
            'tool_name': 'financial_calculator',
            'operation': op,
            'result': result,
            'formatted_result': formatted_result,
            'formula': formula,
            'inputs': kwargs,
            'source': 'deterministic_financial_calculator',
            'timestamp': timezone.now().isoformat(),
        }

    except Exception as exc:
        return {
            'tool_name': 'financial_calculator',
            'operation': op,
            'error': str(exc),
            'inputs': kwargs,
            'source': 'deterministic_financial_calculator',
            'timestamp': timezone.now().isoformat(),
        }


# ============================================================
# 3. Fundamentals & Price Lookup Tool (AGENTS.md section 5)
# ============================================================

def fundamentals_lookup(ticker: str, trade_date: str = None) -> dict[str, Any]:
    """
    Return stored price and fundamental data from MySQL.
    Follows AGENTS.md:
    - Prefer stored MySQL data over live scraping.
    - Include source and timestamp.
    - Clearly mark stale data.
    """
    tckr = (ticker or '').strip().upper()
    if not tckr:
        return {
            'tool_name': 'fundamentals_lookup',
            'error': "Ticker symbol is required.",
            'source': 'MySQL Stored Market Data',
            'timestamp': timezone.now().isoformat(),
        }

    # 1. Query latest Bhavcopy price record
    bhav_query = Bhavcopy.objects.filter(tckr_symb=tckr)
    if trade_date:
        bhav_query = bhav_query.filter(trad_dt=trade_date)
    latest_bhav = bhav_query.order_by('-trad_dt').first()

    # 2. Query CompanyFundamental record
    fund = CompanyFundamental.objects.filter(tckr_symb=tckr).order_by('-as_of_date').first()

    if not latest_bhav and not fund:
        return {
            'tool_name': 'fundamentals_lookup',
            'ticker': tckr,
            'found': False,
            'message': f"No stored market data or fundamentals found for ticker '{tckr}' in MySQL database.",
            'source': 'MySQL Stored Market Data',
            'timestamp': timezone.now().isoformat(),
        }

    price_data = None
    is_stale = True
    staleness_note = "Historical stored data from NSE Bhavcopy."

    if latest_bhav:
        cls_p = float(latest_bhav.cls_pric)
        prv_p = float(latest_bhav.prvs_clsg_pric)
        chg = round(cls_p - prv_p, 2)
        chg_pct = round((chg / prv_p * 100.0), 2) if prv_p > 0 else 0.0

        # Mark staleness
        trade_dt_str = latest_bhav.trad_dt.strftime('%Y-%m-%d')
        staleness_note = f"Data as of trade date {trade_dt_str}. NSE Bhavcopy end-of-day record (Stored MySQL Cache)."

        price_data = {
            'trade_date': trade_dt_str,
            'closing_price': cls_p,
            'previous_close': prv_p,
            'change': chg,
            'change_pct': chg_pct,
            'volume': latest_bhav.ttl_tradg_vol,
            'turnover_val': float(latest_bhav.ttl_trf_val) if latest_bhav.ttl_trf_val else None,
            'isin': latest_bhav.isin,
            'security_series': latest_bhav.scty_srs,
        }

    fundamentals_data = None
    if fund:
        fundamentals_data = {
            'company_name': fund.company_name,
            'sector': fund.sector,
            'industry': fund.industry,
            'market_cap_cr': float(fund.market_cap_cr) if fund.market_cap_cr else None,
            'pe_ratio': float(fund.pe_ratio) if fund.pe_ratio else None,
            'pb_ratio': float(fund.pb_ratio) if fund.pb_ratio else None,
            'debt_to_equity': float(fund.debt_to_equity) if fund.debt_to_equity else None,
            'roe_pct': float(fund.roe_pct) if fund.roe_pct else None,
            'eps': float(fund.eps) if fund.eps else None,
            'dividend_yield_pct': float(fund.dividend_yield_pct) if fund.dividend_yield_pct else None,
            'revenue_cr': float(fund.revenue_cr) if fund.revenue_cr else None,
            'net_profit_cr': float(fund.net_profit_cr) if fund.net_profit_cr else None,
            'operating_margin_pct': float(fund.operating_margin_pct) if fund.operating_margin_pct else None,
            'fiscal_year': fund.fiscal_year,
            'as_of_date': fund.as_of_date.strftime('%Y-%m-%d'),
            'filing_source': fund.source,
        }

    company_name = (
        (fund.company_name if fund else None)
        or (latest_bhav.fin_instrm_nm if latest_bhav else None)
        or tckr
    )

    return {
        'tool_name': 'fundamentals_lookup',
        'ticker': tckr,
        'company_name': company_name,
        'found': True,
        'price_data': price_data,
        'fundamentals': fundamentals_data,
        'is_stale': is_stale,
        'staleness_note': staleness_note,
        'source': 'NSE Daily Bhavcopy & Official Corporate Filings (MySQL Stored)',
        'timestamp': timezone.now().isoformat(),
    }
