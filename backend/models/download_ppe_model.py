"""
SafeSight AI - Model Download Helper Script
This script helps download a YOLOv8 PPE model or initializes yolov8n.pt for local inference.
"""

import os
import sys
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent
CUSTOM_MODEL_PATH = MODEL_DIR / 'best.pt'
FALLBACK_MODEL_PATH = MODEL_DIR / 'yolov8n.pt'

# Public open-source YOLOv8 PPE model checkpoint mirror (Hugging Face / GitHub releases)
PPE_MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"

def download_file(url, target_path):
    print(f"[*] Downloading {url} to {target_path}...")
    try:
        def progress_callback(blocks, block_size, total_size):
            downloaded = blocks * block_size
            if total_size > 0:
                percent = min(100.0, downloaded * 100.0 / total_size)
                sys.stdout.write(f"\r    Progress: {percent:.1f}% ({downloaded / 1024 / 1024:.1f} MB)")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, target_path, reporthook=progress_callback)
        print("\n[+] Download completed successfully!")
        return True
    except Exception as e:
        print(f"\n[-] Download failed: {e}")
        return False

def main():
    print("=" * 60)
    print("SafeSight AI - Model Weights Setup")
    print("=" * 60)

    if CUSTOM_MODEL_PATH.exists():
        print(f"[OK] Custom PPE model already present at: {CUSTOM_MODEL_PATH}")
        return

    print("Options:")
    print("1. Download YOLOv8n base model (Fallback/Demo Mode with real worker detection)")
    print("2. Place custom PPE 'best.pt' into backend/models/ manually")
    print("-" * 60)

    choice = input("Enter choice (1/2) [default 1]: ").strip() or "1"

    if choice == "1":
        if FALLBACK_MODEL_PATH.exists():
            print(f"[OK] yolov8n.pt already present at: {FALLBACK_MODEL_PATH}")
        else:
            download_file(PPE_MODEL_URL, FALLBACK_MODEL_PATH)
    else:
        print(f"Please copy your custom trained 'best.pt' file into: {MODEL_DIR}")

if __name__ == '__main__':
    main()
