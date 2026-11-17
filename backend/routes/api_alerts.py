"""
SafeSight AI -- Milestone 3: Supervisor Alert API Routes
========================================================
Blueprint: alerts_bp
URL prefix: /api/alerts

Endpoints:
  GET   /api/alerts                 -- Retrieve supervisor alerts (with unread filter)
  PATCH /api/alerts/<id>/read       -- Mark alert as read
  PATCH /api/alerts/<id>/acknowledge-- Acknowledge alert with supervisor identity
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database.db import (
    get_supervisor_alerts,
    mark_alert_read,
    acknowledge_alert,
    get_user_by_id,
)

alerts_bp = Blueprint('alerts_bp', __name__)


@alerts_bp.route('/alerts', methods=['GET'])
@jwt_required()
def list_alerts():
    """Retrieve supervisor alerts."""
    unread_only = request.args.get('unread', 'false').lower() == 'true'
    try:
        limit = min(int(request.args.get('limit', 50)), 100)
    except (ValueError, TypeError):
        limit = 50

    alerts = get_supervisor_alerts(unread_only=unread_only, limit=limit)
    unread_count = sum(1 for a in alerts if a.get('is_read') == 0)

    return jsonify({
        'total': len(alerts),
        'unread_count': unread_count,
        'alerts': alerts
    }), 200


@alerts_bp.route('/alerts/<int:alert_id>/read', methods=['PATCH'])
@jwt_required()
def mark_read(alert_id: int):
    """Mark an alert as read."""
    success = mark_alert_read(alert_id)
    if not success:
        return jsonify({'error': f'Alert with ID {alert_id} not found.'}), 404

    return jsonify({'message': 'Alert marked as read.', 'alert_id': alert_id}), 200


@alerts_bp.route('/alerts/<int:alert_id>/acknowledge', methods=['PATCH'])
@jwt_required()
def acknowledge(alert_id: int):
    """Acknowledge an alert with the supervisor's name or identity."""
    body = request.get_json(force=True, silent=True) or {}
    user_id = get_jwt_identity()
    user = get_user_by_id(int(user_id)) if str(user_id).isdigit() else None
    supervisor_name = body.get('supervisor_name') or (user['full_name'] if user else 'Safety Supervisor')

    success = acknowledge_alert(alert_id, supervisor_name)
    if not success:
        return jsonify({'error': f'Alert with ID {alert_id} not found.'}), 404

    return jsonify({
        'message': f'Alert acknowledged by {supervisor_name}.',
        'alert_id': alert_id,
        'acknowledged_by': supervisor_name
    }), 200
