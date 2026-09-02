import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import {
  getCourses,
  createCourse,
  activateCourse,
  deactivateCourse,
  getStudents,
  assignCourse,
  unassignCourse,
  getStudentAssignedCourses,
} from '../../services/api';
import {
  LoadingPage,
  Alert,
  EmptyState,
  Modal,
  ConfirmModal,
  Spinner,
} from '../../components/ui';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const TABS = Object.freeze({
  CATALOG: 'catalog',
  ASSIGN: 'assign',
});

const STATUS_FILTERS = Object.freeze({
  ALL: 'all',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const THUMB_GRADIENTS = Object.freeze([
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '💻' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '🔒' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '📈' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', icon: '🔬' },
  { bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', icon: '🏛️' },
]);

const CATEGORIES = Object.freeze([
  'Leadership',
  'Technical Skills',
  'Compliance',
  'Soft Skills',
  'Security',
]);

const MESSAGES = Object.freeze({
  LOAD_FAILED: 'Failed to load courses data.',
  CREATE_SUCCESS: 'Course created successfully.',
  CREATE_FAILED: 'Failed to create course.',
  ASSIGN_SUCCESS: 'Course assigned successfully.',
  ASSIGN_FAILED: 'Failed to assign course.',
  UNASSIGN_SUCCESS: 'Course assignment removed.',
  UNASSIGN_FAILED: 'Failed to remove assignment.',
  TITLE_REQUIRED: 'Course title is required.',
  STUDENT_REQUIRED: 'Please select a student.',
  COURSE_REQUIRED: 'Please select a course.',
  STATUS_CHANGE_FAILED: 'Failed to update course status.',
});

// ============================================================================
// UTILITIES
// ============================================================================

const formatDate = (isoDate) => {
  if (!isoDate) return '—';
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

// ============================================================================
// SUB-COMPONENT: Course Card Item
// ============================================================================

const CourseCard = React.memo(function CourseCard({
  course,
  index,
  onQuickAssign,
  onToggleStatus,
}) {
  const thumb = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  const category = CATEGORIES[index % CATEGORIES.length];

  return (
    <article className="sm-course-card-v2" id={`course-card-${course.id}`}>
      <div className="sm-course-thumb" style={{ background: thumb.bg }}>
        <div className="sm-course-thumb-inner">
          <svg
            viewBox="0 0 200 140"
            xmlns="http://www.w3.org/2000/svg"
            style={STYLES.thumbSvg}
            aria-hidden="true"
          >
            <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.08)" />
            <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.06)" />
            <circle cx="100" cy="70" r="30" fill="rgba(255,255,255,0.05)" />
          </svg>
          <span className="sm-course-thumb-icon" role="img" aria-label="Course Category">
            {thumb.icon}
          </span>
        </div>
        <span className={`sm-course-status-badge ${course.is_active ? 'published' : 'inactive'}`}>
          {course.is_active ? 'Published' : 'Inactive'}
        </span>
      </div>

      <div className="sm-course-body">
        <div className="sm-course-category">{category}</div>
        <Link
          to={`/admin/courses/${course.id}`}
          className="sm-course-title-v2"
          id={`course-link-${course.id}`}
        >
          {course.title}
        </Link>
        {course.description && (
          <div className="sm-course-desc">{course.description}</div>
        )}

        <div className="sm-course-meta-row">
          <div className="sm-course-enrolled">
            👥 {course.enrolled_count ?? course.enrolled_students ?? 0} Enrolled
          </div>
          <div className="sm-course-actions">
            {course.is_active && (
              <button
                type="button"
                className="sm-icon-btn"
                title="Assign to Student"
                aria-label={`Assign ${course.title} to student`}
                onClick={() => onQuickAssign(course)}
                id={`quick-assign-btn-${course.id}`}
                style={STYLES.quickAssignActionBtn}
              >
                🎯
              </button>
            )}
            <Link
              to={`/admin/courses/${course.id}`}
              className="sm-icon-btn"
              title="Manage & Edit Curriculum"
              aria-label={`Manage ${course.title} curriculum`}
              id={`course-manage-${course.id}`}
            >
              ✏️
            </Link>
            <button
              type="button"
              className="sm-icon-btn danger"
              title={course.is_active ? 'Deactivate Course' : 'Activate Course'}
              aria-label={course.is_active ? `Deactivate ${course.title}` : `Activate ${course.title}`}
              onClick={() => onToggleStatus(course)}
              id={`course-toggle-${course.id}`}
            >
              {course.is_active ? '🚫' : '✅'}
            </button>
          </div>
        </div>

        <div style={STYLES.cardFooterRow}>
          <span>Created {formatDate(course.created_at)}</span>
          {course.is_active && (
            <button
              type="button"
              style={STYLES.inlineAssignLink}
              onClick={() => onQuickAssign(course)}
            >
              Assign →
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

// ============================================================================
// SUB-COMPONENT: Create Course Modal
// ============================================================================

const CreateCourseModal = React.memo(function CreateCourseModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({ title: '', description: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ title: '', description: '' });
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError(MESSAGES.TITLE_REQUIRED);
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onClose();
    } catch (err) {
      setFormError(err.message || MESSAGES.CREATE_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create New Course"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            form="create-course-form"
            disabled={isSubmitting}
            id="submit-create-course"
          >
            {isSubmitting ? <Spinner /> : 'Create Course'}
          </button>
        </>
      }
    >
      {formError && <Alert type="error">{formError}</Alert>}
      <form id="create-course-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="c-title">Course Title *</label>
          <input
            id="c-title"
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Distributed Systems Architecture"
            required
            disabled={isSubmitting}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="c-desc">Description</label>
          <textarea
            id="c-desc"
            className="form-textarea"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief summary of learning objectives and target audience"
            disabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
});

// ============================================================================
// SUB-COMPONENT: Quick Assign Modal
// ============================================================================

const QuickAssignModal = React.memo(function QuickAssignModal({
  course,
  activeStudents,
  onClose,
  onSubmit,
}) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedStudentId('');
    setError('');
  }, [course]);

  if (!course) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setError(MESSAGES.STUDENT_REQUIRED);
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onSubmit(course.id, Number(selectedStudentId));
      onClose();
    } catch (err) {
      setError(err.message || MESSAGES.ASSIGN_FAILED);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Assign "${course.title}"`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            form="quick-assign-form"
            disabled={isSubmitting || !selectedStudentId}
            id="submit-quick-assign"
          >
            {isSubmitting ? <Spinner /> : 'Assign Course'}
          </button>
        </>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      <form id="quick-assign-form" onSubmit={handleSubmit} noValidate>
        <p style={STYLES.modalInstructionText}>
          Assign <strong>{course.title}</strong> to a registered student.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="quick-student-select">
            Select Student *
          </label>
          <select
            id="quick-student-select"
            className="form-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            required
            disabled={isSubmitting}
          >
            <option value="">Choose student…</option>
            {activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
});

// ============================================================================
// MAIN VIEW COMPONENT
// ============================================================================

export default function AdminCourses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === TABS.ASSIGN ? TABS.ASSIGN : TABS.CATALOG;

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notification, setNotification] = useState({ type: '', text: '' });

  // Catalog Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);

  // Modals & Action States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [quickAssignCourse, setQuickAssignCourse] = useState(null);
  const [statusConfirm, setStatusConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dedicated Assign Tab State
  const [assignForm, setAssignForm] = useState({ courseId: '', studentId: '' });
  const [assignFormError, setAssignFormError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Student Course Inspector State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentCourses, setStudentCourses] = useState([]);
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  // Track latest inspect request to discard stale API returns
  const inspectRequestId = useRef(0);

  // Navigation tab switcher (Updates URL as source of truth)
  const handleTabChange = useCallback(
    (tab) => {
      setSearchParams({ tab });
    },
    [setSearchParams]
  );

  // Core Data Synchronization
  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        getCourses(),
        getStudents(),
      ]);
      setCourses(coursesRes.courses ?? []);
      setStudents(studentsRes.students ?? []);
    } catch (err) {
      setPageError(err.message || MESSAGES.LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Active Lists (Memoized)
  const activeCourses = useMemo(() => courses.filter((c) => c.is_active), [courses]);
  const activeStudents = useMemo(() => students.filter((s) => s.is_active), [students]);

  // Derived Filtered Catalog (Clean computation, no state mirroring)
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((c) => {
      const matchesSearch =
        !query ||
        c.title.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === STATUS_FILTERS.ALL ||
        (statusFilter === STATUS_FILTERS.ACTIVE && c.is_active) ||
        (statusFilter === STATUS_FILTERS.INACTIVE && !c.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [courses, search, statusFilter]);

  // Synchronize Inspected Student Courses with Race Condition Guard
  const fetchStudentCourses = useCallback(async (studentId) => {
    if (!studentId) {
      setStudentCourses([]);
      return;
    }

    const currentRequestId = ++inspectRequestId.current;
    setLoadingStudentCourses(true);

    try {
      const res = await getStudentAssignedCourses(Number(studentId));
      if (currentRequestId === inspectRequestId.current) {
        setStudentCourses(res?.courses ?? []);
      }
    } catch {
      if (currentRequestId === inspectRequestId.current) {
        setStudentCourses([]);
      }
    } finally {
      if (currentRequestId === inspectRequestId.current) {
        setLoadingStudentCourses(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStudentCourses(selectedStudentId);
  }, [selectedStudentId, fetchStudentCourses]);

  // Action: Create Course
  const handleCreateCourse = useCallback(
    async ({ title, description }) => {
      await createCourse(title, description);
      setNotification({ type: 'success', text: MESSAGES.CREATE_SUCCESS });
      await loadData();
    },
    [loadData]
  );

  // Action: Status Toggle (Activate/Deactivate)
  const handleToggleCourseStatus = useCallback(async () => {
    if (!statusConfirm) return;
    setActionLoading(true);
    try {
      if (statusConfirm.action === 'activate') {
        await activateCourse(statusConfirm.course.id);
        setNotification({
          type: 'success',
          text: `"${statusConfirm.course.title}" activated.`,
        });
      } else {
        await deactivateCourse(statusConfirm.course.id);
        setNotification({
          type: 'success',
          text: `"${statusConfirm.course.title}" deactivated.`,
        });
      }
      setStatusConfirm(null);
      await loadData();
    } catch (err) {
      setPageError(err.message || MESSAGES.STATUS_CHANGE_FAILED);
      setStatusConfirm(null);
    } finally {
      setActionLoading(false);
    }
  }, [statusConfirm, loadData]);

  // Action: Assign Course
  const handleAssignCourse = useCallback(
    async (courseId, studentId) => {
      await assignCourse(courseId, studentId);
      setNotification({ type: 'success', text: MESSAGES.ASSIGN_SUCCESS });
      await loadData();

      if (Number(selectedStudentId) === Number(studentId)) {
        fetchStudentCourses(studentId);
      }
    },
    [selectedStudentId, fetchStudentCourses, loadData]
  );

  // Form Submit: Tab Assign
  const handleAssignTabSubmit = async (e) => {
    e.preventDefault();
    setAssignFormError('');

    if (!assignForm.courseId) {
      setAssignFormError(MESSAGES.COURSE_REQUIRED);
      return;
    }
    if (!assignForm.studentId) {
      setAssignFormError(MESSAGES.STUDENT_REQUIRED);
      return;
    }

    setIsAssigning(true);
    try {
      await handleAssignCourse(Number(assignForm.courseId), Number(assignForm.studentId));
      setAssignForm({ courseId: '', studentId: '' });
    } catch (err) {
      setAssignFormError(err.message || MESSAGES.ASSIGN_FAILED);
    } finally {
      setIsAssigning(false);
    }
  };

  // Action: Unassign Course
  const handleUnassignCourse = useCallback(async () => {
    if (!confirmUnassign) return;
    setIsUnassigning(true);
    try {
      await unassignCourse(confirmUnassign.courseId, confirmUnassign.studentId);
      setNotification({ type: 'success', text: MESSAGES.UNASSIGN_SUCCESS });
      setConfirmUnassign(null);
      await loadData();

      if (selectedStudentId) {
        fetchStudentCourses(selectedStudentId);
      }
    } catch (err) {
      setPageError(err.message || MESSAGES.UNASSIGN_FAILED);
      setConfirmUnassign(null);
    } finally {
      setIsUnassigning(false);
    }
  }, [confirmUnassign, selectedStudentId, fetchStudentCourses, loadData]);

  if (loading) {
    return (
      <AdminLayout>
        <LoadingPage message="Loading courses and assignments…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header Region */}
      <header className="sm-courses-header">
        <div>
          <h1 className="sm-page-title">Manage Courses</h1>
          <p className="sm-page-subtitle">
            Configure course curriculum, modules, and assign courses to students.
          </p>
        </div>
        <div className="sm-header-actions">
          <button
            type="button"
            className={`btn ${activeTab === TABS.ASSIGN ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handleTabChange(activeTab === TABS.ASSIGN ? TABS.CATALOG : TABS.ASSIGN)}
            id="header-toggle-assign-btn"
          >
            {activeTab === TABS.ASSIGN ? '📖 View Catalog' : '📋 Assign Courses'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateOpen(true)}
            id="create-course-btn"
          >
            + Add New Course
          </button>
        </div>
      </header>

      {/* Primary Tabs */}
      <div className="tabs" style={STYLES.tabsNav} role="tablist" aria-label="Course Management Tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.CATALOG}
          aria-controls="catalog-tab-panel"
          className={`tab-btn${activeTab === TABS.CATALOG ? ' active' : ''}`}
          onClick={() => handleTabChange(TABS.CATALOG)}
          id="tab-catalog-btn"
        >
          📖 Catalog ({courses.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === TABS.ASSIGN}
          aria-controls="assign-tab-panel"
          className={`tab-btn${activeTab === TABS.ASSIGN ? ' active' : ''}`}
          onClick={() => handleTabChange(TABS.ASSIGN)}
          id="tab-assign-btn"
        >
          📋 Assign Courses
        </button>
      </div>

      {/* Global Status Notifications */}
      {pageError && (
        <Alert type="error" onClose={() => setPageError('')} aria-live="assertive">
          {pageError}
        </Alert>
      )}
      {notification.text && (
        <Alert
          type={notification.type}
          onClose={() => setNotification({ type: '', text: '' })}
          aria-live="polite"
        >
          {notification.text}
        </Alert>
      )}

      {/* TAB 1: CATALOG */}
      {activeTab === TABS.CATALOG && (
        <section id="catalog-tab-panel" role="tabpanel" aria-labelledby="tab-catalog-btn">
          <div className="sm-search-filter-row">
            <div className="sm-search-box">
              <span className="sm-search-box-icon" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="sm-search-input"
                placeholder="Search courses…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="course-search"
                aria-label="Search courses"
              />
            </div>
            <div className="flex gap-2" role="group" aria-label="Status Filters">
              <button
                type="button"
                className={`sm-filter-chip${statusFilter === STATUS_FILTERS.ALL ? ' active' : ''}`}
                onClick={() => setStatusFilter(STATUS_FILTERS.ALL)}
                style={statusFilter === STATUS_FILTERS.ALL ? STYLES.filterAllActive : {}}
              >
                All Statuses
              </button>
              <button
                type="button"
                className={`sm-filter-chip${statusFilter === STATUS_FILTERS.ACTIVE ? ' active' : ''}`}
                onClick={() =>
                  setStatusFilter((prev) =>
                    prev === STATUS_FILTERS.ACTIVE ? STATUS_FILTERS.ALL : STATUS_FILTERS.ACTIVE
                  )
                }
                style={statusFilter === STATUS_FILTERS.ACTIVE ? STYLES.filterSuccessActive : {}}
              >
                ✓ Active
              </button>
              <button
                type="button"
                className={`sm-filter-chip${statusFilter === STATUS_FILTERS.INACTIVE ? ' active' : ''}`}
                onClick={() =>
                  setStatusFilter((prev) =>
                    prev === STATUS_FILTERS.INACTIVE ? STATUS_FILTERS.ALL : STATUS_FILTERS.INACTIVE
                  )
                }
                style={statusFilter === STATUS_FILTERS.INACTIVE ? STYLES.filterInactiveActive : {}}
              >
                Inactive
              </button>
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <EmptyState
              icon="📚"
              title={search ? `No results for "${search}"` : 'No courses yet'}
              text={
                search
                  ? 'Try a different search term or reset filters.'
                  : 'Create your first course to start building training content.'
              }
              action={
                !search && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    Create Course
                  </button>
                )
              }
            />
          ) : (
            <div className="sm-course-grid-v2">
              {filteredCourses.map((c, i) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  index={i}
                  onQuickAssign={setQuickAssignCourse}
                  onToggleStatus={(course) =>
                    setStatusConfirm({
                      course,
                      action: course.is_active ? 'deactivate' : 'activate',
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: ASSIGN */}
      {activeTab === TABS.ASSIGN && (
        <section
          id="assign-tab-panel"
          role="tabpanel"
          aria-labelledby="tab-assign-btn"
          style={STYLES.assignTabContainer}
        >
          {/* Assignment Creation Form */}
          <div className="sm-card">
            <div className="sm-card-header">
              <div>
                <h2 className="sm-card-title">🎯 Assign Course to Student</h2>
                <div className="sm-card-subtitle">Select an active course and learner</div>
              </div>
            </div>
            <div className="sm-card-body">
              {assignFormError && <Alert type="error">{assignFormError}</Alert>}
              <form onSubmit={handleAssignTabSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-course-select">
                    Select Course *
                  </label>
                  <select
                    id="assign-course-select"
                    className="form-select"
                    value={assignForm.courseId}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, courseId: e.target.value }))
                    }
                    required
                    disabled={isAssigning}
                  >
                    <option value="">Choose an active course…</option>
                    {activeCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  {activeCourses.length === 0 && (
                    <span className="form-hint" style={STYLES.errorHint}>
                      No active courses found. Please activate or create a course first.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="assign-student-select">
                    Select Student *
                  </label>
                  <select
                    id="assign-student-select"
                    className="form-select"
                    value={assignForm.studentId}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, studentId: e.target.value }))
                    }
                    required
                    disabled={isAssigning}
                  >
                    <option value="">Choose an active student…</option>
                    {activeStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                  {activeStudents.length === 0 && (
                    <span className="form-hint">
                      No active students registered. Go to User Manager to add students.
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={isAssigning || !assignForm.courseId || !assignForm.studentId}
                  id="submit-assign-form-btn"
                  style={STYLES.submitAssignmentBtn}
                  aria-busy={isAssigning}
                >
                  {isAssigning ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Spinner /> Assigning Course…
                    </span>
                  ) : (
                    '⚡ Confirm Course Assignment'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Student Assignments Viewer */}
          <div className="sm-card">
            <div className="sm-card-header">
              <div>
                <h2 className="sm-card-title">👥 Student Course View</h2>
                <div className="sm-card-subtitle">Inspect &amp; manage assignments by student</div>
              </div>
            </div>
            <div className="sm-card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="select-student-preview">
                  Select Student to Inspect
                </label>
                <select
                  id="select-student-preview"
                  className="form-select"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Choose student to view assigned courses…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {loadingStudentCourses ? (
                <div style={STYLES.loaderWrapper}>
                  <Spinner />
                </div>
              ) : !selectedStudentId ? (
                <EmptyState
                  icon="👆"
                  title="Select a student"
                  text="Choose a student from the dropdown to manage their assigned courses."
                />
              ) : studentCourses.length === 0 ? (
                <EmptyState
                  icon="📚"
                  title="No courses assigned"
                  text="This student currently has zero assigned courses."
                />
              ) : (
                <div className="sm-activity-list" style={STYLES.studentCoursesList} role="list">
                  {studentCourses.map((c) => (
                    <div
                      key={c.id}
                      style={STYLES.courseListItem}
                      role="listitem"
                    >
                      <div>
                        <div style={STYLES.itemTitle}>{c.title}</div>
                        <div style={STYLES.itemStatus}>
                          Status: <span style={STYLES.itemStatusValue}>{c.status}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          setConfirmUnassign({
                            courseId: c.id,
                            studentId: Number(selectedStudentId),
                            title: c.title,
                          })
                        }
                        id={`unassign-btn-${c.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Floating Action Button for Small Screens (Catalog tab only) */}
      {activeTab === TABS.CATALOG && (
        <button
          type="button"
          className="sm-mobile-fab"
          onClick={() => setIsCreateOpen(true)}
          aria-label="Add new course"
          title="Add new course"
          id="mobile-fab-create-course"
        >
          +
        </button>
      )}

      {/* Isolated Sub-modals */}
      <CreateCourseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateCourse}
      />

      <QuickAssignModal
        course={quickAssignCourse}
        activeStudents={activeStudents}
        onClose={() => setQuickAssignCourse(null)}
        onSubmit={handleAssignCourse}
      />

      {statusConfirm && (
        <ConfirmModal
          title={statusConfirm.action === 'activate' ? 'Activate Course' : 'Deactivate Course'}
          message={
            statusConfirm.action === 'activate'
              ? `Activate "${statusConfirm.course.title}"? Students will be able to be assigned to it.`
              : `Deactivate "${statusConfirm.course.title}"? No new assignments will be possible.`
          }
          onConfirm={handleToggleCourseStatus}
          onCancel={() => setStatusConfirm(null)}
          danger={statusConfirm.action === 'deactivate'}
          loading={actionLoading}
        />
      )}

      {confirmUnassign && (
        <ConfirmModal
          title="Remove Course Assignment"
          message={`Are you sure you want to remove "${confirmUnassign.title}" assignment for this student?`}
          onConfirm={handleUnassignCourse}
          onCancel={() => setConfirmUnassign(null)}
          danger
          loading={isUnassigning}
        />
      )}
    </AdminLayout>
  );
}

// ============================================================================
// STYLES (Frozen configuration object)
// ============================================================================

const STYLES = Object.freeze({
  tabsNav: {
    marginBottom: '1.5rem',
  },
  thumbSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  quickAssignActionBtn: {
    background: '#eef2ff',
    color: '#4f46e5',
    borderColor: '#c7d2fe',
  },
  cardFooterRow: {
    fontSize: '0.7rem',
    color: '#94a3b8',
    marginTop: '0.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineAssignLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#4f46e5',
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterAllActive: {
    borderColor: '#4f46e5',
    color: '#4f46e5',
    background: '#eef2ff',
  },
  filterSuccessActive: {
    borderColor: '#16a34a',
    color: '#16a34a',
    background: '#dcfce7',
  },
  filterInactiveActive: {
    borderColor: '#64748b',
    color: '#64748b',
    background: '#f1f5f9',
  },
  assignTabContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    alignItems: 'start',
  },
  errorHint: {
    color: 'var(--danger)',
  },
  submitAssignmentBtn: {
    marginTop: '1rem',
  },
  loaderWrapper: {
    textAlign: 'center',
    padding: '2rem',
  },
  studentCoursesList: {
    marginTop: '1rem',
  },
  courseListItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f1f5f9',
  },
  itemTitle: {
    fontWeight: 700,
    fontSize: '0.875rem',
    color: '#0f172a',
  },
  itemStatus: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '2px',
  },
  itemStatusValue: {
    fontWeight: 600,
    color: '#4f46e5',
  },
  modalInstructionText: {
    fontSize: '0.875rem',
    color: '#64748b',
    marginBottom: '1rem',
  },
});