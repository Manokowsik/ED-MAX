// =====================================================
// API CONFIGURATION
// =====================================================

const API_BASE_URL = "http://127.0.0.1:8000";


// =====================================================
// COMMON API REQUEST
// =====================================================

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail ||
      data.message ||
      "Something went wrong"
    );
  }

  return data;
}


// =====================================================
// AUTHENTICATION
// =====================================================

// POST /auth/login  — sends JSON body (never query params for credentials)
export async function login(email, password) {
  return apiRequest(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
}


// =====================================================
// ADMIN DASHBOARD
// =====================================================

// GET /admin/dashboard
export async function getAdminDashboard() {
  return apiRequest("/admin/dashboard");
}


// =====================================================
// ADMIN - STUDENTS
// =====================================================

// POST /admin/students  — sends JSON body
export async function createStudent(name, email, password) {
  return apiRequest(
    "/admin/students",
    {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }
  );
}


// GET /admin/students
export async function getStudents() {
  return apiRequest("/admin/students");
}


// GET /admin/students/{student_id}/courses
export async function getStudentAssignedCourses(studentId) {
  return apiRequest(`/admin/students/${studentId}/courses`);
}


// PATCH /admin/students/{student_id}/activate
export async function activateStudent(studentId) {
  return apiRequest(
    `/admin/students/${studentId}/activate`,
    { method: "PATCH" }
  );
}


// PATCH /admin/students/{student_id}/deactivate
export async function deactivateStudent(studentId) {
  return apiRequest(
    `/admin/students/${studentId}/deactivate`,
    { method: "PATCH" }
  );
}


// =====================================================
// COURSES (Admin)
// =====================================================

// GET /courses/
export async function getCourses() {
  return apiRequest("/courses/");
}


// POST /courses/
export async function createCourse(title, description) {
  return apiRequest(
    "/courses/",
    {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }
  );
}


// GET /courses/{course_id}
export async function getCourse(courseId) {
  return apiRequest(`/courses/${courseId}`);
}


// PUT /courses/{course_id}
export async function updateCourse(courseId, title, description, isActive) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (isActive !== undefined) body.is_active = isActive;
  return apiRequest(
    `/courses/${courseId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}


// GET /courses/{course_id}/progress
export async function getCourseProgress(courseId) {
  return apiRequest(`/courses/${courseId}/progress`);
}


// PATCH /courses/{course_id}/activate
export async function activateCourse(courseId) {
  return apiRequest(
    `/courses/${courseId}/activate`,
    { method: "PATCH" }
  );
}


// PATCH /courses/{course_id}/deactivate
export async function deactivateCourse(courseId) {
  return apiRequest(
    `/courses/${courseId}/deactivate`,
    { method: "PATCH" }
  );
}


// POST /courses/{course_id}/assign  — sends JSON body
export async function assignCourse(courseId, studentId) {
  return apiRequest(
    `/courses/${courseId}/assign`,
    {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    }
  );
}


// DELETE /courses/{course_id}/assign/{student_id}
export async function unassignCourse(courseId, studentId) {
  return apiRequest(
    `/courses/${courseId}/assign/${studentId}`,
    { method: "DELETE" }
  );
}


// =====================================================
// STUDENT COURSES
// =====================================================

// GET /courses/student/{student_id}
export async function getStudentCourses(studentId) {
  return apiRequest(`/courses/student/${studentId}`);
}


// GET /courses/student/{student_id}/{course_id}
export async function getStudentCourse(studentId, courseId) {
  return apiRequest(`/courses/student/${studentId}/${courseId}`);
}


// =====================================================
// MODULES
// =====================================================

// POST /courses/{course_id}/modules  — sends JSON body
export async function createModule(courseId, title, description, moduleOrder) {
  return apiRequest(
    `/courses/${courseId}/modules`,
    {
      method: "POST",
      body: JSON.stringify({ title, description, module_order: moduleOrder }),
    }
  );
}


// PUT /courses/modules/{module_id}  — sends JSON body
export async function updateModule(moduleId, title, description, moduleOrder) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (moduleOrder !== undefined) body.module_order = moduleOrder;
  return apiRequest(
    `/courses/modules/${moduleId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}


// DELETE /courses/modules/{module_id}
export async function deleteModule(moduleId) {
  return apiRequest(
    `/courses/modules/${moduleId}`,
    { method: "DELETE" }
  );
}


// =====================================================
// TRAINING CONTENT
// =====================================================

// POST /courses/modules/{module_id}/content  — sends JSON body
export async function createTrainingContent(moduleId, contentType, content, contentOrder) {
  return apiRequest(
    `/courses/modules/${moduleId}/content`,
    {
      method: "POST",
      body: JSON.stringify({
        content_type: contentType,
        content,
        content_order: contentOrder,
      }),
    }
  );
}


// PUT /courses/modules/{module_id}/content/{content_id}  — sends JSON body
export async function updateTrainingContent(moduleId, contentId, contentType, content, contentOrder) {
  const body = {};
  if (contentType !== undefined) body.content_type = contentType;
  if (content !== undefined) body.content = content;
  if (contentOrder !== undefined) body.content_order = contentOrder;
  return apiRequest(
    `/courses/modules/${moduleId}/content/${contentId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}


// DELETE /courses/modules/{module_id}/content/{content_id}
export async function deleteTrainingContent(moduleId, contentId) {
  return apiRequest(
    `/courses/modules/${moduleId}/content/${contentId}`,
    { method: "DELETE" }
  );
}


// =====================================================
// COMPLETE MODULE
// =====================================================

// POST /courses/modules/{module_id}/complete  — token identifies student
export async function completeModule(moduleId) {
  return apiRequest(
    `/courses/modules/${moduleId}/complete`,
    { method: "POST" }
  );
}


// =====================================================
// QUIZZES
// =====================================================

// POST /quizzes/  — sends JSON body
export async function createQuiz(moduleId, title, description, passingScore) {
  return apiRequest(
    "/quizzes/",
    {
      method: "POST",
      body: JSON.stringify({
        module_id: moduleId,
        title,
        description,
        passing_score: passingScore,
      }),
    }
  );
}


// GET /quizzes/{quiz_id}  — token identifies student
export async function getQuiz(quizId) {
  return apiRequest(`/quizzes/${quizId}`);
}


// PUT /quizzes/{quiz_id}  — update quiz metadata
export async function updateQuiz(quizId, { title, description, passingScore } = {}) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (passingScore !== undefined) body.passing_score = passingScore;
  return apiRequest(
    `/quizzes/${quizId}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}


// DELETE /quizzes/{quiz_id}
export async function deleteQuiz(quizId) {
  return apiRequest(`/quizzes/${quizId}`, { method: "DELETE" });
}


// POST /quizzes/{quiz_id}/questions  — sends JSON body
export async function createQuestion(quizId, questionText, questionOrder) {
  return apiRequest(
    `/quizzes/${quizId}/questions`,
    {
      method: "POST",
      body: JSON.stringify({
        question_text: questionText,
        question_order: questionOrder,
      }),
    }
  );
}


// PUT /quizzes/questions/{question_id}
export async function updateQuestion(questionId, { questionText, questionOrder } = {}) {
  const body = {};
  if (questionText !== undefined) body.question_text = questionText;
  if (questionOrder !== undefined) body.question_order = questionOrder;
  return apiRequest(
    `/quizzes/questions/${questionId}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}


// DELETE /quizzes/questions/{question_id}
export async function deleteQuestion(questionId) {
  return apiRequest(`/quizzes/questions/${questionId}`, { method: "DELETE" });
}


// POST /quizzes/questions/{question_id}/options  — sends JSON body
export async function createOption(questionId, optionLabel, optionText, isCorrect) {
  return apiRequest(
    `/quizzes/questions/${questionId}/options`,
    {
      method: "POST",
      body: JSON.stringify({
        option_label: optionLabel,
        option_text: optionText,
        is_correct: isCorrect,
      }),
    }
  );
}


// PUT /quizzes/questions/{question_id}/options/{option_id}
export async function updateOption(questionId, optionId, { optionText, isCorrect } = {}) {
  const body = {};
  if (optionText !== undefined) body.option_text = optionText;
  if (isCorrect !== undefined) body.is_correct = isCorrect;
  return apiRequest(
    `/quizzes/questions/${questionId}/options/${optionId}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}


// DELETE /quizzes/questions/{question_id}/options/{option_id}
export async function deleteOption(questionId, optionId) {
  return apiRequest(
    `/quizzes/questions/${questionId}/options/${optionId}`,
    { method: "DELETE" }
  );
}


// POST /quizzes/{quiz_id}/submit  — token identifies student
export async function submitQuiz(quizId, answers) {
  return apiRequest(
    `/quizzes/${quizId}/submit`,
    {
      method: "POST",
      body: JSON.stringify({ answers }),
    }
  );
}


// =====================================================
// STUDENT PROGRESS
// =====================================================

// GET /students/{student_id}/dashboard
export async function getStudentDashboard(studentId) {
  return apiRequest(`/students/${studentId}/dashboard`);
}


// =====================================================
// CERTIFICATES
// =====================================================

// POST /certificates/courses/{course_id}  — token identifies student
export async function generateCertificate(courseId) {
  return apiRequest(
    `/certificates/courses/${courseId}`,
    { method: "POST" }
  );
}


// GET /certificates/{certificate_id}
export async function getCertificate(certificateId) {
  return apiRequest(`/certificates/${certificateId}`);
}


// GET /certificates/student/{student_id}
export async function getStudentCertificates(studentId) {
  return apiRequest(`/certificates/student/${studentId}`);
}


// GET /certificates/verify/{certificate_number}  — public, no auth
export async function verifyCertificate(certificateNumber) {
  return apiRequest(`/certificates/verify/${encodeURIComponent(certificateNumber)}`);
}


// =====================================================
// UTILITY
// =====================================================

export { API_BASE_URL };