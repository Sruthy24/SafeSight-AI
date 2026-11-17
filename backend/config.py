import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv(Path(__file__).resolve().parent / '.env')

# Base directories
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / 'uploads'
PROCESSED_FOLDER = BASE_DIR / 'processed'
SNAPSHOT_FOLDER = PROCESSED_FOLDER / 'snapshots'
REPORT_FOLDER = BASE_DIR / 'reports'
DATABASE_DIR = BASE_DIR / 'database'
DATABASE_PATH = DATABASE_DIR / 'safesight.db'
MODEL_DIR = BASE_DIR / 'models'
CUSTOM_MODEL_PATH = MODEL_DIR / 'best.pt'
FALLBACK_MODEL_PATH = MODEL_DIR / 'yolov8n.pt'

# ── Milestone 2: Document Intelligence ──────────────────────────────────────
DOCUMENT_UPLOAD_FOLDER = BASE_DIR / 'document_uploads'   # raw PDF / TXT files
KNOWLEDGE_BASE_DIR     = BASE_DIR / 'knowledge_base'     # FAISS index + metadata JSON
ALLOWED_DOCUMENT_EXTENSIONS = {'pdf', 'txt'}
MAX_DOCUMENT_SIZE_MB = 50          # 50 MB per document upload
MAX_CHUNK_TOKENS     = 500         # words per chunk (approximate)
CHUNK_OVERLAP_TOKENS = 50          # words of overlap between adjacent chunks
EMBEDDING_MODEL_NAME = 'all-MiniLM-L6-v2'   # ~90 MB, fast CPU inference
# ─────────────────────────────────────────────────────────────────────────────

# ── Milestone 3: Multimodal RAG & LangGraph Workflows ───────────────────────
CHROMA_DB_DIR = KNOWLEDGE_BASE_DIR / 'chroma_db'

DEFAULT_CAMERAS = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']
CAMERA_ZONES = {
    'CAM-01': 'Zone A (Assembly & Overhead Crane)',
    'CAM-02': 'Zone B (Welding & Fabrication)',
    'CAM-03': 'Zone C (Loading Dock & Logistics)',
    'CAM-04': 'Zone D (Chemical Processing & Cutting)'
}
ZONE_NAMES = ['Zone A', 'Zone B', 'Zone C', 'Zone D']

# LLM Provider configuration (loaded from .env)
LLM_PROVIDER = os.environ.get('LLM_PROVIDER', 'auto')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
# ─────────────────────────────────────────────────────────────────────────────

# Ensure required directories exist
for folder in [
    UPLOAD_FOLDER, PROCESSED_FOLDER, SNAPSHOT_FOLDER,
    REPORT_FOLDER, DATABASE_DIR, MODEL_DIR,
    DOCUMENT_UPLOAD_FOLDER, KNOWLEDGE_BASE_DIR,       # Milestone 2
    CHROMA_DB_DIR,                                    # Milestone 3
]:
    folder.mkdir(parents=True, exist_ok=True)

# Upload validation limits
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov'}

# JWT Authentication
# Loaded from .env — never hardcode this value
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'fallback-dev-secret-change-in-production')
JWT_ACCESS_TOKEN_EXPIRES_HOURS = 24  # Tokens valid for 24 hours

# YOLO & Detection defaults
DEFAULT_CONFIDENCE_THRESHOLD = 0.40
DEFAULT_IOU_THRESHOLD = 0.45
VIDEO_FRAME_SAMPLE_INTERVAL = 30  # Sample 1 frame every 30 frames (~1 sec on 30fps)
MAX_VIDEO_DURATION_SECONDS = 300  # 5 minutes safety cap

# Class mappings: raw model class name -> standard SafeSight AI class
CLASS_MAPPINGS = {
    # Person / Worker
    'person': 'person',
    'worker': 'person',
    'human': 'person',

    # Helmet / Hard Hat
    'helmet': 'helmet',
    'hard-hat': 'helmet',
    'hardhat': 'helmet',
    'safety_helmet': 'helmet',
    'head_with_helmet': 'helmet',

    # Safety Vest
    'vest': 'vest',
    'safety-vest': 'vest',
    'safety_vest': 'vest',
    'reflective_jacket': 'vest',
    'high_visibility_vest': 'vest',

    # Safety Goggles / Eye Protection
    'goggles': 'goggles',
    'glasses': 'goggles',
    'safety_goggles': 'goggles',
    'safety-goggles': 'goggles',
    'eye_protection': 'goggles',
    'face_shield': 'goggles',

    # Negative / Violation classes (from some PPE datasets)
    'no-helmet': 'no_helmet',
    'no_helmet': 'no_helmet',
    'without_helmet': 'no_helmet',
    'no-hardhat': 'no_helmet',
    'no_hardhat': 'no_helmet',
    'without_hardhat': 'no_helmet',
    'no-vest': 'no_vest',
    'no_vest': 'no_vest',
    'without_vest': 'no_vest',
    'no-goggles': 'no_goggles',
    'no_goggles': 'no_goggles',
}

# Workplace Safety Rules & Severity Definitions
DEFAULT_SAFETY_RULES = {
    'require_helmet': {
        'enabled': True,
        'severity': 'High',
        'description': 'Head injury hazard detected: Worker without certified hard hat / helmet.'
    },
    'require_vest': {
        'enabled': True,
        'severity': 'High',
        'description': 'Low-visibility hazard detected: Worker without high-visibility safety vest.'
    },
    'require_goggles': {
        'enabled': False,
        'severity': 'Medium',
        'description': 'Eye safety hazard: Worker without required protective eyewear in active zone.'
    }
}
