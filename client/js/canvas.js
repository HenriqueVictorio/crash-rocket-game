// Canvas management and graphics rendering

class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;
        
        this.setupCanvas();
        this.setupResizeHandler();
        
        // Performance settings
        this.performanceSettings = this.detectPerformance();
    }
    
    setupCanvas() {
        this.resize();
        
        // Enable hardware acceleration
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    
    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 150);
        });
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        // Set actual canvas size in memory (scaled for high DPI)
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        
        // Scale the drawing context back down
        this.ctx.scale(this.dpr, this.dpr);
        
        // Set the CSS size to maintain responsive design
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
    }
    
    detectPerformance() {
        const isLowEnd = navigator.hardwareConcurrency < 4 || 
                        navigator.deviceMemory < 2 ||
                        window.innerWidth < 768;
        
        return {
            particleCount: isLowEnd ? 10 : 20,
            frameRate: isLowEnd ? 30 : 60,
            enableShadows: !isLowEnd,
            enableBlur: !isLowEnd
        };
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
    
    drawGrid() {
        const { ctx, width, height } = this;
        
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.globalAlpha = 0.3;
        
        // Horizontal lines (multipliers)
        for (let i = 1; i <= 10; i++) {
            const y = height - (i / 10) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            
            // Labels
            ctx.fillStyle = '#a0aec0';
            ctx.font = '12px Inter, sans-serif';
            ctx.globalAlpha = 0.6;
            ctx.fillText(`${i + 1}x`, 10, y - 5);
            ctx.globalAlpha = 0.3;
        }
        
        // Vertical lines (time)
        const timeIntervals = 6; // 6 intervals for 30 seconds
        for (let i = 1; i <= timeIntervals; i++) {
            const x = (i / timeIntervals) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            // Time labels
            ctx.fillStyle = '#a0aec0';
            ctx.globalAlpha = 0.6;
            ctx.fillText(`${i * 5}s`, x + 5, height - 5);
            ctx.globalAlpha = 0.3;
        }
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }
    
    drawBackground() {
        const { ctx, width, height } = this;
        
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(26, 32, 44, 0.8)');
        gradient.addColorStop(1, 'rgba(45, 55, 72, 0.8)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
}

class RocketCurve {
    constructor(canvasManager) {
        this.canvas = canvasManager;
        this.ctx = canvasManager.ctx;
        this.points = [];
        this.animationId = null;
        this.isAnimating = false;
    }
    
    reset() {
        this.points = [];
        this.stopAnimation();
    }
    
    addPoint(time, multiplier) {
        const { width, height } = this.canvas;

        // Mapeamento contínuo (suave) do eixo Y usando log para evitar saltos
        // 1x fica na base; ~10x aproxima do topo (ajuste effectiveRange conforme preferir)
        const effectiveRange = 10;
        const norm = Math.max(0, Math.min(1, Math.log(Math.max(multiplier, 1.0001)) / Math.log(effectiveRange)));

        // Posição (30 segundos = largura total)
        const x = Math.min((time / 30) * width, width);
        const y = height - norm * height;

        // Interpolação de pontos intermediários para suavidade entre amostras de servidor
        if (this.points.length > 0) {
            const last = this.points[this.points.length - 1];
            const dt = Math.max(0, time - last.time);
            const steps = Math.max(0, Math.min(10, Math.floor(dt / 0.05))); // amostra a cada 50ms
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                const xi = last.x + (x - last.x) * t;
                const yi = last.y + (y - last.y) * t;
                const mi = last.multiplier + (multiplier - last.multiplier) * t;
                const ti = last.time + dt * t;
                this.points.push({ x: xi, y: yi, multiplier: mi, time: ti });
            }
        }

        this.points.push({ x, y, multiplier, time });

        // Limitar histórico para performance
        if (this.points.length > 600) {
            this.points.splice(0, this.points.length - 600);
        }
    }
    
    draw() {
        if (this.points.length < 2) return;
        
        const { ctx } = this;
        
    // Draw main curve
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
        
        // Add glow effect on high-performance devices
        if (this.canvas.performanceSettings.enableShadows) {
            ctx.shadowColor = '#e53e3e';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        // Catmull-Rom -> Bezier para suavidade sem picos
        const pts = this.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i > 0 ? pts[i - 1] : pts[0];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        
        ctx.stroke();
        
        // Reset shadow
        if (this.canvas.performanceSettings.enableShadows) {
            ctx.shadowBlur = 0;
        }
        
        // Draw current point indicator
        this.drawCurrentPoint();
    }
    
    drawCurrentPoint() {
        if (this.points.length === 0) return;
        
        const lastPoint = this.points[this.points.length - 1];
        const { ctx } = this;
        
        // Pulsing dot at current position
        const time = Date.now() / 500;
        const pulse = Math.sin(time) * 0.3 + 0.7;
        
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 6 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 4 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#e53e3e';
        ctx.fill();
    }
    
    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.animate();
    }
    
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    animate() {
        if (!this.isAnimating) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    // Get curve trajectory for rocket sprite positioning
    getRocketPosition() {
        if (this.points.length === 0) return null;
        
        const lastPoint = this.points[this.points.length - 1];
        
        // Calculate angle based on last few points for smooth rotation
        let angle = 0;
        if (this.points.length > 1) {
            const prevPoint = this.points[this.points.length - 2];
            angle = Math.atan2(lastPoint.y - prevPoint.y, lastPoint.x - prevPoint.x);
        }
        
        return {
            x: lastPoint.x,
            y: lastPoint.y,
            angle: angle,
            multiplier: lastPoint.multiplier
        };
    }
}

class ExplosionParticles {
    constructor(canvasManager, x, y) {
        this.canvas = canvasManager;
        this.ctx = canvasManager.ctx;
        this.particles = [];
        this.isActive = false;
        
        this.createParticles(x, y);
    }
    
    createParticles(x, y) {
        const particleCount = this.canvas.performanceSettings.particleCount;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01,
                size: 2 + Math.random() * 4,
                color: this.getRandomColor()
            });
        }
        
        this.isActive = true;
    }
    
    getRandomColor() {
        const colors = ['#ff6b6b', '#ffa500', '#ffff00', '#ff4757', '#ff3742'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    update() {
        if (!this.isActive) return;
        
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2; // Gravity
            particle.vx *= 0.98; // Air resistance
            particle.life -= particle.decay;
        });
        
        // Remove dead particles
        this.particles = this.particles.filter(particle => particle.life > 0);
        
        if (this.particles.length === 0) {
            this.isActive = false;
        }
    }
    
    draw() {
        if (!this.isActive) return;
        
        const { ctx } = this;
        
        this.particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.life;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }
}

// Performance throttling function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export for use in other modules
window.CanvasManager = CanvasManager;
window.RocketCurve = RocketCurve;
window.ExplosionParticles = ExplosionParticles;
