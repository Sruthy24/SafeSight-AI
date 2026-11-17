from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from backend.database.db import get_inspections, get_inspection_by_id

inspections_bp = Blueprint('inspections_bp', __name__)

@inspections_bp.route('/inspections', methods=['GET'])
@jwt_required()
def list_inspections():
    """List inspection history with optional filtering and pagination."""
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))
    media_type = request.args.get('media_type')

    inspections = get_inspections(limit=limit, offset=offset, media_type=media_type)
    return jsonify({
        'count': len(inspections),
        'limit': limit,
        'offset': offset,
        'inspections': inspections
    }), 200

@inspections_bp.route('/inspections/<int:inspection_id>', methods=['GET'])
@jwt_required()
def inspection_detail(inspection_id):
    """Retrieve full details for a single inspection, including violations."""
    insp = get_inspection_by_id(inspection_id)
    if not insp:
        return jsonify({'error': f"Inspection #{inspection_id} not found"}), 404

    return jsonify(insp), 200
