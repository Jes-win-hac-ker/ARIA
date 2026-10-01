"""
Document loader and chunker for ARIA RAG pipeline (AGENTS.md section 1 & 5).
Implements Graceful Degradation:
- Tier 1: IBM Docling (DocumentConverter) for rich structural, Markdown, and tabular parsing.
- Tier 2: PyPDF for high-speed, lightweight deterministic fallback when Docling is absent or resource-constrained.
Every retrieved chunk carries document name, page locator, snippet, source, and filing timestamp.
"""
import glob
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Check Docling availability
try:
    from docling.document_converter import DocumentConverter
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False

# Check PyPDF availability
try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pypdf = None
    PYPDF_AVAILABLE = False


# Document catalog with canonical titles, sources, and filing dates
KNOWN_DOCUMENTS = {
    'rag_1.pdf': {
        'title': 'Reliance Industries Limited - Audited Financial Results (Consolidated & Standalone) FY2025-26',
        'source': 'BSE/NSE Regulatory Filing - Reliance Industries Limited',
        'timestamp': '2026-04-24T18:00:00+05:30',
        'doc_type': 'Audited Financial Statements',
    },
    'RAG_2.pdf': {
        'title': 'Reliance Industries Limited - Earnings Call Discussion Transcript Q4 & FY2025-26',
        'source': 'Investor Relations Concall Transcript - Reliance Industries Limited',
        'timestamp': '2026-04-24T20:30:00+05:30',
        'doc_type': 'Earnings Call Transcript',
    },
    'RAG_3.pdf': {
        'title': 'Reliance Industries Limited - Financial Results Investor Presentation FY2025-26',
        'source': 'Investor Presentation - Reliance Industries Limited',
        'timestamp': '2026-04-24T17:30:00+05:30',
        'doc_type': 'Investor Presentation',
    },
    'RIL_Annual_Report_FY24.pdf': {
        'title': 'Reliance Industries Limited - Integrated Annual Report FY 2023-24',
        'source': 'BSE/NSE Annual Regulatory Filing - Reliance Industries Limited',
        'timestamp': '2024-08-07T12:00:00+05:30',
        'doc_type': 'Annual Report (MD&A & Financial Statements)',
    },
    'RIL_Annual_Report_FY23.pdf': {
        'title': 'Reliance Industries Limited - Integrated Annual Report FY 2022-23',
        'source': 'BSE/NSE Annual Regulatory Filing - Reliance Industries Limited',
        'timestamp': '2023-08-05T12:00:00+05:30',
        'doc_type': 'Annual Report (MD&A & Financial Statements)',
    },
    'RIL_Concall_Transcript_Q4_FY24.pdf': {
        'title': 'Reliance Industries Limited - Earnings Call Discussion Transcript Q4 & FY 2023-24',
        'source': 'Investor Relations Concall Transcript - Reliance Industries Limited',
        'timestamp': '2024-04-22T20:30:00+05:30',
        'doc_type': 'Earnings Call Transcript',
    },
    'RIL_Concall_Transcript_Q3_FY24.pdf': {
        'title': 'Reliance Industries Limited - Earnings Call Discussion Transcript Q3 FY 2023-24',
        'source': 'Investor Relations Concall Transcript - Reliance Industries Limited',
        'timestamp': '2024-01-19T20:30:00+05:30',
        'doc_type': 'Earnings Call Transcript',
    },
    'RIL_Concall_Transcript_Q4_FY23.pdf': {
        'title': 'Reliance Industries Limited - Earnings Call Discussion Transcript Q4 & FY 2022-23',
        'source': 'Investor Relations Concall Transcript - Reliance Industries Limited',
        'timestamp': '2023-04-21T20:30:00+05:30',
        'doc_type': 'Earnings Call Transcript',
    },
}


def _split_into_windows(
    clean_text: str,
    filename: str,
    page_num: int,
    meta: dict[str, Any],
    parser_name: str,
    chunk_size: int = 700,
    chunk_overlap: int = 150,
) -> list[dict[str, Any]]:
    """Helper to partition text into overlapping passage windows with citation metadata."""
    chunks = []
    text_len = len(clean_text)
    start = 0
    chunk_idx = 0

    while start < text_len:
        end = min(start + chunk_size, text_len)
        if end < text_len:
            next_space = clean_text.rfind(' ', start, end)
            if next_space > start + (chunk_size // 2):
                end = next_space

        snippet = clean_text[start:end].strip()
        if len(snippet) > 40:
            chunk_id = f"{filename}_p{page_num}_c{chunk_idx}"
            chunks.append({
                'chunk_id': chunk_id,
                'document': filename,
                'title': meta['title'],
                'page': page_num,
                'locator': f"Page {page_num}",
                'snippet': snippet,
                'source': meta['source'],
                'timestamp': meta['timestamp'],
                'doc_type': meta['doc_type'],
                'parser': parser_name,
            })
            chunk_idx += 1

        if end >= text_len:
            break
        start = end - chunk_overlap
        if start < 0:
            start = 0

    return chunks


def _extract_with_docling(
    pdf_path: str,
    filename: str,
    meta: dict[str, Any],
    chunk_size: int = 700,
    chunk_overlap: int = 150,
) -> list[dict[str, Any]]:
    """Primary Parser: IBM Docling for rich layout and table understanding."""
    if not DOCLING_AVAILABLE:
        raise ImportError("Docling is not installed.")

    converter = DocumentConverter()
    conv_result = converter.convert(pdf_path)
    doc = conv_result.document

    chunks = []
    # If doc provides structured items with provenance
    if hasattr(doc, 'iterate_items'):
        current_page = 1
        page_texts: dict[int, list[str]] = {}

        for item, _ in doc.iterate_items():
            text = item.text if hasattr(item, 'text') else str(item)
            page_no = 1
            if hasattr(item, 'prov') and item.prov:
                page_no = getattr(item.prov[0], 'page_no', current_page)
            current_page = page_no
            page_texts.setdefault(page_no, []).append(text)

        for page_no, text_list in page_texts.items():
            full_page_text = ' '.join(' '.join(text_list).split())
            if full_page_text:
                page_chunks = _split_into_windows(
                    full_page_text,
                    filename,
                    page_no,
                    meta,
                    parser_name='docling',
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )
                chunks.extend(page_chunks)
    else:
        # Markdown export fallback within Docling
        md_text = doc.export_to_markdown() if hasattr(doc, 'export_to_markdown') else str(doc)
        clean_text = ' '.join(md_text.split())
        chunks = _split_into_windows(
            clean_text,
            filename,
            page_num=1,
            meta=meta,
            parser_name='docling',
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    return chunks


def _extract_with_pypdf(
    pdf_path: str,
    filename: str,
    meta: dict[str, Any],
    chunk_size: int = 700,
    chunk_overlap: int = 150,
) -> list[dict[str, Any]]:
    """Fallback Parser: Fast, lightweight page-by-page extraction via PyPDF."""
    if not PYPDF_AVAILABLE or pypdf is None:
        return []

    chunks = []
    reader = pypdf.PdfReader(pdf_path)

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        page_text = page.extract_text() or ''
        clean_text = ' '.join(page_text.split())
        if not clean_text:
            continue

        page_chunks = _split_into_windows(
            clean_text,
            filename,
            page_num,
            meta,
            parser_name='pypdf',
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        chunks.extend(page_chunks)

    return chunks


def extract_chunks_from_pdf(
    pdf_path: str,
    chunk_size: int = 700,
    chunk_overlap: int = 150,
) -> list[dict[str, Any]]:
    """
    Extracts text and tables from a PDF using Graceful Degradation:
    1. Attempts Docling if installed for deep structural extraction.
    2. Falls back automatically to PyPDF if Docling is unavailable or fails.
    """
    filename = os.path.basename(pdf_path)
    meta = KNOWN_DOCUMENTS.get(
        filename,
        {
            'title': filename,
            'source': 'Corporate Filing / Financial Document',
            'timestamp': '2026-04-24T00:00:00+05:30',
            'doc_type': 'Financial Document',
        },
    )

    # Tier 1: Try Docling
    if DOCLING_AVAILABLE:
        try:
            chunks = _extract_with_docling(
                pdf_path, filename, meta, chunk_size=chunk_size, chunk_overlap=chunk_overlap
            )
            if chunks:
                return chunks
        except Exception as exc:
            logger.warning("Docling extraction failed for %s (%s). Falling back to PyPDF.", filename, exc)

    # Tier 2: Fallback to PyPDF
    try:
        return _extract_with_pypdf(
            pdf_path, filename, meta, chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
    except Exception as exc:
        logger.error("PyPDF fallback failed for %s: %s", filename, exc)
        return []


def load_all_corpus_chunks(data_dir: str) -> list[dict[str, Any]]:
    """Scan data directory and return all extracted text chunks across filings."""
    all_chunks = []
    pdf_files = sorted(glob.glob(os.path.join(data_dir, '*.pdf')))
    pdf_files.extend(sorted(glob.glob(os.path.join(data_dir, '*.PDF'))))

    seen_files = set()
    unique_pdfs = []
    for p in pdf_files:
        norm = os.path.normcase(os.path.abspath(p))
        if norm not in seen_files:
            seen_files.add(norm)
            unique_pdfs.append(p)

    for pdf_path in unique_pdfs:
        chunks = extract_chunks_from_pdf(pdf_path)
        all_chunks.extend(chunks)

    return all_chunks
