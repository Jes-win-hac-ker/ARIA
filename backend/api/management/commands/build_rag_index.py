"""
Django management command to build or rebuild the FAISS vector index from financial filings.
(AGENTS.md sections 1, 4, 5).
"""
import os
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from rag.indexer import load_all_corpus_chunks
from rag.vector_store import VectorStore


class Command(BaseCommand):
    help = 'Extracts text from domain PDFs in data/ and builds the FAISS vector index.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--data-dir',
            type=str,
            default=None,
            help='Directory containing PDF documents to index. Defaults to data/.',
        )
        parser.add_argument(
            '--persist-dir',
            type=str,
            default=None,
            help='Directory where FAISS index will be stored. Defaults to backend/rag/index_store/.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force rebuild even if index already exists.',
        )

    def handle(self, *args, **options):
        data_dir = options.get('data_dir')
        if not data_dir:
            data_dir = os.environ.get('ARIA_DATA_DIR')
        if not data_dir or not os.path.exists(data_dir):
            data_dir = str(settings.BASE_DIR.parent / 'data')
            if not os.path.exists(data_dir):
                data_dir = str(settings.BASE_DIR / 'data')

        persist_dir = options.get('persist_dir')
        if not persist_dir:
            persist_dir = str(settings.BASE_DIR / 'rag' / 'index_store')

        force = options.get('force', False)

        store = VectorStore()
        if not force and store.load(persist_dir):
            self.stdout.write(
                self.style.SUCCESS(
                    f'FAISS index already exists at {persist_dir} with {len(store.chunks)} chunks. Use --force to rebuild.'
                )
            )
            return

        self.stdout.write(f'Loading financial documents from: {data_dir}')
        chunks = load_all_corpus_chunks(data_dir)
        if not chunks:
            self.stdout.write(self.style.ERROR(f'No chunks extracted from {data_dir}.'))
            return

        self.stdout.write(f'Extracted {len(chunks)} chunks across filings and transcripts.')
        self.stdout.write(f'Building FAISS index in: {persist_dir}...')
        count = store.build(chunks, persist_dir)
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully built FAISS index with {count} chunks at {persist_dir}.'
            )
        )
