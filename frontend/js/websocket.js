/**
 * EyeGuide — WebSocket Module
 * 
 * Manages the WebSocket connection to the backend server for real-time
 * bidirectional communication (audio/video streaming + agent responses).
 */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000; // ms
        this.reconnectTimer = null;
        
        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onAudioResponse = null;     // Binary audio data from agent
        this.onTranscript = null;        // Text transcript from agent
        this.onTurnComplete = null;      // Agent finished speaking
        this.onInterrupted = null;       // Agent was interrupted (barge-in)
        this.onSessionInfo = null;       // Session info from server
        this.onError = null;             // Error messages
        this.onToolCall = null;          // Agent used a tool
    }
    
    /**
     * Connect to the WebSocket server.
     * @param {string} serverUrl - Base URL of the server (e.g., 'ws://localhost:8080')
     * @param {string} sessionId - Optional session ID (uses 'new' if not provided)
     */
    connect(serverUrl, sessionId = 'new') {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.warn('WebSocket already connected');
            return;
        }
        
        this.sessionId = sessionId;
        
        // Construct WebSocket URL
        const wsUrl = `${serverUrl}/ws/${sessionId}`;
        console.log(`🔌 Connecting to: ${wsUrl}`);
        
        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer'; // For audio data
            
            this.ws.onopen = () => this._handleOpen();
            this.ws.onmessage = (event) => this._handleMessage(event);
            this.ws.onclose = (event) => this._handleClose(event);
            this.ws.onerror = (error) => this._handleError(error);
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            if (this.onError) this.onError('Connection failed: ' + error.message);
        }
    }
    
    /**
     * Disconnect from the WebSocket server.
     */
    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            // Send close control message
            this.sendJSON({ type: 'control', action: 'close' });
            this.ws.close(1000, 'User disconnected');
            this.ws = null;
        }
        
        this.isConnected = false;
    }
    
    /**
     * Send raw audio data (binary) to the server.
     * @param {ArrayBuffer} audioData - PCM audio data
     */
    sendAudio(audioData) {
        if (!this.isConnected || !this.ws) return;
        
        try {
            this.ws.send(audioData);
        } catch (error) {
            console.error('Failed to send audio:', error);
        }
    }
    
    /**
     * Send a video frame to the server.
     * @param {string} base64Data - Base64 encoded JPEG frame
     */
    sendVideoFrame(base64Data) {
        if (!this.isConnected || !this.ws) return;
        
        this.sendJSON({
            type: 'video_frame',
            data: base64Data,
        });
    }
    
    /**
     * Send a text message to the server (accessibility fallback).
     * @param {string} text - User's text message
     */
    sendText(text) {
        if (!this.isConnected || !this.ws) return;
        
        this.sendJSON({
            type: 'text_input',
            text: text,
        });
    }
    
    /**
     * Send a JSON message to the server.
     * @param {Object} data - JSON-serializable data
     */
    sendJSON(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        try {
            this.ws.send(JSON.stringify(data));
        } catch (error) {
            console.error('Failed to send JSON:', error);
        }
    }
    
    // ─── Internal Handlers ──────────────────────────────────────────────
    
    _handleOpen() {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.onConnected) this.onConnected();
    }
    
    _handleMessage(event) {
        // Binary message = audio response from agent
        if (event.data instanceof ArrayBuffer) {
            if (this.onAudioResponse) {
                this.onAudioResponse(event.data);
            }
            return;
        }
        
        // Text message = JSON
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'transcript':
                    if (this.onTranscript) this.onTranscript(data.text);
                    break;
                    
                case 'turn_complete':
                    if (this.onTurnComplete) this.onTurnComplete();
                    break;
                    
                case 'interrupted':
                    if (this.onInterrupted) this.onInterrupted();
                    break;
                    
                case 'session_info':
                    this.sessionId = data.session_id || this.sessionId;
                    if (this.onSessionInfo) this.onSessionInfo(data);
                    break;
                    
                case 'tool_call':
                    if (this.onToolCall) this.onToolCall(data.tool);
                    break;
                    
                case 'error':
                    console.error('Server error:', data.message);
                    if (this.onError) this.onError(data.message);
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type, data);
            }
            
        } catch (error) {
            console.warn('Failed to parse WebSocket message:', error);
        }
    }
    
    _handleClose(event) {
        console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
        this.isConnected = false;
        
        if (this.onDisconnected) this.onDisconnected(event.reason);
        
        // Attempt reconnection (unless intentionally closed)
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._attemptReconnect();
        }
    }
    
    _handleError(error) {
        console.error('WebSocket error:', error);
        if (this.onError) this.onError('WebSocket connection error');
    }
    
    _attemptReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            if (this.sessionId) {
                // Reconstruct the server URL from the current WebSocket
                const url = this.ws ? this.ws.url.replace(/\/ws\/.*$/, '') : '';
                if (url) {
                    this.connect(url, this.sessionId);
                }
            }
        }, delay);
    }
    
    /**
     * Get the current connection state.
     * @returns {string} 'connected', 'connecting', or 'disconnected'
     */
    getState() {
        if (!this.ws) return 'disconnected';
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'disconnected';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'disconnected';
        }
    }
}

// Export for use by other modules
window.WebSocketManager = WebSocketManager;
