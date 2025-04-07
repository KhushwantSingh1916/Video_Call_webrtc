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
    
    // Setup WebRTC peer connection
    setupPeerConnection();
    
    // Setup call based on mode
    if (callMode === 'create') {
      await createCall();
    } else if (callMode === 'join') {
      await joinCall();
    }
    
    // Setup the call timer
    startCallTimer();
    
    // Setup button event listeners
    setupEventListeners();
  }
  
  // Setup remote video stream
  function setupRemoteStream() {
    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;
  }
  
  // Start local video/audio stream
  async function startLocalStream() {
    try {
      updateStatus("Setting up camera and microphone...", "connecting");
      
      // Get video/audio state from session storage
      const videoEnabled = sessionStorage.getItem('videoEnabled') !== 'false';
      const audioEnabled = sessionStorage.getItem('audioEnabled') !== 'false';
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: true 
      });
      
      // Apply stored track states
      if (stream.getVideoTracks().length > 0) {
        stream.getVideoTracks()[0].enabled = videoEnabled;
      }
      
      if (stream.getAudioTracks().length > 0) {
        stream.getAudioTracks()[0].enabled = audioEnabled;
      }
      
      // Update button states
      updateMediaButtonStates(stream);
      
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
  
  // Setup WebRTC peer connection
  function setupPeerConnection() {
    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
    
    // Handle incoming tracks from remote peer
    pc.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    };
    
    // Handle ice candidates
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      
      if (callMode === 'create') {
        offerCandidates.add(event.candidate.toJSON());
      } else if (callMode === 'join') {
        answerCandidates.add(event.candidate.toJSON());
      }
    };
    
    // Connection state change
    pc.onconnectionstatechange = () => {
      console.log(`Connection state: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        updateStatus("Connected to remote peer", "connected");
        clearTimeout(connectionTimeout);
        setTimeout(() => { statusElement.style.display = "none"; }, 2000);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        updateStatus("Connection lost. Trying to reconnect...", "connecting");
      } else if (pc.connectionState === 'closed') {
        endCall();
      }
    };
  }
  
  // Create a new call (caller)
  async function createCall() {
    callDoc = db.collection('calls').doc(callId);
    offerCandidates = callDoc.collection('offerCandidates');
    answerCandidates = callDoc.collection('answerCandidates');
    
    // Set call timeout
    connectionTimeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        updateStatus("No one has joined yet. Waiting for someone to join...", "connecting");
      }
    }, 10000);
    
    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await callDoc.set({ offer });
    
    // Listen for remote answer
    callDoc.onSnapshot(snapshot => {
      const data = snapshot.data();
      
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
        updateStatus("Remote peer connected", "connected");
      }
    });
    
    // Listen for remote ICE candidates
    answerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
    
    updateStatus("Waiting for someone to join...", "connecting");
  }
  
  // Join an existing call (callee)
  async function joinCall() {
    callDoc = db.collection('calls').doc(callId);
    offerCandidates = callDoc.collection('offerCandidates');
    answerCandidates = callDoc.collection('answerCandidates');
    
    // Set connection timeout
    connectionTimeout = setTimeout(() => {
      if (pc.connectionState !== 'connected') {
        updateStatus("Failed to connect. The call may no longer be active.", "failed");
      }
    }, 15000);
    
    // Get the call data
    const callData = (await callDoc.get()).data();
    
    if (!callData) {
      updateStatus("Call not found. Check the ID and try again.", "failed");
      return;
    }
    
    // Set remote description (offer)
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    
    // Create answer
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    
    const answer = {
      sdp: answerDescription.sdp,
      type: answerDescription.type,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await callDoc.update({ answer });
    
    // Listen for ICE candidates
    offerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
    
    updateStatus("Connecting to call...", "connecting");
  }
  
  // Start call timer
  function startCallTimer() {
    callTimerInterval = setInterval(() => {
      callDuration++;
      updateCallTimer();
    }, 1000);
  }
  
  // Update call timer display
  function updateCallTimer() {
    const hours = Math.floor(callDuration / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((callDuration % 3600) / 60).toString().padStart(2, '0');
    const seconds = (callDuration % 60).toString().padStart(2, '0');
    callTimer.textContent = `${hours}:${minutes}:${seconds}`;
  }
  
  // Setup button event listeners
  function setupEventListeners() {
    // Toggle video
    toggleVideoBtn.addEventListener('click', () => {
      if (!localStream) return;
      
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.innerHTML = videoTrack.enabled ? '📹' : '📹&#10060;';
      }
    });
    
    // Toggle audio
    toggleAudioBtn.addEventListener('click', () => {
      if (!localStream) return;
      
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioBtn.innerHTML = audioTrack.enabled ? '🎤' : '🎤&#10060;';
      }
    });
    
    // Share screen
    shareScreenBtn.addEventListener('click', async () => {
      try {
        if (isScreenSharing) {
          // Stop screen sharing
          if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.stop();
            }
          }
          
          // Get camera stream again
          await startLocalStream();
          
          // Replace track in peer connection
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            const senders = pc.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          }
          
          shareScreenBtn.innerHTML = '🖥️';
          isScreenSharing = false;
        } else {
          // Start screen sharing
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
          });
          
          // Replace video track
          const screenTrack = screenStream.getVideoTracks()[0];
          
          if (screenTrack) {
            // Replace track in peer connection
            const senders = pc.getSenders();
            const sender = senders.find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
            
            // Replace track in local stream
            if (localStream) {
              const videoTrack = localStream.getVideoTracks()[0];
              if (videoTrack) {
                videoTrack.stop();
              }
              
              localStream.removeTrack(videoTrack);
              localStream.addTrack(screenTrack);
            }
            
            // Update local video
            localVideo.srcObject = localStream;
            
            // Handle screen sharing stopped by user
            screenTrack.onended = async () => {
              await startLocalStream();
              const newVideoTrack = localStream.getVideoTracks()[0];
              if (newVideoTrack) {
                const senders = pc.getSenders();
                const sender = senders.find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  sender.replaceTrack(newVideoTrack);
                }
              }
              shareScreenBtn.innerHTML = '🖥️';
              isScreenSharing = false;
            };
            
            shareScreenBtn.innerHTML = '🖥️&#10060;';
            isScreenSharing = true;
          }
        }
      } catch (error) {
        console.error("Error with screen sharing:", error);
        updateStatus("Failed to share screen", "failed");
        setTimeout(() => { statusElement.style.display = "none"; }, 2000);
      }
    });
    
    // Record call
    recordBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
        recordBtn.innerHTML = '⏺️';
      } else {
        startRecording();
        recordBtn.innerHTML = '⏹️';
      }
    });
    
    // Hangup call
    hangupBtn.addEventListener('click', () => {
      endCall();
    });
    
    // Copy call ID
    copyCallIdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(callId).then(() => {
        copyCallIdBtn.textContent = '✓';
        setTimeout(() => {
          copyCallIdBtn.textContent = 'Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy call ID:', err);
      });
    });
  }
  
  // Start recording
  function startRecording() {
    try {
      recordedChunks = [];
      
      // Create a new stream that includes both local and remote tracks
      const tracks = [...remoteStream.getTracks(), ...localStream.getTracks()];
      const combinedStream = new MediaStream(tracks);
      
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Create a blob and download the recording
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `call-recording-${new Date().toISOString()}.webm`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };
      
      mediaRecorder.start();
      isRecording = true;
      
      updateStatus("Recording started", "connected");
      setTimeout(() => { statusElement.style.display = "none"; }, 2000);
    } catch (error) {
      console.error("Error starting recording:", error);
      updateStatus("Failed to start recording", "failed");
      setTimeout(() => { statusElement.style.display = "none"; }, 2000);
    }
  }
  
  // Stop recording
  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      
      updateStatus("Recording saved", "connected");
      setTimeout(() => { statusElement.style.display = "none"; }, 2000);
    }
  }
  
  // End call and cleanup
  function endCall() {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Stop call timer
    clearInterval(callTimerInterval);
    
    // Close peer connection
    if (pc) {
      pc.close();
    }
    
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Cleanup Firestore resources (optional)
    if (callDoc) {
      // Delete the call document when call ends
      callDoc.delete().catch(console.error);
    }
    
    // Navigate back to home
    window.location.href = 'index.html';
  }
  
  // Helper function to update status with styling
  function updateStatus(message, className) {
    statusElement.textContent = message;
    statusElement.className = "status " + className;
    statusElement.style.display = "block";
  }
  
  // Update media control button states
  function updateMediaButtonStates(stream) {
    if (!stream) return;
    
    // Update video button
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      toggleVideoBtn.innerHTML = videoTrack.enabled ? '📹' : '📹&#10060;';
    }
    
    // Update audio button
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      toggleAudioBtn.innerHTML = audioTrack.enabled ? '🎤' : '🎤&#10060;';
    }
  }
  
  // Handle page unload/navigation
  window.addEventListener('beforeunload', () => {
    endCall();
  });
  
  // Initialize the call page on load
  window.onload = init;