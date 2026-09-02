"""
ED-MAX Development & Demo Seed Script

Executes a full, realistic database seed to bootstrap local development environments:
  - Creates Demo Organization
  - Creates Demo Admin User (admin@edmax.local / AdminPass123!)
  - Creates Demo Student User (student@edmax.local / StudentPass123!)
  - Creates Demo Course with PUBLISHED modules and training content
  - Creates Quiz with MCQ Questions & Options
  - Assigns/Enrolls Student in Course

Usage:
  python -m app.db.seed
"""

import sys
from pwdlib import PasswordHash
from app.db.database import get_connection

password_hasher = PasswordHash.recommended()


def seed_demo_data():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        print("[SEED] Seeding ED-MAX Demonstration Data...")

        # 1. Organization
        cursor.execute("SELECT id FROM organizations WHERE name = %s", ("ED-MAX Demonstration Org",))
        org_row = cursor.fetchone()
        if org_row:
            org_id = org_row[0]
        else:
            cursor.execute(
                "INSERT INTO organizations (name) VALUES (%s) RETURNING id",
                ("ED-MAX Demonstration Org",)
            )
            org_id = cursor.fetchone()[0]

        # 2. Admin User
        admin_email = "admin@edmax.local"
        admin_pass = password_hasher.hash("AdminPass123!")
        cursor.execute("SELECT id FROM users WHERE email = %s", (admin_email,))
        admin_row = cursor.fetchone()
        if admin_row:
            admin_id = admin_row[0]
        else:
            cursor.execute(
                """
                INSERT INTO users (name, email, password_hash, role, organization_id, is_active, is_verified)
                VALUES (%s, %s, %s, 'ADMIN', %s, TRUE, TRUE)
                RETURNING id
                """,
                ("Demo Administrator", admin_email, admin_pass, org_id)
            )
            admin_id = cursor.fetchone()[0]

        # 3. Student User
        student_email = "student@edmax.local"
        student_pass = password_hasher.hash("StudentPass123!")
        cursor.execute("SELECT id FROM users WHERE email = %s", (student_email,))
        student_row = cursor.fetchone()
        if student_row:
            student_id = student_row[0]
        else:
            cursor.execute(
                """
                INSERT INTO users (name, email, password_hash, role, organization_id, is_active, is_verified)
                VALUES (%s, %s, %s, 'STUDENT', %s, TRUE, TRUE)
                RETURNING id
                """,
                ("Demo Student", student_email, student_pass, org_id)
            )
            student_id = cursor.fetchone()[0]

        # Organization Memberships
        cursor.execute(
            """
            INSERT INTO organization_memberships (user_id, organization_id, is_active)
            VALUES (%s, %s, TRUE), (%s, %s, TRUE)
            ON CONFLICT (user_id, organization_id) DO NOTHING
            """,
            (admin_id, org_id, student_id, org_id)
        )

        # 4. Course
        course_title = "Full-Stack Web Development Masterclass"
        cursor.execute("SELECT id FROM courses WHERE title = %s AND organization_id = %s", (course_title, org_id))
        course_row = cursor.fetchone()
        if course_row:
            course_id = course_row[0]
        else:
            cursor.execute(
                """
                INSERT INTO courses (title, description, created_by, organization_id, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                RETURNING id
                """,
                (
                    course_title,
                    "Comprehensive hands-on training covering modern frontend, backend APIs, and PostgreSQL database design.",
                    admin_id,
                    org_id
                )
            )
            course_id = cursor.fetchone()[0]

        # 5. Modules (PUBLISHED = TRUE so students can view them)
        modules_data = [
            {
                "title": "Module 1: Introduction to Web Standards & HTTP Protocols",
                "description": "Learn the foundational mechanics of client-server architecture and HTTP request/response cycles.",
                "order": 1,
                "objectives": ["Understand HTTP methods", "Master status codes", "Analyze headers"],
                "takeaways": ["HTTP is stateless", "REST APIs build on HTTP standards"],
            },
            {
                "title": "Module 2: Building Scalable Backend APIs with FastAPI & PostgreSQL",
                "description": "Architect high-performance REST APIs using FastAPI, Pydantic validation, and PostgreSQL databases.",
                "order": 2,
                "objectives": ["Design database schemas", "Implement JWT auth", "Enforce tenant isolation"],
                "takeaways": ["Parametrize SQL queries", "Structure modular routers"],
            },
        ]

        created_module_ids = []
        for m in modules_data:
            cursor.execute(
                "SELECT id FROM course_modules WHERE course_id = %s AND title = %s",
                (course_id, m["title"])
            )
            mod_row = cursor.fetchone()
            if mod_row:
                m_id = mod_row[0]
            else:
                cursor.execute(
                    """
                    INSERT INTO course_modules (course_id, title, description, module_order, objectives, key_takeaways, is_published)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                    RETURNING id
                    """,
                    (course_id, m["title"], m["description"], m["order"], m["objectives"], m["takeaways"])
                )
                m_id = cursor.fetchone()[0]
            created_module_ids.append(m_id)

        # 6. Training Content
        first_mod_id = created_module_ids[0]
        cursor.execute("SELECT COUNT(*) FROM training_contents WHERE module_id = %s", (first_mod_id,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                """
                INSERT INTO training_contents (module_id, content_type, title, content, content_order)
                VALUES
                (%s, 'TEXT', 'HTTP Core Overview', 'Hypertext Transfer Protocol (HTTP) is the protocol powering communication across the Web.', 1),
                (%s, 'VIDEO', 'HTTP Deep Dive Tutorial', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 2)
                """,
                (first_mod_id, first_mod_id)
            )

        # 7. Quiz & Questions
        cursor.execute("SELECT id FROM quizzes WHERE module_id = %s", (first_mod_id,))
        quiz_row = cursor.fetchone()
        if quiz_row:
            quiz_id = quiz_row[0]
        else:
            cursor.execute(
                """
                INSERT INTO quizzes (module_id, title, description, passing_score)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (first_mod_id, "Module 1 Knowledge Assessment", "Test your understanding of HTTP principles.", 70)
            )
            quiz_id = cursor.fetchone()[0]

            # Question 1
            cursor.execute(
                """
                INSERT INTO quiz_questions (quiz_id, question_text, question_order)
                VALUES (%s, %s, 1)
                RETURNING id
                """,
                (quiz_id, "Which HTTP status code signifies a successful request creation?")
            )
            q1_id = cursor.fetchone()[0]

            cursor.execute(
                """
                INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
                VALUES
                (%s, 'A', '200 OK', FALSE),
                (%s, 'B', '201 Created', TRUE),
                (%s, 'C', '400 Bad Request', FALSE),
                (%s, 'D', '500 Internal Error', FALSE)
                """,
                (q1_id, q1_id, q1_id, q1_id)
            )

            # Question 2
            cursor.execute(
                """
                INSERT INTO quiz_questions (quiz_id, question_text, question_order)
                VALUES (%s, %s, 2)
                RETURNING id
                """,
                (quiz_id, "Which HTTP method is idempotent for retrieving resources?")
            )
            q2_id = cursor.fetchone()[0]

            cursor.execute(
                """
                INSERT INTO quiz_options (question_id, option_label, option_text, is_correct)
                VALUES
                (%s, 'A', 'GET', TRUE),
                (%s, 'B', 'POST', FALSE),
                (%s, 'C', 'PATCH', FALSE),
                (%s, 'D', 'CONNECT', FALSE)
                """,
                (q2_id, q2_id, q2_id, q2_id)
            )

        # 8. Enrollment
        cursor.execute(
            """
            INSERT INTO enrollments (student_id, course_id, status, assigned_at)
            VALUES (%s, %s, 'ASSIGNED', CURRENT_TIMESTAMP)
            ON CONFLICT (student_id, course_id) DO NOTHING
            """,
            (student_id, course_id)
        )

        conn.commit()
        print("[OK] Demo Data Seeded Successfully!")
        print("--------------------------------------------------")
        print(f"  Organization : ED-MAX Demonstration Org")
        print(f"  Admin User   : {admin_email} / AdminPass123!")
        print(f"  Student User : {student_email} / StudentPass123!")
        print(f"  Demo Course  : {course_title} (ID: {course_id})")
        print(f"  Published    : 2 Modules with Text/Video content & Quiz")
        print("--------------------------------------------------")

    except Exception as e:
        conn.rollback()
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Error seeding demo data: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    seed_demo_data()
