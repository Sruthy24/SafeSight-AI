from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.database.db import get_violations, update_violation_status

violations_bp = Blueprint('violations_bp', __name__)

ALLOWED_AUDIT_STATUSES = {'Detected', 'Verified', 'False Positive', 'Requires Review'}

@violations_bp.route('/violations', methods=['GET'])
@jwt_required()
def list_violations():
    """Search and filter violations for the Events & Audit interface."""
    severity = request.args.get('severity')
    status = request.args.get('status') or request.args.get('audit_status')
    category = request.args.get('category') or request.args.get('violation_type')
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))

    violations = get_violations(
        severity=severity,
        audit_status=status,
        violation_type=category,
        limit=limit,
        offset=offset
    )

    return jsonify({
        'count': len(violations),
        'limit': limit,
        'offset': offset,
        'violations': violations
    }), 200

@violations_bp.route('/violations/<int:violation_id>', methods=['PATCH'])
@jwt_required()
def update_violation(violation_id):
    """
    Update the audit status of a violation record.
    Supported statuses: 'Verified', 'False Positive', 'Requires Review', 'Detected'
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get('audit_status') or data.get('status')
    notes = data.get('notes')

    if not new_status:
        return jsonify({'error': 'Missing audit_status in request body'}), 400

    if new_status not in ALLOWED_AUDIT_STATUSES:
        return jsonify({
            'error': f"Invalid status '{new_status}'. Allowed: {list(ALLOWED_AUDIT_STATUSES)}"
        }), 400

    success = update_violation_status(violation_id, new_status, notes)
    if not success:
        return jsonify({'error': f"Violation #{violation_id} not found"}), 404

    return jsonify({
        'success': True,
        'violation_id': violation_id,
        'audit_status': new_status,
        'notes': notes,
        'message': f"Violation audit status updated to '{new_status}' successfully."
    }), 200
