# SafeSight AI – Model Management & PPE Weights Guide

This directory stores YOLOv8 weights used by SafeSight AI for industrial workplace safety and PPE monitoring.

## Supported Model Configurations

1. **Custom PPE Model (`backend/models/best.pt`) [Recommended]**:
   - A YOLOv8 model fine-tuned on construction / industrial PPE datasets (e.g., Roboflow PPE, Kaggle Hardhat and Safety Vest dataset).
   - Expected classes: `helmet`, `vest`, `goggles`, `person` (or variations such as `hard-hat`, `safety_vest`, `worker`).
   - If present at `backend/models/best.pt`, SafeSight AI automatically detects and uses it.

2. **Base YOLOv8 Model (`backend/models/yolov8n.pt`) [Fallback]**:
   - Standard Ultralytics YOLOv8 nano model trained on COCO (80 general object classes including `person`).
   - When running with `yolov8n.pt`, SafeSight AI operates in a **clearly marked Demonstration Mode**: it detects real human workers in the visual feed, and applies rule-based safety evaluation to demonstrate compliance logic without falsely claiming that the general model detected safety gear directly.

## How to Install PPE Weights

### Option A: Using the Automated Helper Script
Run the automated downloader from the project root:
```bash
python backend/models/download_ppe_model.py
```
This script downloads a verified lightweight YOLOv8 PPE checkpoint or provides direct mirrors.

### Option B: Using Your Own Trained Weights
If you trained a custom YOLOv8 model using Ultralytics:
1. Copy your trained weights file (`best.pt`) to this folder:
   ```
   SafeSight-AI/backend/models/best.pt
   ```
2. Restart the Flask backend. The system will report `Custom PPE Model Loaded` on `GET /api/health` and in the dashboard status pill.

## Class Mapping
Class names vary between public datasets (e.g., `hard-hat` vs `helmet`, `reflective-jacket` vs `vest`). SafeSight AI provides a unified normalization mapping in `backend/config.py` under `CLASS_MAPPINGS`.
