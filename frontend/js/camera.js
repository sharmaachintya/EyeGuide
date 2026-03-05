/**
 * EyeGuide — Camera Module
 * 
 * Handles camera capture, frame extraction, and streaming video frames
 * to the backend for Gemini Live API vision processing.
 */

class CameraManager {
    constructor() {
        // Camera settings
        this.width = 640;
        this.height = 480;
        this.frameRate = 1;         // 1 FPS for Live API (saves bandwidth)
        this.quality = 0.7;         // JPEG quality
        this.facingMode = 'environment';  // Rear camera by default (for seeing the world)
        
        // State
        this.isStreaming = false;
        this.mediaStream = null;
        this.frameInterval = null;
        
        // DOM elements
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasContext = null;
        
        // Callbacks
        this.onFrameCapture = null; // Called with base64 JPEG frame data
    }
    
    /**
     * Initialize camera manager with DOM elements.
     * @param {HTMLVideoElement} videoEl - The video preview element
     * @param {HTMLCanvasElement} canvasEl - Hidden canvas for frame capture
     */
    init(videoEl, canvasEl) {
        this.videoElement = videoEl;
        this.canvasElement = canvasEl;
        this.canvasContext = canvasEl.getContext('2d');
        
        // Set canvas size
        this.canvasElement.width = this.width;
        this.canvasElement.height = this.height;
    }
    
    /**
     * Start the camera stream and begin capturing frames.
     */
    async startStream() {
        if (this.isStreaming) return;
        
        try {
            // Request camera access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: this.width },
                    height: { ideal: this.height },
                    frameRate: { ideal: 30 },  // Smooth preview
                },
                audio: false,  // Audio handled by AudioManager
            });
            
            // Attach stream to video element for preview
            if (this.videoElement) {
                this.videoElement.srcObject = this.mediaStream;
                await this.videoElement.play();
            }
            
            // Start frame capture interval
            this.frameInterval = setInterval(() => {
                this._captureFrame();
            }, 1000 / this.frameRate);
            
            this.isStreaming = true;
            console.log(`📷 Camera started (${this.width}x${this.height}, ${this.frameRate} FPS, ${this.facingMode})`);
            
        } catch (error) {
            console.error('Failed to start camera:', error);
            throw error;
        }
    }
    
    /**
     * Stop the camera stream.
     */
    stopStream() {
        this.isStreaming = false;
        
        // Stop frame capture
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
        
        // Stop media tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // Clear video element
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        console.log('📷 Camera stopped');
    }
    
    /**
     * Switch between front and rear cameras.
     */
    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        
        if (this.isStreaming) {
            this.stopStream();
            await this.startStream();
        }
        
        console.log(`📷 Camera switched to: ${this.facingMode}`);
    }
    
    /**
     * Capture a single frame from the video stream.
     * Converts to JPEG and sends via callback.
     */
    _captureFrame() {
        if (!this.isStreaming || !this.videoElement || !this.canvasContext) return;
        
        try {
            // Draw current video frame to canvas
            this.canvasContext.drawImage(
                this.videoElement, 
                0, 0, 
                this.width, this.height
            );
            
            // Convert to base64 JPEG
            const dataUrl = this.canvasElement.toDataURL('image/jpeg', this.quality);
            
            // Extract base64 data (remove data:image/jpeg;base64, prefix)
            const base64Data = dataUrl.split(',')[1];
            
            // Send via callback
            if (this.onFrameCapture && base64Data) {
                this.onFrameCapture(base64Data);
            }
            
        } catch (error) {
            console.error('Frame capture error:', error);
        }
    }
    
    /**
     * Set the frame capture rate.
     * @param {number} fps - Frames per second (1-5 recommended)
     */
    setFrameRate(fps) {
        this.frameRate = Math.max(0.5, Math.min(5, fps));
        
        // Restart interval if streaming
        if (this.isStreaming && this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = setInterval(() => {
                this._captureFrame();
            }, 1000 / this.frameRate);
        }
        
        console.log(`📷 Frame rate set to ${this.frameRate} FPS`);
    }
    
    /**
     * Check if camera is available.
     * @returns {Promise<boolean>}
     */
    static async isCameraAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'videoinput');
        } catch {
            return false;
        }
    }
    
    /**
     * Get list of available cameras.
     * @returns {Promise<Array>} List of video input devices
     */
    static async getCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'videoinput');
        } catch {
            return [];
        }
    }
}

// Export for use by other modules
window.CameraManager = CameraManager;
