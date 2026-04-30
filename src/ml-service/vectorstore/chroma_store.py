"""
vectorstore/chroma_store.py
---------------------------
ChromaDB wrapper for nalam.ai patient record embeddings.
Uses sentence-transformers/all-MiniLM-L6-v2 for local, offline embeddings.
Connects to a Chroma HTTP server (Docker) with a PersistentClient fallback.
"""

import os
import logging
from typing import List, Dict, Any

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

COLLECTION_NAME = "nalam_patient_records"

_client = None
_collection = None
_embedder = None


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        logger.info("Loading sentence-transformer model all-MiniLM-L6-v2 ...")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedder ready.")
    return _embedder


def get_collection():
    """Return (and lazily initialise) the Chroma collection."""
    global _client, _collection
    if _collection is not None:
        return _collection

    host = os.getenv("CHROMA_HOST", "localhost")
    port = int(os.getenv("CHROMA_PORT", "8002"))

    try:
        _client = chromadb.HttpClient(host=host, port=port)
        _client.heartbeat()
        logger.info(f"Connected to Chroma server at {host}:{port}")
    except Exception as e:
        logger.warning(f"Chroma server unreachable ({e}), using local PersistentClient fallback.")
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "/tmp/chroma_nalam")
        _client = chromadb.PersistentClient(path=persist_dir)

    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    logger.info(f"Chroma collection '{COLLECTION_NAME}' ready.")
    return _collection


def upsert_records(patient_id: str, records: List[Dict[str, Any]]) -> int:
    """
    Vectorise and upsert patient medical records into Chroma.
    Each record becomes one document; embeddings are generated locally.
    Returns the number of records upserted.
    """
    if not records:
        return 0

    collection = get_collection()
    embedder = _get_embedder()

    documents, ids, metadatas = [], [], []

    for i, r in enumerate(records):
        text = " | ".join(filter(None, [
            r.get("type", ""),
            r.get("diagnosis", ""),
            r.get("notes", "")[:300] if r.get("notes") else "",
            r.get("lab_results", ""),
        ]))
        doc_id = f"{patient_id}_{r.get('record_id', i)}"
        documents.append(text)
        ids.append(doc_id)
        metadatas.append({
            "patient_id": patient_id,
            "date": r.get("date", ""),
            "type": r.get("type", ""),
            "diagnosis": r.get("diagnosis", ""),
        })

    embeddings = embedder.encode(documents, show_progress_bar=False).tolist()
    collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    logger.info(f"Upserted {len(documents)} records for patient {patient_id}.")
    return len(documents)


def semantic_search(
    patient_id: str,
    query: str,
    n_results: int = 5,
) -> Dict[str, Any]:
    """
    Semantic search over a patient's records.
    Returns ChromaDB query result dict with 'documents' and 'metadatas'.
    """
    collection = get_collection()
    embedder = _get_embedder()

    query_embedding = embedder.encode([query], show_progress_bar=False).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(n_results, collection.count()),
        where={"patient_id": patient_id},
        include=["documents", "metadatas", "distances"],
    )
    return results
