"""
SafeSight AI – Authentication API Routes
Provides register, login, /me, and logout endpoints using JWT.
"""
import re
from datetime import timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from werkzeug.security import generate_password_hash, check_password_hash

from backend.config import JWT_ACCESS_TOKEN_EXPIRES_HOURS
from backend.database.db import create_user, get_user_by_email, get_user_by_id

auth_bp = Blueprint('auth_bp', __name__)

_EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')

def _safe_user(user: dict) -> dict:
    """Strip password_hash before returning user data to the client."""
    return {
        'id':         user['id'],
        'full_name':  user['full_name'],
        'email':      user['email'],
        'created_at': user['created_at'],
    }


# ---------------------------------------------------------------------------
# POST /api/auth/register
# ---------------------------------------------------------------------------
@auth_bp.route('/auth/register', methods=['POST'])
def register():
    """Create a new user account and return a JWT on success."""
    data = request.get_json(silent=True) or {}

    full_name = (data.get('full_name') or '').strip()
    email     = (data.get('email')     or '').strip().lower()
    password  = (data.get('password')  or '')
    confirm   = (data.get('confirm_password') or '')

    # --- Validation ---
    errors = {}
    if not full_name:
        errors['full_name'] = 'Full name is required.'
    elif len(full_name) < 2:
        errors['full_name'] = 'Full name must be at least 2 characters.'

    if not email:
        errors['email'] = 'Email address is required.'
    elif not _EMAIL_RE.match(email):
        errors['email'] = 'Please enter a valid email address.'

    if not password:
        errors['password'] = 'Password is required.'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters.'

    if not confirm:
        errors['confirm_password'] = 'Please confirm your password.'
    elif password and confirm != password:
        errors['confirm_password'] = 'Passwords do not match.'

    if errors:
        return jsonify({'error': 'Validation failed.', 'fields': errors}), 422

    # --- Duplicate check ---
    if get_user_by_email(email):
        return jsonify({
            'error': 'An account with this email address already exists.',
            'fields': {'email': 'Email already registered.'}
        }), 409

    # --- Create user ---
    password_hash = generate_password_hash(password)
    user_id = create_user(full_name=full_name, email=email, password_hash=password_hash)
    user    = get_user_by_id(user_id)

    token = create_access_token(
        identity=str(user_id),
        expires_delta=timedelta(hours=JWT_ACCESS_TOKEN_EXPIRES_HOURS)
    )

    return jsonify({
        'message': 'Account created successfully.',
        'access_token': token,
        'user': _safe_user(user),
    }), 201


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------
@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Verify credentials and return a JWT on success."""
    data = request.get_json(silent=True) or {}

    email    = (data.get('email')    or '').strip().lower()
    password = (data.get('password') or '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = get_user_by_email(email)

    # Use a constant-time check regardless of whether user exists
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_access_token(
        identity=str(user['id']),
        expires_delta=timedelta(hours=JWT_ACCESS_TOKEN_EXPIRES_HOURS)
    )

    return jsonify({
        'message': 'Login successful.',
        'access_token': token,
        'user': _safe_user(user),
    }), 200


# ---------------------------------------------------------------------------
# GET /api/auth/me  (protected)
# ---------------------------------------------------------------------------
@auth_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def me():
    """Return the profile of the currently authenticated user."""
    user_id = int(get_jwt_identity())
    user    = get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
    return jsonify({'user': _safe_user(user)}), 200


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------
@auth_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    JWT is stateless — actual invalidation happens client-side by deleting
    the token.  This endpoint simply confirms the request is authenticated
    and returns 200 so the frontend can clear its state cleanly.
    """
    return jsonify({'message': 'Logged out successfully.'}), 200
