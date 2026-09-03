ED-MAX Training & Certification Platform

A learning platform built for organizations that want to train people, test what they've learned, and issue certificates once they pass. Instructors create courses and quizzes; students work through the material, take quizzes, and earn certificates when they finish.

🚀 What It Does
Separate Organizations: Each organization's courses, students, and data stay separate from everyone else's.
One Instructor/Admin Role: A single ADMIN role that can manage members, create courses, write lesson content, and build quizzes — no need to juggle multiple staff roles.
Clear Learning Path: Students go through Module Content → take a Quiz → get a score calculated by the server → need 70% or higher to pass → module and course progress update automatically.
Certificate Downloads: Once a student finishes a course, they can download a real PDF certificate with their name, score, completion date, and a certificate number they can use to verify it.
Basic Security:
Students and admins have different permissions (ADMIN vs STUDENT).
Every API request checks that users can only see their own organization's data.
Quiz answers are graded on the server, so students can't see correct answers in the app's data before submitting.
Easy Database Setup: One Alembic migration file sets up the whole database from scratch.
Sample Data Included: A single command loads demo courses, quizzes, and test login accounts so you can try the platform right away.
🛠️ Built With
Layer	Technology	Purpose
Backend API	FastAPI (Python 3.10+)	Handles requests, auth, and business logic
Database	PostgreSQL	Stores courses, users, quizzes, progress, certificates
Database Driver	psycopg (v3)	Talks to PostgreSQL
Migrations	Alembic	Sets up and updates the database schema
Frontend	React 19 + Vite	The web app students and instructors use
Styling	Custom CSS	Clean, responsive design
PDF Generation	html2pdf.js / jspdf	Generates the certificate PDF
Frontend Tests	Vitest + React Testing Library	Tests the UI
Backend Tests	Pytest + HTTPX TestClient	Tests the API
📐 How the Data Fits Together
has members
owns
enrolled in
has students
contains
contains
has quiz
contains
contains
tracks
tracked in
submits
recorded for
earns
issued for
ORGANIZATIONS
USERS
int
id
PK
string
email
UK
string
role
ADMIN | STUDENT
int
organization_id
FK
boolean
is_active
COURSES
int
id
PK
string
title
int
organization_id
FK
boolean
is_active
ENROLLMENTS
COURSE_MODULES
int
id
PK
int
course_id
FK
string
title
boolean
is_published
TRAINING_CONTENTS
QUIZZES
int
id
PK
int
module_id
FK
int
passing_score
QUIZ_QUESTIONS
QUIZ_OPTIONS
MODULE_PROGRESS
QUIZ_ATTEMPTS
CERTIFICATES
int
id
PK
string
certificate_number
UK
int
student_id
FK
int
course_id
FK
int
final_score
🔑 Why Only Two Roles?
ADMIN: Runs the organization's account and also writes the courses, modules, and quizzes — basically the instructor.
STUDENT: Takes the courses assigned to them.

We kept it to two roles on purpose — in most training setups, the same person who manages the account is also the one writing the training material. Adding a separate "instructor" role would just mean more roles to manage without giving students or admins anything extra.

⚡ Getting It Running Locally
1. What You'll Need
Python 3.10+
Node.js 18+ & npm
PostgreSQL 14+ running locally
2. Set Up Your Environment

Copy the example environment file:

bash
cp backend/.env.example backend/.env

Update DATABASE_URL in backend/.env to match your local PostgreSQL setup:

env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/training_platform
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
3. Backend Setup
bash
cd backend

# Create & activate a virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up the database
alembic upgrade head

# Load demo data (sample course, quiz, and test logins)
python -m app.db.seed

Test Accounts (created by the seed script):

Role	Email	Password
Admin / Instructor	admin@edmax.local	AdminPass123!
Student	student@edmax.local	StudentPass123!
4. Start the Backend
bash
cd backend
uvicorn app.main:app --reload --port 8000

API docs available at http://localhost:8000/docs

5. Start the Frontend
bash
cd frontend
npm install
npm run dev

Open http://localhost:5173 in your browser.

🧪 Running Tests
Backend (Pytest)
bash
cd backend
.\venv\Scripts\pytest   # Windows
venv/bin/pytest         # macOS/Linux
Frontend (Vitest)
bash
cd frontend
npm run test
Frontend Build Check
bash
cd frontend
npm run build
📜 How People Actually Use It
If You're an Instructor/Admin
Log in as Admin (admin@edmax.local).
Go to the Course Catalog and create a course.
Add modules, write lesson content (text or video), and build a quiz for each module.
Assign students to the course from the Learners tab.
If You're a Student
Log in as Student (student@edmax.local).
Find your assigned courses on My Dashboard.
Go through the lesson content in each module.
Take the quiz at the end of the module — you need 70% or higher to pass.
Mark the module complete; your course progress updates.
Once you finish every module, your certificate is ready to claim.
Certificates
See your earned certificates on the Certificates page.
Click Download PDF for a certificate with your name, course title, score, completion date, and a certificate number.
Anyone can check that a certificate is real at /verify/{cert_number}.
📄 License

Provided for educational and demonstration purposes. All rights reserved unless otherwise stated.