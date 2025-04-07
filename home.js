// Home page script

// DOM Elements
const createCallBtn = document.getElementById('createCallBtn');
const joinCallBtn = document.getElementById('joinCallBtn');
const joinModal = document.getElementById('joinModal');
const confirmJoinBtn = document.getElementById('confirmJoinBtn');
const joinInput = document.getElementById('joinInput');
const closeModal = document.querySelector('.close-modal');

// Event handlers
createCallBtn.addEventListener('click', () => {
  // Navigate to the create call page
  window.location.href = 'create.html';
});

joinCallBtn.addEventListener('click', () => {
  // Show the join modal
  joinModal.classList.add('active');
});

confirmJoinBtn.addEventListener('click', () => {
  const callId = joinInput.value.trim();
  if (callId) {
    // Store call ID in sessionStorage and navigate to call page
    sessionStorage.setItem('joinCallId', callId);
    sessionStorage.setItem('callMode', 'join');
    window.location.href = 'call.html';
  } else {
    alert('Please enter a valid Call ID');
  }
});

// Close modal when clicking the X or outside the modal
closeModal.addEventListener('click', () => {
  joinModal.classList.remove('active');
});

window.addEventListener('click', (event) => {
  if (event.target === joinModal) {
    joinModal.classList.remove('active');
  }
});

// Handle enter key in input
joinInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    confirmJoinBtn.click();
  }
});