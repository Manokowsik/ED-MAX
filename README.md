# ED-MAX Full-Stack Training & Certification Platform

A modern, multi-tenant learning management system (LMS) designed for enterprise organizations, course authoring, interactive student learning, server-validated quizzes, progress persistence, and verified certificate issuance.

---

## 🚀 Key Features

- **Multi-Tenant Architecture**: Complete data isolation across distinct enterprise organizations.
- **Admin / Instructor Authoring**: Single unified `ADMIN` role for managing organization members, authoring courses, published/draft module content, and quiz creation.
- **Enforced Learning Progression**:
  - **Module Content** → **Quiz Attempt** → **Server-Side Scoring** → **Passing Threshold (≥ 70%)** → **Module Progress & Course Completion**.
- **Real PDF Certificate Download**: Instant client-side PDF document generation for completed courses with unique certificate numbers and QR/URL validation.
- **Security & Authorization**:
  - Role-Based Access Control (`ADMIN` vs `STUDENT`).
  - IDOR & Org isolation guards on every API route.
  - Server-calculated quiz scores with zero leakage of correct answer flags in client payloads.
- **Reproducible Database Migrations**: Alembic base migration `000_base_schema.py` enabling complete zero-to-hero database creation from a fresh PostgreSQL instance.
- **Development Seed Data**: One-command CLI seed script creating published demo courses, modules, text/video content, quizzes, and pre-configured test credentials.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend API** | FastAPI (Python 3.14+) | Async REST API, OpenAPI docs, security dependencies |
| **Database** | PostgreSQL | Relational storage with foreign keys, cascades, & indexes |
| **Database Driver** | `psycopg` (v3) | High-performance parameterized SQL execution |
| **Migrations** | Alembic | Version-controlled schema migrations (`alembic upgrade head`) |
| **Frontend UI** | React 19 + Vite | Dynamic SPA with responsive modern design system |
| **Styling** | Custom Vanilla CSS | HSL variables, glassmorphism, responsive grid/flexbox |
| **PDF Generation** | `html2pdf.js` / `jspdf` | High-fidelity landscape PDF certificate export |
| **Frontend Tests** | Vitest + React Testing Library | Component unit testing and assertions |
| **Backend Tests** | Pytest + HTTPX TestClient | End-to-end API integration test coverage |

---

## 📐 System Architecture & ER Diagram

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "has members"
    ORGANIZATIONS ||--o{ COURSES : "owns"
    USERS ||--o{ ENROLLMENTS : "enrolled in"
    COURSES ||--o{ ENROLLMENTS : "has students"
    COURSES ||--o{ COURSE_MODULES : "contains"
    COURSE_MODULES ||--o{ TRAINING_CONTENTS : "contains"
    COURSE_MODULES ||--o{ QUIZZES : "has quiz"
    QUIZZES ||--o{ QUIZ_QUESTIONS : "contains"
    QUIZ_QUESTIONS ||--o{ QUIZ_OPTIONS : "contains"
    USERS ||--o{ MODULE_PROGRESS : "tracks"
    COURSE_MODULES ||--o{ MODULE_PROGRESS : "tracked in"
    USERS ||--o{ QUIZ_ATTEMPTS : "submits"
    QUIZZES ||--o{ QUIZ_ATTEMPTS : "recorded for"
    USERS ||--o{ CERTIFICATES : "earns"
    COURSES ||--o{ CERTIFICATES : "issued for"

    USERS {
        int id PK
        string email UK
        string role "ADMIN | STUDENT"
        int organization_id FK
        boolean is_active
    }

    COURSES {
        int id PK
        string title
        int organization_id FK
        boolean is_active
    }

    COURSE_MODULES {
        int id PK
        int course_id FK
        string title
        boolean is_published
    }

    QUIZZES {
        int id PK
        int module_id FK
        int passing_score
    }

    CERTIFICATES {
        int id PK
        string certificate_number UK
        int student_id FK
        int course_id FK
        int final_score
    }
```

---

## 🔑 Role & Authorization Design Decision

The system deliberately operates on two backend roles:
- **`ADMIN`**: Acts as both system administrator and course author/instructor for their organization.
- **`STUDENT`**: Learner assigned to courses within their organization.

> **Design Rationale**: In modern enterprise LMS environments, administrators frequently author training modules and assign students directly. Rather than introducing duplicate role abstractions, `ADMIN` encompasses full authoring and management privileges.

---

## ⚡ Local Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & `npm`
- PostgreSQL 14+ running locally

### 2. Environment Configuration

Copy environment templates:
```bash
# Backend .env configuration
cp backend/.env.example backend/.env
```

Ensure `DATABASE_URL` matches your local PostgreSQL credentials in `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/training_platform
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
```

### 3. Backend Setup & Database Migration

```bash
cd backend

# Create & activate Python virtual environment
python -m venv venv
.\venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Run Alembic migrations from fresh PostgreSQL database
alembic upgrade head

# Seed Demonstration Data (Creates published course, quiz, admin & student accounts)
python -m app.db.seed
```

**Seeded Credentials for Local Testing:**
- **Admin / Instructor**: `admin@edmax.local` / `AdminPass123!`
- **Student**: `student@edmax.local` / `StudentPass123!`

### 4. Backend Server Startup

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
API Documentation available at: `http://localhost:8000/docs`

### 5. Frontend Setup & Startup

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Open application in browser at: `http://localhost:5173`

---

## 🧪 Running Automated Test Suites

### Backend Integration Tests (Pytest)
```bash
cd backend
.\venv\Scripts\pytest
```

### Frontend Unit Tests (Vitest)
```bash
cd frontend
npm run test
```

### Frontend Production Build Verification
```bash
cd frontend
npm run build
```

---

## 📜 Workflows & Key Features

### Admin Workflow
1. Log in as Admin (`admin@edmax.local`).
2. Navigate to **Course Catalog** to create a course.
3. Add modules, published text/video content, and create quizzes with multiple-choice options.
4. Assign learners to courses on the **Learners** tab.

### Student Workflow
1. Log in as Student (`student@edmax.local`).
2. Open assigned courses on **My Dashboard**.
3. Review published text/video training content.
4. Complete the end-of-module **Quiz** and achieve a passing score (≥ 70%).
5. Mark module completed to update overall course progress.
6. Upon 100% course completion, claim the course **Certificate**.

### Certificate & Download Workflow
1. View earned certificate on the **Certificates** page.
2. Click **Download PDF** to export a landscape `.pdf` document with student name, course title, final score, completion date, and certificate number.
3. Authenticate validity publicly using the certificate number at `/verify/{cert_number}`.
