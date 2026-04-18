// ==================== NexGen Admin Portal JavaScript ====================
// Global state
const state = {
  token: localStorage.getItem('adminToken'),
  currentPage: 'dashboard',
  data: {
    students: [],
    tests: [],
    questions: [],
    results: [],
    discussions: [],
    messages: [],
    blockedStudents: []
  },
  modalCallback: null
};

// Check authentication
if (!state.token) {
  window.location.href = 'index.html';
}

// ==================== API Wrapper ====================
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Authorization': `Bearer ${state.token}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await fetch(`/api${endpoint}`, { ...defaultOptions, ...options });
    if (response.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = 'index.html';
      throw new Error('Unauthorized');
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

// ==================== UI Helpers ====================
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast-enter p-4 rounded-lg shadow-lg text-white ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-indigo-600'
  }`;
  toast.innerHTML = `<i class="fas fa-${
    type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'
  } mr-2"></i>${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== Modal System ====================
function showModal(title, bodyHtml, onConfirm, confirmText = 'Confirm') {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const cancelBtn = document.getElementById('modalCancelBtn');
  const closeBtn = document.getElementById('closeModalBtn');
  
  confirmBtn.textContent = confirmText;
  
  const closeModal = () => {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  };
  
  const handleConfirm = async () => {
    if (onConfirm) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
      try {
        await onConfirm();
        closeModal();
      } catch (error) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = confirmText;
      }
    } else {
      closeModal();
    }
  };
  
  confirmBtn.onclick = handleConfirm;
  cancelBtn.onclick = closeModal;
  closeBtn.onclick = closeModal;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
  
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

// ==================== Navigation ====================
const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
  { id: 'students', label: 'Students', icon: 'fa-users' },
  { id: 'tests', label: 'Tests', icon: 'fa-file-alt' },
  { id: 'questions', label: 'Questions', icon: 'fa-question-circle' },
  { id: 'results', label: 'Results', icon: 'fa-chart-bar' },
  { id: 'discussions', label: 'Discussions', icon: 'fa-comments' },
  { id: 'messages', label: 'Messages', icon: 'fa-envelope' },
  { id: 'blocked', label: 'Blocked Students', icon: 'fa-ban' },
  { id: 'monitor', label: 'Monitor Tests', icon: 'fa-eye' },
  { id: 'settings', label: 'Settings', icon: 'fa-cog' }
];

function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = pages.map(page => `
    <button data-page="${page.id}" class="nav-item w-full text-left px-4 py-3 rounded-lg hover:bg-white/10 transition flex items-center ${
      state.currentPage === page.id ? 'bg-white/20' : ''
    }">
      <i class="fas ${page.icon} w-6"></i>
      <span>${page.label}</span>
    </button>
  `).join('');
  
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentPage = btn.dataset.page;
      renderSidebar();
      loadPage(state.currentPage);
    });
  });
}

// ==================== Page Loader ====================
async function loadPage(pageId) {
  showLoading();
  try {
    const titleMap = {
      dashboard: 'Dashboard',
      students: 'Student Management',
      tests: 'Test Management',
      questions: 'Question Bank',
      results: 'Exam Results',
      discussions: 'Discussion Forum',
      messages: 'Student Messages',
      blocked: 'Blocked Students',
      monitor: 'Test Monitoring',
      settings: 'Admin Settings'
    };
    document.getElementById('pageTitle').textContent = titleMap[pageId];
    document.getElementById('pageSubtitle').textContent = '';
    
    const container = document.getElementById('contentContainer');
    
    switch(pageId) {
      case 'dashboard':
        await loadDashboard(container);
        break;
      case 'students':
        await loadStudents(container);
        break;
      case 'tests':
        await loadTests(container);
        break;
      case 'questions':
        await loadQuestions(container);
        break;
      case 'results':
        await loadResults(container);
        break;
      case 'discussions':
        await loadDiscussions(container);
        break;
      case 'messages':
        await loadMessages(container);
        break;
      case 'blocked':
        await loadBlockedStudents(container);
        break;
      case 'monitor':
        await loadMonitor(container);
        break;
      case 'settings':
        await loadSettings(container);
        break;
    }
  } catch (error) {
    showToast('Error loading page: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Dashboard Page ====================
async function loadDashboard(container) {
  const [students, tests, results] = await Promise.all([
    apiCall('/students'),
    apiCall('/tests'),
    apiCall('/results')
  ]);
  
  // Count total questions across all tests (approximate)
  let totalQuestions = 0;
  for (const test of tests) {
    try {
      const questions = await apiCall(`/questions/${test.testId}`);
      totalQuestions += questions.length;
    } catch (e) {}
  }
  
  const liveTests = tests.filter(t => t.isLive).length;
  const activeStudents = students.filter(s => s.status === 'active').length;
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Total Students</p>
            <p class="text-3xl font-bold text-gray-800">${students.length}</p>
            <p class="text-xs text-green-600 mt-1">Active: ${activeStudents}</p>
          </div>
          <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <i class="fas fa-users text-indigo-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Total Tests</p>
            <p class="text-3xl font-bold text-gray-800">${tests.length}</p>
            <p class="text-xs text-green-600 mt-1">Live: ${liveTests}</p>
          </div>
          <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <i class="fas fa-file-alt text-purple-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Total Questions</p>
            <p class="text-3xl font-bold text-gray-800">${totalQuestions}</p>
          </div>
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <i class="fas fa-question-circle text-green-600 text-xl"></i>
          </div>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-500 text-sm">Tests Taken</p>
            <p class="text-3xl font-bold text-gray-800">${results.length}</p>
          </div>
          <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <i class="fas fa-chart-bar text-orange-600 text-xl"></i>
          </div>
        </div>
      </div>
    </div>
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-4">Recent Results</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4">Student ID</th>
              <th class="text-left py-3 px-4">Test</th>
              <th class="text-left py-3 px-4">Score</th>
              <th class="text-left py-3 px-4">Rank</th>
              <th class="text-left py-3 px-4">Submitted</th>
            </tr>
          </thead>
          <tbody>
            ${results.slice(0, 5).map(r => `
              <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4">${r.studentId}</td>
                <td class="py-3 px-4">${r.testId}</td>
                <td class="py-3 px-4 font-semibold">${r.score}</td>
                <td class="py-3 px-4">${r.rank || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-500">${new Date(r.submittedAt).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== Students Page ====================
async function loadStudents(container) {
  const students = await apiCall('/students');
  state.data.students = students;
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-800">Student List</h3>
        <button id="addStudentBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <i class="fas fa-plus mr-2"></i>Add Student
        </button>
      </div>
      <div class="p-6">
        <input type="text" id="studentSearch" placeholder="Search by ID, name, class..." class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4">Student ID</th>
                <th class="text-left py-3 px-4">Full Name</th>
                <th class="text-left py-3 px-4">Class</th>
                <th class="text-left py-3 px-4">Mobile</th>
                <th class="text-left py-3 px-4">Status</th>
                <th class="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody id="studentsTableBody">
              ${students.map(s => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4 font-mono">${s.studentId}</td>
                  <td class="py-3 px-4">${s.fullName}</td>
                  <td class="py-3 px-4">${s.class || '-'}</td>
                  <td class="py-3 px-4">${s.mobile || '-'}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs ${
                      s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }">
                      ${s.status}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <button data-id="${s.studentId}" class="editStudentBtn text-indigo-600 hover:text-indigo-800 mr-3">Edit</button>
                    ${s.status === 'active' 
                      ? `<button data-id="${s.studentId}" class="blockBtn text-red-600 hover:text-red-800">Block</button>`
                      : `<button data-id="${s.studentId}" class="unblockBtn text-green-600 hover:text-green-800">Unblock</button>`
                    }
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Search
  document.getElementById('studentSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#studentsTableBody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
  
  // Add student
  document.getElementById('addStudentBtn').addEventListener('click', () => showStudentModal());
  
  // Edit student
  document.querySelectorAll('.editStudentBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.studentId === btn.dataset.id);
      showStudentModal(student);
    });
  });
  
  // Block student
  document.querySelectorAll('.blockBtn').forEach(btn => {
    btn.addEventListener('click', () => showBlockModal(btn.dataset.id));
  });
  
  // Unblock student
  document.querySelectorAll('.unblockBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Unblock this student?')) {
        showLoading();
        try {
          await apiCall(`/students/${btn.dataset.id}/unblock`, { method: 'PUT' });
          showToast('Student unblocked successfully', 'success');
          loadPage('students');
        } catch (e) {} finally { hideLoading(); }
      }
    });
  });
}

function showStudentModal(student = null) {
  const isEdit = !!student;
  const bodyHtml = `
    <form id="studentForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
        <input type="text" name="studentId" value="${student?.studentId || ''}" ${isEdit ? 'readonly' : ''} required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
        <input type="text" name="fullName" value="${student?.fullName || ''}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Date of Birth (DDMMYYYY) *</label>
        <input type="text" name="dob" value="${student?.dob || ''}" required pattern="\\d{8}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Class</label>
        <input type="text" name="class" value="${student?.class || ''}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
        <input type="text" name="mobile" value="${student?.mobile || ''}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input type="email" name="email" value="${student?.email || ''}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
    </form>
  `;
  
  showModal(isEdit ? 'Edit Student' : 'Add New Student', bodyHtml, async () => {
    const form = document.getElementById('studentForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    if (isEdit) {
      // Only allow updating certain fields
      const updateData = {
        fullName: data.fullName,
        class: data.class,
        mobile: data.mobile,
        email: data.email
      };
      await apiCall(`/students/${student.studentId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
    } else {
      await apiCall('/students', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    showToast(isEdit ? 'Student updated' : 'Student created', 'success');
    loadPage('students');
  }, isEdit ? 'Update' : 'Create');
}

function showBlockModal(studentId) {
  const bodyHtml = `
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Reason for blocking</label>
      <textarea id="blockReason" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg" 
                placeholder="Enter reason..."></textarea>
    </div>
  `;
  
  showModal('Block Student', bodyHtml, async () => {
    const reason = document.getElementById('blockReason').value;
    if (!reason) {
      showToast('Please provide a reason', 'error');
      throw new Error('Reason required');
    }
    await apiCall(`/students/${studentId}/block`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    });
    showToast('Student blocked', 'success');
    loadPage('students');
  }, 'Block');
}

// ==================== Tests Page ====================
async function loadTests(container) {
  const tests = await apiCall('/tests');
  state.data.tests = tests;
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-semibold text-gray-800">Test List</h3>
        <button id="addTestBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <i class="fas fa-plus mr-2"></i>Create Test
        </button>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4">Test ID</th>
                <th class="text-left py-3 px-4">Name</th>
                <th class="text-left py-3 px-4">Duration</th>
                <th class="text-left py-3 px-4">Marks (C/W/S)</th>
                <th class="text-left py-3 px-4">Classes</th>
                <th class="text-left py-3 px-4">Status</th>
                <th class="text-left py-3 px-4">Schedule</th>
                <th class="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tests.map(t => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4 font-mono">${t.testId}</td>
                  <td class="py-3 px-4">${t.testName}</td>
                  <td class="py-3 px-4">${t.duration} min</td>
                  <td class="py-3 px-4">+${t.marks.correct} / ${t.marks.wrong} / ${t.marks.skip}</td>
                  <td class="py-3 px-4">${t.allowedClasses.join(', ')}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs ${t.isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                      ${t.isLive ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-sm">
                    ${t.startTime ? new Date(t.startTime).toLocaleString() : '-'}<br>
                    ${t.endTime ? new Date(t.endTime).toLocaleString() : '-'}
                  </td>
                  <td class="py-3 px-4">
                    <button data-id="${t.testId}" class="editTestBtn text-indigo-600 hover:text-indigo-800 mr-2">Edit</button>
                    <button data-id="${t.testId}" class="deleteTestBtn text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('addTestBtn').addEventListener('click', () => showTestModal());
  document.querySelectorAll('.editTestBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const test = tests.find(t => t.testId === btn.dataset.id);
      showTestModal(test);
    });
  });
  document.querySelectorAll('.deleteTestBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this test? All questions and results will be lost permanently.')) {
        showLoading();
        try {
          await apiCall(`/tests/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Test deleted', 'success');
          loadPage('tests');
        } catch (e) {} finally { hideLoading(); }
      }
    });
  });
}

function showTestModal(test = null) {
  const isEdit = !!test;
  const bodyHtml = `
    <form id="testForm" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Test ID *</label>
        <input type="text" name="testId" value="${test?.testId || ''}" ${isEdit ? 'readonly' : ''} required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
        <input type="text" name="testName" value="${test?.testName || ''}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) *</label>
        <input type="number" name="duration" value="${test?.duration || ''}" required min="1"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Correct Marks</label>
          <input type="number" name="marks.correct" value="${test?.marks?.correct || 1}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Wrong Marks</label>
          <input type="number" name="marks.wrong" value="${test?.marks?.wrong || 0}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Skip Marks</label>
          <input type="number" name="marks.skip" value="${test?.marks?.skip || 0}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Allowed Classes (comma-separated)</label>
        <input type="text" name="allowedClasses" value="${test?.allowedClasses?.join(', ') || ''}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
      </div>
      <div class="flex items-center">
        <input type="checkbox" name="shuffle" id="shuffle" ${test?.shuffle ? 'checked' : ''} class="mr-2">
        <label for="shuffle" class="text-sm font-medium text-gray-700">Shuffle Questions</label>
      </div>
      <div class="flex items-center">
        <input type="checkbox" name="isLive" id="isLive" ${test?.isLive ? 'checked' : ''} class="mr-2">
        <label for="isLive" class="text-sm font-medium text-gray-700">Live (Visible to students)</label>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
          <input type="datetime-local" name="startTime" value="${test?.startTime ? new Date(test.startTime).toISOString().slice(0,16) : ''}"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
          <input type="datetime-local" name="endTime" value="${test?.endTime ? new Date(test.endTime).toISOString().slice(0,16) : ''}"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
      </div>
    </form>
  `;
  
  showModal(isEdit ? 'Edit Test' : 'Create New Test', bodyHtml, async () => {
    const form = document.getElementById('testForm');
    const formData = new FormData(form);
    const data = {};
    for (let [key, val] of formData.entries()) {
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (!data[parent]) data[parent] = {};
        data[parent][child] = parseFloat(val) || val;
      } else if (key === 'allowedClasses') {
        data[key] = val.split(',').map(c => c.trim()).filter(c => c);
      } else if (key === 'shuffle' || key === 'isLive') {
        data[key] = val === 'on';
      } else if (key === 'duration') {
        data[key] = parseInt(val);
      } else {
        data[key] = val;
      }
    }
    
    if (isEdit) {
      await apiCall(`/tests/${test.testId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/tests', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    showToast(isEdit ? 'Test updated' : 'Test created', 'success');
    loadPage('tests');
  }, isEdit ? 'Update' : 'Create');
}

// ==================== Questions Page ====================
async function loadQuestions(container) {
  const tests = await apiCall('/tests');
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Question Management</h3>
        <div class="flex space-x-4">
          <select id="testSelect" class="px-4 py-2 border border-gray-300 rounded-lg flex-1">
            <option value="">Select a test</option>
            ${tests.map(t => `<option value="${t.testId}">${t.testName} (${t.testId})</option>`).join('')}
          </select>
          <button id="addQuestionBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled>
            <i class="fas fa-plus mr-2"></i>Add Question
          </button>
          <button id="uploadCsvBtn" class="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50" disabled>
            <i class="fas fa-upload mr-2"></i>Upload CSV
          </button>
        </div>
      </div>
      <div class="p-6" id="questionsContainer">
        <p class="text-gray-500 text-center py-8">Select a test to view and manage questions</p>
      </div>
    </div>
  `;
  
  const testSelect = document.getElementById('testSelect');
  const addBtn = document.getElementById('addQuestionBtn');
  const uploadBtn = document.getElementById('uploadCsvBtn');
  const questionsContainer = document.getElementById('questionsContainer');
  
  let currentQuestions = [];
  
  testSelect.addEventListener('change', async () => {
    const testId = testSelect.value;
    if (!testId) {
      addBtn.disabled = true;
      uploadBtn.disabled = true;
      questionsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Select a test to view and manage questions</p>';
      return;
    }
    
    addBtn.disabled = false;
    uploadBtn.disabled = false;
    showLoading();
    
    try {
      currentQuestions = await apiCall(`/questions/${testId}`);
      renderQuestionsTable(currentQuestions, testId);
    } catch (e) {} finally { hideLoading(); }
  });
  
  addBtn.addEventListener('click', () => {
    if (testSelect.value) showQuestionModal(testSelect.value);
  });
  
  uploadBtn.addEventListener('click', () => {
    if (testSelect.value) showCsvUploadModal(testSelect.value);
  });
}

function renderQuestionsTable(questions, testId) {
  const container = document.getElementById('questionsContainer');
  container.innerHTML = `
    <div class="mb-4">
      <input type="text" id="questionSearch" placeholder="Search by ID or text..." class="w-full px-4 py-2 border border-gray-300 rounded-lg">
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-3 px-4">QID</th>
            <th class="text-left py-3 px-4">Type</th>
            <th class="text-left py-3 px-4">Question (EN)</th>
            <th class="text-left py-3 px-4">Correct Answer</th>
            <th class="text-left py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody id="questionsTableBody">
          ${questions.map(q => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-3 px-4 font-mono">${q.questionId}</td>
              <td class="py-3 px-4"><span class="uppercase text-xs font-semibold px-2 py-1 bg-gray-100 rounded">${q.type}</span></td>
              <td class="py-3 px-4">${q.questionText.en.substring(0, 60)}${q.questionText.en.length > 60 ? '...' : ''}</td>
              <td class="py-3 px-4">${q.type === 'mcq' ? `Option ${q.correctAnswer}` : q.correctAnswer}</td>
              <td class="py-3 px-4">
                <button data-id="${q._id}" class="editQuestionBtn text-indigo-600 hover:text-indigo-800 mr-2">Edit</button>
                <button data-id="${q._id}" class="deleteQuestionBtn text-red-600 hover:text-red-800">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${questions.length === 0 ? '<p class="text-gray-500 text-center py-4">No questions found. Add some!</p>' : ''}
  `;
  
  // Search
  document.getElementById('questionSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#questionsTableBody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
  
  // Edit and delete handlers
  document.querySelectorAll('.editQuestionBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const question = questions.find(q => q._id === btn.dataset.id);
      showQuestionModal(testId, question);
    });
  });
  
  document.querySelectorAll('.deleteQuestionBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this question?')) {
        showLoading();
        try {
          await apiCall(`/questions/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Question deleted', 'success');
          const updated = await apiCall(`/questions/${testId}`);
          renderQuestionsTable(updated, testId);
        } catch (e) {} finally { hideLoading(); }
      }
    });
  });
}

function showQuestionModal(testId, question = null) {
  const isEdit = !!question;
  const bodyHtml = `
    <form id="questionForm" class="space-y-4 max-h-[60vh] overflow-y-auto">
      <input type="hidden" name="testId" value="${testId}">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Question ID *</label>
        <input type="text" name="questionId" value="${question?.questionId || ''}" ${isEdit ? 'readonly' : ''} required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
        <select name="type" id="qType" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
          <option value="mcq" ${question?.type === 'mcq' ? 'selected' : ''}>MCQ</option>
          <option value="numerical" ${question?.type === 'numerical' ? 'selected' : ''}>Numerical</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Question (English) *</label>
        <textarea name="questionText.en" rows="3" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">${question?.questionText?.en || ''}</textarea>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Question (Hindi)</label>
        <textarea name="questionText.hi" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${question?.questionText?.hi || ''}</textarea>
      </div>
      <div id="optionsSection" style="display: ${(!question || question.type === 'mcq') ? 'block' : 'none'}">
        <label class="block text-sm font-medium text-gray-700 mb-2">Options</label>
        ${[1,2,3,4].map(i => `
          <div class="grid grid-cols-2 gap-2 mb-2">
            <input type="text" name="options[${i-1}].en" placeholder="Option ${i} (EN)" value="${question?.options?.[i-1]?.en || ''}"
                   class="px-3 py-2 border border-gray-300 rounded-lg">
            <input type="text" name="options[${i-1}].hi" placeholder="Option ${i} (HI)" value="${question?.options?.[i-1]?.hi || ''}"
                   class="px-3 py-2 border border-gray-300 rounded-lg">
          </div>
        `).join('')}
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Correct Answer *</label>
        <input type="text" name="correctAnswer" value="${question?.correctAnswer || ''}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        <p class="text-xs text-gray-500 mt-1" id="answerHint">For MCQ, enter option number (1-4). For numerical, enter the exact value.</p>
      </div>
      <div id="toleranceField" style="display: ${question?.type === 'numerical' ? 'block' : 'none'}">
        <label class="block text-sm font-medium text-gray-700 mb-1">Tolerance (for numerical)</label>
        <input type="number" name="tolerance" value="${question?.tolerance || ''}" step="0.01"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Marks (Correct)</label>
          <input type="number" name="marks.correct" value="${question?.marks?.correct || ''}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Marks (Wrong)</label>
          <input type="number" name="marks.wrong" value="${question?.marks?.wrong || ''}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Marks (Skip)</label>
          <input type="number" name="marks.skip" value="${question?.marks?.skip || ''}" step="0.5"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Image URLs (semicolon separated)</label>
        <input type="text" name="imageUrls" value="${question?.imageUrls?.join(';') || ''}"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
    </form>
  `;
  
  showModal(isEdit ? 'Edit Question' : 'Add New Question', bodyHtml, async () => {
    const form = document.getElementById('questionForm');
    const formData = new FormData(form);
    const data = { testId };
    
    // Parse form data into structured object
    for (let [key, val] of formData.entries()) {
      if (key === 'questionText.en') {
        if (!data.questionText) data.questionText = {};
        data.questionText.en = val;
      } else if (key === 'questionText.hi') {
        if (!data.questionText) data.questionText = {};
        data.questionText.hi = val;
      } else if (key.startsWith('options[')) {
        const match = key.match(/options\[(\d+)\]\.(\w+)/);
        if (match) {
          const idx = parseInt(match[1]);
          const lang = match[2];
          if (!data.options) data.options = [{}, {}, {}, {}];
          data.options[idx][lang] = val;
        }
      } else if (key.includes('.')) {
        const [parent, child] = key.split('.');
        if (!data[parent]) data[parent] = {};
        data[parent][child] = parseFloat(val) || val;
      } else if (key === 'type') {
        data.type = val;
      } else if (key === 'correctAnswer') {
        data.correctAnswer = data.type === 'mcq' ? parseInt(val) : parseFloat(val);
      } else if (key === 'tolerance') {
        if (val) data.tolerance = parseFloat(val);
      } else if (key === 'imageUrls') {
        data.imageUrls = val.split(';').map(u => u.trim()).filter(u => u);
      } else {
        data[key] = val;
      }
    }
    
    // Clean empty options
    if (data.options) {
      data.options = data.options.filter(opt => opt.en || opt.hi);
    }
    
    if (isEdit) {
      await apiCall(`/questions/${question._id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/questions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    showToast(isEdit ? 'Question updated' : 'Question added', 'success');
    // Refresh questions list
    const updated = await apiCall(`/questions/${testId}`);
    renderQuestionsTable(updated, testId);
  }, isEdit ? 'Update' : 'Add');
  
  // Toggle between MCQ and Numerical
  const typeSelect = document.getElementById('qType');
  const optionsSection = document.getElementById('optionsSection');
  const toleranceField = document.getElementById('toleranceField');
  const answerHint = document.getElementById('answerHint');
  
  typeSelect.addEventListener('change', () => {
    if (typeSelect.value === 'mcq') {
      optionsSection.style.display = 'block';
      toleranceField.style.display = 'none';
      answerHint.textContent = 'For MCQ, enter option number (1-4)';
    } else {
      optionsSection.style.display = 'none';
      toleranceField.style.display = 'block';
      answerHint.textContent = 'For numerical, enter the exact value';
    }
  });
}

function showCsvUploadModal(testId) {
  const bodyHtml = `
    <div class="space-y-4">
      <p class="text-gray-600">Upload a CSV file with questions. The CSV must have the required headers as per specification.</p>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
        <input type="file" id="csvFileInput" accept=".csv" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
      <div id="uploadPreview" class="hidden">
        <p class="text-sm text-gray-600">Ready to upload. Existing questions with same ID will be updated.</p>
      </div>
    </div>
  `;
  
  showModal('Upload Questions CSV', bodyHtml, async () => {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (!file) {
      showToast('Please select a file', 'error');
      throw new Error('No file selected');
    }
    
    const formData = new FormData();
    formData.append('csvFile', file);
    
    const response = await fetch(`/api/questions/upload/${testId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` },
      body: formData
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Upload failed');
    
    showToast(`Successfully processed ${result.count} questions`, 'success');
    // Refresh questions display
    const testSelect = document.getElementById('testSelect');
    if (testSelect.value === testId) {
      const updated = await apiCall(`/questions/${testId}`);
      renderQuestionsTable(updated, testId);
    }
  }, 'Upload');
  
  // Preview when file selected
  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      document.getElementById('uploadPreview').classList.remove('hidden');
    }
  });
}

// ==================== Results Page ====================
async function loadResults(container) {
  const [results, tests] = await Promise.all([
    apiCall('/results'),
    apiCall('/tests')
  ]);
  state.data.results = results;
  
  const testMap = Object.fromEntries(tests.map(t => [t.testId, t.testName]));
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800">Exam Results</h3>
      </div>
      <div class="p-6">
        <div class="mb-4 flex space-x-4">
          <select id="testFilter" class="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="">All Tests</option>
            ${tests.map(t => `<option value="${t.testId}">${t.testName}</option>`).join('')}
          </select>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4">Student ID</th>
                <th class="text-left py-3 px-4">Test</th>
                <th class="text-left py-3 px-4">Score</th>
                <th class="text-left py-3 px-4">Rank</th>
                <th class="text-left py-3 px-4">Submitted</th>
                <th class="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody id="resultsTableBody">
              ${results.map(r => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4">${r.studentId}</td>
                  <td class="py-3 px-4">${testMap[r.testId] || r.testId}</td>
                  <td class="py-3 px-4 font-semibold">${r.score}</td>
                  <td class="py-3 px-4">${r.rank || '-'}</td>
                  <td class="py-3 px-4 text-sm">${new Date(r.submittedAt).toLocaleString()}</td>
                  <td class="py-3 px-4">
                    <button data-student="${r.studentId}" data-test="${r.testId}" class="viewAnalysisBtn text-indigo-600 hover:text-indigo-800">
                      View Analysis
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Filter by test
  document.getElementById('testFilter').addEventListener('change', (e) => {
    const testId = e.target.value;
    document.querySelectorAll('#resultsTableBody tr').forEach(row => {
      if (!testId) {
        row.style.display = '';
      } else {
        const testCell = row.cells[1].textContent;
        const testObj = tests.find(t => t.testName === testCell);
        row.style.display = (testObj?.testId === testId) ? '' : 'none';
      }
    });
  });
  
  // View analysis
  document.querySelectorAll('.viewAnalysisBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { student, test } = btn.dataset;
      showResultAnalysisModal(student, test);
    });
  });
}

async function showResultAnalysisModal(studentId, testId) {
  showLoading();
  try {
    const [result, questions] = await Promise.all([
      apiCall(`/results/student/${studentId}`).then(res => res.find(r => r.testId === testId)),
      apiCall(`/questions/${testId}`)
    ]);
    
    const questionMap = Object.fromEntries(questions.map(q => [q.questionId, q]));
    
    const bodyHtml = `
      <div class="space-y-4">
        <div class="bg-gray-50 p-4 rounded-lg">
          <p><span class="font-medium">Student:</span> ${studentId}</p>
          <p><span class="font-medium">Test:</span> ${testId}</p>
          <p><span class="font-medium">Score:</span> ${result.score}</p>
          <p><span class="font-medium">Rank:</span> ${result.rank || 'N/A'}</p>
          <p><span class="font-medium">Submitted:</span> ${new Date(result.submittedAt).toLocaleString()}</p>
        </div>
        <h4 class="font-semibold text-gray-800">Question-wise Analysis</h4>
        <div class="max-h-96 overflow-y-auto space-y-3">
          ${result.answers.map(ans => {
            const q = questionMap[ans.questionId];
            if (!q) return '';
            return `
              <div class="border rounded-lg p-3 ${ans.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                <p class="font-medium">${q.questionText.en}</p>
                <p class="text-sm mt-1">Your Answer: ${ans.selectedAnswer ?? 'Skipped'}</p>
                <p class="text-sm">Correct Answer: ${q.type === 'mcq' ? `Option ${q.correctAnswer}` : q.correctAnswer}</p>
                <p class="text-sm font-medium">Marks: ${ans.marksAwarded}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    showModal('Result Analysis', bodyHtml, null, 'Close');
    // Change confirm button to just close
    document.getElementById('modalConfirmBtn').textContent = 'Close';
    document.getElementById('modalConfirmBtn').onclick = closeModal;
    document.getElementById('modalCancelBtn').classList.add('hidden');
  } catch (error) {
    showToast('Error loading analysis', 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Discussions Page ====================
async function loadDiscussions(container) {
  const tests = await apiCall('/tests');
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Discussion Forum Management</h3>
        <div class="flex space-x-4">
          <select id="discussionTestSelect" class="px-4 py-2 border border-gray-300 rounded-lg flex-1">
            <option value="">Select a test</option>
            ${tests.map(t => `<option value="${t.testId}">${t.testName}</option>`).join('')}
          </select>
          <button id="addDiscussionBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50" disabled>
            <i class="fas fa-plus mr-2"></i>Add Post
          </button>
        </div>
      </div>
      <div class="p-6" id="discussionsContainer">
        <p class="text-gray-500 text-center py-8">Select a test to view discussions</p>
      </div>
    </div>
  `;
  
  const testSelect = document.getElementById('discussionTestSelect');
  const addBtn = document.getElementById('addDiscussionBtn');
  
  testSelect.addEventListener('change', async () => {
    const testId = testSelect.value;
    if (!testId) {
      addBtn.disabled = true;
      document.getElementById('discussionsContainer').innerHTML = '<p class="text-gray-500 text-center py-8">Select a test to view discussions</p>';
      return;
    }
    addBtn.disabled = false;
    await loadDiscussionsForTest(testId);
  });
  
  addBtn.addEventListener('click', () => {
    const testId = testSelect.value;
    if (testId) showDiscussionModal(testId);
  });
}

async function loadDiscussionsForTest(testId) {
  showLoading();
  try {
    const discussions = await apiCall(`/discussions/${testId}`);
    const container = document.getElementById('discussionsContainer');
    
    container.innerHTML = `
      <div class="space-y-4">
        ${discussions.map(d => `
          <div class="border rounded-lg p-4 hover:shadow-sm transition">
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-semibold text-gray-800">${d.title}</h4>
                <p class="text-gray-600 mt-1">${d.description || ''}</p>
                ${d.link ? `<a href="${d.link}" target="_blank" class="text-indigo-600 text-sm mt-1 inline-block">${d.link}</a>` : ''}
                <p class="text-xs text-gray-400 mt-2">Posted: ${new Date(d.createdAt).toLocaleString()}</p>
              </div>
              <button data-id="${d._id}" class="deleteDiscussionBtn text-red-600 hover:text-red-800">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `).join('')}
        ${discussions.length === 0 ? '<p class="text-gray-500 text-center py-4">No discussions yet</p>' : ''}
      </div>
    `;
    
    document.querySelectorAll('.deleteDiscussionBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this discussion post?')) {
          await apiCall(`/discussions/${btn.dataset.id}`, { method: 'DELETE' });
          showToast('Discussion deleted', 'success');
          loadDiscussionsForTest(testId);
        }
      });
    });
  } catch (e) {} finally { hideLoading(); }
}

function showDiscussionModal(testId, discussion = null) {
  const isEdit = !!discussion;
  const bodyHtml = `
    <form id="discussionForm" class="space-y-4">
      <input type="hidden" name="testId" value="${testId}">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input type="text" name="title" value="${discussion?.title || ''}" required
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea name="description" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${discussion?.description || ''}</textarea>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">External Link (optional)</label>
        <input type="url" name="link" value="${discussion?.link || ''}" placeholder="https://..."
               class="w-full px-3 py-2 border border-gray-300 rounded-lg">
      </div>
    </form>
  `;
  
  showModal(isEdit ? 'Edit Discussion' : 'Add Discussion Post', bodyHtml, async () => {
    const form = document.getElementById('discussionForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    if (isEdit) {
      await apiCall(`/discussions/${discussion._id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/discussions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    showToast(isEdit ? 'Discussion updated' : 'Discussion added', 'success');
    loadDiscussionsForTest(testId);
  }, isEdit ? 'Update' : 'Post');
}

// ==================== Messages Page ====================
async function loadMessages(container) {
  const messages = await apiCall('/messages');
  state.data.messages = messages;
  
  // Group messages by student
  const studentMessages = {};
  messages.forEach(m => {
    if (!studentMessages[m.studentId]) studentMessages[m.studentId] = [];
    studentMessages[m.studentId].push(m);
  });
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex h-[calc(100vh-200px)]">
      <div class="w-80 border-r">
        <div class="p-4 border-b">
          <h4 class="font-semibold">Students</h4>
        </div>
        <div class="overflow-y-auto h-full">
          ${Object.keys(studentMessages).map(studentId => {
            const lastMsg = studentMessages[studentId][0];
            const unblockRequest = studentMessages[studentId].some(m => m.isUnblockRequest);
            return `
              <div data-student="${studentId}" class="studentChatItem p-4 border-b hover:bg-gray-50 cursor-pointer ${unblockRequest ? 'bg-yellow-50' : ''}">
                <p class="font-medium">${studentId}</p>
                <p class="text-sm text-gray-600 truncate">${lastMsg.content.substring(0, 30)}...</p>
                ${unblockRequest ? '<span class="text-xs text-yellow-600">Unblock Request</span>' : ''}
              </div>
            `;
          }).join('')}
          ${Object.keys(studentMessages).length === 0 ? '<p class="p-4 text-gray-500">No messages</p>' : ''}
        </div>
      </div>
      <div class="flex-1 flex flex-col">
        <div id="chatHeader" class="p-4 border-b">
          <p class="text-gray-500">Select a student to view conversation</p>
        </div>
        <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-3">
        </div>
        <div id="chatInput" class="p-4 border-t hidden">
          <div class="flex space-x-2">
            <input type="text" id="messageInput" placeholder="Type your reply..." class="flex-1 px-3 py-2 border border-gray-300 rounded-lg">
            <button id="sendMessageBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Send</button>
          </div>
          <button id="unblockFromChatBtn" class="mt-2 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 hidden">Unblock Student</button>
        </div>
      </div>
    </div>
  `;
  
  let currentStudent = null;
  
  document.querySelectorAll('.studentChatItem').forEach(item => {
    item.addEventListener('click', async () => {
      currentStudent = item.dataset.student;
      const studentMsgs = studentMessages[currentStudent] || [];
      
      // Check if student is blocked and has unblock request
      const hasUnblockRequest = studentMsgs.some(m => m.isUnblockRequest);
      const studentInfo = await apiCall('/students').then(s => s.find(st => st.studentId === currentStudent));
      const isBlocked = studentInfo?.status === 'blocked';
      
      document.getElementById('chatHeader').innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <p class="font-semibold">${currentStudent}</p>
            <p class="text-sm text-gray-600">${studentInfo?.fullName || ''}</p>
          </div>
          ${isBlocked ? '<span class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Blocked</span>' : ''}
        </div>
      `;
      
      const messagesContainer = document.getElementById('chatMessages');
      messagesContainer.innerHTML = studentMsgs.reverse().map(m => `
        <div class="flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}">
          <div class="max-w-xs px-4 py-2 rounded-lg ${m.sender === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}">
            <p>${m.content}</p>
            <p class="text-xs mt-1 ${m.sender === 'admin' ? 'text-indigo-200' : 'text-gray-500'}">${new Date(m.timestamp).toLocaleTimeString()}</p>
            ${m.isUnblockRequest ? '<p class="text-xs text-yellow-600 mt-1">Unblock request</p>' : ''}
          </div>
        </div>
      `).join('');
      
      document.getElementById('chatInput').classList.remove('hidden');
      if (hasUnblockRequest && isBlocked) {
        document.getElementById('unblockFromChatBtn').classList.remove('hidden');
      } else {
        document.getElementById('unblockFromChatBtn').classList.add('hidden');
      }
    });
  });
  
  document.getElementById('sendMessageBtn').addEventListener('click', async () => {
    if (!currentStudent) return;
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    await apiCall('/messages', {
      method: 'POST',
      body: JSON.stringify({
        studentId: currentStudent,
        sender: 'admin',
        content
      })
    });
    input.value = '';
    showToast('Message sent', 'success');
    // Refresh messages
    const newMessages = await apiCall('/messages');
    state.data.messages = newMessages;
    loadPage('messages');
  });
  
  document.getElementById('unblockFromChatBtn').addEventListener('click', async () => {
    if (!currentStudent) return;
    if (confirm('Unblock this student?')) {
      await apiCall(`/students/${currentStudent}/unblock`, { method: 'PUT' });
      showToast('Student unblocked', 'success');
      loadPage('messages');
    }
  });
}

// ==================== Blocked Students Page ====================
async function loadBlockedStudents(container) {
  const students = await apiCall('/students');
  const blocked = students.filter(s => s.status === 'blocked');
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800">Blocked Students</h3>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4">Student ID</th>
                <th class="text-left py-3 px-4">Name</th>
                <th class="text-left py-3 px-4">Class</th>
                <th class="text-left py-3 px-4">Block Reason</th>
                <th class="text-left py-3 px-4">Blocked At</th>
                <th class="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${blocked.map(s => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4">${s.studentId}</td>
                  <td class="py-3 px-4">${s.fullName}</td>
                  <td class="py-3 px-4">${s.class || '-'}</td>
                  <td class="py-3 px-4 text-red-600">${s.blockReason || '-'}</td>
                  <td class="py-3 px-4">${s.blockedAt ? new Date(s.blockedAt).toLocaleString() : '-'}</td>
                  <td class="py-3 px-4">
                    <button data-id="${s.studentId}" class="unblockBtn text-green-600 hover:text-green-800">Unblock</button>
                  </td>
                </tr>
              `).join('')}
              ${blocked.length === 0 ? '<tr><td colspan="6" class="text-center py-8 text-gray-500">No blocked students</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.unblockBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Unblock this student?')) {
        await apiCall(`/students/${btn.dataset.id}/unblock`, { method: 'PUT' });
        showToast('Student unblocked', 'success');
        loadPage('blocked');
      }
    });
  });
}

// ==================== Monitor Tests Page ====================
async function loadMonitor(container) {
  const tests = await apiCall('/tests');
  const liveTests = tests.filter(t => t.isLive);
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Live Test Monitoring</h3>
        <select id="monitorTestSelect" class="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-64">
          <option value="">Select a live test</option>
          ${liveTests.map(t => `<option value="${t.testId}">${t.testName}</option>`).join('')}
        </select>
      </div>
      <div class="p-6" id="monitorContainer">
        <p class="text-gray-500 text-center py-8">Select a live test to monitor students</p>
      </div>
    </div>
  `;
  
  const testSelect = document.getElementById('monitorTestSelect');
  
  testSelect.addEventListener('change', async () => {
    const testId = testSelect.value;
    if (!testId) {
      document.getElementById('monitorContainer').innerHTML = '<p class="text-gray-500 text-center py-8">Select a live test to monitor students</p>';
      return;
    }
    await loadMonitoringData(testId);
    
    // Auto-refresh every 10 seconds
    if (state.monitorInterval) clearInterval(state.monitorInterval);
    state.monitorInterval = setInterval(() => loadMonitoringData(testId), 10000);
  });
}

async function loadMonitoringData(testId) {
  showLoading();
  try {
    // Get all results for this test that are in progress (not submitted but with result entry)
    const results = await apiCall(`/results/test/${testId}`);
    const activeResults = results.filter(r => !r.submittedAt || r.paused); // Simplified
    
    // For each active result, get pause status
    const monitorData = await Promise.all(activeResults.map(async r => {
      try {
        const status = await apiCall(`/admin/paused-status/${r.studentId}/${testId}`);
        return { ...r, ...status };
      } catch {
        return { ...r, paused: false };
      }
    }));
    
    const container = document.getElementById('monitorContainer');
    container.innerHTML = `
      <h4 class="font-semibold text-gray-800 mb-4">Active Students (${monitorData.length})</h4>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4">Student ID</th>
              <th class="text-left py-3 px-4">Status</th>
              <th class="text-left py-3 px-4">Paused Duration</th>
              <th class="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${monitorData.map(d => `
              <tr class="border-b border-gray-100">
                <td class="py-3 px-4">${d.studentId}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-1 rounded-full text-xs ${d.paused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                    ${d.paused ? 'Paused' : 'Active'}
                  </span>
                </td>
                <td class="py-3 px-4">${Math.floor((d.totalPausedDuration || 0) / 60)} min</td>
                <td class="py-3 px-4">
                  ${d.paused 
                    ? `<button data-student="${d.studentId}" class="resumeTestBtn text-green-600 hover:text-green-800 mr-3">Resume</button>`
                    : `<button data-student="${d.studentId}" class="pauseTestBtn text-yellow-600 hover:text-yellow-800 mr-3">Pause</button>`
                  }
                </td>
              </tr>
            `).join('')}
            ${monitorData.length === 0 ? '<tr><td colspan="4" class="text-center py-8 text-gray-500">No active students for this test</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    `;
    
    // Pause/Resume handlers
    document.querySelectorAll('.pauseTestBtn').forEach(btn => {
      btn.addEventListener('click', () => showPasswordPrompt('pause', testId, btn.dataset.student));
    });
    document.querySelectorAll('.resumeTestBtn').forEach(btn => {
      btn.addEventListener('click', () => showPasswordPrompt('resume', testId, btn.dataset.student));
    });
  } catch (e) {} finally { hideLoading(); }
}

function showPasswordPrompt(action, testId, studentId) {
  const bodyHtml = `
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Enter ${action === 'pause' ? 'Pause' : 'Resume'} Password</label>
      <input type="password" id="actionPassword" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Password">
    </div>
  `;
  
  showModal(`${action === 'pause' ? 'Pause' : 'Resume'} Test`, bodyHtml, async () => {
    const password = document.getElementById('actionPassword').value;
    if (!password) {
      showToast('Password required', 'error');
      throw new Error('Password required');
    }
    
    const endpoint = action === 'pause' ? '/admin/pause-test' : '/admin/resume-test';
    await apiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify({ studentId, testId, password })
    });
    showToast(`Test ${action}d`, 'success');
    loadMonitoringData(testId);
  }, action === 'pause' ? 'Pause' : 'Resume');
}

// ==================== Settings Page ====================
async function loadSettings(container) {
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-800 mb-6">Admin Settings</h3>
      <form id="passwordForm" class="max-w-md space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">New Admin Password</label>
          <input type="password" id="newPassword" required minlength="6"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input type="password" id="confirmPassword" required minlength="6"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
        </div>
        <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Update Password
        </button>
      </form>
      <div class="mt-8 pt-6 border-t">
        <p class="text-sm text-gray-600">Environment Variables (Read-only)</p>
        <div class="mt-2 space-y-1 text-sm">
          <p><span class="font-medium">ADMIN_USERNAME:</span> ${'•'.repeat(8)}</p>
          <p><span class="font-medium">PAUSE_PASSWORD:</span> ${'•'.repeat(8)}</p>
          <p><span class="font-medium">RESUME_PASSWORD:</span> ${'•'.repeat(8)}</p>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    
    if (newPass !== confirmPass) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    showLoading();
    try {
      await apiCall('/settings/password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPass })
      });
      showToast('Password updated successfully', 'success');
      document.getElementById('passwordForm').reset();
    } catch (e) {} finally { hideLoading(); }
  });
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  loadPage('dashboard');
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
  });
  
  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadPage(state.currentPage);
  });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (state.monitorInterval) clearInterval(state.monitorInterval);
});
