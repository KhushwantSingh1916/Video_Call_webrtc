// Active Call Page script

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBAPOukAuY-80w96gfrg82lNq27Z98vU9Q",
    authDomain: "videocall-webrtc-68d25.firebaseapp.com",
    projectId: "videocall-webrtc-68d25",
    storageBucket: "videocall-webrtc-68d25.firebasestorage.app",
    messagingSenderId: "801001516648",
    appId: "1:801001516648:web:e39284bda73350f86115dd",
    measurementId: "G-TK1HL6WDMZ"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
  // DOM Elements
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const statusElement = document.getElementById('status');
  const callIdDisplay = document.getElementById('callIdDisplay');
  const callTimer = document.querySelector('.call-timer');
  const copyCallIdBtn = document.getElementById('copyCallIdBtn');
  
  // Control buttons
  const toggleVideoBtn = document.getElementById('toggleVideoBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const shareScreenBtn = document.getElementById('shareScreenBtn');
  const recordBtn = document.getElementById('recordBtn');
  const hangupBtn = document.getElementById('hangupBtn');
  
  // ICE Servers configuration - includes STUN and TURN servers for better connectivity
  const servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Add TURN servers for production use
    ],
    iceCandidatePoolSize: 10
  };
  
  // State variables
  let localStream = null;
  let remoteStream = null;
  let pc = new RTCPeerConnection(servers);
  let callMode = '';
  let callId = '';
  let callDoc = null;
  let offerCandidates = null;
  let answerCandidates = null;
  let isScreenSharing = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let connectionTimeout = null;
  let callDuration = 0;
  let callTimerInterval = null;
  
  // Initialize the call page
  async function init() {
    // Get call mode and ID from session storage
    callMode = sessionStorage.getItem('callMode');
    
    if (callMode === 'create') {
      callId = sessionStorage.getItem('createCallId');
    } else if (callMode === 'join') {
      callId = sessionStorage.getItem('joinCallId');
    } else {
      // If no mode is set, redirect to home
      window.location.href = 'index.html';
      return;
    }
    
    // Display call ID
    callIdDisplay.value = callId;
    
    // Setup remote stream
    setupRemoteStream();
    
    // Start local stream
    await startLocalStream();