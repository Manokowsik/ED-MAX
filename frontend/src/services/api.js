// =====================================================
// API CONFIGURATION
// =====================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");

let refreshPromise = null;

export function clearAuthState(message = "Your session has expired. Please sign in again.") {
  if (window.__accessTokenRefreshTimer) {
    window.clearTimeout(window.__accessTokenRefreshTimer);
    window.__accessTokenRefreshTimer = null;
  }

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  sessionStorage.setItem("auth_error", message);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function scheduleAccessTokenRefresh() {
  const token = localStorage.getItem("access_token");
  if (!token) return;

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return;

  const expiresAt = Number(payload.exp) * 1000;
  const refreshIn = Math.max(expiresAt - Date.now() - 30000, 0);

  window.clearTimeout(window.__accessTokenRefreshTimer);
  window.__accessTokenRefreshTimer = window.setTimeout(async () => {
    try {
      await refreshSession();
    } catch {
      // keep the auth state cleanup handled inside refreshSession
    }
  }, refreshIn);
}

async function refreshSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const storedRefreshToken = localStorage.getItem("refresh_token");

  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(storedRefreshToken ? { "Authorization": `Bearer ${storedRefreshToken}` } : {}),
    },
    body: JSON.stringify({ refresh_token: storedRefreshToken || undefined }),
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        clearAuthState(data.detail || "Your session has expired. Please sign in again.");
        throw new Error(data.detail || "Your session has expired. Please sign in again.");
      }

      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      const savedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (savedUser) {
        const nextUser = { ...savedUser, ...data.user };
        localStorage.setItem("user", JSON.stringify(nextUser));
      }

      scheduleAccessTokenRefresh();
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// =====================================================
// COMMON API REQUEST
// =====================================================

async function apiRequest(endpoint, options = {}) {
  const storedToken = localStorage.getItem("access_token");
  if (storedToken) {
    const payload = decodeJwtPayload(storedToken);
    const exp = Number(payload?.exp || 0) * 1000;
    if (exp && Date.now() >= exp - 30000) {
      await refreshSession();
    }
  }

  const token = localStorage.getItem("access_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.detail || data.message || "Something went wrong";

    if (response.status === 401 && !options.__retryAfterRefresh && endpoint !== "/auth/refresh") {
      try {
        await refreshSession();
        return apiRequest(endpoint, { ...options, __retryAfterRefresh: true });
      } catch (error) {
        throw error;
      }
    }

    if (response.status === 401 && message.toLowerCase().includes("session expired")) {
      clearAuthState();
    }

    throw new Error(message);
  }

  return data;
}


// =====================================================
// AUTHENTICATION
// =====================================================

// POST /auth/login  — sends JSON body (never query params for credentials)
export async function login(email, password) {
  const data = await apiRequest(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );

  if (data.access_token) {
    localStorage.setItem("access_token", data.access_token);
  }
  if (data.refresh_token) {
    localStorage.setItem("refresh_token", data.refresh_token);
  }
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
  }

  scheduleAccessTokenRefresh();
  return data;
}


// POST /auth/admin-signup  — public, no auth required
export async function adminSignup(name, email, password, confirmPassword) {
  return apiRequest(
    "/auth/admin-signup",
    {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        confirm_password: confirmPassword,
      }),
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
export async function createModule(courseId, title, description, moduleOrder, { objectives = [], keyTakeaways = [], isPublished = false } = {}) {
  return apiRequest(
    `/courses/${courseId}/modules`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        module_order: moduleOrder,
        objectives,
        key_takeaways: keyTakeaways,
        is_published: isPublished,
      }),
    }
  );
}


// PUT /courses/modules/{module_id}  — sends JSON body
export async function updateModule(moduleId, { title, description, moduleOrder, objectives, keyTakeaways, isPublished } = {}) {
  const body = {};
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (moduleOrder !== undefined) body.module_order = moduleOrder;
  if (objectives !== undefined) body.objectives = objectives;
  if (keyTakeaways !== undefined) body.key_takeaways = keyTakeaways;
  if (isPublished !== undefined) body.is_published = isPublished;
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
export async function createTrainingContent(moduleId, contentType, title, content, contentOrder) {
  return apiRequest(
    `/courses/modules/${moduleId}/content`,
    {
      method: "POST",
      body: JSON.stringify({
        content_type: contentType,
        title: title || "",
        content,
        content_order: contentOrder,
      }),
    }
  );
}


// PUT /courses/modules/{module_id}/content/{content_id}  — sends JSON body
export async function updateTrainingContent(moduleId, contentId, { contentType, title, content, contentOrder } = {}) {
  const body = {};
  if (contentType !== undefined) body.content_type = contentType;
  if (title !== undefined) body.title = title;
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


// Convenience: reorder a content item (updates content_order only)
export async function reorderContent(moduleId, contentId, newOrder) {
  return updateTrainingContent(moduleId, contentId, { contentOrder: newOrder });
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