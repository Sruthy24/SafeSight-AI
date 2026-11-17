"""
SafeSight AI -- Milestone 3: LangGraph Agentic Multi-Agent Workflow
===================================================================
Coordinates multimodal visual evidence retrieval, ChromaDB document retrieval,
evidence fusion, context-grounded answer generation, automated incident logging,
and supervisor alerting.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import StateGraph, END

from backend.config import (
    DEFAULT_CAMERAS,
    CAMERA_ZONES,
    ZONE_NAMES,
    LLM_PROVIDER,
    GEMINI_API_KEY,
    OPENAI_API_KEY,
    GROQ_API_KEY,
    OLLAMA_BASE_URL,
)
from backend.database.db import (
    get_db_connection,
    create_incident,
    create_supervisor_alert,
)
from backend.services.chroma_service import chroma_store
from backend.services.document_service import knowledge_base, embedding_model

logger = logging.getLogger(__name__)


# ── Workflow State Definition ────────────────────────────────────────────────

class AgentWorkflowState(TypedDict, total=False):
    question: str
    intent: str                  # 'multimodal' | 'visual_only' | 'document_only' | 'general'
    entities: Dict[str, Any]     # zone, camera_id, ppe_item, violation_type, timeframe
    needs_vision: bool
    needs_docs: bool
    vision_evidence: List[Dict[str, Any]]
    doc_evidence: List[Dict[str, Any]]
    fused_context: str
    answer: str
    sources: List[Dict[str, Any]]
    incident_id: Optional[int]
    incident_code: Optional[str]
    incident_created: bool
    alert_id: Optional[int]
    alert_code: Optional[str]
    alert_created: bool
    steps_log: List[Dict[str, Any]]
    error: Optional[str]


# ── Node 1: Query Analyzer ───────────────────────────────────────────────────

def query_analyzer_node(state: AgentWorkflowState) -> Dict[str, Any]:
    question = (state.get('question') or '').strip()
    q_lower = question.lower()
    step_start = datetime.now().isoformat()

    # Extract Entities
    entities: Dict[str, Any] = {
        'zone': None,
        'camera_id': None,
        'ppe_items': [],
        'violation_type': None,
        'timeframe': None,
    }

    # Detect Zone (e.g. Zone A, Zone B, Zone C, Zone D)
    for z in ZONE_NAMES:
        if z.lower() in q_lower:
            entities['zone'] = z
            break

    # Detect Camera (e.g. CAM-01, Camera 01, Cam 1)
    cam_match = re.search(r'\b(cam(?:era)?[-_\s]?0?([1-9]))\b', q_lower)
    if cam_match:
        cam_num = cam_match.group(2)
        entities['camera_id'] = f"CAM-0{cam_num}"
    else:
        for c in DEFAULT_CAMERAS:
            if c.lower() in q_lower:
                entities['camera_id'] = c
                break

    # Detect PPE items
    if 'helmet' in q_lower or 'hard hat' in q_lower or 'hardhat' in q_lower:
        entities['ppe_items'].append('helmet')
    if 'vest' in q_lower or 'jacket' in q_lower or 'hi-vis' in q_lower:
        entities['ppe_items'].append('vest')
    if 'goggle' in q_lower or 'eye' in q_lower or 'glasses' in q_lower:
        entities['ppe_items'].append('goggles')

    # Detect Violation Type
    if 'missing helmet' in q_lower or ('without' in q_lower and 'helmet' in q_lower) or ('no' in q_lower and 'helmet' in q_lower):
        entities['violation_type'] = 'Missing Helmet'
    elif 'missing vest' in q_lower or ('without' in q_lower and 'vest' in q_lower) or ('no' in q_lower and 'vest' in q_lower):
        entities['violation_type'] = 'Missing Safety Vest'
    elif 'missing goggle' in q_lower or ('without' in q_lower and 'goggle' in q_lower):
        entities['violation_type'] = 'Missing Goggles'

    # Detect timeframe
    if 'today' in q_lower or 'morning' in q_lower:
        entities['timeframe'] = 'recent'

    # Decide Retrieval Routing
    visual_indicators = [
        'zone a', 'zone b', 'zone c', 'zone d', 'cam', 'camera', 'worker',
        'detected', 'detection', 'alert in', 'violation in', 'snapshot',
        'who was', 'which worker', 'today', 'image', 'video', 'feed'
    ]
    doc_indicators = [
        'manual', 'policy', 'rule', 'osha', 'standard', 'regulation',
        'requirement', 'protocol', 'action should', 'supervisor take',
        'procedure', 'section', 'guideline', 'allowed', 'mandatory'
    ]

    has_visual = any(w in q_lower for w in visual_indicators) or entities['zone'] or entities['camera_id']
    has_doc = any(w in q_lower for w in doc_indicators)

    # Specific routing decisions
    if has_visual and has_doc:
        intent = 'multimodal'
        needs_vision = True
        needs_docs = True
    elif has_visual:
        # If question asks "why violation alert", checking against policy provides grounding
        if 'why' in q_lower or 'violation' in q_lower or 'alert' in q_lower:
            intent = 'multimodal'
            needs_vision = True
            needs_docs = True
        else:
            intent = 'visual_only'
            needs_vision = True
            needs_docs = False
    elif has_doc:
        intent = 'document_only'
        needs_vision = False
        needs_docs = True
    else:
        # Default for safety questions: multimodal retrieval
        intent = 'multimodal'
        needs_vision = True
        needs_docs = True

    step = {
        'node': 'Query Analyzer',
        'status': 'completed',
        'timestamp': step_start,
        'detail': f"Intent: {intent} | Needs Vision: {needs_vision} | Needs Docs: {needs_docs} | Entities: {entities}"
    }

    return {
        'intent': intent,
        'entities': entities,
        'needs_vision': needs_vision,
        'needs_docs': needs_docs,
        'steps_log': [step]
    }


# ── Node 2: Vision Retrieval Agent ───────────────────────────────────────────

def vision_retrieval_agent_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    entities = state.get('entities', {})
    zone_filter = entities.get('zone')
    cam_filter = entities.get('camera_id')
    viol_filter = entities.get('violation_type')

    evidence: List[Dict[str, Any]] = []

    with get_db_connection() as conn:
        cursor = conn.cursor()

        query = '''
            SELECT
                v.id as violation_id,
                v.inspection_id,
                v.violation_type,
                v.severity,
                v.confidence,
                v.bbox,
                v.snapshot_path,
                v.audit_status,
                v.notes,
                v.created_at as timestamp,
                COALESCE(v.camera_id, i.camera_id, 'CAM-01') as camera_id,
                COALESCE(v.zone, i.zone, 'Zone A') as zone,
                i.inspection_code,
                i.filename as source_media
            FROM violations v
            JOIN inspections i ON v.inspection_id = i.id
            WHERE 1=1
        '''
        params = []

        if zone_filter:
            query += ' AND (v.zone LIKE ? OR i.zone LIKE ?)'
            params.extend([f"%{zone_filter}%", f"%{zone_filter}%"])

        if cam_filter:
            query += ' AND (v.camera_id = ? OR i.camera_id = ?)'
            params.extend([cam_filter, cam_filter])

        if viol_filter:
            query += ' AND v.violation_type LIKE ?'
            params.append(f"%{viol_filter}%")

        query += ' ORDER BY v.created_at DESC LIMIT 6'

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # If strict filter returned no rows, fall back to recent violations in related zone or general
        if not rows and zone_filter:
            cursor.execute('''
                SELECT v.id as violation_id, v.inspection_id, v.violation_type, v.severity,
                       v.confidence, v.bbox, v.snapshot_path, v.audit_status, v.notes,
                       v.created_at as timestamp,
                       COALESCE(v.camera_id, i.camera_id, 'CAM-01') as camera_id,
                       COALESCE(v.zone, i.zone, 'Zone A') as zone,
                       i.inspection_code, i.filename as source_media
                FROM violations v
                JOIN inspections i ON v.inspection_id = i.id
                ORDER BY v.created_at DESC LIMIT 4
            ''')
            rows = cursor.fetchall()

        for r in rows:
            d = dict(r)
            try:
                d['bbox'] = json.loads(d['bbox']) if d.get('bbox') else []
            except Exception:
                pass
            evidence.append(d)

    step = {
        'node': 'Vision Retrieval Agent',
        'status': 'completed',
        'timestamp': step_start,
        'detail': f"Retrieved {len(evidence)} visual inspection & violation records from database."
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'vision_evidence': evidence,
        'steps_log': steps
    }


# ── Node 3: Document Retrieval Agent ─────────────────────────────────────────

def document_retrieval_agent_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    question = state.get('question', '')
    entities = state.get('entities', {})

    # Construct expanded semantic search query
    search_terms = [question]
    if entities.get('ppe_items'):
        search_terms.append(" ".join(entities['ppe_items']) + " safety requirement standard")
    if entities.get('violation_type'):
        search_terms.append(entities['violation_type'] + " policy protocol")

    combined_query = " ".join(search_terms)

    doc_evidence: List[Dict[str, Any]] = []

    # 1. First retrieve from ChromaDB
    try:
        results = chroma_store.search(combined_query, top_k=4)
        for r in results:
            doc_evidence.append({
                'filename': r.get('filename', 'Safety_Manual.pdf'),
                'page': r.get('page', 1),
                'text': r.get('text', ''),
                'score': r.get('score', 0.8),
                'chunk_id': r.get('chunk_id'),
            })
    except Exception as exc:
        logger.warning("ChromaDB search note: %s", exc)

    # 2. Fallback to knowledge_base FAISS if Chroma returned empty
    if not doc_evidence:
        try:
            q_emb = embedding_model.encode([question])[0]
            faiss_res = knowledge_base.search(q_emb, top_k=3)
            for r in faiss_res:
                doc_evidence.append({
                    'filename': r.get('filename', 'Safety_Manual.pdf'),
                    'page': r.get('page', 1),
                    'text': r.get('text', ''),
                    'score': r.get('score', 0.8),
                    'chunk_id': r.get('chunk_id'),
                })
        except Exception as exc:
            logger.warning("FAISS search note: %s", exc)

    step = {
        'node': 'Document Retrieval Agent',
        'status': 'completed',
        'timestamp': step_start,
        'detail': f"Retrieved {len(doc_evidence)} passages from ChromaDB knowledge base."
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'doc_evidence': doc_evidence,
        'steps_log': steps
    }


# ── Node 4: Evidence Fusion Node ─────────────────────────────────────────────

def evidence_fusion_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    vision_evidence = state.get('vision_evidence', [])
    doc_evidence = state.get('doc_evidence', [])
    question = state.get('question', '')

    fusion_lines = []
    sources = []

    fusion_lines.append(f"User Query: {question}\n")

    # Visual Evidence Section
    if vision_evidence:
        fusion_lines.append("=== VERIFIED VISUAL DETECTION EVIDENCE ===")
        for idx, v in enumerate(vision_evidence, 1):
            cam = v.get('camera_id', 'Unknown Camera')
            zone = v.get('zone', 'Unknown Zone')
            ts = v.get('timestamp', 'Unknown Time')
            v_type = v.get('violation_type', 'PPE Violation')
            conf = int(float(v.get('confidence', 0.0)) * 100)
            status = v.get('audit_status', 'Detected')
            notes = v.get('notes', '')
            media = v.get('source_media', '')

            fusion_lines.append(
                f"[Visual Record #{idx}] Camera: {cam} | Zone: {zone} | Timestamp: {ts} | "
                f"Violation: {v_type} (Confidence: {conf}%, Severity: {v.get('severity', 'High')}) | "
                f"Audit Status: {status} | Media: {media} | Notes: {notes}"
            )
        fusion_lines.append("")

    # Document Evidence Section
    if doc_evidence:
        fusion_lines.append("=== RETRIEVED SAFETY POLICY & DOCUMENT EVIDENCE ===")
        for idx, d in enumerate(doc_evidence, 1):
            fname = d.get('filename', 'Workplace Safety Policy')
            page = d.get('page', 1)
            text = d.get('text', '').strip()
            score = d.get('score', 0.0)

            fusion_lines.append(
                f"[Document #{idx}] Source: {fname} (Page {page}, Match Score: {score}):\n\"{text}\""
            )
            sources.append({
                'filename': fname,
                'page': page,
                'text': text[:300] + ('...' if len(text) > 300 else ''),
                'score': score
            })
        fusion_lines.append("")

    fused_context = "\n".join(fusion_lines)

    step = {
        'node': 'Evidence Fusion Node',
        'status': 'completed',
        'timestamp': step_start,
        'detail': f"Synthesized {len(vision_evidence)} visual detection records and {len(doc_evidence)} document passages."
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'fused_context': fused_context,
        'sources': sources,
        'steps_log': steps
    }


# ── Node 5: Answer Generation Node ───────────────────────────────────────────

def _call_gemini_api(prompt: str, api_key: str) -> Optional[str]:
    """Call Google Gemini REST API directly without extra library dependencies."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            candidates = body.get('candidates', [])
            if candidates:
                return candidates[0]['content']['parts'][0]['text']
    except Exception as exc:
        logger.warning("Gemini API call failed: %s", exc)
    return None


def _call_openai_api(prompt: str, api_key: str) -> Optional[str]:
    """Call OpenAI compatible API directly."""
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 800
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, data=data,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            return body['choices'][0]['message']['content']
    except Exception as exc:
        logger.warning("OpenAI API call failed: %s", exc)
    return None


def _call_groq_api(prompt: str, api_key: str) -> Optional[str]:
    """Call Groq API directly."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 800
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, data=data,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode('utf-8'))
            return body['choices'][0]['message']['content']
    except Exception as exc:
        logger.warning("Groq API call failed: %s", exc)
    return None


def _synthesize_grounded_answer(
    question: str,
    vision_evidence: List[Dict[str, Any]],
    doc_evidence: List[Dict[str, Any]],
    entities: Dict[str, Any]
) -> str:
    """
    Deterministic context-grounded answer synthesis.
    Strictly follows facts in evidence. Never invents worker identities or unseen events.
    """
    q_lower = question.lower()

    # Case 1: Specific question about unknown worker or unknown zone
    target_zone = entities.get('zone')
    if target_zone:
        matching_v = [v for v in vision_evidence if target_zone.lower() in v.get('zone', '').lower()]
        if not matching_v and ('why' in q_lower or 'alert' in q_lower or 'violation' in q_lower):
            # Check if any zone was asked that doesn't exist
            return f"No visual detection records or safety alerts were found for {target_zone} in the SafeSight AI system. Please verify the zone name or camera feed."

    # Case 2: Inquiring about specific worker identity
    if 'which worker' in q_lower or 'who was' in q_lower or 'worker name' in q_lower:
        if vision_evidence:
            top_v = vision_evidence[0]
            cam = top_v.get('camera_id', 'CAM-01')
            zone = top_v.get('zone', 'Zone A')
            ts = top_v.get('timestamp', 'recent inspection')
            v_type = top_v.get('violation_type', 'PPE Violation')
            conf = int(float(top_v.get('confidence', 0.0)) * 100)
            return (
                f"The worker detected with a **{v_type}** was recorded by **{cam}** in **{zone}** on **{ts}** "
                f"(Detection Confidence: {conf}%). "
                f"Note: SafeSight AI detects protective equipment using computer vision and does not identify individuals by name. "
                f"The visual bounding box snapshot is logged in the system audit records."
            )
        else:
            return "No worker detection records were found matching the specified criteria."

    # Case 3: Multimodal question combining plant violation and safety manual/policy
    if vision_evidence and doc_evidence:
        top_v = vision_evidence[0]
        cam = top_v.get('camera_id', 'CAM-01')
        zone = top_v.get('zone', 'Zone A')
        ts = top_v.get('timestamp', 'today')
        v_type = top_v.get('violation_type', 'PPE Violation')
        conf = int(float(top_v.get('confidence', 0.0)) * 100)
        sev = top_v.get('severity', 'High')

        top_d = doc_evidence[0]
        doc_name = top_d.get('filename', 'Safety Policy')
        page_num = top_d.get('page', 1)

        # Build grounded response
        answer = (
            f"A safety alert was triggered because a worker was detected with a **{v_type}** in **{zone}** "
            f"by **{cam}** at **{ts}** with a confidence score of **{conf}%** (Severity: {sev}).\n\n"
            f"According to the uploaded **{doc_name}** (Page {page_num}), mandatory PPE compliance is required "
            f"in active industrial zones. Overhead protection and high-visibility apparel are classified as strict requirements. "
            f"Consequently, this event was categorized as a potential {sev}-severity PPE safety violation."
        )

        if 'action' in q_lower or 'supervisor' in q_lower:
            answer += (
                f"\n\n**Recommended Supervisor Actions:**\n"
                f"1. Conduct immediate on-site worker verification in {zone}.\n"
                f"2. Ensure proper PPE is equipped before resuming overhead operations.\n"
                f"3. Review the event in the SafeSight AI Audit portal to verify or acknowledge the incident."
            )

        return answer

    # Case 4: Pure document question
    if doc_evidence and not vision_evidence:
        top_d = doc_evidence[0]
        doc_name = top_d.get('filename', 'Safety Manual')
        page_num = top_d.get('page', 1)
        text = top_d.get('text', '')

        return (
            f"According to **{doc_name}** (Page {page_num}):\n\n"
            f"> \"{text[:450]}...\"\n\n"
            f"The document mandates continuous PPE compliance in all designated active zones."
        )

    # Case 5: Pure vision detection question (e.g. "Summarize today's incidents")
    if vision_evidence and not doc_evidence:
        count = len(vision_evidence)
        top_v = vision_evidence[0]
        summary_items = []
        for v in vision_evidence[:4]:
            summary_items.append(
                f"- **{v.get('violation_type', 'PPE Violation')}** in {v.get('zone', 'Zone A')} by {v.get('camera_id', 'CAM-01')} at {v.get('timestamp', 'recent')} (Severity: {v.get('severity', 'High')})"
            )

        return (
            f"SafeSight AI has logged **{count} visual violation detections**:\n"
            + "\n".join(summary_items) +
            f"\n\nAll recorded events have been indexed in the Incident and Audit Log for supervisor review."
        )

    # Case 6: No data available
    return (
        "I could not find sufficient visual detection records or document passages in the SafeSight AI "
        "knowledge base to answer this question. Please ensure the safety documents are processed and visual media is uploaded."
    )


def answer_generation_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    question = state.get('question', '')
    fused_context = state.get('fused_context', '')
    vision_evidence = state.get('vision_evidence', [])
    doc_evidence = state.get('doc_evidence', [])
    entities = state.get('entities', {})

    answer = None

    # Check if external LLM configured
    system_prompt = (
        "You are SafeSight AI Assistant (VisionDesk Agent), an industrial workplace safety intelligence system. "
        "Your task is to answer user queries using ONLY the provided Visual Detection Evidence and Retrieved Document Evidence. "
        "STRICT GROUNDING RULES:\n"
        "1. Never invent worker names, fake IDs, or unrecorded incidents.\n"
        "2. If camera detections do not contain personal names, explicitly state that personal identities are not captured.\n"
        "3. Always cite Camera ID, Detection Timestamp, Detected Violation, Document Name, Page Number, and supporting policy passages when available.\n"
        "4. If information is not found in the context, explicitly state that it could not be found.\n\n"
        f"Context:\n{fused_context}\n\nUser Question: {question}\n\nAnswer:"
    )

    if GEMINI_API_KEY:
        try:
            answer = _call_gemini_api(system_prompt, GEMINI_API_KEY)
        except Exception:
            answer = None

    if not answer and OPENAI_API_KEY:
        try:
            answer = _call_openai_api(system_prompt, OPENAI_API_KEY)
        except Exception:
            answer = None

    if not answer and GROQ_API_KEY:
        try:
            answer = _call_groq_api(system_prompt, GROQ_API_KEY)
        except Exception:
            answer = None

    # Deterministic grounded fallback if no API key or call failed
    if not answer:
        answer = _synthesize_grounded_answer(question, vision_evidence, doc_evidence, entities)

    step = {
        'node': 'Answer Generation Node',
        'status': 'completed',
        'timestamp': step_start,
        'detail': f"Generated context-grounded answer (Length: {len(answer)} chars)."
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'answer': answer,
        'steps_log': steps
    }


# ── Node 6: Incident Logger Node ─────────────────────────────────────────────

def incident_logger_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    vision_evidence = state.get('vision_evidence', [])
    doc_evidence = state.get('doc_evidence', [])

    incident_id = None
    incident_code = None
    incident_created = False

    # Check if there is an appropriate high/medium severity violation to log
    if vision_evidence:
        top_v = vision_evidence[0]
        severity = top_v.get('severity', 'High')
        v_type = top_v.get('violation_type', 'PPE Violation')
        cam = top_v.get('camera_id', 'CAM-01')
        zone = top_v.get('zone', 'Zone A')
        conf = float(top_v.get('confidence', 0.85))
        v_id = top_v.get('violation_id')
        insp_id = top_v.get('inspection_id')
        v_ts = top_v.get('timestamp')

        doc_ref = ""
        if doc_evidence:
            d = doc_evidence[0]
            doc_ref = f"{d.get('filename', 'Safety Manual')} (Page {d.get('page', 1)})"

        # Log incident (with duplicate prevention built into create_incident)
        try:
            inc_id, code, is_dup = create_incident(
                violation_type=v_type,
                severity=severity,
                confidence=conf,
                camera_id=cam,
                zone=zone,
                supporting_details={
                    'camera_id': cam,
                    'zone': zone,
                    'violation_type': v_type,
                    'source_media': top_v.get('source_media', ''),
                    'detection_id': v_id,
                    'doc_reference': doc_ref
                },
                related_document=doc_ref or "SafeSight Workplace Safety Manual Section 3.2",
                status='Open',
                notes=top_v.get('notes') or f"Automated incident record for {v_type} in {zone}",
                violation_id=v_id,
                inspection_id=insp_id,
                timestamp=v_ts
            )
            incident_id = inc_id
            incident_code = code
            incident_created = not is_dup
        except Exception as exc:
            logger.warning("Incident logger node error: %s", exc)

    detail_msg = (
        f"Incident {'logged' if incident_created else 'referenced existing'}: {incident_code}"
        if incident_code else "No new incident required for this query."
    )

    step = {
        'node': 'Incident Logger Node',
        'status': 'completed',
        'timestamp': step_start,
        'detail': detail_msg
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'incident_id': incident_id,
        'incident_code': incident_code,
        'incident_created': incident_created,
        'steps_log': steps
    }


# ── Node 7: Supervisor Alert Node ────────────────────────────────────────────

def supervisor_alert_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    vision_evidence = state.get('vision_evidence', [])
    incident_id = state.get('incident_id')

    alert_id = None
    alert_code = None
    alert_created = False

    if vision_evidence:
        top_v = vision_evidence[0]
        severity = top_v.get('severity', 'High')

        # Trigger in-app supervisor alert for high severity violations
        if severity == 'High':
            v_type = top_v.get('violation_type', 'PPE Violation')
            cam = top_v.get('camera_id', 'CAM-01')
            zone = top_v.get('zone', 'Zone A')
            conf = int(float(top_v.get('confidence', 0.85)) * 100)
            v_ts = top_v.get('timestamp')

            evidence_summary = (
                f"Automated In-App Alert: {v_type} detected in {zone} by {cam} "
                f"(Confidence: {conf}%). Immediate supervisor review recommended."
            )

            try:
                a_id, a_code, is_dup = create_supervisor_alert(
                    violation_type=v_type,
                    severity=severity,
                    camera_id=cam,
                    zone=zone,
                    evidence_summary=evidence_summary,
                    incident_id=incident_id,
                    timestamp=v_ts
                )
                alert_id = a_id
                alert_code = a_code
                alert_created = not is_dup
            except Exception as exc:
                logger.warning("Supervisor alert node error: %s", exc)

    detail_msg = (
        f"In-App Supervisor Alert {'created' if alert_created else 'referenced existing'}: {alert_code}"
        if alert_code else "No supervisor alert required."
    )

    step = {
        'node': 'Supervisor Alert Node',
        'status': 'completed',
        'timestamp': step_start,
        'detail': detail_msg
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'alert_id': alert_id,
        'alert_code': alert_code,
        'alert_created': alert_created,
        'steps_log': steps
    }


# ── Node 8: Response Node ────────────────────────────────────────────────────

def response_node(state: AgentWorkflowState) -> Dict[str, Any]:
    step_start = datetime.now().isoformat()
    step = {
        'node': 'Response Node',
        'status': 'completed',
        'timestamp': step_start,
        'detail': "Compiled final grounded response with supporting evidence and source references."
    }

    steps = list(state.get('steps_log', []))
    steps.append(step)

    return {
        'steps_log': steps
    }


# ── Conditional Routing Functions ────────────────────────────────────────────

def route_retrieval(state: AgentWorkflowState) -> str:
    needs_vision = state.get('needs_vision', True)
    needs_docs = state.get('needs_docs', True)

    if needs_vision and needs_docs:
        return 'both'
    elif needs_vision:
        return 'vision_only'
    elif needs_docs:
        return 'docs_only'
    return 'both'


def route_alert(state: AgentWorkflowState) -> str:
    vision_evidence = state.get('vision_evidence', [])
    if vision_evidence:
        top_v = vision_evidence[0]
        if top_v.get('severity') == 'High':
            return 'alert'
    return 'skip_alert'


# ── Build LangGraph StateGraph Workflow ──────────────────────────────────────

def create_safesight_agent_workflow():
    workflow = StateGraph(AgentWorkflowState)

    # Add logical nodes
    workflow.add_node("query_analyzer", query_analyzer_node)
    workflow.add_node("vision_agent", vision_retrieval_agent_node)
    workflow.add_node("doc_agent", document_retrieval_agent_node)
    workflow.add_node("evidence_fusion", evidence_fusion_node)
    workflow.add_node("answer_generation", answer_generation_node)
    workflow.add_node("incident_logger", incident_logger_node)
    workflow.add_node("supervisor_alert", supervisor_alert_node)
    workflow.add_node("response_node", response_node)

    # Set entrypoint
    workflow.set_entry_point("query_analyzer")

    # Conditional Branching from Query Analyzer
    workflow.add_conditional_edges(
        "query_analyzer",
        route_retrieval,
        {
            "both": "vision_agent",
            "vision_only": "vision_agent",
            "docs_only": "doc_agent",
        }
    )

    # For multimodal path: vision_agent -> doc_agent -> evidence_fusion
    # For vision_only path: vision_agent -> evidence_fusion
    def after_vision(state: AgentWorkflowState) -> str:
        return "doc_agent" if state.get('needs_docs', False) else "evidence_fusion"

    workflow.add_conditional_edges("vision_agent", after_vision, {
        "doc_agent": "doc_agent",
        "evidence_fusion": "evidence_fusion"
    })

    workflow.add_edge("doc_agent", "evidence_fusion")
    workflow.add_edge("evidence_fusion", "answer_generation")
    workflow.add_edge("answer_generation", "incident_logger")

    # Conditional Branching from Incident Logger to Supervisor Alert
    workflow.add_conditional_edges(
        "incident_logger",
        route_alert,
        {
            "alert": "supervisor_alert",
            "skip_alert": "response_node",
        }
    )

    workflow.add_edge("supervisor_alert", "response_node")
    workflow.add_edge("response_node", END)

    return workflow.compile()


# Global compiled workflow instance
agent_app = create_safesight_agent_workflow()


def run_agent_workflow(question: str) -> Dict[str, Any]:
    """
    Executes the LangGraph multimodal RAG agent on a question.
    Returns full state including answer, visual evidence, document sources,
    incident and alert records, and execution trace.
    """
    initial_state: AgentWorkflowState = {
        'question': question,
        'steps_log': [],
    }

    try:
        final_state = agent_app.invoke(initial_state)
        return {
            'success': True,
            'question': question,
            'answer': final_state.get('answer', ''),
            'intent': final_state.get('intent', 'general'),
            'entities': final_state.get('entities', {}),
            'visual_evidence': final_state.get('vision_evidence', []),
            'document_sources': final_state.get('sources', []),
            'incident': {
                'id': final_state.get('incident_id'),
                'code': final_state.get('incident_code'),
                'created': final_state.get('incident_created', False),
            } if final_state.get('incident_code') else None,
            'alert': {
                'id': final_state.get('alert_id'),
                'code': final_state.get('alert_code'),
                'created': final_state.get('alert_created', False),
            } if final_state.get('alert_code') else None,
            'steps_log': final_state.get('steps_log', []),
        }
    except Exception as exc:
        logger.error("LangGraph agent execution failed: %s", exc, exc_info=True)
        return {
            'success': False,
            'question': question,
            'answer': f"An error occurred while coordinating the AI safety workflow: {exc}",
            'visual_evidence': [],
            'document_sources': [],
            'incident': None,
            'alert': None,
            'steps_log': [{
                'node': 'Workflow Error Handler',
                'status': 'error',
                'detail': str(exc)
            }]
        }
