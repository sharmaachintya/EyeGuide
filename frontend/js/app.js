/**
 * EyeGuide — Main Application
 * 
 * Orchestrates all modules (Audio, Camera, WebSocket, UI) to create
 * the complete real-time accessibility companion experience.
 */

class EyeGuideApp {
    constructor() {
        // Module instances
        this.audio = new AudioManager();
        this.camera = new CameraManager();
        this.ws = new WebSocketManager();
        this.ui = new UIManager();
        
        // State
        this.isRunning = false;
        this.serverUrl = this._getServerUrl();
        
        // Current transcript accumulator (for streaming text)
        this.currentAgentText = '';
    }
    
    /**
     * Initialize the application.
     */
    async init() {
        console.log('🚀 EyeGuide App initializing...');
        
        // Initialize UI
        this.ui.init();
        
        // Initialize camera with DOM elements
        this.camera.init(
            document.getElementById('cameraPreview'),
            document.getElementById('cameraCanvas')
        );
        
        // Wire up callbacks
        this._setupCallbacks();
        
        // Check device capabilities
        await this._checkCapabilities();
        
        console.log('✅ EyeGuide App ready');
        console.log(`   Server URL: ${this.serverUrl}`);
    }
    
    /**
     * Determine the WebSocket server URL.
     */
    _getServerUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:8080';
        return `${protocol}//${host}`;
    }
    
    /**
     * Set up all inter-module callbacks.
     */
    _setupCallbacks() {
        // ─── UI Callbacks ───────────────────────────────────────────────
        
        this.ui.onStartStop = () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        };
        
        this.ui.onModeChange = (mode) => {
            // Send mode change as text command to agent
            if (this.ws.isConnected) {
                this.ws.sendText(`Switch to ${mode} mode`);
            }
        };
        
        this.ui.onTextSubmit = (text) => {
            if (this.ws.isConnected) {
                this.ws.sendText(text);
            }
        };
        
        this.ui.onSettingsChange = (settings) => {
            // Apply camera toggle
            if (!settings.cameraEnabled && this.camera.isStreaming) {
                this.camera.stopStream();
            } else if (settings.cameraEnabled && this.isRunning && !this.camera.isStreaming) {
                this.camera.startStream();
            }
        };
        
        // ─── WebSocket Callbacks ────────────────────────────────────────
        
        this.ws.onConnected = () => {
            this.ui.setConnectionStatus('connected');
            this.ui.addTranscriptMessage('Connected to EyeGuide server', 'system');
        };
        
        this.ws.onDisconnected = (reason) => {
            this.ui.setConnectionStatus('disconnected');
            if (this.isRunning) {
                this.ui.addTranscriptMessage('Connection lost. Attempting to reconnect...', 'system');
            }
        };
        
        this.ws.onAudioResponse = (audioData) => {
            // Play agent's audio response
            this.audio.playAudio(audioData);
            this.ui.setAudioActive(true);
        };
        
        this.ws.onTranscript = (text) => {
            // Accumulate streaming text
            this.currentAgentText += text;
            // Display in transcript
            this.ui.addTranscriptMessage(text, 'agent');
        };
        
        this.ws.onTurnComplete = () => {
            // Agent finished speaking
            this.ui.setAudioActive(false);
            this.currentAgentText = '';
        };
        
        this.ws.onInterrupted = () => {
            // Barge-in detected — stop playback immediately
            this.audio.stopPlayback();
            this.ui.setAudioActive(false);
            this.ui.addTranscriptMessage('(interrupted)', 'system');
            this.currentAgentText = '';
        };
        
        this.ws.onSessionInfo = (info) => {
            console.log('Session info:', info);
        };
        
        this.ws.onToolCall = (toolName) => {
            console.log(`🔧 Tool called: ${toolName}`);
        };
        
        this.ws.onError = (message) => {
            this.ui.showNotification(`Error: ${message}`, 'error');
        };
        
        // ─── Audio Callbacks ────────────────────────────────────────────
        
        this.audio.onAudioData = (pcmData) => {
            // Send microphone audio to server
            this.ws.sendAudio(pcmData);
        };
        
        this.audio.onLevelChange = (level) => {
            // Update audio visualization
            this.ui.updateAudioLevel(level);
        };
        
        // ─── Camera Callbacks ───────────────────────────────────────────
        
        this.camera.onFrameCapture = (base64Data) => {
            // Send video frame to server
            this.ws.sendVideoFrame(base64Data);
        };
    }
    
    /**
     * Check device capabilities (camera, microphone).
     */
    async _checkCapabilities() {
        const hasMic = await AudioManager.isMicrophoneAvailable();
        const hasCam = await CameraManager.isCameraAvailable();
        
        if (!hasMic) {
            this.ui.showNotification('⚠️ No microphone detected. You can still use text input.', 'warning');
        }
        if (!hasCam) {
            this.ui.showNotification('⚠️ No camera detected. Audio-only mode will be used.', 'warning');
        }
        
        console.log(`   Microphone: ${hasMic ? '✅' : '❌'}`);
        console.log(`   Camera: ${hasCam ? '✅' : '❌'}`);
    }
    
    /**
     * Start an EyeGuide session — connect WebSocket, start audio & camera.
     */
    async start() {
        if (this.isRunning) return;
        
        console.log('▶️ Starting EyeGuide session...');
        this.ui.setConnectionStatus('connecting');
        
        try {
            // 1. Connect to WebSocket server
            this.ws.connect(this.serverUrl);
            
            // 2. Start audio capture
            try {
                await this.audio.startCapture();
                this.ui.setAudioActive(true);
            } catch (err) {
                console.warn('Audio capture failed:', err);
                this.ui.showNotification('Microphone unavailable — using text input only', 'warning');
            }
            
            // 3. Start camera (if enabled in settings)
            const settings = this.ui.getSettings();
            if (settings.cameraEnabled) {
                try {
                    await this.camera.startStream();
                } catch (err) {
                    console.warn('Camera start failed:', err);
                    this.ui.showNotification('Camera unavailable — audio-only mode', 'warning');
                }
            }
            
            // Update state
            this.isRunning = true;
            this.ui.setSessionActive(true);
            
            console.log('✅ EyeGuide session started');
            
        } catch (error) {
            console.error('Failed to start session:', error);
            this.ui.showNotification('Failed to start session: ' + error.message, 'error');
            this.stop();
        }
    }
    
    /**
     * Stop the EyeGuide session — disconnect everything.
     */
    stop() {
        console.log('⏹️ Stopping EyeGuide session...');
        
        // Stop audio
        this.audio.stopCapture();
        this.audio.stopPlayback();
        this.ui.setAudioActive(false);
        
        // Stop camera
        this.camera.stopStream();
        
        // Disconnect WebSocket
        this.ws.disconnect();
        
        // Update state
        this.isRunning = false;
        this.ui.setSessionActive(false);
        this.ui.setConnectionStatus('disconnected');
        
        this.ui.addTranscriptMessage('Session ended', 'system');
        console.log('⏹️ EyeGuide session stopped');
    }
}

// ─── Initialize App on Page Load ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const app = new EyeGuideApp();
    await app.init();
    
    // Expose to global scope for debugging
    window.eyeguideApp = app;
});
