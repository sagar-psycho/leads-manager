// ============================================================
// TRAINING-ADMIN.JS — Sales Academy Admin Features
// ============================================================
// Admin dashboard, training builder, course management
// ============================================================

// ============================================================
// ADMIN DASHBOARD
// ============================================================

function renderAdminTrainingDashboard() {
  const container = document.getElementById("trainingContentArea");
  if (!container) return;
  
  const stats = calculateAdminStats();
  
  container.innerHTML = `
    <div class="training-admin-dashboard">
      <!-- Admin Header -->
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="mb-1">
            <i class="bi bi-mortarboard-fill me-2"></i>Sales Academy Management
          </h1>
          <p class="text-muted mb-0">Create and manage training courses, track team progress</p>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="openTrainingBuilder()">
            <i class="bi bi-plus-lg me-1"></i>New Course
          </button>
          <button class="btn btn-outline-primary" onclick="openCategoryManager()">
            <i class="bi bi-folder-plus me-1"></i>Categories
          </button>
          <button class="btn btn-outline-primary" onclick="openKnowledgeBaseManager()">
            <i class="bi bi-book me-1"></i>Knowledge Base
          </button>
          <button class="btn btn-outline-secondary" onclick="showAdminReports()">
            <i class="bi bi-graph-up me-1"></i>Reports
          </button>
        </div>
      </div>
      
      <!-- Admin KPI Cards -->
      <div class="row g-3 mb-4">
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-book-fill text-primary fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.totalCourses}</h3>
              <small class="text-muted">Total Courses</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-check-circle-fill text-success fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.published}</h3>
              <small class="text-muted">Published</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-pencil-square text-warning fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.draft}</h3>
              <small class="text-muted">Draft</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-briefcase-fill text-info fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.campaignTrainings}</h3>
              <small class="text-muted">Campaign Trainings</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-people-fill text-secondary fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.employeesTrained}</h3>
              <small class="text-muted">Employees Trained</small>
            </div>
          </div>
        </div>
        <div class="col-md-2">
          <div class="card h-100">
            <div class="card-body text-center">
              <i class="bi bi-award-fill text-danger fs-2 mb-2"></i>
              <h3 class="mb-0">${stats.certificatesIssued}</h3>
              <small class="text-muted">Certificates</small>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Course Management Table -->
      <div class="card">
        <div class="card-header bg-white">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="bi bi-list-ul me-2"></i>Course Management</h5>
            <div class="input-group" style="width: 300px;">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control" id="adminCourseSearch" placeholder="Search courses..." onkeyup="filterAdminCourses()">
            </div>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>Course Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Sections</th>
                  <th>Enrolled</th>
                  <th>Completed</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="adminCoursesTableBody">
                ${renderAdminCoursesTable()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function calculateAdminStats() {
  const totalCourses = ALL_TRAININGS.length;
  const published = ALL_TRAININGS.filter(t => t.status === "published").length;
  const draft = ALL_TRAININGS.filter(t => t.status === "draft").length;
  const campaignTrainings = ALL_TRAININGS.filter(t => t.campaignId).length;
  
  // Count unique users who have made progress
  const uniqueUsers = new Set(ALL_USERS_PROGRESS.map(p => p.userId));
  const employeesTrained = uniqueUsers.size;
  
  // Count total certificates
  let certificatesIssued = 0;
  try {
    // This would need to be loaded separately if not already available
    certificatesIssued = ALL_USERS_PROGRESS.filter(p => p.certificateIssued).length;
  } catch(e) {
    certificatesIssued = 0;
  }
  
  return {
    totalCourses,
    published,
    draft,
    campaignTrainings,
    employeesTrained,
    certificatesIssued
  };
}

function renderAdminCoursesTable() {
  if (ALL_TRAININGS.length === 0) {
    return `<tr><td colspan="8" class="text-center py-4 text-muted">
      <i class="bi bi-inbox display-4 d-block mb-2"></i>
      No courses yet. Click "New Course" to create your first training.
    </td></tr>`;
  }
  
  return ALL_TRAININGS.map(training => {
    const category = ALL_TRAINING_CATEGORIES.find(c => c.id === training.categoryId);
    const enrolled = ALL_USERS_PROGRESS.filter(p => p.trainingId === training.id).length;
    const completed = ALL_USERS_PROGRESS.filter(p => p.trainingId === training.id && p.status === "completed").length;
    
    let statusBadge = '';
    if (training.status === "published") {
      statusBadge = '<span class="badge bg-success">Published</span>';
    } else if (training.status === "draft") {
      statusBadge = '<span class="badge bg-secondary">Draft</span>';
    } else if (training.status === "archived") {
      statusBadge = '<span class="badge bg-dark">Archived</span>';
    }
    
    const isSuperAdmin = CURRENT_USER.role === "superadmin";
    
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            ${training.isMandatory ? '<i class="bi bi-exclamation-circle-fill text-danger me-2" title="Mandatory"></i>' : ''}
            <div>
              <div class="fw-bold">${escapeHtml(training.title)}</div>
              ${training.campaignId ? '<small class="text-muted"><i class="bi bi-briefcase me-1"></i>Campaign Training</small>' : ''}
            </div>
          </div>
        </td>
        <td>${category ? escapeHtml(category.name) : '—'}</td>
        <td>${statusBadge}</td>
        <td>${(training.sections || []).length} lessons</td>
        <td>${enrolled}</td>
        <td>${completed}</td>
        <td>${training.createdAt ? formatDate(training.createdAt.toDate()) : '—'}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="editTraining('${training.id}')" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            ${training.status === "draft" ? `
              <button class="btn btn-outline-success" onclick="publishTraining('${training.id}')" title="Publish">
                <i class="bi bi-check-lg"></i>
              </button>
            ` : ''}
            ${training.status === "published" ? `
              <button class="btn btn-outline-warning" onclick="archiveTraining('${training.id}')" title="Archive">
                <i class="bi bi-archive"></i>
              </button>
            ` : ''}
            <button class="btn btn-outline-secondary" onclick="duplicateTraining('${training.id}')" title="Duplicate">
              <i class="bi bi-files"></i>
            </button>
            ${isSuperAdmin ? `
              <button class="btn btn-outline-danger" onclick="deleteTraining('${training.id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterAdminCourses = function() {
  const searchTerm = document.getElementById("adminCourseSearch")?.value.toLowerCase() || '';
  const tbody = document.getElementById("adminCoursesTableBody");
  if (!tbody) return;
  
  if (!searchTerm) {
    tbody.innerHTML = renderAdminCoursesTable();
    return;
  }
  
  const filtered = ALL_TRAININGS.filter(t => 
    t.title.toLowerCase().includes(searchTerm) ||
    (t.description || '').toLowerCase().includes(searchTerm)
  );
  
  // Create filtered table rows
  const tempTrainings = ALL_TRAININGS;
  ALL_TRAININGS = filtered;
  tbody.innerHTML = renderAdminCoursesTable();
  ALL_TRAININGS = tempTrainings;
};

// ============================================================
// TRAINING BUILDER
// ============================================================

window.openTrainingBuilder = function(trainingId = null) {
  CURRENT_EDITING_TRAINING = trainingId ? ALL_TRAININGS.find(t => t.id === trainingId) : null;
  
  const modal = document.getElementById("trainingBuilderModal");
  if (!modal) {
    console.error("Training builder modal not found in HTML");
    toast("Training builder not available", "danger");
    return;
  }
  
  renderTrainingBuilderModal(CURRENT_EDITING_TRAINING);
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.editTraining = function(trainingId) {
  openTrainingBuilder(trainingId);
};
