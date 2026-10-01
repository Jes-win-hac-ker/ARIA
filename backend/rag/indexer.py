"""
Document loader and chunker for ARIA RAG pipeline.
Extracts text from annual reports, concall transcripts, and filings with full citation metadata.
(AGENTS.md section 1 & 5).
"""
import os
import glob
from typing import Any
import pypdf

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
}


def extract_chunks_from_pdf(
    pdf_path: str,
    chunk_size: int = 700,
    chunk_overlap: int = 150,
) -> list[dict[str, Any]]:
    """
    Extracts text page-by-page from a PDF and splits it into chunks
    while preserving page numbers, document name, source, and timestamps.
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

    chunks = []
    try:
        reader = pypdf.PdfReader(pdf_path)
    except Exception as exc:
        print(f"Error reading PDF {pdf_path}: {exc}")
        return []

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        page_text = page.extract_text() or ''
        clean_text = ' '.join(page_text.split())
        if not clean_text:
            continue

        # Split into overlapping windows
        start = 0
        text_len = len(clean_text)
        chunk_idx = 0

        while start < text_len:
            end = min(start + chunk_size, text_len)
            # Find next space if not at end
            if end < text_len:
                next_space = clean_text.rfind(' ', start, end)
                if next_space > start + (chunk_size // 2):
                    end = next_space

            snippet = clean_text[start:end].strip()
            if len(snippet) > 40:  # Ignore tiny noise fragments
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
                })
                chunk_idx += 1

            if end >= text_len:
                break
            start = end - chunk_overlap
            if start < 0:
                start = 0

    return chunks


def load_all_corpus_chunks(data_dir: str) -> list[dict[str, Any]]:
    """Scan data directory and return all extracted text chunks."""
    all_chunks = []
    pdf_files = sorted(glob.glob(os.path.join(data_dir, '*.pdf')))
    pdf_files.extend(sorted(glob.glob(os.path.join(data_dir, '*.PDF'))))

    # Remove duplicates from case-insensitive match on Windows
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
