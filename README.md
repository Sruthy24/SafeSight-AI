# SafeSight AI – AI-Powered Workplace Safety Monitoring System

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![React](https://img.shields.io/badge/Frontend-React-61DAFB)
![Flask](https://img.shields.io/badge/Backend-Flask-lightgrey)
![YOLOv8](https://img.shields.io/badge/Computer%20Vision-YOLOv8-orange)
![RAG](https://img.shields.io/badge/AI-RAG-purple)
![LangGraph](https://img.shields.io/badge/Workflow-LangGraph-green)

**Infosys Springboard Virtual Internship Project**

SafeSight AI is an AI-powered workplace safety monitoring system designed to identify potential safety violations, understand workplace safety documentation, and support safety officers in managing workplace risks.

The system combines computer vision, document intelligence, Retrieval-Augmented Generation (RAG), and agentic AI workflows to provide a unified workplace safety solution.

---

## Project Overview

Workplace safety is essential in construction, manufacturing, and industrial environments. Manual safety monitoring can be time-consuming and may not identify every violation quickly.

SafeSight AI aims to improve this process through:

- Automated visual safety detection using YOLOv8.
- Document processing and knowledge retrieval.
- AI-powered question answering using RAG.
- Multimodal reasoning using visual detection results and safety documents.
- Agentic workflows using LangGraph.
- Incident tracking and supervisor alerts.

## Key Features & Project Milestones

### Milestone 1 – Visual Processing & Safety Detection

- Upload workplace images and videos.
- Analyze visual inputs using YOLOv8.
- Detect supported PPE categories and potential safety violations.
- Display detection results with bounding boxes, labels, and confidence scores.
- Maintain inspection records and safety reports.
- Provide a visual dashboard for monitoring safety information.

### Milestone 2 – Document Intelligence & Knowledge Base

- Upload workplace safety documents such as PDF and TXT files.
- Extract and process document text.
- Split documents into smaller chunks.
- Generate semantic embeddings.
- Store document embeddings in ChromaDB.
- Perform semantic search to retrieve relevant information.
- Support document-based question answering using an integrated language model.
- Display relevant source document information and page references where available.

### Milestone 3 – Multimodal RAG & Agentic Workflows

- Integrate visual detection information with workplace safety document knowledge.
- Implement multimodal Retrieval-Augmented Generation.
- Allow users to ask questions through the AI Assistant.
- Retrieve relevant safety information from the knowledge base.
- Use visual detection results as additional context for answering safety questions.
- Generate context-grounded responses using an integrated language model.
- Implement agentic workflows using LangGraph to coordinate retrieval, evidence processing, and answer generation.
- Support incident management and supervisor alerts as additional safety-management features.

## AI Assistant

The AI Assistant provides a conversational interface for interacting with SafeSight AI.

It helps users:

- Ask questions about workplace safety.
- Retrieve relevant information from uploaded safety documents.
- Understand detected safety violations.
- Combine visual detection information with relevant safety rules.
- Receive answers based on available evidence and retrieved context.

**Example question:**

"Why was this worker identified as unsafe?"

The system can use the YOLO detection results and relevant safety-document information to explain the potential violation.

## Incident Management

Incident Management helps maintain records of detected safety violations.

Depending on the available implementation, incident records can include:

- Incident ID
- Date and time
- Violation type
- Detection confidence
- Supporting evidence
- Incident status

Incident status can be tracked as Open, Under Review, or Resolved.

## Supervisor Alerts

Supervisor Alerts help bring important safety violations to the attention of supervisors through the application's alert interface.

They support faster review and corrective action.

## Technology Stack

### Frontend
- React.js
- Vite
- JavaScript
- CSS
- React Router

### Backend
- Python
- Flask REST API
- Flask-CORS

### Artificial Intelligence
- Ultralytics YOLOv8
- OpenCV
- Sentence Transformers
- Retrieval-Augmented Generation (RAG)
- LangChain
- LangGraph
- Integrated LLM provider

### Vector Database
- ChromaDB

### Data Storage
- SQLite
- File-based document and media storage

### Authentication
- JWT Authentication
- Werkzeug password hashing

## System Architecture

```text
              VISUAL INPUT
          Images and Videos
                  |
                  v
             YOLOv8 Model
                  |
                  v
          Visual Detection Results
                  |
                  |
                  v
             MULTIMODAL RAG
                  ^
                  |
          Safety Document Input
                  |
                  v
         Text Extraction & Chunking
                  |
                  v
             Embeddings
                  |
                  v
              ChromaDB
                  |
                  v
          Document Retrieval
                  |
                  v
          AI Assistant / LLM
                  |
                  v
          LangGraph Workflows
                  |
                  v
          Evidence-Based Answers
                  |
          +-------+--------+
          |                |
          v                v
    Incident Records   Supervisor Alerts
          |
          v
       Dashboard
```

## Project Structure

```text
SafeSight-AI/
|
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- services/
|   |   |-- styles/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |-- package.json
|
|-- backend/
|   |-- app.py
|   |-- models/
|   |-- routes/
|   |-- services/
|   |-- database/
|   |-- uploads/
|   |-- processed/
|   |-- reports/
|   |-- tests/
|   |-- requirements.txt
|
|-- README.md
|-- .gitignore
```

*The structure above is a simplified overview. Actual files may vary.*

## Installation & Setup (Windows)

### Prerequisites

- Python 3.10+
- Node.js and npm
- Git
- VS Code

### 1. Clone the Repository

```powershell
git clone https://github.com/Sruthy24/SafeSight-AI.git
cd SafeSight-AI
```

### 2. Backend Setup

```powershell
cd backend

python -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt
```

Configure the required environment variables in `backend/.env` using the environment-variable names expected by the application.

Never commit API keys, passwords, or secret keys.

### 3. Frontend Setup

Open another terminal:

```powershell
cd SafeSight-AI\frontend

npm install
```

### 4. Run the Application

**Terminal 1 – Backend**

```powershell
cd SafeSight-AI\backend
.\.venv\Scripts\Activate.ps1
python app.py
```

**Terminal 2 – Frontend**

```powershell
cd SafeSight-AI\frontend
npm run dev
```

Open:

http://localhost:5173

Register an account and log in to access the application.

## Important Notes

- The custom YOLOv8 model should be placed at `backend/models/best.pt` if required by the backend configuration.
- Configure the necessary API keys and environment variables locally.
- Do not upload `.env` files, credentials, virtual environments, or `node_modules` to GitHub.
- AI responses depend on the retrieved documents, available detection results, and configured language model.
- Features should be demonstrated only when they have been implemented and tested successfully.

## Project Information

**Project:** SafeSight AI  
**Program:** Infosys Springboard Virtual Internship  
**Focus Areas:** Artificial Intelligence, Computer Vision, RAG, Agentic AI, and Workplace Safety

---

Developed as part of the Infosys Springboard Virtual Internship.
