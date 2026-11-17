"""
SafeSight AI -- Milestone 3: ChromaDB Vector Store Service
Integrates ChromaDB for storing and retrieving document embeddings,
maintaining document names, page numbers, and chunk references.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings

from backend.config import CHROMA_DB_DIR, KNOWLEDGE_BASE_DIR

logger = logging.getLogger(__name__)

COLLECTION_NAME = "safesight_documents"


class ChromaVectorStore:
    def __init__(self, persist_dir: Path = CHROMA_DB_DIR):
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self._client: Optional[chromadb.ClientAPI] = None
        self._collection = None
        self._init_client()

    def _init_client(self):
        try:
            self._client = chromadb.PersistentClient(
                path=str(self.persist_dir),
                settings=Settings(anonymized_telemetry=False)
            )
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"description": "SafeSight AI workplace safety policies and audit manuals"}
            )
            logger.info("ChromaDB initialized. Existing vectors: %d", self._collection.count())
        except Exception as exc:
            logger.error("Failed to initialize ChromaDB: %s", exc)
            self._client = None
            self._collection = None

    def count(self) -> int:
        if self._collection is None:
            return 0
        try:
            return self._collection.count()
        except Exception:
            return 0

    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: Optional[Any] = None):
        """
        Add chunks with metadata (filename, page, doc_id, chunk_index) into ChromaDB.
        embeddings: optional pre-calculated numpy array of embeddings.
        """
        if self._collection is None or not chunks:
            return

        ids = [str(c['chunk_id']) for c in chunks]
        documents = [c['text'] for c in chunks]
        metadatas = [
            {
                'doc_id': str(c.get('doc_id', '')),
                'filename': str(c.get('filename', '')),
                'page': int(c.get('page', 1)),
                'chunk_index': int(c.get('chunk_index', 0)),
                'word_count': int(c.get('word_count', len(c['text'].split()))),
            }
            for c in chunks
        ]

        kwargs: Dict[str, Any] = {
            'ids': ids,
            'documents': documents,
            'metadatas': metadatas,
        }
        if embeddings is not None:
            kwargs['embeddings'] = [e.tolist() if hasattr(e, 'tolist') else list(e) for e in embeddings]

        self._collection.upsert(**kwargs)
        logger.info("ChromaDB: upserted %d chunks into '%s'", len(chunks), COLLECTION_NAME)

    def search(self, query_text: str, query_embedding: Optional[Any] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Query ChromaDB for relevant document passages.
        Returns list of structured records with score, filename, page, and passage.
        """
        if self._collection is None or self.count() == 0:
            return []

        limit = min(top_k, self.count())
        if limit <= 0:
            return []

        kwargs: Dict[str, Any] = {
            'n_results': limit,
            'include': ['documents', 'metadatas', 'distances'],
        }

        if query_embedding is None and query_text:
            try:
                from backend.services.document_service import embedding_model
                query_embedding = embedding_model.encode([query_text])[0]
            except Exception as e:
                logger.warning("Could not encode query text: %s", e)

        if query_embedding is not None:
            emb = query_embedding.tolist() if hasattr(query_embedding, 'tolist') else list(query_embedding)
            kwargs['query_embeddings'] = [emb]
        else:
            kwargs['query_texts'] = [query_text]

        try:
            results = self._collection.query(**kwargs)
        except Exception as exc:
            logger.error("ChromaDB query failed: %s", exc)
            return []

        formatted: List[Dict[str, Any]] = []
        if not results or not results.get('ids') or not results['ids'][0]:
            return formatted

        ids = results['ids'][0]
        docs = results['documents'][0] if results.get('documents') else []
        metas = results['metadatas'][0] if results.get('metadatas') else []
        distances = results['distances'][0] if results.get('distances') else []

        for i in range(len(ids)):
            meta = metas[i] if i < len(metas) else {}
            dist = distances[i] if i < len(distances) else 1.0
            relevance = float(1.0 / (1.0 + max(0.0, float(dist))))

            formatted.append({
                'chunk_id': ids[i],
                'doc_id': meta.get('doc_id', ''),
                'filename': meta.get('filename', 'Unknown Document'),
                'page': meta.get('page', 1),
                'chunk_index': meta.get('chunk_index', 0),
                'text': docs[i] if i < len(docs) else '',
                'score': round(relevance, 4),
            })

        return formatted

    def delete_document(self, doc_id: str):
        """Remove all chunks belonging to doc_id."""
        if self._collection is None:
            return
        try:
            self._collection.delete(where={"doc_id": doc_id})
            logger.info("ChromaDB: deleted document chunks for doc_id=%s", doc_id)
        except Exception as exc:
            logger.warning("ChromaDB deletion failed for doc_id=%s: %s", doc_id, exc)

    def sync_from_json(self):
        """
        Synchronizes existing metadata.json chunks into ChromaDB on startup if ChromaDB is empty.
        Ensures existing Milestone 2 documents are immediately searchable in ChromaDB.
        """
        import json
        meta_file = KNOWLEDGE_BASE_DIR / 'metadata.json'
        if not meta_file.exists():
            return

        try:
            chunks = json.loads(meta_file.read_text(encoding='utf-8'))
            if not chunks:
                return

            if self.count() < len(chunks):
                from backend.services.document_service import embedding_model
                texts = [c['text'] for c in chunks]
                embs = embedding_model.encode(texts)
                self.add_chunks(chunks, embeddings=embs)
                logger.info("ChromaDB synced %d chunks from existing metadata.json", len(chunks))
        except Exception as exc:
            logger.warning("Could not sync metadata.json to ChromaDB: %s", exc)


chroma_store = ChromaVectorStore()
try:
    chroma_store.sync_from_json()
except Exception as e:
    logger.warning("ChromaDB initial sync note: %s", e)
