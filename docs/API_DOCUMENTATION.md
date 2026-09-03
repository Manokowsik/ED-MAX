ED-MAX Training Platform — API Documentation

Welcome to the ED-MAX Training Platform API Documentation. This document provides detailed information on all RESTful endpoints, request/response contracts, authentication methods, role permissions, and error handling.

📋 Table of Contents
Overview & Base URL
Authentication & Authorization
Error Handling & Status Codes
Endpoints Reference
Auth & Account Lifecycle
Admin & User Management
Courses & Curriculums
Course Modules
Training Content
Quizzes & Assessments
Certificates & Verification
Student Progress & Telemetry
User Profile & Settings
Notifications
🌐 Overview & Base URL
Item	Value
Development Base URL	http://localhost:8000 (or http://127.0.0.1:8000)
Content-Type	application/json
Interactive OpenAPI Spec (Swagger UI)	http://localhost:8000/docs
ReDoc Documentation	http://localhost:8000/redoc
🔐 Authentication & Authorization

The API uses JWT (JSON Web Tokens) for stateless authentication, with short-lived Access Tokens and long-lived Refresh Tokens.

Authorization Header

Include the access token in the Authorization HTTP header for protected routes:

http
Authorization: Bearer <access_token>
User Roles
Role	Description
ADMIN	Platform / organization administrator with full content authoring, user management, and telemetry privileges.
STUDENT	Learner role with access to enrolled courses, content consumption, quiz attempts, progress tracking, and certificate generation.
PUBLIC	Endpoints accessible without authentication (e.g. login, sign-up, email verification, public certificate verification).
⚠️ Error Handling & Status Codes

All error responses use a standard JSON payload format:

json
{
  "detail": "Descriptive error message"
}
HTTP Code	Description	Reason
200 OK	Request succeeded	Standard success response
201 Created	Resource created	Successful entity creation
400 Bad Request	Invalid input or business logic violation	Missing fields, invalid state, attempt failed
401 Unauthorized	Unauthenticated	Missing or expired JWT token
403 Forbidden	Access denied	User role lacks permissions for the resource
404 Not Found	Resource missing	Invalid ID or entity does not exist
422 Unprocessable Entity	Validation error	Pydantic model validation failure
500 Internal Server Error	Server fault	Unexpected internal backend error
🚀 Endpoints Reference
1. Auth & Account Lifecycle
POST /auth/login
	
Access	Public
Description	Authenticates Admin or Student credentials and returns JWT tokens with user metadata.

Request Body

json
{
  "email": "user@example.com",
  "password": "SecretPassword123!"
}

Response 200 OK

json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "name": "Kowsik",
    "email": "user@example.com",
    "role": "ADMIN",
    "organization_id": 1
  }
}
POST /auth/admin-signup
	
Access	Public
Description	Self-serve registration for new organization administrators. Triggers a verification OTP email.

Request Body

json
{
  "name": "Admin Name",
  "email": "admin@organization.com",
  "password": "StrongPassword123!",
  "confirm_password": "StrongPassword123!"
}
POST /auth/verify-email
	
Access	Public
Description	Verifies a user's email using the 6-digit OTP sent by email.

Request Body

json
{
  "email": "admin@organization.com",
  "otp": "123456"
}
POST /auth/resend-otp
	
Access	Public
Description	Resends a fresh email verification OTP.

Request Body

json
{ "email": "admin@organization.com" }
POST /auth/refresh
	
Access	Public (requires a valid Refresh Token in header or body)
Description	Issues a fresh Access Token using a valid Refresh Token.
POST /auth/forgot-password
	
Access	Public
Description	Sends a password reset token by email.
POST /auth/reset-password
	
Access	Public
Description	Resets an account password using a reset token.
POST /auth/activate-account
	
Access	Public
Description	Activates an invited student account and sets their password.
2. Admin & User Management
GET /admin/dashboard
	
Access	Admin only (ADMIN)
Description	Fetches aggregated telemetry, active counts, course performance metrics, and recent learner quiz activity.

Response 200 OK

json
{
  "summary": {
    "total_courses": 5,
    "total_students": 42,
    "total_enrollments": 85,
    "total_certificates": 18
  },
  "recent_quiz_attempts": [ ],
  "courses": [ ]
}
POST /admin/students
	
Access	Admin only (ADMIN)
Description	Invites a new student to the organization and sends an activation email. Optionally assigns an initial course.

Request Body

json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "course_id": 1
}
GET /admin/students
	
Access	Admin only (ADMIN)
Description	Returns all students belonging to the administrator's organization.
GET /admin/students/{student_id}
	
Access	Admin only (ADMIN)
Description	Retrieves a detailed student profile, enrollment status, and progress metrics.
PATCH /admin/students/{student_id}/activate
	
Access	Admin only (ADMIN)
Description	Re-activates a deactivated student account.
PATCH /admin/students/{student_id}/deactivate
	
Access	Admin only (ADMIN)
Description	Deactivates a student's access to the organization.
3. Courses & Curriculums
GET /courses/
	
Access	Admin or Student
Description	Returns organization courses for Admins, or active enrolled courses for Students.
POST /courses/
	
Access	Admin only (ADMIN)
Description	Creates a new course in the administrator's organization.

Request Body

json
{
  "title": "Python Full Stack Development",
  "description": "Comprehensive full stack training program."
}
GET /courses/{course_id}
	
Access	Authenticated users
Description	Retrieves course details, including published modules and content.
PUT /courses/{course_id}
	
Access	Admin only (ADMIN)
Description	Updates a course's title, description, or activation status (is_active).
DELETE /courses/{course_id}
	
Access	Admin only (ADMIN)
Description	Deletes a course.
POST /courses/{course_id}/assign
	
Access	Admin only (ADMIN)
Description	Enrolls/assigns a student to a course.

Request Body

json
{ "student_id": 4 }
DELETE /courses/{course_id}/assign/{student_id}
	
Access	Admin only (ADMIN)
Description	Unassigns/removes a student from a course.
4. Course Modules
POST /courses/{course_id}/modules
	
Access	Admin only (ADMIN)
Description	Adds a new module to a course.

Request Body

json
{
  "title": "Module 1: Fundamentals",
  "description": "Overview of core concepts.",
  "module_order": 1,
  "objectives": ["Understand syntax", "Write basic scripts"],
  "key_takeaways": ["Python basics"],
  "is_published": true
}
PUT /courses/modules/{module_id}
	
Access	Admin only (ADMIN)
Description	Updates module metadata, ordering, learning objectives, and publication status.
DELETE /courses/modules/{module_id}
	
Access	Admin only (ADMIN)
Description	Deletes a module and its associated quizzes/content.
POST /courses/modules/{module_id}/complete
	
Access	Student only (STUDENT)
Description	Marks a module completed for the authenticated student after completing required reading/quizzes.
5. Training Content
POST /courses/modules/{module_id}/content
	
Access	Admin only (ADMIN)
Description	Adds a training content item to a module.
Supported Content Types	TEXT, VIDEO, DOCUMENT, LINK, CODE

Request Body

json
{
  "content_type": "VIDEO",
  "title": "Introductory Video Lecture",
  "content": "https://example.com/stream/lecture1.mp4",
  "content_order": 1
}
PUT /courses/modules/{module_id}/content/{content_id}
	
Access	Admin only (ADMIN)
Description	Updates a content item.
DELETE /courses/modules/{module_id}/content/{content_id}
	
Access	Admin only (ADMIN)
Description	Removes a content item.
6. Quizzes & Assessments
POST /quizzes/
	
Access	Admin only (ADMIN)
Description	Creates an assessment quiz for a module.

Request Body

json
{
  "module_id": 1,
  "title": "Python Syntax Quiz",
  "description": "Assess basic knowledge",
  "passing_score": 70
}
GET /quizzes/{quiz_id}
	
Access	Authenticated users
Description	Gets quiz questions and answer choices (correct-answer flags are hidden from students taking the quiz).
POST /quizzes/{quiz_id}/questions
	
Access	Admin only (ADMIN)
Description	Adds a multiple-choice question to a quiz.
POST /quizzes/questions/{question_id}/options
	
Access	Admin only (ADMIN)
Description	Adds an answer option to a question (is_correct: true/false).
POST /quizzes/{quiz_id}/submit
	
Access	Student only (STUDENT)
Description	Submits student quiz answers, performs server-side grading, records the attempt score, and updates module progress if the passing score is met.

Request Body

json
{
  "answers": {
    "question_id_1": "option_id_2",
    "question_id_2": "option_id_4"
  }
}

Response 200 OK

json
{
  "score": 85,
  "passed": true,
  "passing_score": 70,
  "attempt_id": 12,
  "message": "Congratulations! You passed the quiz."
}
7. Certificates & Verification
GET /certificates/verify/{certificate_number}
	
Access	Public (no authentication required)
Description	Verifies certificate authenticity by certificate number. Accessible to students, instructors, employers, and external visitors.
Public Portal	/verify/{certificate_number} or /verify

Response 200 OK

json
{
  "valid": true,
  "certificate": {
    "certificate_number": "CERT-1-4-ABC12345",
    "student_name": "Jane Doe",
    "course_title": "Python Full Stack Development",
    "final_score": 92,
    "issued_at": "2026-09-03T12:00:00Z"
  }
}
POST /certificates/courses/{course_id}
	
Access	Student only (STUDENT)
Description	Generates an official Certificate of Completion once all course modules are completed and quizzes are passed.
GET /certificates/student/{student_id}
	
Access	Student (own records) or Admin (organization students)
Description	Lists all earned certificates for a student.
8. Student Progress & Telemetry
GET /students/{student_id}/dashboard
	
Access	Student (own) or Admin
Description	Retrieves student dashboard analytics, including overall completion %, active enrollments, recent quiz attempts, and certificates earned.
9. User Profile & Settings
GET /users/me (also available at /api/users/me)
	
Access	Authenticated users
Description	Fetches the current authenticated user's profile and organization info.
PATCH /users/me
	
Access	Authenticated users
Description	Updates the user's display name.
POST /users/me/change-password
	
Access	Authenticated users
Description	Changes the user's account password.

Request Body

json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
DELETE /users/me
	
Access	Authenticated users
Description	Deletes the account, requiring confirmation text and current password verification.
10. Notifications
GET /notifications
	
Access	Authenticated users
Description	Returns recent user notifications (unread count and recent items).
PATCH /notifications/{notification_id}/read
	
Access	Authenticated users
Description	Marks a specific notification as read.
POST /notifications/read-all
	
Access	Authenticated users
Description	Marks all notifications as read for the user.
📌 Document Information
Field	Value
Platform	ED-MAX Training & LMS Platform
API Version	v1.0.0
Last Updated	September 2026