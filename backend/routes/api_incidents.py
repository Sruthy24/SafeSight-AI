"""
SafeSight AI -- Milestone 3: Incident Management API Routes
============================================================
Blueprint: incidents_bp
URL prefix: /api/incidents

Endpoints:
  GET   /api/incidents       -- List incidents with optional filters
  GET   /api/incidents/<id>  -- Get incident details
  PATCH /api/incidents/<id>  -- Update incident status and notes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database.db import (
    get_incidents,
    get_incident_by_id,
    update_incident_status,
)

incidents_bp = Blueprint('incidents_bp', __name__)


@incidents_bp.route('/incidents', methods=['GET'])
@jwt_required()
def list_incidents():
    """Retrieve list of workplace safety incidents."""
    status = request.args.get('status')
    severity = request.args.get('severity')
    zone = request.args.get('zone')
    camera_id = request.args.get('camera_id')
    try:
        limit = min(int(request.args.get('limit', 100)), 200)
        offset = max(int(request.args.get('offset', 0)), 0)
    except (ValueError, TypeError):
        limit = 100
        offset = 0

    incidents = get_incidents(
        status=status,
        severity=severity,
        zone=zone,
        camera_id=camera_id,
        limit=limit,
        offset=offset
    )

    return jsonify({
        'total': len(incidents),
        'incidents': incidents
    }), 200


@incidents_bp.route('/incidents/<int:incident_id>', methods=['GET'])
@jwt_required()
def get_incident(incident_id: int):
    """Retrieve detailed information for a single incident."""
    incident = get_incident_by_id(incident_id)
    if not incident:
        return jsonify({'error': f'Incident with ID {incident_id} was not found.'}), 404

    return jsonify({'incident': incident}), 200


@incidents_bp.route('/incidents/<int:incident_id>', methods=['PATCH'])
@jwt_required()
def update_status(incident_id: int):
    """
    Update incident status ('Open', 'Under Review', 'Resolved') and supervisor notes.
    Body: { "status": "Under Review", "notes": "..." }
    """
    body = request.get_json(force=True, silent=True) or {}
    new_status = body.get('status')
    notes = body.get('notes')

    valid_statuses = {'Open', 'Under Review', 'Resolved'}
    if new_status and new_status not in valid_statuses:
        return jsonify({
            'error': f'Invalid status. Allowed values: {", ".join(sorted(valid_statuses))}'
        }), 400

    existing = get_incident_by_id(incident_id)
    if not existing:
        return jsonify({'error': f'Incident with ID {incident_id} was not found.'}), 404

    status_to_set = new_status or existing['status']
    updated = update_incident_status(incident_id, status_to_set, notes)

    if not updated:
        return jsonify({'error': 'Failed to update incident.'}), 500

    return jsonify({
        'message': 'Incident updated successfully.',
        'incident': get_incident_by_id(incident_id)
    }), 200
