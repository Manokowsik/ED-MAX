import { useEffect, useState } from "react";

import {
  getAdminDashboard,
  getStudents,
  getCourses,
  getCourseProgress,
  getStudentAssignedCourses,
  createStudent,
  createCourse,
  assignCourse,
} from "../services/api";


// =====================================================
// ADMIN DASHBOARD
// =====================================================

export default function AdminDashboard() {

  // ===================================================
  // STATE
  // ===================================================

  const [dashboard, setDashboard] = useState({
    students: 0,
    courses: 0,
    enrollments: 0,
    completed: 0,
    certificates: 0,
  });

  const [students, setStudents] = useState([]);

  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");


  // ===================================================
  // CREATE STUDENT FORM
  // ===================================================

  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  const [creatingStudent, setCreatingStudent] = useState(false);


  // ===================================================
  // CREATE COURSE FORM
  // ===================================================

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const [creatingCourse, setCreatingCourse] = useState(false);


  // ===================================================
  // ASSIGN COURSE FORM
  // ===================================================

  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

  const [assigningCourse, setAssigningCourse] = useState(false);


  // ===================================================
  // LOAD DASHBOARD
  // ===================================================

  async function loadDashboard() {

    try {

      setLoading(true);
      setError("");

      const [
        dashboardData,
        studentsData,
        coursesData,
      ] = await Promise.all([
        getAdminDashboard(),
        getStudents(),
        getCourses(),
      ]);


      // -----------------------------------------------
      // Dashboard statistics
      // -----------------------------------------------

      setDashboard({
        students: dashboardData.students || 0,
        courses: dashboardData.courses || 0,
        enrollments: dashboardData.enrollments || 0,
        completed: dashboardData.completed || 0,
        certificates: dashboardData.certificates || 0,
      });


      // -----------------------------------------------
      // Students
      // -----------------------------------------------

      setStudents(
        studentsData.students || []
      );


      // -----------------------------------------------
      // Courses
      // -----------------------------------------------

      setCourses(
        coursesData.courses || coursesData || []
      );

    } catch (err) {

      console.error(err);

      setError(
        err.message || "Failed to load dashboard"
      );

    } finally {

      setLoading(false);

    }
  }


  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {

    loadDashboard();

  }, []);


  // ===================================================
  // CREATE STUDENT
  // ===================================================

  async function handleCreateStudent(e) {

    e.preventDefault();

    if (
      !studentName.trim() ||
      !studentEmail.trim() ||
      !studentPassword.trim()
    ) {

      alert("Please fill all student fields.");

      return;
    }


    try {

      setCreatingStudent(true);

      await createStudent(
        studentName,
        studentEmail,
        studentPassword
      );


      alert("Student created successfully.");


      // Clear form

      setStudentName("");
      setStudentEmail("");
      setStudentPassword("");


      // Reload dashboard

      await loadDashboard();

    } catch (err) {

      alert(
        err.message || "Failed to create student"
      );

    } finally {

      setCreatingStudent(false);

    }
  }


  // ===================================================
  // CREATE COURSE
  // ===================================================

  async function handleCreateCourse(e) {

    e.preventDefault();

    if (!courseTitle.trim()) {

      alert("Course title is required.");

      return;
    }


    /*
      For now we use the logged-in admin ID.

      If your login response stores the admin ID
      in localStorage, this will use it.
    */

    const adminId =
      localStorage.getItem("userId") || "1";


    try {

      setCreatingCourse(true);

      await createCourse(
        courseTitle,
        courseDescription,
        adminId
      );


      alert("Course created successfully.");


      // Clear form

      setCourseTitle("");
      setCourseDescription("");


      // Reload dashboard

      await loadDashboard();

    } catch (err) {

      alert(
        err.message || "Failed to create course"
      );

    } finally {

      setCreatingCourse(false);

    }
  }


  // ===================================================
  // ASSIGN COURSE
  // ===================================================

  async function handleAssignCourse(e) {

    e.preventDefault();

    if (!selectedCourse || !selectedStudent) {

      alert(
        "Please select both a course and a student."
      );

      return;
    }


    try {

      setAssigningCourse(true);

      await assignCourse(
        selectedCourse,
        selectedStudent
      );


      alert("Course assigned successfully.");


      setSelectedCourse("");
      setSelectedStudent("");


      // Refresh dashboard

      await loadDashboard();

    } catch (err) {

      alert(
        err.message || "Failed to assign course"
      );

    } finally {

      setAssigningCourse(false);

    }
  }


  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {

    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingText}>
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <div style={styles.page}>

      {/* =================================================
          HEADER
      ================================================= */}

      <header style={styles.header}>

        <div>

          <h1 style={styles.title}>
            Training Platform
          </h1>

          <p style={styles.subtitle}>
            Admin Dashboard
          </p>

        </div>


        <button
          onClick={loadDashboard}
          style={styles.refreshButton}
        >
          Refresh
        </button>

      </header>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (

        <div style={styles.errorBox}>
          {error}
        </div>

      )}


      {/* =================================================
          STATISTICS
      ================================================= */}

      <section style={styles.statsGrid}>

        <StatCard
          title="Students"
          value={dashboard.students}
        />

        <StatCard
          title="Courses"
          value={dashboard.courses}
        />

        <StatCard
          title="Enrollments"
          value={dashboard.enrollments}
        />

        <StatCard
          title="Completed"
          value={dashboard.completed}
        />

        <StatCard
          title="Certificates"
          value={dashboard.certificates}
        />

      </section>


      {/* =================================================
          STUDENTS
      ================================================= */}

      <section style={styles.section}>

        <div style={styles.sectionHeader}>

          <div>

            <h2 style={styles.sectionTitle}>
              Students
            </h2>

            <p style={styles.sectionDescription}>
              Manage students and monitor their training progress.
            </p>

          </div>

        </div>


        <div style={styles.tableWrapper}>

          <table style={styles.table}>

            <thead>

              <tr>

                <th style={styles.th}>
                  Name
                </th>

                <th style={styles.th}>
                  Email
                </th>

                <th style={styles.th}>
                  Status
                </th>

                <th style={styles.th}>
                  Courses
                </th>

                <th style={styles.th}>
                  Progress
                </th>

              </tr>

            </thead>


            <tbody>

              {students.length === 0 ? (

                <tr>

                  <td
                    colSpan="5"
                    style={styles.emptyCell}
                  >
                    No students found.
                  </td>

                </tr>

              ) : (

                students.map((student) => (

                  <StudentRow
                    key={student.id}
                    student={student}
                  />

                ))

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =================================================
          COURSES
      ================================================= */}

      <section style={styles.section}>

        <div>

          <h2 style={styles.sectionTitle}>
            Courses
          </h2>

          <p style={styles.sectionDescription}>
            View courses and their current status.
          </p>

        </div>


        <div style={styles.courseGrid}>

          {courses.length === 0 ? (

            <div style={styles.emptyBox}>
              No courses found.
            </div>

          ) : (

            courses.map((course) => (

              <CourseCard
                key={course.id}
                course={course}
              />

            ))

          )}

        </div>

      </section>


      {/* =================================================
          MANAGEMENT
      ================================================= */}

      <section style={styles.section}>

        <h2 style={styles.sectionTitle}>
          Management
        </h2>

        <p style={styles.sectionDescription}>
          Create users, courses and assign training.
        </p>


        <div style={styles.managementGrid}>


          {/* =============================================
              CREATE STUDENT
          ============================================= */}

          <div style={styles.formCard}>

            <h3 style={styles.formTitle}>
              Create Student
            </h3>

            <form onSubmit={handleCreateStudent}>

              <label style={styles.label}>
                Name
              </label>

              <input
                type="text"
                value={studentName}
                onChange={(e) =>
                  setStudentName(e.target.value)
                }
                placeholder="Student name"
                style={styles.input}
              />


              <label style={styles.label}>
                Email
              </label>

              <input
                type="email"
                value={studentEmail}
                onChange={(e) =>
                  setStudentEmail(e.target.value)
                }
                placeholder="student@example.com"
                style={styles.input}
              />


              <label style={styles.label}>
                Password
              </label>

              <input
                type="password"
                value={studentPassword}
                onChange={(e) =>
                  setStudentPassword(e.target.value)
                }
                placeholder="Password"
                style={styles.input}
              />


              <button
                type="submit"
                disabled={creatingStudent}
                style={styles.primaryButton}
              >

                {creatingStudent
                  ? "Creating..."
                  : "Create Student"}

              </button>

            </form>

          </div>


          {/* =============================================
              CREATE COURSE
          ============================================= */}

          <div style={styles.formCard}>

            <h3 style={styles.formTitle}>
              Create Course
            </h3>

            <form onSubmit={handleCreateCourse}>

              <label style={styles.label}>
                Course Title
              </label>

              <input
                type="text"
                value={courseTitle}
                onChange={(e) =>
                  setCourseTitle(e.target.value)
                }
                placeholder="Python for Beginners"
                style={styles.input}
              />


              <label style={styles.label}>
                Description
              </label>

              <textarea
                value={courseDescription}
                onChange={(e) =>
                  setCourseDescription(e.target.value)
                }
                placeholder="Course description"
                style={styles.textarea}
              />


              <button
                type="submit"
                disabled={creatingCourse}
                style={styles.primaryButton}
              >

                {creatingCourse
                  ? "Creating..."
                  : "Create Course"}

              </button>

            </form>

          </div>


          {/* =============================================
              ASSIGN COURSE
          ============================================= */}

          <div style={styles.formCard}>

            <h3 style={styles.formTitle}>
              Assign Course
            </h3>

            <form onSubmit={handleAssignCourse}>


              <label style={styles.label}>
                Course
              </label>

              <select
                value={selectedCourse}
                onChange={(e) =>
                  setSelectedCourse(e.target.value)
                }
                style={styles.input}
              >

                <option value="">
                  Select course
                </option>

                {courses.map((course) => (

                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title}
                  </option>

                ))}

              </select>


              <label style={styles.label}>
                Student
              </label>

              <select
                value={selectedStudent}
                onChange={(e) =>
                  setSelectedStudent(e.target.value)
                }
                style={styles.input}
              >

                <option value="">
                  Select student
                </option>

                {students.map((student) => (

                  <option
                    key={student.id}
                    value={student.id}
                  >
                    {student.name} — {student.email}
                  </option>

                ))}

              </select>


              <button
                type="submit"
                disabled={assigningCourse}
                style={styles.primaryButton}
              >

                {assigningCourse
                  ? "Assigning..."
                  : "Assign Course"}

              </button>

            </form>

          </div>

        </div>

      </section>

    </div>
  );
}


// =====================================================
// STAT CARD
// =====================================================

function StatCard({ title, value }) {

  return (

    <div style={styles.statCard}>

      <div style={styles.statValue}>
        {value}
      </div>

      <div style={styles.statTitle}>
        {title}
      </div>

    </div>
  );
}


// =====================================================
// STUDENT ROW
// =====================================================

function StudentRow({ student }) {

  const progress =
    student.progress !== null &&
    student.progress !== undefined
      ? `${student.progress}%`
      : "-";


  return (

    <tr>

      <td style={styles.td}>
        <strong>
          {student.name}
        </strong>
      </td>

      <td style={styles.td}>
        {student.email}
      </td>

      <td style={styles.td}>

        <span
          style={
            student.status === "Active"
              ? styles.activeBadge
              : styles.inactiveBadge
          }
        >
          {student.status}
        </span>

      </td>

      <td style={styles.td}>
        {student.courses}
      </td>

      <td style={styles.td}>

        {student.progress !== null &&
        student.progress !== undefined ? (

          <div style={styles.progressContainer}>

            <div style={styles.progressBarBackground}>

              <div
                style={{
                  ...styles.progressBar,
                  width: `${student.progress}%`,
                }}
              />

            </div>

            <span style={styles.progressText}>
              {progress}
            </span>

          </div>

        ) : (

          "-"

        )}

      </td>

    </tr>
  );
}


// =====================================================
// COURSE CARD
// =====================================================

function CourseCard({ course }) {

  return (

    <div style={styles.courseCard}>

      <div style={styles.courseHeader}>

        <h3 style={styles.courseTitle}>
          {course.title}
        </h3>

        <span
          style={
            course.is_active
              ? styles.activeBadge
              : styles.inactiveBadge
          }
        >
          {course.is_active
            ? "Active"
            : "Inactive"}
        </span>

      </div>


      <p style={styles.courseDescription}>

        {course.description ||
          "No description available."}

      </p>


      <div style={styles.courseFooter}>

        <span>
          Course ID: {course.id}
        </span>

      </div>

    </div>
  );
}


// =====================================================
// STYLES
// =====================================================

const styles = {

  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "30px",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#1f2937",
  },


  // ---------------------------------------------------
  // HEADER
  // ---------------------------------------------------

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },


  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: "700",
  },


  subtitle: {
    marginTop: "6px",
    marginBottom: 0,
    color: "#6b7280",
  },


  refreshButton: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },


  // ---------------------------------------------------
  // ERROR
  // ---------------------------------------------------

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px",
    borderRadius: "8px",
    marginBottom: "20px",
    border:
      "1px solid #fecaca",
  },


  // ---------------------------------------------------
  // LOADING
  // ---------------------------------------------------

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f5f7fa",
  },


  loadingText: {
    fontSize: "20px",
    fontWeight: "600",
  },


  // ---------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(5, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "30px",
  },


  statCard: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    border:
      "1px solid #e5e7eb",
    boxShadow:
      "0 2px 6px rgba(0,0,0,0.05)",
  },


  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    marginBottom: "8px",
  },


  statTitle: {
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: "600",
  },


  // ---------------------------------------------------
  // SECTION
  // ---------------------------------------------------

  section: {
    background: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "25px",
    border:
      "1px solid #e5e7eb",
  },


  sectionHeader: {
    marginBottom: "20px",
  },


  sectionTitle: {
    marginTop: 0,
    marginBottom: "6px",
    fontSize: "22px",
  },


  sectionDescription: {
    marginTop: 0,
    color: "#6b7280",
    fontSize: "14px",
  },


  // ---------------------------------------------------
  // TABLE
  // ---------------------------------------------------

  tableWrapper: {
    overflowX: "auto",
  },


  table: {
    width: "100%",
    borderCollapse: "collapse",
  },


  th: {
    textAlign: "left",
    padding: "14px",
    borderBottom:
      "2px solid #e5e7eb",
    fontSize: "13px",
    color: "#6b7280",
  },


  td: {
    padding: "16px 14px",
    borderBottom:
      "1px solid #e5e7eb",
    fontSize: "14px",
  },


  emptyCell: {
    padding: "30px",
    textAlign: "center",
    color: "#6b7280",
  },


  // ---------------------------------------------------
  // STATUS
  // ---------------------------------------------------

  activeBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "20px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: "600",
  },


  inactiveBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "20px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: "600",
  },


  // ---------------------------------------------------
  // PROGRESS
  // ---------------------------------------------------

  progressContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "150px",
  },


  progressBarBackground: {
    width: "100px",
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "10px",
    overflow: "hidden",
  },


  progressBar: {
    height: "100%",
    background: "#2563eb",
    borderRadius: "10px",
  },


  progressText: {
    fontSize: "13px",
    fontWeight: "600",
  },


  // ---------------------------------------------------
  // COURSES
  // ---------------------------------------------------

  courseGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    marginTop: "20px",
  },


  courseCard: {
    border:
      "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "20px",
  },


  courseHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
  },


  courseTitle: {
    margin: 0,
    fontSize: "18px",
  },


  courseDescription: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: "1.5",
    minHeight: "42px",
  },


  courseFooter: {
    paddingTop: "12px",
    borderTop:
      "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: "12px",
  },


  emptyBox: {
    padding: "30px",
    textAlign: "center",
    color: "#6b7280",
    border:
      "1px dashed #d1d5db",
    borderRadius: "10px",
  },


  // ---------------------------------------------------
  // MANAGEMENT
  // ---------------------------------------------------

  managementGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, minmax(0, 1fr))",
    gap: "20px",
    marginTop: "20px",
  },


  formCard: {
    border:
      "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "20px",
  },


  formTitle: {
    marginTop: 0,
    marginBottom: "20px",
    fontSize: "18px",
  },


  label: {
    display: "block",
    marginBottom: "7px",
    marginTop: "14px",
    fontSize: "13px",
    fontWeight: "600",
  },


  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: "7px",
    fontSize: "14px",
    outline: "none",
  },


  textarea: {
    width: "100%",
    minHeight: "100px",
    boxSizing: "border-box",
    padding: "10px 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: "7px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },


  primaryButton: {
    width: "100%",
    marginTop: "20px",
    padding: "11px 15px",
    border: "none",
    borderRadius: "7px",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
  },
};