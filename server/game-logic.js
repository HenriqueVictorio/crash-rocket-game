const EventEmitter = require('events');

// Game states
const GAME_STATES = {
    WAITING: 'waiting',
    STARTING: 'starting',
    FLYING: 'flying',
    CRASHED: 'crashed'
};

class GameEngine extends EventEmitter {
    constructor(io) {
        super();
        this.io = io;
        
        // Game state
        this.state = GAME_STATES.WAITING;
        this.multiplier = 1.00;
        this.startTime = null;
        this.gameId = 0;
        this.history = [];
        
        // Active players and bets
        this.activePlayers = new Map(); // playerId -> { bet, autoCashOut, hasWon }
        this.cashedOutPlayers = new Set();
        
        // Timers
        this.gameLoopInterval = null;
        this.stateTimeout = null;
        
        // Configuration
        this.config = {
            waitTime: { min: 3000, max: 7000 }, // 3-7 seconds
            countdownTime: 3000, // 3 seconds
            updateInterval: 16, // 16ms (60 FPS)
            maxGameTime: 45000, // 45 seconds max
            historySize: 20
        };
        // Growth configuration
        this.growth = {
            mode: 'exponential', // 'exponential' | 'polynomial'
            rate: 0.55,          // per-second growth rate for exponential (e.g., ~2x em ~1.26s)
            baseGrowth: 0.6,     // for polynomial fallback
            acceleration: 0.08   // for polynomial fallback
        };
        
        // Statistics
        this.stats = {
            totalGames: 0,
            totalBets: 0,
            totalPayouts: 0,
            averageMultiplier: 0,
            uptime: Date.now()
        };
    }
    
    start() {
        console.log('🎮 Game engine starting...');
        this.scheduleNextGame();
    }
    
    stop() {
        console.log('🛑 Game engine stopping...');
        this.clearTimers();
        this.state = GAME_STATES.WAITING;
    }
    
    scheduleNextGame() {
        const waitTime = this.getRandomWaitTime();
        console.log(`⏰ Next game in ${waitTime / 1000}s`);
        
        this.state = GAME_STATES.WAITING;
        this.emit('game_state_changed', {
            state: this.state,
            nextGameIn: waitTime / 1000
        });
        
        this.stateTimeout = setTimeout(() => {
            this.startCountdown();
        }, waitTime);
    }
    
    startCountdown() {
        console.log('🚦 Starting countdown...');
        
        this.state = GAME_STATES.STARTING;
        this.cashedOutPlayers.clear();
        
        this.emit('game_state_changed', {
            state: this.state,
            countdown: this.config.countdownTime / 1000
        });
        
        this.stateTimeout = setTimeout(() => {
            this.startGame();
        }, this.config.countdownTime);
    }
    
    startGame() {
        console.log(`🚀 Game ${++this.gameId} started with ${this.activePlayers.size} players`);
        
        this.state = GAME_STATES.FLYING;
        this.multiplier = 1.00;
        this.startTime = Date.now();
        
        this.emit('game_state_changed', {
            state: this.state,
            multiplier: this.multiplier,
            time: 0
        });
        
        this.startGameLoop();
    }
    
    startGameLoop() {
        this.gameLoopInterval = setInterval(() => {
            this.updateGame();
        }, this.config.updateInterval);
    }
    
    updateGame() {
        if (this.state !== GAME_STATES.FLYING) return;
        
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.multiplier = this.calculateMultiplier(elapsed);
        
        // Check for crash
        if (this.shouldCrash(this.multiplier, elapsed)) {
            this.crashGame();
            return;
        }
        
        // Check for max game time
        if (elapsed >= this.config.maxGameTime / 1000) {
            this.crashGame();
            return;
        }
        
        // Check auto cash outs
        this.checkAutoCashOuts();
        
        // Emit game state
        this.emit('game_state_changed', {
            state: this.state,
            multiplier: this.multiplier,
            time: elapsed
        });
    }
    
    calculateMultiplier(time) {
        // Dois modos: exponencial (padrão) ou polinomial (fallback)
        if (this.growth.mode === 'exponential') {
            // m(t) = e^(rate * t)
            return Math.exp(this.growth.rate * time);
        } else {
            // m(t) = 1 + a*t + b*t^2
            return 1 + (this.growth.baseGrowth * time) + (this.growth.acceleration * Math.pow(time, 2));
        }
    }
    
    shouldCrash(multiplier, time) {
        // Modelo de risco por segundo (hazard) convertido para probabilidade por update.
        // Isso evita explosão de chance por frame em 60 FPS.
        let lambda; // hazard por segundo
        if (multiplier < 1.5) {
            lambda = 0.003; // quase nula no começo
        } else if (multiplier < 2) {
            lambda = 0.02;  // 2% por segundo próximo de 2x
        } else if (multiplier < 5) {
            lambda = 0.05 + 0.02 * (multiplier - 2); // sobe gradualmente
        } else {
            lambda = 0.12 + 0.04 * (multiplier - 5); // sobe mais forte acima de 5x
        }

        // incremento suave com o tempo de voo (após 2s começa a crescer)
        lambda += Math.max(0, time - 2) * 0.01;

        // Converter hazard por segundo em probabilidade por update
        const dt = this.config.updateInterval / 1000;
        const probability = 1 - Math.exp(-lambda * dt);
        return Math.random() < probability;
    }
    
    checkAutoCashOuts() {
        for (const [playerId, playerData] of this.activePlayers) {
            if (playerData.autoCashOut && 
                !this.cashedOutPlayers.has(playerId) && 
                this.multiplier >= playerData.autoCashOut) {
                
                this.performAutoCashOut(playerId, playerData);
            }
        }
    }
    
    performAutoCashOut(playerId, playerData) {
        const winAmount = playerData.bet * this.multiplier;
        
        this.cashedOutPlayers.add(playerId);
        playerData.hasWon = true;
        
        this.stats.totalPayouts += winAmount;
        
        console.log(`🤖 Auto cash out: Player ${playerId} at ${this.multiplier.toFixed(2)}x = R$ ${winAmount.toFixed(2)}`);
        
        this.emit('player_auto_cashed_out', {
            playerId: playerId,
            multiplier: this.multiplier,
            winAmount: winAmount,
            betAmount: playerData.bet
        });
    }
    
    crashGame() {
        console.log(`💥 Game ${this.gameId} crashed at ${this.multiplier.toFixed(2)}x`);
        
        this.clearTimers();
        this.state = GAME_STATES.CRASHED;
        
        // Update statistics
        this.stats.totalGames++;
        this.updateAverageMultiplier();
        
        // Add to history
        this.addToHistory(this.multiplier);
        
        // Calculate payouts for players who didn't cash out
        this.finalizeBets();
        
        this.emit('game_state_changed', {
            state: this.state,
            finalMultiplier: this.multiplier
        });
        
        // Schedule next game
        this.stateTimeout = setTimeout(() => {
            this.scheduleNextGame();
        }, 2000); // Show crash for 2 seconds
    }
    
    finalizeBets() {
        // Reset active players for next game
        this.activePlayers.clear();
    }
    
    addToHistory(multiplier) {
        this.history.unshift(parseFloat(multiplier.toFixed(2)));
        
        if (this.history.length > this.config.historySize) {
            this.history.pop();
        }
    }
    
    updateAverageMultiplier() {
        if (this.history.length > 0) {
            const sum = this.history.reduce((a, b) => a + b, 0);
            this.stats.averageMultiplier = sum / this.history.length;
        }
    }
    
    // Player interaction methods
    canPlaceBet() {
        return this.state === GAME_STATES.WAITING || this.state === GAME_STATES.STARTING;
    }
    
    placeBet(playerId, amount, autoCashOut = null) {
        if (!this.canPlaceBet()) {
            return false;
        }
        
        // Validate auto cash out
        if (autoCashOut && autoCashOut < 1.01) {
            return false;
        }
        
        this.activePlayers.set(playerId, {
            bet: amount,
            autoCashOut: autoCashOut,
            hasWon: false,
            placedAt: Date.now()
        });
        
        this.stats.totalBets += amount;
        
        return true;
    }
    
    cashOut(playerId) {
        if (this.state !== GAME_STATES.FLYING) {
            return { success: false, error: 'Cannot cash out at this time' };
        }
        
        if (!this.activePlayers.has(playerId)) {
            return { success: false, error: 'No active bet found' };
        }
        
        if (this.cashedOutPlayers.has(playerId)) {
            return { success: false, error: 'Already cashed out' };
        }
        
        const playerData = this.activePlayers.get(playerId);
        const winAmount = playerData.bet * this.multiplier;
        
        this.cashedOutPlayers.add(playerId);
        playerData.hasWon = true;
        
        this.stats.totalPayouts += winAmount;
        
        return {
            success: true,
            multiplier: this.multiplier,
            winAmount: winAmount,
            betAmount: playerData.bet
        };
    }
    
    removePlayer(playerId) {
        this.activePlayers.delete(playerId);
        this.cashedOutPlayers.delete(playerId);
    }
    
    // Utility methods
    getRandomWaitTime() {
        const { min, max } = this.config.waitTime;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    clearTimers() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        
        if (this.stateTimeout) {
            clearTimeout(this.stateTimeout);
            this.stateTimeout = null;
        }
    }
    
    // Public getters
    getCurrentState() {
        const baseState = {
            state: this.state,
            gameId: this.gameId
        };
        
        switch (this.state) {
            case GAME_STATES.WAITING:
                return baseState;
                
            case GAME_STATES.STARTING:
                return baseState;
                
            case GAME_STATES.FLYING:
                const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
                return {
                    ...baseState,
                    multiplier: this.multiplier,
                    time: elapsed
                };
                
            case GAME_STATES.CRASHED:
                return {
                    ...baseState,
                    finalMultiplier: this.multiplier
                };
                
            default:
                return baseState;
        }
    }
    
    getGameState() {
        return this.state;
    }
    
    getHistory() {
        return [...this.history];
    }
    
    getStats() {
        return {
            ...this.stats,
            currentMultiplier: this.multiplier,
            gameState: this.state,
            activePlayers: this.activePlayers.size,
            uptime: Date.now() - this.stats.uptime
        };
    }
    
    getActivePlayers() {
        return Array.from(this.activePlayers.keys());
    }
}

module.exports = GameEngine;
