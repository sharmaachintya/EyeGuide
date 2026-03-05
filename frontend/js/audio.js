/**
 * EyeGuide — Audio Module
 * 
 * Handles microphone capture (PCM 16-bit, 16kHz, mono) and audio playback
 * (PCM 16-bit, 24kHz, mono) for real-time communication with the Gemini Live API.
 */

class AudioManager {
    constructor() {
        // Audio capture settings (must match Gemini Live API requirements)
        this.inputSampleRate = 16000;   // 16kHz for input
        this.outputSampleRate = 24000;  // 24kHz for output
        this.channelCount = 1;          // Mono
        this.bufferSize = 4096;
        
        // State
        this.isCapturing = false;
        this.audioContext = null;
        this.mediaStream = null;
        this.workletNode = null;
        this.sourceNode = null;
        
        // Playback
        this.playbackQueue = [];
        this.isPlaying = false;
        this.playbackContext = null;
        
        // Callbacks
        this.onAudioData = null;    // Called with PCM audio data chunks
        this.onLevelChange = null;  // Called with audio level (0-1)
    }
    
    /**
     * Start capturing audio from the microphone.
     */
    async startCapture() {
        if (this.isCapturing) return;
        
        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.inputSampleRate,
                    channelCount: this.channelCount,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });
            
            // Create audio context
            this.audioContext = new AudioContext({
                sampleRate: this.inputSampleRate,
            });
            
            // Create source from microphone
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Use ScriptProcessor for PCM capture (widely supported)
            // Note: AudioWorklet would be preferred for production
            this.processorNode = this.audioContext.createScriptProcessor(
                this.bufferSize, 1, 1
            );
            
            this.processorNode.onaudioprocess = (event) => {
                if (!this.isCapturing) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                
                // Calculate audio level for visualization
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const level = Math.sqrt(sum / inputData.length);
                if (this.onLevelChange) {
                    this.onLevelChange(level);
                }
                
                // Convert Float32 to Int16 PCM
                const pcmData = this._float32ToInt16(inputData);
                
                // Send to callback
                if (this.onAudioData) {
                    this.onAudioData(pcmData.buffer);
                }
            };
            
            // Connect: microphone → processor → destination (required for processing)
            this.sourceNode.connect(this.processorNode);
            this.processorNode.connect(this.audioContext.destination);
            
            this.isCapturing = true;
            console.log('🎤 Audio capture started (16kHz, 16-bit, mono)');
            
        } catch (error) {
            console.error('Failed to start audio capture:', error);
            throw error;
        }
    }
    
    /**
     * Stop capturing audio.
     */
    stopCapture() {
        this.isCapturing = false;
        
        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }
        
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('🎤 Audio capture stopped');
    }
    
    /**
     * Play received audio data (PCM 16-bit, 24kHz).
     * Queues audio chunks for gapless playback.
     * @param {ArrayBuffer} pcmData - Raw PCM audio data
     */
    async playAudio(pcmData) {
        // Add to queue
        this.playbackQueue.push(pcmData);
        
        // Start playing if not already
        if (!this.isPlaying) {
            this._processPlaybackQueue();
        }
    }
    
    /**
     * Stop audio playback immediately (for barge-in support).
     */
    stopPlayback() {
        this.playbackQueue = [];
        this.isPlaying = false;
        
        if (this.playbackContext) {
            this.playbackContext.close();
            this.playbackContext = null;
        }
        
        console.log('🔇 Audio playback stopped (barge-in)');
    }
    
    /**
     * Process the playback queue - plays chunks sequentially.
     */
    async _processPlaybackQueue() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        // Create playback context if needed
        if (!this.playbackContext || this.playbackContext.state === 'closed') {
            this.playbackContext = new AudioContext({
                sampleRate: this.outputSampleRate,
            });
        }
        
        while (this.playbackQueue.length > 0) {
            const pcmData = this.playbackQueue.shift();
            
            try {
                // Convert Int16 PCM to Float32
                const float32Data = this._int16ToFloat32(new Int16Array(pcmData));
                
                // Create audio buffer
                const audioBuffer = this.playbackContext.createBuffer(
                    1, float32Data.length, this.outputSampleRate
                );
                audioBuffer.getChannelData(0).set(float32Data);
                
                // Play the buffer
                const source = this.playbackContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.playbackContext.destination);
                
                // Wait for playback to complete
                await new Promise((resolve) => {
                    source.onended = resolve;
                    source.start();
                });
                
            } catch (error) {
                console.error('Playback error:', error);
            }
        }
        
        this.isPlaying = false;
    }
    
    /**
     * Convert Float32Array to Int16Array (PCM encoding).
     * @param {Float32Array} float32 - Input audio data
     * @returns {Int16Array} PCM encoded data
     */
    _float32ToInt16(float32) {
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16;
    }
    
    /**
     * Convert Int16Array to Float32Array (PCM decoding).
     * @param {Int16Array} int16 - PCM encoded data
     * @returns {Float32Array} Decoded audio data
     */
    _int16ToFloat32(int16) {
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
        }
        return float32;
    }
    
    /**
     * Check if microphone is available.
     * @returns {Promise<boolean>}
     */
    static async isMicrophoneAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'audioinput');
        } catch {
            return false;
        }
    }
}

// Export for use by other modules
window.AudioManager = AudioManager;
