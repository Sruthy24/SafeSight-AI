"""
SafeSight AI -- Milestone 3: AI Assistant & LangGraph Workflow API
==================================================================
Blueprint: agent_bp
URL prefix: /api/agent

Endpoints:
  POST /api/agent/chat      -- Submit user question to LangGraph multi-agent workflow
  GET  /api/agent/suggested -- Retrieve suggested safety queries
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.services.agent_workflow import run_agent_workflow

agent_bp = Blueprint('agent_bp', __name__)

SUGGESTED_QUESTIONS = [
    "Why was there a safety violation alert in Zone A?",
    "Which worker was detected without a helmet?",
    "What does the safety manual say about helmet requirements?",
    "Are the detected PPE violations against company safety policy?",
    "What safety actions should the supervisor take?",
    "Summarize today's safety incidents.",
    "Show the document source supporting this violation.",
]


@agent_bp.route('/agent/chat', methods=['POST'])
@jwt_required()
def agent_chat():
    """
    Submits a user question to the LangGraph agent workflow.
    Body: { "question": "..." }
    """
    data = request.get_json(force=True, silent=True) or {}
    question = (data.get('question') or '').strip()

    if not question:
        return jsonify({'error': 'Question cannot be empty.'}), 400

    result = run_agent_workflow(question)
    return jsonify(result), (200 if result.get('success') else 500)


@agent_bp.route('/agent/suggested', methods=['GET'])
@jwt_required()
def get_suggested():
    """Returns curated suggested questions for the AI assistant interface."""
    return jsonify({
        'suggestions': SUGGESTED_QUESTIONS
    }), 200
