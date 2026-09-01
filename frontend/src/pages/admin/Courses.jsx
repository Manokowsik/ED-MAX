import { useState, useEffect, useCallback } from 'react';
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
  LoadingPage, Alert, EmptyState,
  Modal, ConfirmModal, Spinner,
} from '../../components/ui';

// Gradient thumbnails per card index
const THUMB_GRADIENTS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '💻' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '🔒' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '📊' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', icon: '🚀' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', icon: '🎓' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', icon: '📈' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', icon: '🔬' },
  { bg: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', icon: '🏛️' },
];

const CATEGORIES = ['Leadership', 'Technical Skills', 'Compliance', 'Soft Skills', 'Security'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminCourses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'assign' ? 'assign' : 'catalog';
  
  const [activeTab, setActiveTab] = useState(initialTab); // 'catalog' | 'assign'
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create course form state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  // Status confirm modal
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Assign Modal from course card
  const [quickAssignCourse, setQuickAssignCourse] = useState(null);
  const [quickStudentId, setQuickStudentId] = useState('');
  const [quickAssigning, setQuickAssigning] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Assignments tab state
  const [assignForm, setAssignForm] = useState({ courseId: '', studentId: '' });
  const [assigning, setAssigning] = useState(false);
  const [assignFormError, setAssignFormError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentCourses, setStudentCourses] = useState([]);
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [unassigning, setUnassigning] = useState(false);

  // Sync query params tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'assign') setActiveTab('assign');
    else if (tab === 'catalog') setActiveTab('catalog');
  }, [searchParams]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [coursesRes, studentsRes] = await Promise.all([getCourses(), getStudents()]);
      setCourses(coursesRes.courses ?? []);
      setStudents(studentsRes.students ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load courses data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load selected student's assigned courses
  useEffect(() => {
    if (!selectedStudentId) { setStudentCourses([]); return; }
    setLoadingStudentCourses(true);
    getStudentAssignedCourses(Number(selectedStudentId))
      .then(res => setStudentCourses(res.courses ?? []))
      .catch(() => setStudentCourses([]))
      .finally(() => setLoadingStudentCourses(false));
  }, [selectedStudentId]);

  // Filter courses for catalog
  useEffect(() => {
    let result = courses;
    const q = search.toLowerCase();
    if (q) {
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'active') result = result.filter(c => c.is_active);
    if (statusFilter === 'inactive') result = result.filter(c => !c.is_active);
    setFiltered(result);
  }, [search, statusFilter, courses]);

  // Handle Create Course
  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim()) { setFormError('Course title is required.'); return; }

    setCreating(true);
    try {
      await createCourse(form.title.trim(), form.description.trim());
      setShowCreate(false);
      setForm({ title: '', description: '' });
      setSuccess('Course created successfully.');
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  }

  // Handle Activate / Deactivate
  async function handleStatusChange() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      if (confirm.action === 'activate') {
        await activateCourse(confirm.course.id);
        setSuccess(`"${confirm.course.title}" activated.`);
      } else {
        await deactivateCourse(confirm.course.id);
        setSuccess(`"${confirm.course.title}" deactivated.`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Action failed');
      setConfirm(null);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Quick Assign from course card modal
  async function handleQuickAssign(e) {
    e.preventDefault();
    setQuickError('');
    if (!quickStudentId) { setQuickError('Please select a student.'); return; }

    setQuickAssigning(true);
    try {
      await assignCourse(quickAssignCourse.id, Number(quickStudentId));
      setSuccess(`Assigned "${quickAssignCourse.title}" successfully.`);
      setQuickAssignCourse(null);
      setQuickStudentId('');
      await load();
    } catch (err) {
      setQuickError(err.message || 'Failed to assign course');
    } finally {
      setQuickAssigning(false);
    }
  }

  // Handle Assign in Assign Courses section
  async function handleAssign(e) {
    e.preventDefault();
    setAssignFormError('');
    if (!assignForm.courseId) { setAssignFormError('Please select a course.'); return; }
    if (!assignForm.studentId) { setAssignFormError('Please select a student.'); return; }

    setAssigning(true);
    try {
      await assignCourse(Number(assignForm.courseId), Number(assignForm.studentId));
      setSuccess('Course assigned successfully to student.');
      const assignedCourseId = assignForm.courseId;
      const assignedStudentId = assignForm.studentId;
      setAssignForm({ courseId: '', studentId: '' });
      await load();
      if (selectedStudentId === assignedStudentId) {
        const res = await getStudentAssignedCourses(Number(assignedStudentId));
        setStudentCourses(res.courses ?? []);
      }
    } catch (err) {
      setAssignFormError(err.message || 'Failed to assign course');
    } finally {
      setAssigning(false);
    }
  }

  // Handle Unassign
  async function handleUnassign() {
    if (!confirmUnassign) return;
    setUnassigning(true);
    try {
      await unassignCourse(confirmUnassign.courseId, confirmUnassign.studentId);
      setSuccess('Course assignment removed.');
      setConfirmUnassign(null);
      await load();
      if (selectedStudentId) {
        const res = await getStudentAssignedCourses(Number(selectedStudentId));
        setStudentCourses(res.courses ?? []);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove assignment');
      setConfirmUnassign(null);
    } finally {
      setUnassigning(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <LoadingPage message="Loading courses and assignments…" />
      </AdminLayout>
    );
  }

  const activeCourses = courses.filter(c => c.is_active);
  const activeStudents = students.filter(s => s.is_active);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="sm-courses-header">
        <div>
          <h1 className="sm-page-title">Manage Courses</h1>
          <p className="sm-page-subtitle">Configure course curriculum, modules, and assign courses to students.</p>
        </div>
        <div className="sm-header-actions">
          <button
            className={`btn ${activeTab === 'assign' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => changeTab(activeTab === 'assign' ? 'catalog' : 'assign')}
            id="header-toggle-assign-btn"
          >
            {activeTab === 'assign' ? '📖 View Catalog' : '📋 Assign Courses'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-course-btn">
            + Add New Course
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn${activeTab === 'catalog' ? ' active' : ''}`}
          onClick={() => changeTab('catalog')}
          id="tab-catalog-btn"
        >
          📖 Course Catalog ({courses.length})
        </button>
        <button
          className={`tab-btn${activeTab === 'assign' ? ' active' : ''}`}
          onClick={() => changeTab('assign')}
          id="tab-assign-btn"
        >
          📋 Assign Courses to Students
        </button>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* =========================================================
          TAB 1: COURSE CATALOG GRID
      ========================================================= */}
      {activeTab === 'catalog' && (
        <>
          {/* Search + Filters */}
          <div className="sm-search-filter-row">
            <div className="sm-search-box">
              <span className="sm-search-box-icon">🔍</span>
              <input
                type="search"
                className="sm-search-input"
                placeholder="Search courses…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="course-search"
              />
            </div>
            <button
              className={`sm-filter-chip${statusFilter === 'all' ? ' active' : ''}`}
              onClick={() => setStatusFilter('all')}
              style={statusFilter === 'all' ? { borderColor: '#4f46e5', color: '#4f46e5', background: '#eef2ff' } : {}}
            >
              All Statuses
            </button>
            <button
              className={`sm-filter-chip`}
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              style={statusFilter === 'active' ? { borderColor: '#16a34a', color: '#16a34a', background: '#dcfce7' } : {}}
            >
              ✓ Active
            </button>
            <button
              className={`sm-filter-chip`}
              onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
              style={statusFilter === 'inactive' ? { borderColor: '#64748b', color: '#64748b', background: '#f1f5f9' } : {}}
            >
              Inactive
            </button>
          </div>

          {/* Course Cards Grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="📚"
              title={search ? `No results for "${search}"` : 'No courses yet'}
              text={search ? 'Try a different search term.' : 'Create your first course to start building training content.'}
              action={!search && (
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  Create Course
                </button>
              )}
            />
          ) : (
            <div className="sm-course-grid-v2">
              {filtered.map((c, i) => {
                const thumb = THUMB_GRADIENTS[i % THUMB_GRADIENTS.length];
                const category = CATEGORIES[i % CATEGORIES.length];
                return (
                  <div key={c.id} className="sm-course-card-v2" id={`course-card-${c.id}`}>
                    {/* Thumbnail */}
                    <div className="sm-course-thumb" style={{ background: thumb.bg }}>
                      <div className="sm-course-thumb-inner">
                        <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                          <circle cx="160" cy="20" r="60" fill="rgba(255,255,255,0.08)" />
                          <circle cx="30" cy="110" r="50" fill="rgba(255,255,255,0.06)" />
                          <circle cx="100" cy="70" r="30" fill="rgba(255,255,255,0.05)" />
                        </svg>
                        <span className="sm-course-thumb-icon">{thumb.icon}</span>
                      </div>
                      <span className={`sm-course-status-badge ${c.is_active ? 'published' : 'inactive'}`}>
                        {c.is_active ? 'Published' : 'Inactive'}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="sm-course-body">
                      <div className="sm-course-category">{category}</div>
                      <Link to={`/admin/courses/${c.id}`} className="sm-course-title-v2" id={`course-link-${c.id}`}>
                        {c.title}
                      </Link>
                      {c.description && (
                        <div className="sm-course-desc">{c.description}</div>
                      )}

                      <div className="sm-course-meta-row">
                        <div className="sm-course-enrolled">
                          👥 {c.enrolled_count ?? 0} Enrolled
                        </div>
                        <div className="sm-course-actions">
                          {c.is_active && (
                            <button
                              className="sm-icon-btn"
                              title="Assign to Student"
                              onClick={() => { setQuickAssignCourse(c); setQuickStudentId(''); setQuickError(''); }}
                              id={`quick-assign-btn-${c.id}`}
                              style={{ background: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe' }}
                            >
                              🎯
                            </button>
                          )}
                          <Link
                            to={`/admin/courses/${c.id}`}
                            className="sm-icon-btn"
                            title="Manage & Edit Curriculum"
                            id={`course-manage-${c.id}`}
                          >
                            ✏️
                          </Link>
                          <button
                            className="sm-icon-btn danger"
                            title={c.is_active ? 'Deactivate Course' : 'Activate Course'}
                            onClick={() => setConfirm({ course: c, action: c.is_active ? 'deactivate' : 'activate' })}
                            id={`course-toggle-${c.id}`}
                          >
                            {c.is_active ? '🚫' : '✅'}
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Created {formatDate(c.created_at)}</span>
                        {c.is_active && (
                          <span
                            style={{ color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}
                            onClick={() => { setQuickAssignCourse(c); setQuickStudentId(''); setQuickError(''); }}
                          >
                            Assign →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =========================================================
          TAB 2: ASSIGN COURSES SECTION (Directly inside Manage Courses)
      ========================================================= */}
      {activeTab === 'assign' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Assign Form Card */}
          <div className="sm-card">
            <div className="sm-card-header">
              <div>
                <div className="sm-card-title">🎯 Assign Course to Student</div>
                <div className="sm-card-subtitle">Select an active course and learner</div>
              </div>
            </div>
            <div className="sm-card-body">
              {assignFormError && <Alert type="error">{assignFormError}</Alert>}
              <form onSubmit={handleAssign} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="assign-course-select">Select Course *</label>
                  <select
                    id="assign-course-select"
                    className="form-select"
                    value={assignForm.courseId}
                    onChange={e => setAssignForm(f => ({ ...f, courseId: e.target.value }))}
                    required
                  >
                    <option value="">Choose an active course…</option>
                    {activeCourses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  {activeCourses.length === 0 && (
                    <span className="form-hint" style={{ color: 'var(--danger)' }}>No active courses found. Please activate or create a course first.</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="assign-student-select">Select Student *</label>
                  <select
                    id="assign-student-select"
                    className="form-select"
                    value={assignForm.studentId}
                    onChange={e => setAssignForm(f => ({ ...f, studentId: e.target.value }))}
                    required
                  >
                    <option value="">Choose an active student…</option>
                    {activeStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                  {activeStudents.length === 0 && (
                    <span className="form-hint">No active students registered. Go to User Manager to add students.</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={assigning || !assignForm.courseId || !assignForm.studentId}
                  id="submit-assign-form-btn"
                  style={{ marginTop: '1rem' }}
                >
                  {assigning ? <><Spinner /> Assigning Course…</> : '⚡ Confirm Course Assignment'}
                </button>
              </form>
            </div>
          </div>

          {/* Student Assignments Viewer & Unassign Manager */}
          <div className="sm-card">
            <div className="sm-card-header">
              <div>
                <div className="sm-card-title">👥 Student Course View</div>
                <div className="sm-card-subtitle">Inspect &amp; manage assignments by student</div>
              </div>
            </div>
            <div className="sm-card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="select-student-preview">Select Student to Inspect</label>
                <select
                  id="select-student-preview"
                  className="form-select"
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Choose student to view assigned courses…</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              {loadingStudentCourses ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner /></div>
              ) : !selectedStudentId ? (
                <EmptyState icon="👆" title="Select a student" text="Choose a student from the dropdown to manage their assigned courses." />
              ) : studentCourses.length === 0 ? (
                <EmptyState icon="📚" title="No courses assigned" text="This student currently has zero assigned courses." />
              ) : (
                <div className="sm-activity-list" style={{ marginTop: '1rem' }}>
                  {studentCourses.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>{c.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Status: <span style={{ fontWeight: 600, color: '#4f46e5' }}>{c.status}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmUnassign({ courseId: c.id, studentId: Number(selectedStudentId), title: c.title })}
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
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) */}
      <button
        className="sm-mobile-fab"
        onClick={() => setShowCreate(true)}
        aria-label="Add new course"
        title="Add new course"
        id="mobile-fab-create-course"
      >
        +
      </button>

      {/* Create Course Modal */}
      {showCreate && (
        <Modal
          title="Create New Course"
          onClose={() => { setShowCreate(false); setFormError(''); setForm({ title: '', description: '' }); }}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
              <button className="btn btn-primary" form="create-course-form" type="submit" disabled={creating} id="submit-create-course">
                {creating ? <Spinner /> : 'Create Course'}
              </button>
            </>
          }
        >
          {formError && <Alert type="error">{formError}</Alert>}
          <form id="create-course-form" onSubmit={handleCreate} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="c-title">Course Title *</label>
              <input id="c-title" type="text" className="form-input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Full-Stack Web Architecture 2024" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-desc">Description</label>
              <textarea id="c-desc" className="form-textarea" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief summary of learning objectives and target audience" />
            </div>
          </form>
        </Modal>
      )}

      {/* Quick Assign Modal (opened directly from course card) */}
      {quickAssignCourse && (
        <Modal
          title={`Assign "${quickAssignCourse.title}"`}
          onClose={() => { setQuickAssignCourse(null); setQuickStudentId(''); setQuickError(''); }}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setQuickAssignCourse(null)} disabled={quickAssigning}>Cancel</button>
              <button className="btn btn-primary" form="quick-assign-form" type="submit" disabled={quickAssigning || !quickStudentId} id="submit-quick-assign">
                {quickAssigning ? <Spinner /> : 'Assign Course'}
              </button>
            </>
          }
        >
          {quickError && <Alert type="error">{quickError}</Alert>}
          <form id="quick-assign-form" onSubmit={handleQuickAssign} noValidate>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Assign <strong>{quickAssignCourse.title}</strong> to a registered student.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="quick-student-select">Select Student *</label>
              <select
                id="quick-student-select"
                className="form-select"
                value={quickStudentId}
                onChange={e => setQuickStudentId(e.target.value)}
                required
              >
                <option value="">Choose student…</option>
                {activeStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Activate/Deactivate Status Modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.action === 'activate' ? 'Activate Course' : 'Deactivate Course'}
          message={
            confirm.action === 'activate'
              ? `Activate "${confirm.course.title}"? Students will be able to be assigned to it.`
              : `Deactivate "${confirm.course.title}"? No new assignments will be possible.`
          }
          onConfirm={handleStatusChange}
          onCancel={() => setConfirm(null)}
          danger={confirm.action === 'deactivate'}
          loading={actionLoading}
        />
      )}

      {/* Confirm Unassign Modal */}
      {confirmUnassign && (
        <ConfirmModal
          title="Remove Course Assignment"
          message={`Are you sure you want to remove "${confirmUnassign.title}" assignment for this student?`}
          onConfirm={handleUnassign}
          onCancel={() => setConfirmUnassign(null)}
          danger
          loading={unassigning}
        />
      )}
    </AdminLayout>
  );
}
