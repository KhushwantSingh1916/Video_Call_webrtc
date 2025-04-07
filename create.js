// Create Call Page script

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
  const statusElement = document.getElementById('status');
  const callInput = document.getElementById('callInput');
  const copyCallIdBtn = document.getElementById('copyCallIdBtn');
  const toggleVideoBtn = document.getElementById('toggleVideoBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');
  const startCallBtn = document.getElementById('startCallBtn');
  const backBtn = document.getElementById('backBtn');
  
  // State variables
  let localStream = null;
  let callDoc = null;
  let videoEnabled = true;
  let audioEnabled = true;
  
  // Initialize the page
  async function init() {
    try {
      // Start local camera/mic stream
      await startLocalStream();
      
      // Generate a call ID in Firestore
      callDoc = db.collection('calls').doc();
      callInput.value = callDoc.id;
      
      updateStatus("Ready to start call", "connected");
      setTimeout(() => { statusElement.style.display = "none"; }, 2000);
      
    } catch (error) {
      console.error("Error initializing create page:", error);
      updateStatus("Failed to initialize. Please reload the page.", "failed");
    }
  }
  
  // Start local video/audio stream
  async function startLocalStream() {
    try {
      updateStatus("Setting up camera...", "connecting");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      
      localVideo.srcObject = stream;
      localStream = stream;
      
      console.log("✅ Local stream started");
      return true;
    } catch (error) {
      console.error("❌ Error accessing camera/mic:", error);
      updateStatus("Failed to access camera or microphone. Please check permissions.", "failed");
      return false;
    }
  }
  
  // Helper function to update status with styling
  function updateStatus(message, className) {
    statusElement.textContent = message;
    statusElement.className = "status " + className;
    statusElement.style.display = "block";
  }
  
  // Toggle video
  toggleVideoBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoEnabled = !videoEnabled;
      videoTrack.enabled = videoEnabled;
      toggleVideoBtn.textContent = `📹 Video ${videoEnabled ? 'On' : 'Off'}`;
    }
  });
  
  // Toggle audio
  toggleAudioBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioEnabled = !audioEnabled;
      audioTrack.enabled = audioEnabled;
      toggleAudioBtn.textContent = `🎤 ${audioEnabled ? 'Audio On' : 'Muted'}`;
    }
  });
  
  // Copy call ID
  copyCallIdBtn.addEventListener('click', () => {
    const callId = callInput.value;
    
    if (callId) {
      navigator.clipboard.writeText(callId).then(() => {
        copyCallIdBtn.textContent = '✓ Copied';
        setTimeout(() => {
          copyCallIdBtn.textContent = '📋 Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy call ID:', err);
      });
    }
  });
  
  // Start call button
  startCallBtn.addEventListener('click', () => {
    // Store the call mode and ID
    sessionStorage.setItem('callMode', 'create');
    sessionStorage.setItem('createCallId', callDoc.id);
    sessionStorage.setItem('videoEnabled', videoEnabled);
    sessionStorage.setItem('audioEnabled', audioEnabled);
    
    // Store track states in session storage
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];
      
      if (videoTrack) videoTrack.stop();
      if (audioTrack) audioTrack.stop();
    }
    
    // Navigate to call page
    window.location.href = 'call.html';
  });
  
  // Back button
  backBtn.addEventListener('click', () => {
    // Stop tracks before navigating away
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    window.location.href = 'index.html';
  });
  
  // Initialize the page on load
  window.onload = init;