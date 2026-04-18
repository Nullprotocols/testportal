// ==================== NexGen Student Portal JavaScript ====================
// Global state
const studentData = JSON.parse(localStorage.getItem('studentData'));
if (!studentData) {
  window.location.href = 'index.html';
}

const state = {
  student: studentData,
  currentPage: 'dashboard',
  currentTest: null,
  testAnswers: {},
  flaggedQuestions: new Set(),
  testStartTime: null,
  timerInterval: null,
  pauseInterval: null,
  tabSwitchCount: 0,
  language: localStorage.getItem('preferredLanguage') || 'en',
  autoSaveInterval: null
};

// ==================== API Wrapper ====================
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' }
  };
  
  try {
    const response = await fetch(`/api${endpoint}`, { ...defaultOptions, ...options });
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
  const existing = document.getElementById('loadingOverlay');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50';
  overlay.innerHTML = `
    <div class="bg-white p-6 rounded-2xl shadow-xl">
      <i class="fas fa-spinner fa-spin text-3xl text-indigo-600"></i>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.remove();
}

function showToast(message, type = 'info') {
  const container = document.createElement('div');
  container.className = 'fixed bottom-4 right-4 z-50';
  container.innerHTML = `
    <div class="toast-enter p-4 rounded-lg shadow-lg text-white ${
      type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-indigo-600'
    }">
      <i class="fas fa-${
        type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'
      } mr-2"></i>${message}
    </div>
  `;
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3000);
}

// ==================== Navigation ====================
const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fa-home' },
  { id: 'available', label: 'Available Tests', icon: 'fa-list' },
  { id: 'results', label: 'Previous Results', icon: 'fa-chart-bar' },
  { id: 'discussions', label: 'Discussions', icon: 'fa-comments' },
  { id: 'messages', label: 'Messages', icon: 'fa-envelope' }
];

function renderSidebar() {
  document.getElementById('studentNameDisplay').textContent = 
    `${state.student.fullName} (${state.student.class || 'N/A'})`;
  
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
  // Clean up any test intervals if leaving test page
  if (state.currentTest) {
    exitTest(false);
  }
  
  showLoading();
  try {
    const titleMap = {
      dashboard: 'Dashboard',
      available: 'Available Tests',
      results: 'Previous Results',
      discussions: 'Discussion Forum',
      messages: 'Messages'
    };
    document.getElementById('pageTitle').textContent = titleMap[pageId];
    const container = document.getElementById('contentContainer');
    
    switch(pageId) {
      case 'dashboard':
        await loadStudentDashboard(container);
        break;
      case 'available':
        await loadAvailableTests(container);
        break;
      case 'results':
        await loadStudentResults(container);
        break;
      case 'discussions':
        await loadStudentDiscussions(container);
        break;
      case 'messages':
        await loadStudentMessages(container);
        break;
    }
  } catch (error) {
    showToast('Error loading page: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Dashboard ====================
async function loadStudentDashboard(container) {
  const results = await apiCall(`/results/student/${state.student.studentId}`);
  const avgScore = results.length 
    ? (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(1) 
    : '0.0';
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Profile</h3>
        <div class="space-y-2">
          <p><span class="font-medium">ID:</span> ${state.student.studentId}</p>
          <p><span class="font-medium">Name:</span> ${state.student.fullName}</p>
          <p><span class="font-medium">Class:</span> ${state.student.class || 'N/A'}</p>
          <p><span class="font-medium">DOB:</span> ${state.student.dob}</p>
          <p><span class="font-medium">Mobile:</span> ${state.student.mobile || 'N/A'}</p>
          <p><span class="font-medium">Email:</span> ${state.student.email || 'N/A'}</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Statistics</h3>
        <div class="mb-4">
          <p class="text-4xl font-bold text-indigo-600">${results.length}</p>
          <p class="text-gray-500">Tests Taken</p>
        </div>
        <div>
          <p class="text-4xl font-bold text-green-600">${avgScore}</p>
          <p class="text-gray-500">Average Score</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        <div class="space-y-2">
          ${results.slice(0, 5).map(r => `
            <div class="py-2 border-b last:border-0">
              <p class="font-medium">${r.testId}</p>
              <p class="text-sm text-gray-500">
                Score: ${r.score} | Rank: ${r.rank || 'N/A'}<br>
                ${new Date(r.submittedAt).toLocaleDateString()}
              </p>
            </div>
          `).join('') || '<p class="text-gray-500">No tests taken yet</p>'}
        </div>
      </div>
    </div>
  `;
}

// ==================== Available Tests ====================
async function loadAvailableTests(container) {
  const tests = await apiCall(`/student/available-tests/${state.student.studentId}`);
  
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${tests.map(test => `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
          <h3 class="text-xl font-bold text-gray-800 mb-2">${test.testName}</h3>
          <div class="space-y-2 text-gray-600 mb-4">
            <p><i class="far fa-clock mr-2"></i>Duration: ${test.duration} min</p>
            <p><i class="far fa-calendar mr-2"></i>Starts: ${new Date(test.startTime).toLocaleString()}</p>
            <p><i class="far fa-calendar-check mr-2"></i>Ends: ${new Date(test.endTime).toLocaleString()}</p>
            <p><i class="fas fa-star mr-2"></i>Marks: +${test.marks.correct} / ${test.marks.wrong} / ${test.marks.skip}</p>
          </div>
          <button data-testid="${test.testId}" class="startTestBtn w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Start Test
          </button>
        </div>
      `).join('')}
      ${tests.length === 0 
        ? '<p class="col-span-full text-center text-gray-500 py-12">No tests available at the moment.</p>' 
        : ''}
    </div>
  `;
  
  document.querySelectorAll('.startTestBtn').forEach(btn => {
    btn.addEventListener('click', () => startTest(btn.dataset.testid));
  });
}

// ==================== Test Taking ====================
async function startTest(testId) {
  showLoading();
  try {
    // Initialize test session
    const result = await apiCall('/student/start-test', {
      method: 'POST',
      body: JSON.stringify({ studentId: state.student.studentId, testId })
    });
    
    const [test, questions] = await Promise.all([
      apiCall('/tests').then(tests => tests.find(t => t.testId === testId)),
      apiCall(`/questions/${testId}`)
    ]);
    
    if (!test) throw new Error('Test not found');
    
    state.currentTest = {
      testId,
      test,
      questions: test.shuffle ? shuffleArray([...questions]) : questions,
      result,
      currentIndex: 0
    };
    
    // Reset test state
    state.testAnswers = {};
    state.flaggedQuestions.clear();
    state.testStartTime = Date.now();
    state.tabSwitchCount = 0;
    
    // Render test interface
    renderTestInterface();
    
    // Start systems
    startTestTimer();
    startPausePolling();
    startAutoSave();
    
    // Anti-cheating
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
  } catch (error) {
    showToast('Error starting test: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderTestInterface() {
  const modal = document.getElementById('testModal');
  const q = state.currentTest.questions[state.currentTest.currentIndex];
  const currentAnswer = state.testAnswers[q.questionId];
  const isFlagged = state.flaggedQuestions.has(q.questionId);
  
  modal.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gray-50">
      <!-- Header -->
      <div class="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h2 class="text-xl font-bold text-gray-800">${state.currentTest.test.testName}</h2>
          <p class="text-gray-600">Question ${state.currentTest.currentIndex + 1} of ${state.currentTest.questions.length}</p>
        </div>
        <div class="flex items-center space-x-4">
          <div id="timer" class="text-2xl font-mono font-bold px-4 py-2 rounded-lg ${
            state.currentTest.test.duration <= 1 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'
          }"></div>
          <button id="toggleLanguageBtn" class="px-3 py-2 border rounded-lg hover:bg-gray-50">
            <i class="fas fa-language mr-1"></i>${state.language === 'en' ? 'हिंदी' : 'English'}
          </button>
          <button id="closeTestBtn" class="text-gray-500 hover:text-gray-700 p-2">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Question Area -->
        <div class="flex-1 p-6 overflow-y-auto">
          <div class="max-w-3xl mx-auto">
            <div class="bg-white rounded-xl shadow-sm border p-6">
              <!-- Question Text -->
              <div class="prose max-w-none mb-6">
                <p class="text-lg font-medium">${q.questionText[state.language] || q.questionText.en}</p>
                ${q.imageUrls?.length ? q.imageUrls.map(url => `
                  <img src="${url}" class="my-4 max-w-full rounded-lg" alt="Question image">
                `).join('') : ''}
              </div>
              
              <!-- Options -->
              <div class="space-y-3" id="optionsContainer">
                ${renderOptions(q, currentAnswer)}
              </div>
              
              <!-- Action Buttons -->
              <div class="mt-6 flex space-x-3">
                <button id="clearAnswerBtn" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <i class="far fa-times-circle mr-2"></i>Clear
                </button>
                <button id="flagQuestionBtn" class="px-4 py-2 border rounded-lg hover:bg-gray-50 ${
                  isFlagged ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-300'
                }">
                  <i class="far fa-flag mr-2"></i>${isFlagged ? 'Unflag' : 'Flag'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Question Palette -->
        <div class="w-80 bg-white border-l p-4 overflow-y-auto">
          <h3 class="font-semibold text-gray-700 mb-3">Question Palette</h3>
          <div class="grid grid-cols-5 gap-2">
            ${state.currentTest.questions.map((question, idx) => {
              const qid = question.questionId;
              let statusClass = 'not-visited';
              if (state.testAnswers[qid] !== undefined) statusClass = 'answered';
              if (state.flaggedQuestions.has(qid)) statusClass = 'flagged';
              if (idx === state.currentTest.currentIndex) statusClass += ' current';
              
              return `
                <div data-index="${idx}" class="question-palette-btn ${statusClass}">
                  ${idx + 1}
                </div>
              `;
            }).join('')}
          </div>
          <div class="mt-6 space-y-2 text-sm">
            <div class="flex items-center"><span class="w-3 h-3 bg-green-500 rounded mr-2"></span> Answered</div>
            <div class="flex items-center"><span class="w-3 h-3 bg-yellow-500 rounded mr-2"></span> Flagged</div>
            <div class="flex items-center"><span class="w-3 h-3 bg-gray-300 rounded mr-2"></span> Not Visited</div>
            <div class="flex items-center"><span class="w-3 h-3 border-2 border-indigo-500 rounded mr-2"></span> Current</div>
          </div>
          <button id="submitTestBtn" class="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">
            Submit Test
          </button>
        </div>
      </div>
      
      <!-- Footer Navigation -->
      <div class="bg-white border-t p-4 flex justify-between">
        <button id="prevBtn" class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50" 
                ${state.currentTest.currentIndex === 0 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left mr-2"></i>Previous
        </button>
        <span class="text-gray-500">${state.currentTest.currentIndex + 1} / ${state.currentTest.questions.length}</span>
        <button id="nextBtn" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          ${state.currentTest.currentIndex === state.currentTest.questions.length - 1 ? 'Finish' : 'Next'} 
          <i class="fas fa-chevron-right ml-2"></i>
        </button>
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
  attachTestEventListeners();
}

function renderOptions(question, currentAnswer) {
  if (question.type === 'mcq') {
    return question.options.map((opt, idx) => {
      const optionValue = idx + 1;
      const isSelected = currentAnswer == optionValue;
      return `
        <label class="flex items-center p-4 border rounded-lg cursor-pointer transition ${
          isSelected ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
        }">
          <input type="radio" name="mcq" value="${optionValue}" ${isSelected ? 'checked' : ''} class="mr-3">
          <span class="flex-1">${opt[state.language] || opt.en}</span>
          ${isSelected ? '<i class="fas fa-check-circle text-indigo-600"></i>' : ''}
        </label>
      `;
    }).join('');
  } else {
    return `
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Enter your answer:</label>
        <input type="number" step="any" id="numericalAnswer" value="${currentAnswer || ''}" 
               class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-lg"
               placeholder="Type your numerical answer here">
      </div>
    `;
  }
}

function attachTestEventListeners() {
  const modal = document.getElementById('testModal');
  const currentQ = state.currentTest.questions[state.currentTest.currentIndex];
  
  // MCQ option selection
  modal.querySelectorAll('input[name="mcq"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.testAnswers[currentQ.questionId] = parseInt(e.target.value);
      renderTestInterface();
    });
  });
  
  // Numerical input
  const numInput = modal.querySelector('#numericalAnswer');
  if (numInput) {
    numInput.addEventListener('input', (e) => {
      state.testAnswers[currentQ.questionId] = parseFloat(e.target.value) || e.target.value;
    });
    numInput.focus();
  }
  
  // Clear answer
  modal.querySelector('#clearAnswerBtn')?.addEventListener('click', () => {
    delete state.testAnswers[currentQ.questionId];
    renderTestInterface();
  });
  
  // Flag question
  modal.querySelector('#flagQuestionBtn')?.addEventListener('click', () => {
    if (state.flaggedQuestions.has(currentQ.questionId)) {
      state.flaggedQuestions.delete(currentQ.questionId);
    } else {
      state.flaggedQuestions.add(currentQ.questionId);
    }
    renderTestInterface();
  });
  
  // Navigation
  modal.querySelector('#prevBtn')?.addEventListener('click', () => {
    if (state.currentTest.currentIndex > 0) {
      state.currentTest.currentIndex--;
      renderTestInterface();
    }
  });
  
  modal.querySelector('#nextBtn')?.addEventListener('click', () => {
    if (state.currentTest.currentIndex < state.currentTest.questions.length - 1) {
      state.currentTest.currentIndex++;
      renderTestInterface();
    } else {
      // Last question, show confirmation
      showSubmitConfirmation();
    }
  });
  
  // Palette buttons
  modal.querySelectorAll('[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentTest.currentIndex = parseInt(btn.dataset.index);
      renderTestInterface();
    });
  });
  
  // Language toggle
  modal.querySelector('#toggleLanguageBtn')?.addEventListener('click', () => {
    state.language = state.language === 'en' ? 'hi' : 'en';
    localStorage.setItem('preferredLanguage', state.language);
    renderTestInterface();
  });
  
  // Submit button
  modal.querySelector('#submitTestBtn')?.addEventListener('click', showSubmitConfirmation);
  
  // Close test
  modal.querySelector('#closeTestBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the test? Your progress will be lost.')) {
      exitTest(true);
    }
  });
}

function showSubmitConfirmation() {
  const answered = Object.keys(state.testAnswers).length;
  const total = state.currentTest.questions.length;
  const flagged = state.flaggedQuestions.size;
  
  const message = `
    <div class="space-y-2">
      <p>You are about to submit your test.</p>
      <div class="bg-gray-50 p-4 rounded-lg">
        <p><span class="font-medium">Total Questions:</span> ${total}</p>
        <p><span class="font-medium">Answered:</span> ${answered}</p>
        <p><span class="font-medium">Flagged:</span> ${flagged}</p>
        <p><span class="font-medium">Unanswered:</span> ${total - answered}</p>
      </div>
      <p class="text-yellow-600">Are you sure you want to submit?</p>
    </div>
  `;
  
  const confirmModal = document.createElement('div');
  confirmModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  confirmModal.innerHTML = `
    <div class="bg-white p-6 rounded-2xl max-w-md w-full">
      <h3 class="text-xl font-bold mb-4">Submit Test</h3>
      ${message}
      <div class="flex justify-end space-x-3 mt-6">
        <button class="cancelBtn px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button class="confirmBtn px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
  
  confirmModal.querySelector('.cancelBtn').addEventListener('click', () => {
    confirmModal.remove();
  });
  
  confirmModal.querySelector('.confirmBtn').addEventListener('click', () => {
    confirmModal.remove();
    submitTest();
  });
}

function startTestTimer() {
  const timerEl = document.getElementById('timer');
  if (!timerEl) return;
  
  const updateTimer = () => {
    if (!state.testStartTime) return;
    
    const elapsed = Math.floor((Date.now() - state.testStartTime) / 1000) - 
                    (state.currentTest.result.totalPausedDuration || 0);
    const totalSeconds = state.currentTest.test.duration * 60;
    const remaining = Math.max(0, totalSeconds - elapsed);
    
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    if (remaining <= 60) {
      timerEl.classList.add('bg-red-100', 'text-red-700');
      timerEl.classList.remove('bg-gray-100', 'text-gray-800');
    }
    
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      showToast('Time is up! Submitting your test...', 'info');
      submitTest(true);
    }
  };
  
  updateTimer();
  state.timerInterval = setInterval(updateTimer, 1000);
}

function startPausePolling() {
  state.pauseInterval = setInterval(async () => {
    if (!state.currentTest) return;
    
    try {
      const status = await apiCall(`/admin/paused-status/${state.student.studentId}/${state.currentTest.testId}`);
      
      const overlay = document.getElementById('pauseOverlay');
      if (status.paused) {
        overlay.classList.add('flex');
        overlay.classList.remove('hidden');
        // Update the stored paused duration from server
        state.currentTest.result.totalPausedDuration = status.totalPausedDuration;
      } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
      }
    } catch (e) {
      // Ignore errors during polling
    }
  }, 2000);
}

function startAutoSave() {
  state.autoSaveInterval = setInterval(async () => {
    if (!state.currentTest || Object.keys(state.testAnswers).length === 0) return;
    
    try {
      // In a full implementation, you'd call an auto-save endpoint
      // For now, we just note that answers are preserved in memory
      console.log('Auto-saved', Object.keys(state.testAnswers).length, 'answers');
    } catch (e) {}
  }, 30000);
}

function handleVisibilityChange() {
  if (document.hidden && state.currentTest) {
    state.tabSwitchCount++;
    
    if (state.tabSwitchCount >= 3) {
      showToast('Multiple tab switches detected. Test will be auto-submitted.', 'error');
      submitTest(true);
    } else {
      showToast(`Warning: Tab switch detected (${state.tabSwitchCount}/3). This is considered cheating.`, 'error');
    }
  }
}

async function submitTest(isAuto = false) {
  // Clean up intervals and listeners
  clearInterval(state.timerInterval);
  clearInterval(state.pauseInterval);
  clearInterval(state.autoSaveInterval);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // Prepare answers
  const answers = Object.entries(state.testAnswers).map(([qid, ans]) => ({
    questionId: qid,
    selectedAnswer: ans
  }));
  
  showLoading();
  try {
    const result = await apiCall('/student/submit-test', {
      method: 'POST',
      body: JSON.stringify({
        studentId: state.student.studentId,
        testId: state.currentTest.testId,
        answers
      })
    });
    
    // Hide test modal
    document.getElementById('testModal').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    
    // Show score
    showScoreModal(result);
    
    state.currentTest = null;
    loadPage('available');
  } catch (error) {
    showToast('Error submitting test: ' + error.message, 'error');
    // Re-enable interface? 
  } finally {
    hideLoading();
  }
}

function showScoreModal(result) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white p-8 rounded-2xl max-w-md w-full text-center">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-check-circle text-5xl text-green-600"></i>
      </div>
      <h2 class="text-2xl font-bold mb-2">Test Completed!</h2>
      <p class="text-gray-600 mb-4">Your test has been submitted successfully.</p>
      <div class="bg-gray-50 rounded-lg p-6 mb-6">
        <p class="text-sm text-gray-500">Your Score</p>
        <p class="text-5xl font-bold text-indigo-600 my-2">${result.score}</p>
        <p class="text-gray-700">Rank: ${result.rank}</p>
      </div>
      <button class="closeModalBtn w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">
        Continue
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  
  modal.querySelector('.closeModalBtn').addEventListener('click', () => {
    modal.remove();
  });
}

function exitTest(confirm = true) {
  if (confirm && !window.confirm('Exit test? Your progress will be lost.')) return;
  
  clearInterval(state.timerInterval);
  clearInterval(state.pauseInterval);
  clearInterval(state.autoSaveInterval);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  document.getElementById('testModal').classList.add('hidden');
  document.getElementById('pauseOverlay').classList.add('hidden');
  state.currentTest = null;
}

// ==================== Results Page ====================
async function loadStudentResults(container) {
  const results = await apiCall(`/results/student/${state.student.studentId}`);
  const tests = await apiCall('/tests');
  const testMap = Object.fromEntries(tests.map(t => [t.testId, t.testName]));
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800">Your Test Results</h3>
      </div>
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4">Test Name</th>
                <th class="text-left py-3 px-4">Score</th>
                <th class="text-left py-3 px-4">Rank</th>
                <th class="text-left py-3 px-4">Date</th>
                <th class="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(r => `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4 font-medium">${testMap[r.testId] || r.testId}</td>
                  <td class="py-3 px-4">
                    <span class="text-lg font-semibold ${r.score >= 0 ? 'text-green-600' : 'text-red-600'}">${r.score}</span>
                  </td>
                  <td class="py-3 px-4">${r.rank || 'N/A'}</td>
                  <td class="py-3 px-4 text-sm text-gray-500">${new Date(r.submittedAt).toLocaleString()}</td>
                  <td class="py-3 px-4">
                    <button data-test="${r.testId}" class="viewAnalysisBtn text-indigo-600 hover:text-indigo-800">
                      View Analysis
                    </button>
                  </td>
                </tr>
              `).join('')}
              ${results.length === 0 
                ? '<tr><td colspan="5" class="text-center py-8 text-gray-500">No results yet</td></tr>' 
                : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.querySelectorAll('.viewAnalysisBtn').forEach(btn => {
    btn.addEventListener('click', () => showStudentAnalysisModal(btn.dataset.test));
  });
}

async function showStudentAnalysisModal(testId) {
  showLoading();
  try {
    const [results, questions] = await Promise.all([
      apiCall(`/results/student/${state.student.studentId}`),
      apiCall(`/questions/${testId}`)
    ]);
    const result = results.find(r => r.testId === testId);
    if (!result) throw new Error('Result not found');
    
    const questionMap = Object.fromEntries(questions.map(q => [q.questionId, q]));
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div class="p-6 border-b">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold">Test Analysis - ${testId}</h3>
            <button class="closeModalBtn text-gray-400 hover:text-gray-600">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-gray-500">Score</p>
              <p class="text-2xl font-bold text-indigo-600">${result.score}</p>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-gray-500">Rank</p>
              <p class="text-2xl font-bold">${result.rank || 'N/A'}</p>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-gray-500">Submitted</p>
              <p class="text-sm">${new Date(result.submittedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-4">
            ${result.answers.map(ans => {
              const q = questionMap[ans.questionId];
              if (!q) return '';
              const isCorrect = ans.isCorrect;
              return `
                <div class="border rounded-lg p-4 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
                  <p class="font-medium mb-2">${q.questionText.en}</p>
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p class="text-gray-600">Your Answer:</p>
                      <p class="font-medium">${ans.selectedAnswer ?? 'Not answered'}</p>
                    </div>
                    <div>
                      <p class="text-gray-600">Correct Answer:</p>
                      <p class="font-medium">${q.type === 'mcq' ? `Option ${q.correctAnswer}` : q.correctAnswer}</p>
                    </div>
                  </div>
                  <p class="mt-2 text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}">
                    Marks: ${ans.marksAwarded}
                  </p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="p-6 border-t">
          <button class="closeModalBtn w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const closeBtns = modal.querySelectorAll('.closeModalBtn');
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.remove()));
    
  } catch (error) {
    showToast('Error loading analysis: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== Discussions Page ====================
async function loadStudentDiscussions(container) {
  const tests = await apiCall('/tests');
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Discussion Forum</h3>
        <select id="discussionTestSelect" class="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-64">
          <option value="">Select a test</option>
          ${tests.map(t => `<option value="${t.testId}">${t.testName}</option>`).join('')}
        </select>
      </div>
      <div class="p-6" id="discussionsContainer">
        <p class="text-gray-500 text-center py-8">Select a test to view discussions</p>
      </div>
    </div>
  `;
  
  document.getElementById('discussionTestSelect').addEventListener('change', async (e) => {
    const testId = e.target.value;
    if (!testId) {
      document.getElementById('discussionsContainer').innerHTML = 
        '<p class="text-gray-500 text-center py-8">Select a test to view discussions</p>';
      return;
    }
    
    showLoading();
    try {
      const discussions = await apiCall(`/discussions/${testId}`);
      const container = document.getElementById('discussionsContainer');
      
      container.innerHTML = `
        <div class="space-y-4">
          ${discussions.map(d => `
            <div class="border rounded-lg p-4 hover:shadow-sm transition">
              <h4 class="font-semibold text-gray-800">${d.title}</h4>
              <p class="text-gray-600 mt-1">${d.description || ''}</p>
              ${d.link ? `
                <a href="${d.link}" target="_blank" class="text-indigo-600 text-sm mt-2 inline-block">
                  <i class="fas fa-external-link-alt mr-1"></i>View Resource
                </a>
              ` : ''}
              <p class="text-xs text-gray-400 mt-3">Posted: ${new Date(d.createdAt).toLocaleString()}</p>
            </div>
          `).join('')}
          ${discussions.length === 0 
            ? '<p class="text-gray-500 text-center py-4">No discussions for this test</p>' 
            : ''}
        </div>
      `;
    } catch (e) {} finally { hideLoading(); }
  });
}

// ==================== Messages Page ====================
async function loadStudentMessages(container) {
  const messages = await apiCall(`/messages?studentId=${state.student.studentId}`);
  
  container.innerHTML = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
      <div class="p-6 border-b">
        <h3 class="text-lg font-semibold text-gray-800">Messages with Admin</h3>
        ${state.student.status === 'blocked' 
          ? '<p class="text-red-600 text-sm mt-1">Your account is blocked. You cannot send messages.</p>' 
          : ''}
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-3" id="messagesContainer">
        ${messages.map(m => `
          <div class="flex ${m.sender === 'student' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
              m.sender === 'student' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'
            }">
              <p>${m.content}</p>
              <p class="text-xs mt-1 ${m.sender === 'student' ? 'text-indigo-200' : 'text-gray-500'}">
                ${new Date(m.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        `).join('')}
        ${messages.length === 0 
          ? '<p class="text-center text-gray-500 py-8">No messages yet</p>' 
          : ''}
      </div>
      ${state.student.status !== 'blocked' ? `
        <div class="p-6 border-t">
          <div class="flex space-x-2">
            <input type="text" id="messageInput" placeholder="Type your message..." 
                   class="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
            <button id="sendMessageBtn" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Send
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  if (state.student.status !== 'blocked') {
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  
  async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content) return;
    
    input.disabled = true;
    try {
      await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({
          studentId: state.student.studentId,
          sender: 'student',
          content
        })
      });
      input.value = '';
      showToast('Message sent', 'success');
      loadPage('messages');
    } catch (e) {
      input.disabled = false;
    }
  }
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  loadPage('dashboard');
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('studentData');
    window.location.href = 'index.html';
  });
  
  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadPage(state.currentPage);
  });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (state.timerInterval) clearInterval(state.timerInterval);
  if (state.pauseInterval) clearInterval(state.pauseInterval);
  if (state.autoSaveInterval) clearInterval(state.autoSaveInterval);
});
