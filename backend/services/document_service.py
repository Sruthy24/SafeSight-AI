"""
SafeSight AI -- Milestone 2: Document Intelligence Service
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import unicodedata
import uuid
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

_fitz = None
_pytesseract = None
_Image = None
_SentenceTransformer = None
_faiss = None


def _import_fitz():
    global _fitz
    if _fitz is None:
        import fitz
        _fitz = fitz
    return _fitz


def _import_tesseract():
    global _pytesseract, _Image
    if _pytesseract is None:
        import pytesseract
        from PIL import Image
        _pytesseract = pytesseract
        _Image = Image
    return _pytesseract, _Image


def _import_sentence_transformers():
    global _SentenceTransformer
    if _SentenceTransformer is None:
        from sentence_transformers import SentenceTransformer
        _SentenceTransformer = SentenceTransformer
    return _SentenceTransformer


def _import_faiss():
    global _faiss
    if _faiss is None:
        import faiss
        _faiss = faiss
    return _faiss


def extract_text_from_pdf(file_path):
    fitz = _import_fitz()
    pages = []
    try:
        doc = fitz.open(str(file_path))
    except Exception as exc:
        raise RuntimeError(f"Cannot open PDF '{file_path}': {exc}") from exc
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if len(text.strip()) < 20:
            text = _ocr_page(page, page_num + 1)
        pages.append({'page': page_num + 1, 'text': text})
    doc.close()
    return pages


def extract_text_from_txt(file_path):
    try:
        text = Path(file_path).read_text(encoding='utf-8', errors='replace')
    except Exception as exc:
        raise RuntimeError(f"Cannot read text file '{file_path}': {exc}") from exc
    return [{'page': 1, 'text': text}]


def _ocr_page(page, page_num):
    try:
        pytesseract, Image = _import_tesseract()
        mat = page.get_pixmap(dpi=200)
        img_bytes = mat.tobytes("png")
        import io
        img = Image.open(io.BytesIO(img_bytes))
        return pytesseract.image_to_string(img)
    except ImportError:
        logger.warning("Tesseract not installed -- skipping OCR for page %d", page_num)
        return ""
    except Exception as exc:
        logger.warning("OCR failed for page %d: %s", page_num, exc)
        return ""


def clean_text(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def chunk_pages(pages, doc_id, filename, chunk_size=500, overlap=50):
    chunks = []
    chunk_index = 0
    for page_info in pages:
        page_num = page_info['page']
        text = clean_text(page_info['text'])
        if not text:
            continue
        words = text.split()
        step = max(1, chunk_size - overlap)
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_text = ' '.join(words[start:end])
            if chunk_text.strip():
                chunks.append({
                    'chunk_id': str(uuid.uuid4()),
                    'doc_id': doc_id,
                    'filename': filename,
                    'page': page_num,
                    'chunk_index': chunk_index,
                    'text': chunk_text,
                    'word_count': end - start,
                })
                chunk_index += 1
            if end >= len(words):
                break
            start += step
    return chunks


class EmbeddingModel:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, model_name='all-MiniLM-L6-v2'):
        if self._model is None:
            logger.info("Loading embedding model '%s' ...", model_name)
            SentenceTransformer = _import_sentence_transformers()
            self._model = SentenceTransformer(model_name)
            logger.info("Embedding model loaded.")
        return self._model

    def encode(self, texts, model_name='all-MiniLM-L6-v2'):
        model = self.load(model_name)
        return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


embedding_model = EmbeddingModel()


def generate_embeddings(chunks, model_name='all-MiniLM-L6-v2'):
    texts = [c['text'] for c in chunks]
    embeddings = embedding_model.encode(texts, model_name)
    return embeddings.astype(np.float32)


class DocumentKnowledgeBase:
    def __init__(self, kb_dir):
        self.kb_dir = Path(kb_dir)
        self.kb_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.kb_dir / 'faiss.index'
        self.meta_path  = self.kb_dir / 'metadata.json'
        self.docs_path  = self.kb_dir / 'docs.json'
        self._index = None
        self._chunks = []
        self._docs = {}
        self._load()

    def _load(self):
        # Load JSON metadata first (no FAISS needed for this)
        if self.meta_path.exists():
            try:
                self._chunks = json.loads(self.meta_path.read_text(encoding='utf-8'))
            except Exception:
                self._chunks = []
        if self.docs_path.exists():
            try:
                self._docs = json.loads(self.docs_path.read_text(encoding='utf-8'))
            except Exception:
                self._docs = {}
        # Load FAISS index only if it exists and FAISS is installed
        if self.index_path.exists() and len(self._chunks) > 0:
            try:
                faiss = _import_faiss()
                self._index = faiss.read_index(str(self.index_path))
                logger.info("FAISS index loaded: %d vectors", self._index.ntotal)
            except ImportError:
                logger.warning("FAISS not installed yet — index will be rebuilt after install.")
                self._index = None
            except Exception as exc:
                logger.warning("Could not load FAISS index: %s. Rebuilding.", exc)
                self._index = None
                self._chunks = []

    def _save(self):
        faiss = _import_faiss()
        if self._index is not None:
            faiss.write_index(self._index, str(self.index_path))
        self.meta_path.write_text(json.dumps(self._chunks, ensure_ascii=False, indent=2), encoding='utf-8')
        self.docs_path.write_text(json.dumps(self._docs, ensure_ascii=False, indent=2), encoding='utf-8')

    @staticmethod
    def _file_hash(file_path):
        sha = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for block in iter(lambda: f.read(65536), b''):
                sha.update(block)
        return sha.hexdigest()

    def is_duplicate(self, file_hash):
        return any(d.get('file_hash') == file_hash for d in self._docs.values())

    def add_document(self, doc_id, filename, file_hash, chunks, embeddings):
        faiss = _import_faiss()
        if len(chunks) == 0:
            raise ValueError("No chunks to index.")
        embeddings = embeddings.astype(np.float32)
        dim = embeddings.shape[1]
        if self._index is None:
            self._index = faiss.IndexFlatL2(dim)
        self._index.add(embeddings)
        self._chunks.extend(chunks)
        self._docs[doc_id] = {
            'doc_id': doc_id,
            'filename': filename,
            'file_hash': file_hash,
            'chunk_count': len(chunks),
        }
        self._save()
        logger.info("Indexed %d chunks for doc '%s'", len(chunks), filename)

        # Mirror to ChromaDB (Milestone 3)
        try:
            from backend.services.chroma_service import chroma_store
            chroma_store.add_chunks(chunks, embeddings)
        except Exception as exc:
            logger.warning("Could not sync added document to ChromaDB: %s", exc)

    def get_all_docs(self):
        return list(self._docs.values())

    def get_doc(self, doc_id):
        return self._docs.get(doc_id)

    def search(self, query_embedding, top_k=5):
        if self._index is None or self._index.ntotal == 0:
            return []
        query = query_embedding.astype(np.float32).reshape(1, -1)
        k = min(top_k, self._index.ntotal)
        distances, indices = self._index.search(query, k)
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self._chunks):
                continue
            chunk = dict(self._chunks[idx])
            chunk['score'] = float(1 / (1 + dist))
            results.append(chunk)
        return results

    def answer_question(self, query_embedding, top_k=3):
        results = self.search(query_embedding, top_k=top_k)
        if not results:
            return {
                'answer': (
                    "I could not find relevant information in the uploaded documents. "
                    "Please upload and process a document first, or rephrase your question."
                ),
                'sources': [],
                'found': False,
            }
        best = results[0]
        sources = [
            {
                'filename': r['filename'],
                'page': r['page'],
                'text': r['text'][:400] + ('...' if len(r['text']) > 400 else ''),
                'score': round(r['score'], 4),
            }
            for r in results
        ]
        return {'answer': best['text'], 'sources': sources, 'found': True}

    def remove_document(self, doc_id):
        if doc_id not in self._docs:
            return
        faiss = _import_faiss()
        remaining = [c for c in self._chunks if c['doc_id'] != doc_id]
        del self._docs[doc_id]
        if not remaining:
            self._chunks = []
            self._index = None
            self._save()
            return
        texts = [c['text'] for c in remaining]
        embs = embedding_model.encode(texts).astype(np.float32)
        dim = embs.shape[1]
        new_index = faiss.IndexFlatL2(dim)
        new_index.add(embs)
        self._index = new_index
        self._chunks = remaining
        self._save()
        try:
            from backend.services.chroma_service import chroma_store
            chroma_store.delete_document(doc_id)
        except Exception:
            pass


from backend.config import KNOWLEDGE_BASE_DIR  # noqa
knowledge_base = DocumentKnowledgeBase(KNOWLEDGE_BASE_DIR)
