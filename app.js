/* ==========================================================================
   KUNG-FU CAT DOJO ARENA - CORE ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startOverlay = document.getElementById('start-overlay');
    const btnEnter = document.getElementById('btn-enter');
    const appContainer = document.getElementById('app-container');
    const canvas = document.getElementById('arena-canvas');
    const canvasCtx = canvas.getContext('2d');
    const trainingTarget = document.getElementById('training-target');
    const catSprite = document.getElementById('kungfu-cat');
    const catImg = document.getElementById('cat-img');
    
    // UI Panel Elements
    const comboVal = document.getElementById('stat-combo');
    const maxComboVal = document.getElementById('stat-max-combo');
    const damageVal = document.getElementById('stat-damage');
    const speedVal = document.getElementById('stat-speed');
    const frenzyPctVal = document.getElementById('frenzy-pct');
    const frenzyFill = document.getElementById('frenzy-fill');
    const selectStyle = document.getElementById('select-style');
    const volumeSlider = document.getElementById('volume-slider');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const comboToast = document.getElementById('combo-toast');
    
    // Background Eraser Workshop Modal Elements
    const eraserModal = document.getElementById('eraser-modal');
    const eraserCanvas = document.getElementById('eraser-canvas');
    const eraserCtx = eraserCanvas.getContext('2d');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const sliderTolerance = document.getElementById('slider-tolerance');
    const valTolerance = document.getElementById('val-tolerance');
    const checkManualEraser = document.getElementById('check-manual-eraser');
    const manualControls = document.getElementById('manual-controls');
    const sliderBrushSize = document.getElementById('slider-brush-size');
    const valBrushSize = document.getElementById('val-brush-size');
    const btnResetEraser = document.getElementById('btn-reset-eraser');
    const btnSaveEraser = document.getElementById('btn-save-eraser');
    
    // Eraser Workshop State Variables
    let originalImageElement = null;
    let targetBgColor = { r: 255, g: 255, b: 255 };
    let isDrawingEraser = false;
    let lastBrushPos = { x: 0, y: 0 };
    let maskCanvas = null;
    let maskCtx = null;
    
    // Buttons selectors
    const avatarBtns = document.querySelectorAll('.avatar-btn');
    const targetBtns = document.querySelectorAll('.target-btn');

    // Canvas sizing
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        canvasCtx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Game Engine State
    const mouse = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        active: false,
        clicked: false,
        lastX: window.innerWidth / 2,
        lastY: window.innerHeight / 2,
        speed: 0
    };

    const cat = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2 + 100,
        vx: 0,
        vy: 0,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        width: 160,
        height: 160,
        
        // Physics variables
        spring: 0.05,
        damping: 0.82,
        
        // Combat states
        state: 'idle', // idle, dashing, attacking, recoil
        lastAttackTime: 0,
        attackInterval: 140, // ms between consecutive hits
        lungeOffset: 0,
        lungeAngle: 0,
        isLeftPunch: true,
        ghosts: [] // Motion blur positions
    };

    const particles = [];
    
    const game = {
        started: false,
        combo: 0,
        maxCombo: 0,
        damage: 0,
        hitsWindow: [], // Timestamps to measure Hits/Sec
        frenzy: false,
        frenzyProgress: 0,
        frenzyTimer: null,
        combatStyle: 'rapid', // rapid, kick, fireball, electro
        targetType: 'yarn', // yarn, mouse, dummy
        activeHero: 'default', // default, fire, shadow, electro
        totalClicks: 0
    };

    // Sound Synthesizer State (Web Audio API)
    let audioCtx = null;
    let masterGain = null;
    let isMuted = false;
    let baseVolume = 0.5;

    // Preloaded Hero Configuration
    const HERO_CONFIGS = {
        default: {
            theme: 'theme-default',
            spring: 0.05,
            damping: 0.82,
            attackInterval: 140,
            bandanaColor: '#ff3344',
            auraColor: '#f59e0b',
            auraGlow: 'rgba(245,158,11,0.4)'
        },
        fire: {
            theme: 'theme-fire',
            spring: 0.07,
            damping: 0.78,
            attackInterval: 180, // Heavy hits
            bandanaColor: '#ffb300',
            auraColor: '#ff3344',
            auraGlow: 'rgba(255,51,68,0.5)'
        },
        shadow: {
            theme: 'theme-shadow',
            spring: 0.09,
            damping: 0.86,
            attackInterval: 100, // Speed assassin
            bandanaColor: '#00f0ff',
            auraColor: '#8b5cf6',
            auraGlow: 'rgba(139,92,246,0.5)'
        },
        electro: {
            theme: 'theme-electro',
            spring: 0.06,
            damping: 0.80,
            attackInterval: 120, // Electric bursts
            bandanaColor: '#8b5cf6',
            auraColor: '#00f0ff',
            auraGlow: 'rgba(0,240,255,0.5)'
        }
    };

    // ==========================================================================
    // PROCEDURAL SOUND SYNTHESIZER (WEB AUDIO API)
    // ==========================================================================
    function initAudio() {
        if (audioCtx) return;
        
        try {
            // Support legacy browsers
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
            
            // Create master controls
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(isMuted ? 0 : baseVolume, audioCtx.currentTime);
            masterGain.connect(audioCtx.destination);
            
            console.log("Web Audio API Synthesizer successfully initialized!");
            playWelcomeChime();
        } catch (e) {
            console.error("Web Audio API not supported in this browser:", e);
        }
    }

    // Play a lovely high-tech welcoming chime
    function playWelcomeChime() {
        if (!audioCtx || isMuted) return;
        const now = audioCtx.currentTime;
        
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C major pentatonic
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            
            gainNode.gain.setValueAtTime(0, now + idx * 0.08);
            gainNode.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.6);
            
            osc.connect(gainNode);
            gainNode.connect(masterGain);
            
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.65);
        });
    }

    // Procedural Whoosh Sound (Swinging paws)
    function playWhooshSound(duration = 0.15, pitchStart = 200, pitchEnd = 1200) {
        if (!audioCtx || isMuted) return;
        
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitchStart, now);
        osc.frequency.exponentialRampToValueAtTime(pitchEnd, now + duration * 0.8);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1600, now + duration * 0.8);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + duration);
    }

    // Procedural Impact Hit (Melee strikes)
    function playHitSound() {
        if (!audioCtx || isMuted) return;
        
        const now = audioCtx.currentTime;
        
        // 1. Synthesized Drum Core (Deeps)
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'triangle';
        // Pitch envelope drops quickly
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
        
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        
        osc.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc.start(now);
        osc.stop(now + 0.11);
        
        // 2. Slap Transient (White Noise Puff)
        const bufferSize = audioCtx.sampleRate * 0.04; // 40ms buffer
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        
        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noiseNode.start(now);
        noiseNode.stop(now + 0.05);
    }

    // Procedural FM Cute Meow Sound
    function playMeowSound() {
        if (!audioCtx || isMuted) return;
        
        const now = audioCtx.currentTime;
        
        // FM Synthesis setup: Carrier modulated by Modulator
        const carrier = audioCtx.createOscillator();
        const modulator = audioCtx.createOscillator();
        const modGain = audioCtx.createGain();
        const gainNode = audioCtx.createGain();
        
        carrier.type = 'triangle';
        // Meow rising pitch curve: e.g., 400Hz -> 650Hz -> 500Hz
        carrier.frequency.setValueAtTime(380, now);
        carrier.frequency.exponentialRampToValueAtTime(680, now + 0.15);
        carrier.frequency.exponentialRampToValueAtTime(520, now + 0.3);
        
        modulator.type = 'sine';
        modulator.frequency.value = 250; // Pitch of the modifier
        modGain.gain.value = 120; // FM depth index
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(gainNode);
        gainNode.connect(masterGain);
        
        carrier.start(now);
        modulator.start(now);
        carrier.stop(now + 0.38);
        modulator.stop(now + 0.38);
    }

    // Procedural Frenzy Mode Charging Sound (Ascending Synth Sweep)
    function playFrenzyChargeSound() {
        if (!audioCtx || isMuted) return;
        
        const now = audioCtx.currentTime;
        const duration = 0.8;
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.exponentialRampToValueAtTime(700, now + duration);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(240, now);
        osc2.frequency.exponentialRampToValueAtTime(1400, now + duration);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + duration);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration + 0.05);
        osc2.stop(now + duration + 0.05);
    }

    // ==========================================================================
    // CANVA PARTICLES & SPECIAL VISUAL FX SYSTEM
    // ==========================================================================
    class VisualEffect {
        constructor(config) {
            this.type = config.type || 'spark'; // spark, slash, smoke, leaf, popup
            this.x = config.x;
            this.y = config.y;
            this.vx = config.vx || (Math.random() * 8 - 4);
            this.vy = config.vy || (Math.random() * 8 - 4);
            this.life = config.life || 1;
            this.maxLife = config.maxLife || 30; // frames
            this.alpha = 1;
            this.size = config.size || Math.random() * 4 + 2;
            this.color = config.color || '#fff';
            this.angle = config.angle || 0;
            this.spin = config.spin || 0;
            this.text = config.text || '';
            this.fontSize = config.fontSize || 14;
            this.rainbow = config.rainbow || false;
            this.emoji = config.emoji || null;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.type === 'leaf' ? 0.05 : 0; // leaves drift down
            this.angle += this.spin;
            this.life--;
            this.alpha = Math.max(0, this.life / this.maxLife);
        }

        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            
            let drawColor = this.color;
            if (this.rainbow) {
                const hue = (Date.now() / 4 + this.x) % 360;
                drawColor = `hsla(${hue}, 100%, 60%, ${this.alpha})`;
            }

            if (this.type === 'slash') {
                // Slashes are glowing custom paths
                ctx.strokeStyle = drawColor;
                ctx.lineWidth = this.size;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 10;
                ctx.shadowColor = drawColor;
                
                ctx.beginPath();
                ctx.moveTo(this.x - this.vx * 3, this.y - this.vy * 3);
                ctx.lineTo(this.x + this.vx * 3, this.y + this.vy * 3);
                ctx.stroke();
            } else if (this.type === 'popup') {
                // Floating text Popups
                ctx.font = `900 ${this.fontSize}px Outfit, sans-serif`;
                ctx.fillStyle = drawColor;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 4;
                ctx.textAlign = 'center';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                
                ctx.strokeText(this.text, this.x, this.y);
                ctx.fillText(this.text, this.x, this.y);
            } else if (this.emoji) {
                // Render custom emoji elements
                ctx.font = `${this.size * 2}px sans-serif`;
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.emoji, 0, 0);
            } else {
                // Standard round glowing sparks
                ctx.fillStyle = drawColor;
                ctx.shadowBlur = this.size * 2;
                ctx.shadowColor = drawColor;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    // Spawn visual explosion effects
    function spawnHitParticles(x, y, style, isHeavy = false) {
        const config = HERO_CONFIGS[game.activeHero];
        const primaryColor = config.auraColor;
        const speedMultiplier = isHeavy ? 1.6 : 1.0;
        
        // 1. Spawns standard radial sparks
        const sparkCount = isHeavy ? 20 : 8;
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = (Math.random() * 5 + 3) * speedMultiplier;
            particles.push(new VisualEffect({
                type: 'spark',
                x: x,
                y: y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                size: Math.random() * 3 + 1.5,
                color: game.frenzy ? 'multicolor' : primaryColor,
                rainbow: game.frenzy,
                maxLife: Math.random() * 20 + 15,
                life: Math.random() * 20 + 15
            }));
        }

        // 2. Spawns martial arts slashes
        const slashCount = isHeavy ? 3 : 1;
        for (let i = 0; i < slashCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const length = Math.random() * 15 + 10;
            particles.push(new VisualEffect({
                type: 'slash',
                x: x + (Math.random() * 20 - 10),
                y: y + (Math.random() * 20 - 10),
                vx: Math.cos(angle) * length,
                vy: Math.sin(angle) * length,
                size: Math.random() * 4 + 2,
                color: game.frenzy ? 'multicolor' : primaryColor,
                rainbow: game.frenzy,
                maxLife: 10,
                life: 10
            }));
        }

        // 3. Spawns drifting bamboo leaves (nature aura) or custom flames
        const leafProbability = 0.3;
        if (Math.random() < leafProbability || isHeavy) {
            const emoji = game.activeHero === 'fire' ? '🔥' : 
                          game.activeHero === 'electro' ? '⚡' :
                          game.activeHero === 'shadow' ? '💀' : '🍃';
            particles.push(new VisualEffect({
                type: 'leaf',
                x: x,
                y: y,
                vx: Math.random() * 4 - 2,
                vy: Math.random() * -3 - 2,
                size: Math.random() * 8 + 6,
                angle: Math.random() * Math.PI,
                spin: Math.random() * 0.1 - 0.05,
                maxLife: 40,
                life: 40,
                emoji: emoji
            }));
        }

        // 4. Floating popup damage indicators
        if (Math.random() < 0.4 || isHeavy) {
            const comboMultiplier = Math.floor(game.combo / 10) + 1;
            const dmgBase = isHeavy ? 999 * comboMultiplier : Math.floor(Math.random() * 120 + 60);
            
            // Text choice
            let labelText = `+${dmgBase}`;
            if (isHeavy) {
                const slaps = ["⚡ CRITICAL!", "🔥 FATAL BLAST!", "🌀 DRAGON FIST!", "⚡ 5X DAMAGE!", "🐾 NEKO SLAP!"];
                labelText = slaps[Math.floor(Math.random() * slaps.length)];
            } else if (game.combo > 0 && game.combo % 15 === 0) {
                const messages = ["KUNG FU!", "MEOW POWER!", "NYAN STRIKE!", "PURR-FECT!", "PAWSTRIKE!"];
                labelText = messages[Math.floor(Math.random() * messages.length)];
            }

            particles.push(new VisualEffect({
                type: 'popup',
                x: x,
                y: y - 20,
                vx: Math.random() * 3 - 1.5,
                vy: Math.random() * -3 - 3,
                color: isHeavy ? '#f87171' : (game.frenzy ? 'multicolor' : (game.activeHero === 'shadow' ? '#c084fc' : '#ffedd5')),
                rainbow: game.frenzy && !isHeavy,
                text: labelText,
                fontSize: isHeavy ? Math.random() * 6 + 18 : Math.random() * 4 + 13,
                maxLife: 35,
                life: 35
            }));
        }
    }

    // Draw the ghost trails during swift dash/combo movements
    function renderGhostTrails() {
        if (cat.ghosts.length === 0) return;
        
        for (let i = 0; i < cat.ghosts.length; i++) {
            const ghost = cat.ghosts[i];
            const alpha = (i + 1) / (cat.ghosts.length + 1) * 0.18; // Fades older ones
            
            canvasCtx.save();
            canvasCtx.globalAlpha = alpha;
            canvasCtx.translate(ghost.x, ghost.y);
            canvasCtx.scale(ghost.scaleX, ghost.scaleY);
            canvasCtx.rotate(ghost.angle);
            
            // Draw a subtle translucent circle silhouette of the cat
            const config = HERO_CONFIGS[game.activeHero];
            canvasCtx.fillStyle = config.auraColor;
            canvasCtx.shadowBlur = 15;
            canvasCtx.shadowColor = config.auraColor;
            canvasCtx.beginPath();
            canvasCtx.arc(0, 0, 50, 0, Math.PI * 2);
            canvasCtx.fill();
            
            canvasCtx.restore();
        }
    }

    // ==========================================================================
    // DOJO GAMEPLAY LOOP & GAME STATES
    // ==========================================================================
    function updateStats() {
        // Combo
        comboVal.textContent = game.combo;
        if (game.combo > game.maxCombo) {
            game.maxCombo = game.combo;
            maxComboVal.textContent = game.maxCombo;
            maxComboVal.classList.add('num-glow');
            setTimeout(() => maxComboVal.classList.remove('num-glow'), 400);
        }

        // Damage Value
        damageVal.textContent = game.damage.toLocaleString();

        // Calculate hits per second (window of last 1000ms)
        const now = Date.now();
        game.hitsWindow = game.hitsWindow.filter(t => now - t < 1000);
        const hps = game.hitsWindow.length;
        speedVal.textContent = hps.toFixed(1);

        // Frenzy Energy Bar
        frenzyPctVal.textContent = `${Math.floor(game.frenzyProgress)}%`;
        frenzyFill.style.width = `${game.frenzyProgress}%`;
        
        if (game.frenzyProgress >= 100 && !game.frenzy) {
            triggerFrenzyMode();
        }
    }

    // Enter Frenzy ultra-attacking state
    function triggerFrenzyMode() {
        game.frenzy = true;
        game.frenzyProgress = 100;
        appContainer.classList.add('frenzy-active');
        playFrenzyChargeSound();
        
        // Popup Toast Notice
        comboToast.classList.add('toast-show');
        
        // Play epic audio meow
        setTimeout(playMeowSound, 150);
        
        // Shake screen violently
        appContainer.classList.add('heavy-shake');
        setTimeout(() => appContainer.classList.remove('heavy-shake'), 600);

        // Trigger auto-timer to decay Frenzy Mode (last 8 seconds)
        game.frenzyTimer = setTimeout(() => {
            exitFrenzyMode();
        }, 8000);
    }

    function exitFrenzyMode() {
        game.frenzy = false;
        game.frenzyProgress = 0;
        appContainer.classList.remove('frenzy-active');
        comboToast.classList.remove('toast-show');
    }

    function addComboHit(amount = 1, isClick = false) {
        if (!game.started) return;
        
        const mult = game.frenzy ? 2 : 1;
        game.combo += amount;
        game.hitsWindow.push(Date.now());
        
        const baseDmg = isClick ? 850 : 120;
        game.damage += baseDmg * mult;
        
        // Add Frenzy Energy
        const energyGain = isClick ? 8 : 0.8;
        if (!game.frenzy) {
            game.frenzyProgress = Math.min(100, game.frenzyProgress + energyGain);
        }
        
        updateStats();
    }

    // Handles Cat melee single hit actions
    function performSingleAttack(isHeavy = false) {
        const now = Date.now();
        const interval = game.frenzy ? 40 : HERO_CONFIGS[game.activeHero].attackInterval;
        
        if (now - cat.lastAttackTime < interval) return;
        
        cat.lastAttackTime = now;
        
        // Create Lunge Animation Offset (Leaping forward)
        const angle = Math.atan2(mouse.y - cat.y, mouse.x - cat.x);
        cat.lungeAngle = angle;
        cat.lungeOffset = game.frenzy ? 45 : 30; // Physical offset in pixels
        cat.state = 'attacking';
        
        // Alternating Paw indicators popping up
        cat.isLeftPunch = !cat.isLeftPunch;
        const leftPaw = document.querySelector('.paw-indicator.left');
        const rightPaw = document.querySelector('.paw-indicator.right');
        
        if (cat.isLeftPunch) {
            leftPaw.classList.remove('strike-left');
            void leftPaw.offsetWidth; // Trigger reflow
            leftPaw.classList.add('strike-left');
        } else {
            rightPaw.classList.remove('strike-right');
            void rightPaw.offsetWidth; // Trigger reflow
            rightPaw.classList.add('strike-right');
        }

        // Trigger Target physical bounce React Class
        trainingTarget.classList.remove('target-hit', 'target-hit-alt');
        void trainingTarget.offsetWidth; // Trigger reflow
        trainingTarget.classList.add(cat.isLeftPunch ? 'target-hit' : 'target-hit-alt');
        setTimeout(() => trainingTarget.classList.remove('target-hit', 'target-hit-alt'), 150);

        // Sound triggers
        playWhooshSound(0.12, 180, game.frenzy ? 1400 : 900);
        playHitSound();
        
        // Shake Dojo Environment slightly
        appContainer.classList.remove('light-shake');
        void appContainer.offsetWidth; // trigger reflow
        appContainer.classList.add('light-shake');
        setTimeout(() => appContainer.classList.remove('light-shake'), 120);

        // Score counts
        addComboHit(1, isHeavy);

        // Particle bursts
        spawnHitParticles(mouse.x, mouse.y, game.combatStyle, isHeavy);

        // Random cute meows!
        const meowChance = game.frenzy ? 0.05 : 0.02;
        if (Math.random() < meowChance) {
            playMeowSound();
        }
    }

    // ==========================================================================
    // PHYSICS ENGINE & CORE RENDERING LOOP
    // ==========================================================================
    function mainLoop() {
        // Clear Background Arena canvas
        canvasCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // 1. Calculate Mouse Position velocity/speed
        const dxMouse = mouse.x - mouse.lastX;
        const dyMouse = mouse.y - mouse.lastY;
        mouse.speed = Math.hypot(dxMouse, dyMouse);
        mouse.lastX = mouse.x;
        mouse.lastY = mouse.y;

        // 2. Target physical movement tracker (Smooth lagging pointer lock)
        const targetX = mouse.active ? mouse.x : window.innerWidth / 2;
        const targetY = mouse.active ? mouse.y : window.innerHeight / 2;
        
        let targetCurrentX = parseFloat(trainingTarget.style.left) || 0;
        let targetCurrentY = parseFloat(trainingTarget.style.top) || 0;
        
        if (targetCurrentX === 0 && targetCurrentY === 0) {
            targetCurrentX = targetX;
            targetCurrentY = targetY;
        }

        // Fast ease target to cursor position
        targetCurrentX += (targetX - targetCurrentX) * 0.45;
        targetCurrentY += (targetY - targetCurrentY) * 0.45;
        
        trainingTarget.style.left = `${targetCurrentX}px`;
        trainingTarget.style.top = `${targetCurrentY}px`;

        if (game.started) {
            // 3. Cat Tracking Physics Engine (Spring-Damper system)
            const heroConfig = HERO_CONFIGS[game.activeHero];
            const currentSpring = game.frenzy ? 0.09 : heroConfig.spring;
            const currentDamping = game.frenzy ? 0.85 : heroConfig.damping;
            
            // The destination of tracking
            let chaseX = targetCurrentX;
            let chaseY = targetCurrentY;

            // Attack offsets logic
            if (cat.lungeOffset > 1) {
                // Cat is in strike thrust frame! Push it forward
                chaseX += Math.cos(cat.lungeAngle) * cat.lungeOffset;
                chaseY += Math.sin(cat.lungeAngle) * cat.lungeOffset;
                // Slowly absorb recoil thrust back
                cat.lungeOffset *= 0.65;
            }

            const dx = chaseX - cat.x;
            const dy = chaseY - cat.y;
            const distance = Math.hypot(dx, dy);

            // Calculate active movement acceleration
            const ax = dx * currentSpring;
            const ay = dy * currentSpring;
            
            cat.vx = (cat.vx + ax) * currentDamping;
            cat.vy = (cat.vy + ay) * currentDamping;
            
            cat.x += cat.vx;
            cat.y += cat.vy;

            // Dynamic rotation towards the pointer
            cat.angle = Math.atan2(dy, dx) * 0.12; // Eased tilt orientation

            // Flip horizontally according to cursor boundary
            if (dx > 4) {
                cat.scaleX = 1;
            } else if (dx < -4) {
                cat.scaleX = -1;
            }

            // Squash and Stretch dynamic shape morphing (Velocity physics)
            const currentVelocity = Math.hypot(cat.vx, cat.vy);
            cat.scaleY = 1 - Math.min(0.18, currentVelocity * 0.004);
            cat.scaleX = (cat.scaleX > 0 ? 1 : -1) * (1 + Math.min(0.18, currentVelocity * 0.003));

            // Move the absolute styled DOM cat container
            catSprite.style.left = `${cat.x}px`;
            catSprite.style.top = `${cat.y}px`;
            catSprite.style.transform = `scale(${cat.scaleX}, ${cat.scaleY}) rotate(${cat.angle}rad)`;

            // Push trail positions for ghosting visuals during swift attacks
            if (currentVelocity > 10 || game.frenzy) {
                cat.ghosts.push({
                    x: cat.x,
                    y: cat.y,
                    scaleX: cat.scaleX,
                    scaleY: cat.scaleY,
                    angle: cat.angle
                });
                if (cat.ghosts.length > 5) cat.ghosts.shift();
            } else if (cat.ghosts.length > 0) {
                cat.ghosts.shift(); // decay trails slowly
            }

            // 4. Combat triggers
            if (mouse.active) {
                // If cat is close enough to target, trigger attacks!
                if (distance < 155 || game.frenzy) {
                    performSingleAttack(mouse.clicked);
                }
            } else {
                // Slowly decay combo if mouse leaves playground
                if (game.combo > 0 && Math.random() < 0.015) {
                    game.combo = Math.max(0, game.combo - 1);
                    updateStats();
                }
            }
        } else {
            // Hover floating movement on landing screen
            const floatOffset = Math.sin(Date.now() / 400) * 12;
            catSprite.style.left = `${window.innerWidth / 2}px`;
            catSprite.style.top = `${window.innerHeight / 2 + 100 + floatOffset}px`;
            catSprite.style.transform = 'scale(1) rotate(0deg)';
        }

        // 5. Draw ghost trails & active particles inside offscreen buffer
        renderGhostTrails();

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw(canvasCtx);
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Loop animation loop
        requestAnimationFrame(mainLoop);
    }

    // ==========================================================================
    // MOUSE EVENT HANDLERS
    // ==========================================================================
    function trackMousePosition(e) {
        if (!game.started) return;
        
        // Prevent event on side panels from triggering cat movement
        if (e.target.closest('#dojo-panel')) {
            mouse.active = false;
            return;
        }

        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    }

    window.addEventListener('mousemove', trackMousePosition);
    
    window.addEventListener('mousedown', (e) => {
        if (!game.started) return;
        if (e.target.closest('#dojo-panel')) return;
        
        mouse.clicked = true;
        // Heavy strike triggers on click
        performSingleAttack(true);
    });
    
    window.addEventListener('mouseup', () => {
        mouse.clicked = false;
    });

    // Touch screen compatible
    window.addEventListener('touchmove', (e) => {
        if (!game.started || e.touches.length === 0) return;
        if (e.target.closest('#dojo-panel')) {
            mouse.active = false;
            return;
        }
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        mouse.active = true;
    }, { passive: true });
    
    window.addEventListener('touchstart', (e) => {
        if (!game.started || e.touches.length === 0) return;
        if (e.target.closest('#dojo-panel')) return;
        const touch = e.touches[0];
        
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        mouse.active = true;
        mouse.clicked = true;
        performSingleAttack(true);
    }, { passive: true });
    
    window.addEventListener('touchend', () => {
        mouse.clicked = false;
    });

    appContainer.addEventListener('mouseleave', () => {
        mouse.active = false;
    });

    appContainer.addEventListener('mouseenter', () => {
        if (game.started) mouse.active = true;
    });

    // ==========================================================================
    // UI MENU INTERACTION & HANDLERS
    // ==========================================================================
    
    // Welcome Overlay "ENTER DOJO" Button
    btnEnter.addEventListener('click', () => {
        initAudio();
        
        // Fade landing screen overlay
        startOverlay.classList.add('hidden');
        
        // Activate Dojo play status
        setTimeout(() => {
            game.started = true;
            mouse.active = true;
            // Play initial cat meow sound
            playMeowSound();
        }, 600);
    });

    // Change Hero Selector
    avatarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            avatarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const hero = btn.getAttribute('data-hero');
            setDojoHero(hero);
        });
    });

    function setDojoHero(heroName) {
        if (game.activeHero === heroName) return;
        
        // Remove previous theme classes
        const prevConfig = HERO_CONFIGS[game.activeHero];
        catSprite.classList.remove(prevConfig.theme);
        
        // Update state
        game.activeHero = heroName;
        const config = HERO_CONFIGS[heroName];
        catSprite.classList.add(config.theme);
        
        // Apply active CSS style aura
        document.documentElement.style.setProperty('--aura-color', config.auraColor);
        document.documentElement.style.setProperty('--aura-glow', config.auraGlow);
        
        // Play responsive customized selection meow sound
        if (audioCtx) {
            if (heroName === 'fire') {
                playWhooshSound(0.3, 100, 400); // Deep roar sound
            } else if (heroName === 'shadow') {
                playWhooshSound(0.2, 500, 1500); // Fast blade slice
            } else if (heroName === 'electro') {
                playWhooshSound(0.25, 300, 2000); // Sharp spark sound
            } else {
                playMeowSound();
            }
        }
        
        // Spawn transformation smoke/sparks
        spawnHitParticles(cat.x, cat.y, 'rapid', true);
    }

    // Change Combat Styles Selection
    selectStyle.addEventListener('change', (e) => {
        game.combatStyle = e.target.value;
        // Trigger a simple whoosh indicator
        playWhooshSound(0.18, 200, 1000);
    });

    // Change Training Targets Selector
    targetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            targetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetType = btn.getAttribute('data-target');
            game.targetType = targetType;
            
            // Update emoji inside Target
            const inner = trainingTarget.querySelector('.target-inner');
            if (targetType === 'yarn') {
                inner.textContent = '🧶';
            } else if (targetType === 'mouse') {
                inner.textContent = '🐭';
            } else if (targetType === 'dummy') {
                inner.textContent = '🪵';
            }
            
            // Pop item hit sounds
            playHitSound();
        });
    });

    // Audio volume adjuster slider
    volumeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        baseVolume = value / 100;
        
        if (masterGain) {
            masterGain.gain.setValueAtTime(isMuted ? 0 : baseVolume, audioCtx.currentTime);
        }
        
        // Update label volume percentage text next to slider if exist (we can query sibling node)
        btnSoundToggle.textContent = value === 0 ? '🔇' : (value < 40 ? '🔉' : '🔊');
    });

    // Toggle mute icon clicks
    btnSoundToggle.addEventListener('click', () => {
        isMuted = !isMuted;
        btnSoundToggle.textContent = isMuted ? '🔇' : (baseVolume < 0.4 ? '🔉' : '🔊');
        
        if (masterGain) {
            masterGain.gain.setValueAtTime(isMuted ? 0 : baseVolume, audioCtx.currentTime);
        }
        
        // Play short sound to confirm unmute
        if (!isMuted) {
            playHitSound();
        }
    });

    // ==========================================================================
    // CUSTOM FILE PHOTO DRAG & DROP LOADER
    // ==========================================================================
    
    // Clicks upload box
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Read custom files
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processUploadedFile(e.target.files[0]);
        }
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            processUploadedFile(e.dataTransfer.files[0]);
        }
    });

    // Process file and frame it nicely
    function processUploadedFile(file) {
        if (!file.type.startsWith('image/')) {
            alert("請上傳圖片檔案哦！Please upload an image file!");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imgDataUrl = e.target.result;
            
            // Set up a new Image object for pixel sampling and canvas sizing
            originalImageElement = new Image();
            originalImageElement.src = imgDataUrl;
            
            originalImageElement.onload = () => {
                // Calculate responsive, optimal canvas dimensions (max bounding box 450px)
                const maxDim = 450;
                let w = originalImageElement.width;
                let h = originalImageElement.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = (h / w) * maxDim;
                        w = maxDim;
                    } else {
                        w = (w / h) * maxDim;
                        h = maxDim;
                    }
                }
                
                eraserCanvas.width = w;
                eraserCanvas.height = h;
                
                // Initialize manual overlay eraser mask canvas
                maskCanvas = document.createElement('canvas');
                maskCanvas.width = w;
                maskCanvas.height = h;
                maskCtx = maskCanvas.getContext('2d');
                maskCtx.clearRect(0, 0, w, h);
                
                // Sample default background color from top-left pixel (0,0)
                eraserCtx.drawImage(originalImageElement, 0, 0, w, h);
                const firstPixel = eraserCtx.getImageData(0, 0, 1, 1).data;
                targetBgColor = {
                    r: firstPixel[0],
                    g: firstPixel[1],
                    b: firstPixel[2]
                };
                
                // Reset workshop control states
                sliderTolerance.value = 35;
                valTolerance.textContent = 35;
                checkManualEraser.checked = false;
                manualControls.classList.add('hidden-control');
                
                // Open the Workshop Modal with transition scale
                eraserModal.classList.remove('modal-hidden');
                
                // Render initial auto-background-removed preview
                renderEraserPreview();
            };
        };
        
        reader.readAsDataURL(file);
    }

    // Real-time canvas preview renderer (fuses color key mask and drawing eraser strokes)
    function renderEraserPreview() {
        if (!originalImageElement) return;
        const w = eraserCanvas.width;
        const h = eraserCanvas.height;
        
        // 1. Create a clean offscreen canvas to process original pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImageElement, 0, 0, w, h);
        
        const imgData = tempCtx.getImageData(0, 0, w, h);
        const pixels = imgData.data;
        const tol = parseInt(sliderTolerance.value);
        
        // 2. Erase colors similar to targetBgColor
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i+1];
            const b = pixels[i+2];
            const a = pixels[i+3];
            
            if (a > 0) {
                const dist = Math.sqrt(
                    (r - targetBgColor.r) ** 2 +
                    (g - targetBgColor.g) ** 2 +
                    (b - targetBgColor.b) ** 2
                );
                if (dist < tol) {
                    pixels[i+3] = 0; // Set transparency alpha to 0!
                }
            }
        }
        tempCtx.putImageData(imgData, 0, 0);
        
        // 3. Render color-removed image to visible canvas
        eraserCtx.clearRect(0, 0, w, h);
        eraserCtx.drawImage(tempCanvas, 0, 0);
        
        // 4. Clip manual brush strokes with destination-out
        eraserCtx.save();
        eraserCtx.globalCompositeOperation = 'destination-out';
        eraserCtx.drawImage(maskCanvas, 0, 0);
        eraserCtx.restore();
    }

    // Helper to calculate mouse coordinates inside canvas relative scale
    function getCanvasMousePos(e) {
        const rect = eraserCanvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (eraserCanvas.width / rect.width),
            y: (e.clientY - rect.top) * (eraserCanvas.height / rect.height)
        };
    }

    // Draw manual eraser stroke on offscreen mask canvas
    function drawEraserStroke(pos) {
        if (!maskCtx) return;
        maskCtx.save();
        maskCtx.strokeStyle = 'rgba(0, 0, 0, 1.0)';
        maskCtx.fillStyle = 'rgba(0, 0, 0, 1.0)';
        maskCtx.lineWidth = parseInt(sliderBrushSize.value);
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        
        maskCtx.beginPath();
        maskCtx.moveTo(lastBrushPos.x, lastBrushPos.y);
        maskCtx.lineTo(pos.x, pos.y);
        maskCtx.stroke();
        maskCtx.closePath();
        
        lastBrushPos = { x: pos.x, y: pos.y };
        maskCtx.restore();
        
        renderEraserPreview();
    }

    // ==========================================================================
    // ERASER WORKSHOP WORKFLOW BINDINGS
    // ==========================================================================
    
    // Canvas interaction events
    eraserCanvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasMousePos(e);
        
        if (checkManualEraser.checked) {
            // Manual Eraser Brush
            isDrawingEraser = true;
            lastBrushPos = pos;
            
            maskCtx.save();
            maskCtx.fillStyle = '#000';
            maskCtx.beginPath();
            maskCtx.arc(pos.x, pos.y, parseInt(sliderBrushSize.value) / 2, 0, Math.PI * 2);
            maskCtx.fill();
            maskCtx.restore();
            
            renderEraserPreview();
        } else {
            // Magic Wand Color Sampler (Pick clicked background color)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = eraserCanvas.width;
            tempCanvas.height = eraserCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(originalImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
            
            const pxX = Math.max(0, Math.min(eraserCanvas.width - 1, Math.floor(pos.x)));
            const pxY = Math.max(0, Math.min(eraserCanvas.height - 1, Math.floor(pos.y)));
            const px = tempCtx.getImageData(pxX, pxY, 1, 1).data;
            
            targetBgColor = {
                r: px[0],
                g: px[1],
                b: px[2]
            };
            
            renderEraserPreview();
        }
    });

    eraserCanvas.addEventListener('mousemove', (e) => {
        if (isDrawingEraser && checkManualEraser.checked) {
            const pos = getCanvasMousePos(e);
            drawEraserStroke(pos);
        }
    });

    window.addEventListener('mouseup', () => {
        isDrawingEraser = false;
    });

    // Mobile touch interaction for background eraser workshop
    eraserCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 0) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const simulatedEvent = { clientX: touch.clientX, clientY: touch.clientY };
        const pos = getCanvasMousePos(simulatedEvent);
        
        if (checkManualEraser.checked) {
            isDrawingEraser = true;
            lastBrushPos = pos;
            
            maskCtx.save();
            maskCtx.fillStyle = '#000';
            maskCtx.beginPath();
            maskCtx.arc(pos.x, pos.y, parseInt(sliderBrushSize.value) / 2, 0, Math.PI * 2);
            maskCtx.fill();
            maskCtx.restore();
            
            renderEraserPreview();
        } else {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = eraserCanvas.width;
            tempCanvas.height = eraserCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(originalImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
            
            const pxX = Math.max(0, Math.min(eraserCanvas.width - 1, Math.floor(pos.x)));
            const pxY = Math.max(0, Math.min(eraserCanvas.height - 1, Math.floor(pos.y)));
            const px = tempCtx.getImageData(pxX, pxY, 1, 1).data;
            
            targetBgColor = {
                r: px[0],
                g: px[1],
                b: px[2]
            };
            
            renderEraserPreview();
        }
    });

    eraserCanvas.addEventListener('touchmove', (e) => {
        if (isDrawingEraser && checkManualEraser.checked && e.touches.length > 0) {
            e.preventDefault();
            const touch = e.touches[0];
            const pos = getCanvasMousePos({ clientX: touch.clientX, clientY: touch.clientY });
            drawEraserStroke(pos);
        }
    });

    window.addEventListener('touchend', () => {
        isDrawingEraser = false;
    });

    // Control inputs binding
    sliderTolerance.addEventListener('input', (e) => {
        valTolerance.textContent = e.target.value;
        renderEraserPreview();
    });

    sliderBrushSize.addEventListener('input', (e) => {
        valBrushSize.textContent = e.target.value;
    });

    checkManualEraser.addEventListener('change', (e) => {
        if (e.target.checked) {
            manualControls.classList.remove('hidden-control');
        } else {
            manualControls.classList.add('hidden-control');
        }
    });

    // Close Modal triggers
    btnCloseModal.addEventListener('click', () => {
        eraserModal.classList.add('modal-hidden');
    });

    eraserModal.addEventListener('click', (e) => {
        if (e.target === eraserModal) {
            eraserModal.classList.add('modal-hidden');
        }
    });

    // Reset Workshop drawing canvas
    btnResetEraser.addEventListener('click', () => {
        if (!originalImageElement) return;
        
        maskCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
        sliderTolerance.value = 35;
        valTolerance.textContent = 35;
        
        // Re-sample top-left corner
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = eraserCanvas.width;
        tempCanvas.height = eraserCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImageElement, 0, 0, tempCanvas.width, tempCanvas.height);
        const px = tempCtx.getImageData(0, 0, 1, 1).data;
        
        targetBgColor = {
            r: px[0],
            g: px[1],
            b: px[2]
        };
        
        renderEraserPreview();
    });

    // Save perfectly masked PNG image back to dojo cat
    btnSaveEraser.addEventListener('click', () => {
        if (!originalImageElement) return;
        
        // Export current transparent canvas as dataURL!
        const cleanPngDataUrl = eraserCanvas.toDataURL('image/png');
        
        // Apply to Dojo
        catImg.src = cleanPngDataUrl;
        catImg.classList.add('custom-kitty-masked');
        
        // Close modal
        eraserModal.classList.add('modal-hidden');
        
        // Satifying meow chime and smoke sparkles
        setTimeout(playMeowSound, 200);
        spawnHitParticles(cat.x, cat.y, 'rapid', true);
        
        // Reset active hero buttons
        avatarBtns.forEach(b => b.classList.remove('active'));
    });

    // ==========================================================================
    // INITIATE ENGINE ANIMATION LOOP
    // ==========================================================================
    mainLoop();
});
