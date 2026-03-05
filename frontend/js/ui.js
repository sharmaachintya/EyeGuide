/**
 * EyeGuide — UI Module
 * 
 * Handles all UI interactions: transcript display, connection status,
 * mode switching, settings panel, and accessibility features.
 */

class UIManager {
    constructor() {
        // DOM Elements
        this.elements = {};
        this.currentMode = 'navigation';
        this.isSessionActive = false;
        
        // Mode icons
        this.modeIcons = {
            navigation: '🧭',
            reading: '📖',
            exploration: '🔍',
            shopping: '🛒',
        };
        
        // Mode names (capitalized)
        this.modeNames = {
            navigation: 'Navigation',
            reading: 'Reading',
            exploration: 'Exploration',
            shopping: 'Shopping',
        };
        
        // Callbacks
        this.onStartStop = null;
        this.onModeChange = null;
        this.onTextSubmit = null;
        this.onSettingsChange = null;
    }
    
    /**
     * Initialize UI - cache DOM elements and set up event listeners.
     */
    init() {
        // Cache DOM elements
        this.elements = {
            // Status
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            
            // Camera
            cameraOverlay: document.getElementById('cameraOverlay'),
            modeBadge: document.getElementById('modeBadge'),
            modeIcon: document.getElementById('modeIcon'),
            modeName: document.getElementById('modeName'),
            audioIndicator: document.getElementById('audioIndicator'),
            
            // Transcript
            transcriptContainer: document.getElementById('transcriptContainer'),
            clearTranscriptBtn: document.getElementById('clearTranscriptBtn'),
            
            // Main button
            startStopBtn: document.getElementById('startStopBtn'),
            startStopIcon: document.getElementById('startStopIcon'),
            startStopText: document.getElementById('startStopText'),
            
            // Mode buttons
            modeButtons: document.querySelectorAll('.mode-btn'),
            
            // Text input
            textInputForm: document.getElementById('textInputForm'),
            textInput: document.getElementById('textInput'),
            
            // Settings
            settingsBtn: document.getElementById('settingsBtn'),
            settingsPanel: document.getElementById('settingsPanel'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            verbositySelect: document.getElementById('verbositySelect'),
            voiceSelect: document.getElementById('voiceSelect'),
            cameraToggle: document.getElementById('cameraToggle'),
            highContrastToggle: document.getElementById('highContrastToggle'),
        };
        
        this._setupEventListeners();
        console.log('🎨 UI initialized');
    }
    
    /**
     * Set up all event listeners.
     */
    _setupEventListeners() {
        // Start/Stop button
        this.elements.startStopBtn.addEventListener('click', () => {
            if (this.onStartStop) this.onStartStop();
        });
        
        // Mode buttons
        this.elements.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setMode(mode);
                if (this.onModeChange) this.onModeChange(mode);
            });
        });
        
        // Text input form
        this.elements.textInputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = this.elements.textInput.value.trim();
            if (text && this.onTextSubmit) {
                this.onTextSubmit(text);
                this.addTranscriptMessage(text, 'user');
                this.elements.textInput.value = '';
            }
        });
        
        // Clear transcript
        this.elements.clearTranscriptBtn.addEventListener('click', () => {
            this.clearTranscript();
        });
        
        // Settings panel
        this.elements.settingsBtn.addEventListener('click', () => {
            this.toggleSettings(true);
        });
        
        this.elements.closeSettingsBtn.addEventListener('click', () => {
            this.toggleSettings(false);
        });
        
        // High contrast toggle
        this.elements.highContrastToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('high-contrast', e.target.checked);
            localStorage.setItem('eyeguide_high_contrast', e.target.checked);
        });
        
        // Settings changes
        ['verbositySelect', 'voiceSelect', 'cameraToggle'].forEach(id => {
            const el = this.elements[id];
            if (el) {
                el.addEventListener('change', () => {
                    if (this.onSettingsChange) {
                        this.onSettingsChange(this.getSettings());
                    }
                });
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space to start/stop (when not typing)
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                if (this.onStartStop) this.onStartStop();
            }
            // Escape to close settings
            if (e.code === 'Escape') {
                this.toggleSettings(false);
            }
        });
        
        // Load saved preferences
        this._loadSavedPreferences();
    }
    
    /**
     * Load saved UI preferences from localStorage.
     */
    _loadSavedPreferences() {
        const highContrast = localStorage.getItem('eyeguide_high_contrast') === 'true';
        if (highContrast) {
            document.body.classList.add('high-contrast');
            this.elements.highContrastToggle.checked = true;
        }
    }
    
    // ─── Connection Status ──────────────────────────────────────────────
    
    /**
     * Update the connection status indicator.
     * @param {string} state - 'connected', 'connecting', or 'disconnected'
     */
    setConnectionStatus(state) {
        const { statusDot, statusText } = this.elements;
        
        statusDot.className = 'status-dot';
        
        switch (state) {
            case 'connected':
                statusDot.classList.add('connected');
                statusText.textContent = 'Connected';
                break;
            case 'connecting':
                statusDot.classList.add('connecting');
                statusText.textContent = 'Connecting...';
                break;
            default:
                statusText.textContent = 'Disconnected';
        }
    }
    
    // ─── Session State ──────────────────────────────────────────────────
    
    /**
     * Update UI to reflect session active/inactive state.
     * @param {boolean} active - Whether session is active
     */
    setSessionActive(active) {
        this.isSessionActive = active;
        const { startStopBtn, startStopIcon, startStopText, cameraOverlay } = this.elements;
        
        if (active) {
            startStopBtn.classList.add('active');
            startStopBtn.setAttribute('aria-pressed', 'true');
            startStopBtn.setAttribute('aria-label', 'Stop EyeGuide session');
            startStopIcon.textContent = '⏹️';
            startStopText.textContent = 'Stop EyeGuide';
            cameraOverlay.classList.add('hidden');
        } else {
            startStopBtn.classList.remove('active');
            startStopBtn.setAttribute('aria-pressed', 'false');
            startStopBtn.setAttribute('aria-label', 'Start EyeGuide session');
            startStopIcon.textContent = '🎙️';
            startStopText.textContent = 'Start EyeGuide';
            cameraOverlay.classList.remove('hidden');
        }
    }
    
    // ─── Mode Management ────────────────────────────────────────────────
    
    /**
     * Set the active operating mode.
     * @param {string} mode - Mode name
     */
    setMode(mode) {
        if (!this.modeIcons[mode]) return;
        
        this.currentMode = mode;
        
        // Update mode badge
        this.elements.modeIcon.textContent = this.modeIcons[mode];
        this.elements.modeName.textContent = this.modeNames[mode];
        
        // Update mode buttons
        this.elements.modeButtons.forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
        
        // Add system message to transcript
        this.addTranscriptMessage(
            `Mode changed to ${this.modeNames[mode]}`,
            'system'
        );
    }
    
    // ─── Audio Indicator ────────────────────────────────────────────────
    
    /**
     * Show/hide the audio activity indicator.
     * @param {boolean} active - Whether audio is active
     */
    setAudioActive(active) {
        this.elements.audioIndicator.classList.toggle('active', active);
    }
    
    /**
     * Update audio level visualization.
     * @param {number} level - Audio level (0-1)
     */
    updateAudioLevel(level) {
        const bars = this.elements.audioIndicator.querySelectorAll('.audio-bar');
        const normalizedLevel = Math.min(1, level * 10); // Amplify for visibility
        
        bars.forEach((bar, i) => {
            const barLevel = normalizedLevel * (1 - Math.abs(i - 2) * 0.2);
            bar.style.height = `${Math.max(4, barLevel * 24)}px`;
        });
    }
    
    // ─── Transcript ─────────────────────────────────────────────────────
    
    /**
     * Add a message to the transcript.
     * @param {string} text - Message text
     * @param {string} type - 'agent', 'user', or 'system'
     */
    addTranscriptMessage(text, type = 'agent') {
        const container = this.elements.transcriptContainer;
        
        // Remove welcome message if present
        const welcome = container.querySelector('.transcript-welcome');
        if (welcome) welcome.remove();
        
        // Create message element
        const msgEl = document.createElement('div');
        msgEl.className = `transcript-msg ${type}`;
        
        if (type !== 'system') {
            const label = document.createElement('span');
            label.className = 'msg-label';
            label.textContent = type === 'agent' ? '👁️ EyeGuide' : '👤 You';
            msgEl.appendChild(label);
        }
        
        const textEl = document.createElement('span');
        textEl.textContent = text;
        msgEl.appendChild(textEl);
        
        container.appendChild(msgEl);
        
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }
    
    /**
     * Clear all transcript messages.
     */
    clearTranscript() {
        const container = this.elements.transcriptContainer;
        container.innerHTML = `
            <div class="transcript-welcome">
                <p>🗑️ Transcript cleared</p>
            </div>
        `;
    }
    
    // ─── Settings ───────────────────────────────────────────────────────
    
    /**
     * Toggle the settings panel.
     * @param {boolean} open - Whether to open or close
     */
    toggleSettings(open) {
        const panel = this.elements.settingsPanel;
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', !open);
        
        if (open) {
            this.elements.closeSettingsBtn.focus();
        }
    }
    
    /**
     * Get current settings values.
     * @returns {Object} Current settings
     */
    getSettings() {
        return {
            verbosity: this.elements.verbositySelect.value,
            voice: this.elements.voiceSelect.value,
            cameraEnabled: this.elements.cameraToggle.checked,
            highContrast: this.elements.highContrastToggle.checked,
        };
    }
    
    /**
     * Show a temporary notification/toast message.
     * @param {string} message - Message to display
     * @param {string} type - 'info', 'success', 'warning', 'error'
     */
    showNotification(message, type = 'info') {
        this.addTranscriptMessage(message, 'system');
    }
}

// Export for use by other modules
window.UIManager = UIManager;
