"""
SafeSight AI -- Milestone 2: Document Intelligence API Routes
=============================================================
Blueprint: documents_bp
URL prefix: /api/documents

Endpoints:
  POST   /upload          -- Upload a PDF or TXT file
  GET    /list            -- List all uploaded documents
  POST   /<doc_id>/process -- Extract, chunk, embed, index
  POST   /search          -- Semantic similarity search
  POST   /ask             -- AI question answering
"""

import os
import uuid
import hashlib
from pathlib import Path

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from backend.config import (
    DOCUMENT_UPLOAD_FOLDER,
    ALLOWED_DOCUMENT_EXTENSIONS,
    MAX_DOCUMENT_SIZE_MB,
    MAX_CHUNK_TOKENS,
    CHUNK_OVERLAP_TOKENS,
    EMBEDDING_MODEL_NAME,
)
from backend.services.document_service import (
    extract_text_from_pdf,
    extract_text_from_txt,
    chunk_pages,
    generate_embeddings,
    embedding_model,
    knowledge_base,
)

documents_bp = Blueprint('documents_bp', __name__)

# ── helpers ──────────────────────────────────────────────────────────────────

def _allowed_doc(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_DOCUMENT_EXTENSIONS


def _file_hash(path: Path) -> str:
    sha = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(65536), b''):
            sha.update(block)
    return sha.hexdigest()


# ── In-memory document status store ──────────────────────────────────────────
# Keys: doc_id  Values: {doc_id, filename, original_name, status, file_hash, ...}
_doc_registry: dict = {}


def _load_registry_from_kb():
    """Sync in-memory registry with knowledge base docs on startup."""
    for doc in knowledge_base.get_all_docs():
        doc_id = doc['doc_id']
        if doc_id not in _doc_registry:
            _doc_registry[doc_id] = {
                'doc_id': doc_id,
                'filename': doc['filename'],
                'original_name': doc['filename'],
                'status': 'indexed',
                'file_hash': doc.get('file_hash', ''),
                'chunk_count': doc.get('chunk_count', 0),
                'error': None,
            }


_load_registry_from_kb()


# ── Routes ───────────────────────────────────────────────────────────────────

@documents_bp.route('/documents/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a PDF or TXT document."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400

    original_name = file.filename
    if not _allowed_doc(original_name):
        return jsonify({
            'error': f'Unsupported file type. Allowed: {", ".join(ALLOWED_DOCUMENT_EXTENSIONS)}'
        }), 400

    # Read content and check size
    content = file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_DOCUMENT_SIZE_MB:
        return jsonify({'error': f'File too large. Maximum size is {MAX_DOCUMENT_SIZE_MB} MB.'}), 413

    # Generate a unique ID and safe filename
    doc_id = str(uuid.uuid4())
    ext = original_name.rsplit('.', 1)[1].lower()
    safe_name = f"{doc_id}.{ext}"
    save_path = DOCUMENT_UPLOAD_FOLDER / safe_name

    try:
        save_path.write_bytes(content)
    except Exception as exc:
        return jsonify({'error': f'Failed to save file: {exc}'}), 500

    file_hash = _file_hash(save_path)

    # Duplicate check
    if knowledge_base.is_duplicate(file_hash):
        save_path.unlink(missing_ok=True)
        return jsonify({
            'error': 'This document is already in the knowledge base (duplicate detected).',
            'duplicate': True,
        }), 409

    record = {
        'doc_id': doc_id,
        'filename': safe_name,
        'original_name': original_name,
        'status': 'uploaded',
        'file_hash': file_hash,
        'chunk_count': 0,
        'error': None,
        'size_mb': round(size_mb, 2),
    }
    _doc_registry[doc_id] = record

    return jsonify({
        'message': 'Document uploaded successfully.',
        'doc_id': doc_id,
        'original_name': original_name,
        'size_mb': round(size_mb, 2),
        'status': 'uploaded',
    }), 201


@documents_bp.route('/documents/list', methods=['GET'])
@jwt_required()
def list_documents():
    """Return all documents: registry + KB docs."""
    _load_registry_from_kb()
    docs = list(_doc_registry.values())
    # Sort by original name
    docs.sort(key=lambda d: d.get('original_name', ''))
    return jsonify({'documents': docs, 'total': len(docs)}), 200


@documents_bp.route('/documents/<doc_id>/process', methods=['POST'])
@jwt_required()
def process_document(doc_id: str):
    """
    Full processing pipeline for a single document:
      extract -> clean -> chunk -> embed -> index
    """
    record = _doc_registry.get(doc_id)
    if not record:
        return jsonify({'error': 'Document not found. Please upload it first.'}), 404

    if record.get('status') == 'indexed':
        return jsonify({'message': 'Document already indexed.', 'doc_id': doc_id}), 200

    if record.get('status') == 'processing':
        return jsonify({'message': 'Document is already being processed.', 'doc_id': doc_id}), 202

    # Mark as processing
    record['status'] = 'processing'
    record['error'] = None

    filename   = record['filename']
    orig_name  = record['original_name']
    file_path  = DOCUMENT_UPLOAD_FOLDER / filename
    file_hash  = record['file_hash']
    ext        = filename.rsplit('.', 1)[1].lower()

    try:
        # 1. Extract text
        if ext == 'pdf':
            pages = extract_text_from_pdf(file_path)
        else:
            pages = extract_text_from_txt(file_path)

        total_chars = sum(len(p['text']) for p in pages)
        if total_chars < 10:
            raise ValueError("Extracted text is empty or too short. The PDF may be blank or image-only without OCR support.")

        # 2. Chunk
        chunks = chunk_pages(
            pages,
            doc_id=doc_id,
            filename=orig_name,
            chunk_size=MAX_CHUNK_TOKENS,
            overlap=CHUNK_OVERLAP_TOKENS,
        )
        if not chunks:
            raise ValueError("No text chunks could be created from this document.")

        # 3. Generate embeddings
        embeddings = generate_embeddings(chunks, model_name=EMBEDDING_MODEL_NAME)

        # 4. Index
        knowledge_base.add_document(
            doc_id=doc_id,
            filename=orig_name,
            file_hash=file_hash,
            chunks=chunks,
            embeddings=embeddings,
        )

        # Update registry
        record['status'] = 'indexed'
        record['chunk_count'] = len(chunks)

        return jsonify({
            'message': 'Document processed and indexed successfully.',
            'doc_id': doc_id,
            'original_name': orig_name,
            'pages_processed': len(pages),
            'chunks_created': len(chunks),
            'status': 'indexed',
        }), 200

    except Exception as exc:
        record['status'] = 'error'
        record['error'] = str(exc)
        return jsonify({'error': f'Processing failed: {exc}', 'doc_id': doc_id}), 500


@documents_bp.route('/documents/search', methods=['POST'])
@jwt_required()
def search_documents():
    """
    Semantic search across all indexed documents.
    Body: { "query": "...", "top_k": 5 }
    """
    body = request.get_json(force=True, silent=True) or {}
    query = (body.get('query') or '').strip()
    top_k = min(int(body.get('top_k', 5)), 20)

    if not query:
        return jsonify({'error': 'Query cannot be empty.'}), 400

    if knowledge_base._index is None or knowledge_base._index.ntotal == 0:
        return jsonify({
            'results': [],
            'message': 'Knowledge base is empty. Please upload and process a document first.',
        }), 200

    try:
        query_embedding = embedding_model.encode([query])[0]
        results = knowledge_base.search(query_embedding, top_k=top_k)
    except Exception as exc:
        return jsonify({'error': f'Search failed: {exc}'}), 500

    formatted = [
        {
            'chunk_id':   r['chunk_id'],
            'doc_id':     r['doc_id'],
            'filename':   r['filename'],
            'page':       r['page'],
            'text':       r['text'],
            'score':      round(r['score'], 4),
            'chunk_index': r.get('chunk_index', 0),
        }
        for r in results
    ]

    return jsonify({
        'query': query,
        'results': formatted,
        'total': len(formatted),
    }), 200


@documents_bp.route('/documents/ask', methods=['POST'])
@jwt_required()
def ask_question():
    """
    AI Q&A: answer a question from document content.
    Body: { "question": "...", "top_k": 3 }
    """
    body = request.get_json(force=True, silent=True) or {}
    question = (body.get('question') or '').strip()
    top_k = min(int(body.get('top_k', 3)), 10)

    if not question:
        return jsonify({'error': 'Question cannot be empty.'}), 400

    try:
        q_embedding = embedding_model.encode([question])[0]
        answer_data = knowledge_base.answer_question(q_embedding, top_k=top_k)
    except Exception as exc:
        return jsonify({'error': f'Q&A failed: {exc}'}), 500

    return jsonify({
        'question': question,
        'answer':   answer_data['answer'],
        'sources':  answer_data['sources'],
        'found':    answer_data['found'],
    }), 200


@documents_bp.route('/documents/<doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id: str):
    """Remove a document from the registry and knowledge base."""
    record = _doc_registry.pop(doc_id, None)
    knowledge_base.remove_document(doc_id)

    # Also delete the file from disk
    if record:
        try:
            (DOCUMENT_UPLOAD_FOLDER / record['filename']).unlink(missing_ok=True)
        except Exception:
            pass

    return jsonify({'message': 'Document deleted.', 'doc_id': doc_id}), 200
