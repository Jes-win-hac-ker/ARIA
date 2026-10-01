"""
FAISS Vector Store and semantic retriever for ARIA (AGENTS.md sections 1, 4, 5).
Uses dense normalized TF-IDF representations indexed with FAISS IndexFlatIP.
Ensures zero-external-network-dependency, fast initialization, and deterministic retrieval.
"""
import json
import os
import pickle
from typing import Any

try:
    import faiss
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    faiss = None
    np = None
    TfidfVectorizer = None


class VectorStore:
    """FAISS-backed vector store for financial documents."""

    def __init__(self, dimension: int = 1024):
        self.dimension = dimension
        self.index = None
        self.chunks: list[dict[str, Any]] = []
        self.vectorizer = None
        self.is_initialized = False

    def build(self, chunks: list[dict[str, Any]], persist_dir: str) -> int:
        """Builds a FAISS index from chunks and persists index + metadata."""
        if not chunks:
            raise ValueError("No chunks provided to build vector index.")

        os.makedirs(persist_dir, exist_ok=True)
        texts = [c['snippet'] for c in chunks]

        # Fit TF-IDF model
        self.vectorizer = TfidfVectorizer(
            max_features=self.dimension,
            stop_words='english',
            sublinear_tf=True,
            ngram_range=(1, 2),
        )
        sparse_matrix = self.vectorizer.fit_transform(texts)
        dense_vectors = sparse_matrix.toarray().astype('float32')

        # If dimension of vocabulary is less than self.dimension, pad vectors
        actual_dim = dense_vectors.shape[1]
        if actual_dim < self.dimension:
            padding = np.zeros((dense_vectors.shape[0], self.dimension - actual_dim), dtype='float32')
            dense_vectors = np.hstack([dense_vectors, padding])

        # L2-normalize vectors for cosine similarity via inner product
        faiss.normalize_L2(dense_vectors)

        # Build IndexFlatIP
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(dense_vectors)
        self.chunks = chunks
        self.is_initialized = True

        # Persist index, metadata, and vectorizer
        index_file = os.path.join(persist_dir, 'faiss_index.bin')
        metadata_file = os.path.join(persist_dir, 'chunks_metadata.json')
        vectorizer_file = os.path.join(persist_dir, 'vectorizer.pkl')

        faiss.write_index(self.index, index_file)
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(self.chunks, f, ensure_ascii=False, indent=2)
        with open(vectorizer_file, 'wb') as f:
            pickle.dump(self.vectorizer, f)

        return len(chunks)

    def load(self, persist_dir: str) -> bool:
        """Loads index, metadata, and vectorizer from disk."""
        index_file = os.path.join(persist_dir, 'faiss_index.bin')
        metadata_file = os.path.join(persist_dir, 'chunks_metadata.json')
        vectorizer_file = os.path.join(persist_dir, 'vectorizer.pkl')

        if not (os.path.exists(index_file) and os.path.exists(metadata_file) and os.path.exists(vectorizer_file)):
            return False

        try:
            self.index = faiss.read_index(index_file)
            with open(metadata_file, 'r', encoding='utf-8') as f:
                self.chunks = json.load(f)
            with open(vectorizer_file, 'rb') as f:
                self.vectorizer = pickle.load(f)
            self.dimension = self.index.d
            self.is_initialized = True
            return True
        except Exception as exc:
            print(f"Failed to load vector store from {persist_dir}: {exc}")
            return False

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """
        Executes semantic vector search over filings and reports.
        Returns citations strictly formatted with document, locator, snippet, source, timestamp.
        """
        if not self.is_initialized or self.index is None or self.vectorizer is None:
            return []

        # Vectorize query
        sparse_q = self.vectorizer.transform([query])
        dense_q = sparse_q.toarray().astype('float32')

        actual_dim = dense_q.shape[1]
        if actual_dim < self.dimension:
            padding = np.zeros((1, self.dimension - actual_dim), dtype='float32')
            dense_q = np.hstack([dense_q, padding])

        faiss.normalize_L2(dense_q)

        # FAISS search
        k = min(top_k, len(self.chunks))
        if k <= 0:
            return []

        scores, indices = self.index.search(dense_q, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.chunks):
                continue
            chunk = self.chunks[idx].copy()
            chunk['score'] = float(score)
            results.append(chunk)

        # Fallback keyword boosting for precise financial domain matches
        query_words = set(query.lower().split())
        for item in results:
            text_lower = item['snippet'].lower()
            matches = sum(1 for w in query_words if len(w) > 3 and w in text_lower)
            item['relevance_boost'] = matches

        # Sort by combination of vector score and keyword matches
        results.sort(key=lambda x: (x.get('relevance_boost', 0) > 0, x['score']), reverse=True)
        return results[:top_k]


# Global singleton instance
_GLOBAL_STORE = None


def get_vector_store(persist_dir: str = None) -> VectorStore:
    """Returns singleton VectorStore instance, loading if necessary."""
    global _GLOBAL_STORE
    if _GLOBAL_STORE is not None and _GLOBAL_STORE.is_initialized:
        return _GLOBAL_STORE

    from django.conf import settings
    if persist_dir is None:
        persist_dir = getattr(settings, 'ARIA_FAISS_DIR', None)
    if persist_dir is None:
        persist_dir = str(settings.BASE_DIR / 'rag' / 'index_store')

    store = VectorStore()
    if store.load(persist_dir):
        _GLOBAL_STORE = store
    return store
