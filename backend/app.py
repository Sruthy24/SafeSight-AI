import os
import sys
from datetime import timedelta
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from backend.config import MAX_CONTENT_LENGTH, JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES_HOURS
from backend.database.db import init_db
from backend.routes.api_health import health_bp
from backend.routes.api_auth import auth_bp
from backend.routes.api_dashboard import dashboard_bp
from backend.routes.api_analysis import analysis_bp
from backend.routes.api_inspections import inspections_bp
from backend.routes.api_violations import violations_bp
from backend.routes.api_reports import reports_bp
from backend.routes.api_media import media_bp
from backend.routes.api_documents import documents_bp   # Milestone 2
from backend.routes.api_agent import agent_bp           # Milestone 3
from backend.routes.api_incidents import incidents_bp   # Milestone 3
from backend.routes.api_alerts import alerts_bp         # Milestone 3

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

def create_app():
    """Application factory for SafeSight AI Flask Backend."""
    app = Flask(__name__)

    # --- JWT Configuration ---
    app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=JWT_ACCESS_TOKEN_EXPIRES_HOURS)
    app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
    # Allow token from Authorization header OR ?token= query param (needed for PDF download)
    app.config['JWT_TOKEN_LOCATION'] = ['headers', 'query_string']
    app.config['JWT_QUERY_STRING_NAME'] = 'token'

    # Initialise JWT manager
    jwt = JWTManager(app)

    # --- JWT error handlers ---
    @jwt.unauthorized_loader
    def unauthorized_response(reason):
        return jsonify({'error': 'Authentication required. Please log in.', 'reason': reason}), 401

    @jwt.invalid_token_loader
    def invalid_token_response(reason):
        return jsonify({'error': 'Invalid authentication token.', 'reason': reason}), 401

    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({'error': 'Your session has expired. Please log in again.'}), 401

    # --- CORS ---
    # supports_credentials=True is NOT set because we use Authorization headers,
    # not cookies — so we can use a wildcard-style origin list safely.
    CORS(app, resources={
        r"/api/*": {
            "origins": _ALLOWED_ORIGINS,
            "methods": ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    })

    # --- Initialize SQLite database schema (creates users table on first run) ---
    init_db()

    # --- Register blueprints ---
    # Public endpoints (no JWT required)
    app.register_blueprint(health_bp, url_prefix='/api')  # /api/health – stays public
    app.register_blueprint(auth_bp,   url_prefix='/api')  # /api/auth/* – register / login

    # Protected endpoints (each route decorated with @jwt_required())
    app.register_blueprint(dashboard_bp,   url_prefix='/api')
    app.register_blueprint(analysis_bp,    url_prefix='/api')
    app.register_blueprint(inspections_bp, url_prefix='/api')
    app.register_blueprint(violations_bp,  url_prefix='/api')
    app.register_blueprint(reports_bp,     url_prefix='/api')
    app.register_blueprint(media_bp,       url_prefix='/api')
    app.register_blueprint(documents_bp,   url_prefix='/api')   # Milestone 2
    app.register_blueprint(agent_bp,       url_prefix='/api')   # Milestone 3
    app.register_blueprint(incidents_bp,   url_prefix='/api')   # Milestone 3
    app.register_blueprint(alerts_bp,      url_prefix='/api')   # Milestone 3

    # --- Global Error Handlers ---
    @app.errorhandler(413)
    def file_too_large(error):
        return jsonify({
            'error': f'Payload too large. File size exceeds the {MAX_CONTENT_LENGTH // (1024 * 1024)}MB maximum limit.'
        }), 413

    @app.errorhandler(404)
    def resource_not_found(error):
        return jsonify({'error': 'The requested API endpoint was not found.'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'An internal server error occurred in SafeSight AI backend.'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Starting SafeSight AI Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
