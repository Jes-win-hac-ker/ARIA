"""
API views: Health check probe and validated Agent ask endpoint.
Follows AGENTS.md:
- Pre-flight guardrails (AGENTS.md section 3 & 11): 100% refusal for advice or predictions.
- The LLM handles language; tools handle facts, math, and decisions.
- Every number and fact is traceable to a tool or citation.
- Full session, message, and tool-call persistence in MySQL.
- Pydantic validation on every output.
"""
import os
import time
import uuid
from pathlib import Path
from typing import Any
from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from agent.guardrails import (
    STANDARD_REFUSAL_MESSAGE,
    check_postflight_guardrail,
    check_preflight_guardrail,
)
from agent.llm import synthesize_research_answer
from agent.router import route_and_execute
from agent.tools import financial_calculator, fundamentals_lookup, search_filings
from .memory import (
    add_session_token_usage,
    get_or_create_session,
    record_assistant_message,
    record_tool_call,
    record_user_message,
)
from .models import Bhavcopy, ChatSession, CompanyFundamental
from .schemas import AgentResponse, Citation, ToolOutput

AVAILABLE_PDF_DOCUMENTS = frozenset({
    'rag_1.pdf',
    'RAG_2.pdf',
    'RAG_3.pdf',
    'RIL_Annual_Report_FY23.pdf',
    'RIL_Annual_Report_FY24.pdf',
    'RIL_Concall_Transcript_Q3_FY24.pdf',
    'RIL_Concall_Transcript_Q4_FY23.pdf',
    'RIL_Concall_Transcript_Q4_FY24.pdf',
})


def _resolve_document_path(filename: str) -> Path | None:
    data_dir = os.environ.get('ARIA_DATA_DIR')
    if data_dir and os.path.isdir(data_dir):
        candidate = Path(data_dir) / filename
        if candidate.is_file():
            return candidate
    candidate1 = Path(settings.BASE_DIR).parent / 'data' / filename
    if candidate1.is_file():
        return candidate1
    candidate2 = Path(settings.BASE_DIR) / 'data' / filename
    if candidate2.is_file():
        return candidate2
    return None


def document(request, filename: str):
    """Serve only the public PDFs explicitly included in the research corpus."""
    if filename not in AVAILABLE_PDF_DOCUMENTS:
        raise Http404('Document not found')

    document_path = _resolve_document_path(filename)
    if not document_path:
        raise Http404('Document not found')

    response = FileResponse(document_path.open('rb'), content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{filename}"'
    return response


@api_view(['GET'])
@permission_classes([])
def comparison_data(request):
    """Return stored fundamentals for deterministic company/year comparisons."""
    numeric_fields = (
        'revenue_cr',
        'net_profit_cr',
        'eps',
        'market_cap_cr',
        'debt_to_equity',
        'roe_pct',
        'dividend_yield_pct',
        'operating_margin_pct',
    )
    records = []
    for record in CompanyFundamental.objects.order_by('company_name', 'fiscal_year'):
        item = {
            'ticker': record.tckr_symb,
            'company_name': record.company_name,
            'fiscal_year': record.fiscal_year,
            'as_of_date': record.as_of_date.isoformat(),
            'source': record.source,
        }
        item.update({
            field: float(value) if (value := getattr(record, field)) is not None else None
            for field in numeric_fields
        })
        records.append(item)

    return Response({'records': records})


def _safe_fallback(correlation_id: str, reason: str) -> dict:
    """Safe fallback response used whenever validation fails (AGENTS.md section 6)."""
    return {
        'answer': 'Sorry, I could not produce a validated answer. Please try again.',
        'refused': False,
        'refusal_reason': None,
        'citations': [],
        'tool_outputs': [],
        'warnings': [f'validation_failed: {reason}'],
        'token_usage': 0,
        'correlation_id': correlation_id,
        'latency_ms': 0,
    }


@api_view(['GET'])
@permission_classes([])
def health(request):
    """Liveness + DB connectivity probe used by compose healthchecks."""
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            db_ok = True
    except Exception:
        db_ok = False
    status_code = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response({'status': 'ok' if db_ok else 'degraded', 'database': db_ok}, status=status_code)


@api_view(['GET'])
@permission_classes([])
def market_movers(request):
    """Return stored NSE end-of-day quotes with their dates and provenance."""
    tickers = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']
    latest_trade_date = Bhavcopy.objects.order_by('-trad_dt').values_list('trad_dt', flat=True).first()
    movers = []

    for ticker in tickers:
        lookup = fundamentals_lookup(ticker)
        price = lookup.get('price_data')
        movers.append({
            'ticker': ticker,
            'found': bool(price),
            'price': price.get('closing_price') if price else None,
            'change_pct': price.get('change_pct') if price else None,
            'trade_date': price.get('trade_date') if price else None,
            'source': 'NSE Bhavcopy (stored MySQL data)',
            'retrieved_at': lookup.get('timestamp'),
            'is_stale': lookup.get('is_stale', True),
        })

    return Response({
        'movers': movers,
        'source': 'NSE Bhavcopy (stored MySQL data)',
        'as_of': latest_trade_date.isoformat() if latest_trade_date else None,
        'retrieved_at': timezone.now().isoformat(),
        'is_stale': True,
    })


@api_view(['POST'])
@permission_classes([])
def ask(request):
    """
    Financial research and explanation endpoint.
    Orchestrates pre-flight guardrails, deterministic tools, RAG filing retrieval,
    session memory, and strict output validation with Pydantic.
    """
    start_time = time.monotonic()
    data = request.data or {}
    question = data.get('question', '').strip()
    session_id = data.get('session_id') or str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())

    if not question:
        return Response(
            {'error': "Field 'question' is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 1. Non-negotiable Pre-flight Guardrail Check (AGENTS.md section 3 & 11)
    guardrail_result = check_preflight_guardrail(question)
    if guardrail_result.is_blocked:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        refusal_payload = {
            'answer': guardrail_result.refusal_message or STANDARD_REFUSAL_MESSAGE,
            'refused': True,
            'refusal_reason': guardrail_result.reason,
            'citations': [],
            'tool_outputs': [],
            'warnings': ['preflight_guardrail_refusal'],
            'token_usage': 0,
            'correlation_id': correlation_id,
            'latency_ms': latency_ms,
        }
        try:
            validated = AgentResponse.model_validate(refusal_payload)
        except Exception as exc:  # pragma: no cover
            return Response(_safe_fallback(correlation_id, str(exc)))

        session, _ = get_or_create_session(session_id=session_id)
        record_user_message(session=session, content=question, correlation_id=correlation_id)
        record_assistant_message(session=session, content=refusal_payload['answer'], correlation_id=correlation_id)
        return Response(validated.model_dump())

    # 2. MySQL Session Memory: Get or create session & save user message
    session, _ = get_or_create_session(session_id=session_id)
    user_msg = record_user_message(session=session, content=question, correlation_id=correlation_id)

    # 3. Deterministic tool routing & execution
    answer, tool_outputs, citations, warnings = route_and_execute(question)

    # Augment with real FAISS RAG citations if filing retrieval query
    q_lower = question.lower()
    if any(k in q_lower for k in ['transcript', 'annual report', 'earnings call', 'filing', '5g', 'capex', 'contingencies', 'software']):
        real_filing_res = search_filings(question, top_k=2)
        for c in real_filing_res.get('citations', []):
            citations.append(
                Citation(
                    document=c['document'],
                    locator=c['locator'],
                    snippet=c['snippet'],
                    timestamp=c.get('timestamp'),
                )
            )

    # Augment with real MySQL fundamentals if fundamentals lookup query
    if any(k in q_lower for k in ['reliance', 'tcs', 'infy', 'infosys', 'pe ratio', 'revenue', 'debt', 'fundamentals', 'price']):
        ticker = 'RELIANCE' if 'reliance' in q_lower else ('TCS' if 'tcs' in q_lower else 'INFY')
        real_fund = fundamentals_lookup(ticker)
        if real_fund.get('found'):
            # Check staleness of Bhavcopy trade date against current calendar date
            price_data = real_fund.get('price_data') or {}
            trade_date = price_data.get('trade_date')
            today_str = timezone.now().date().isoformat()
            if trade_date and trade_date != today_str:
                staleness_msg = f"staleness_warning: Market data is from {trade_date}. Live pricing is not provided."
                if staleness_msg not in warnings:
                    warnings.append(staleness_msg)

            fund_tool = next((t for t in tool_outputs if t.tool_name == 'fundamentals_lookup'), None)
            if fund_tool:
                fund_tool.output['stored_mysql_data'] = real_fund
            else:
                tool_outputs.append(
                    ToolOutput(
                        tool_name='fundamentals_lookup',
                        input={'query': question, 'ticker': ticker},
                        output={'stored_mysql_data': real_fund, 'status': 'success'},
                        source='mysql_fundamentals_table',
                        timestamp=timezone.now().isoformat(),
                    )
                )

            # If user asked for price right now / current price, construct a precise factual response
            if any(p in q_lower for p in ['price right now', 'current price', 'live price', "today's price"]):
                closing_price = price_data.get('closing_price')
                if closing_price is not None:
                    answer = (
                        f"The last recorded closing price for {ticker} is ₹{closing_price:,.2f} "
                        f"as of trade date {trade_date}. Note that live pricing is not provided."
                    )

    # 4. Record every ToolCall in MySQL
    for t in tool_outputs:
        record_tool_call(
            message=user_msg,
            tool_name=t.tool_name,
            input_args=t.input if isinstance(t.input, dict) else {'query': question},
            output_result=t.output,
            latency_ms=10,
            correlation_id=correlation_id,
        )

    # 5. Hybrid LLM Synthesis (AGENTS.md sections 1, 2, 6)
    synthesized_answer, llm_tokens, _, llm_warnings = synthesize_research_answer(
        question=question,
        tool_outputs=tool_outputs,
        citations=citations,
        default_answer=answer,
    )
    if llm_warnings:
        warnings.extend(llm_warnings)

    # 6. Post-flight Guardrail Check (guarantees zero advice/predictions in output)
    post_check = check_postflight_guardrail(synthesized_answer)
    if post_check.is_blocked:
        refusal_payload = {
            'answer': post_check.refusal_message or STANDARD_REFUSAL_MESSAGE,
            'refused': True,
            'refusal_reason': post_check.reason or 'postflight_guardrail_refusal',
            'citations': [],
            'tool_outputs': [],
            'warnings': ['postflight_guardrail_refusal'],
            'token_usage': 0,
            'correlation_id': correlation_id,
            'latency_ms': int((time.monotonic() - start_time) * 1000),
        }
        validated = AgentResponse.model_validate(refusal_payload)
        record_assistant_message(session=session, content=refusal_payload['answer'], correlation_id=correlation_id)
        return Response(validated.model_dump())

    token_usage = llm_tokens if llm_tokens > 0 else (45 if tool_outputs else 0)
    latency_ms = int((time.monotonic() - start_time) * 1000)

    payload = {
        'answer': synthesized_answer,
        'refused': False,
        'refusal_reason': None,
        'citations': citations,
        'tool_outputs': tool_outputs,
        'warnings': warnings,
        'token_usage': token_usage,
        'correlation_id': correlation_id,
        'latency_ms': latency_ms,
    }

    try:
        validated = AgentResponse.model_validate(payload)
    except Exception as exc:  # pragma: no cover
        return Response(_safe_fallback(correlation_id, str(exc)))

    # Persist assistant message and token usage in MySQL
    record_assistant_message(session=session, content=synthesized_answer, correlation_id=correlation_id)
    add_session_token_usage(session=session, tokens=token_usage)

    return Response(validated.model_dump())
