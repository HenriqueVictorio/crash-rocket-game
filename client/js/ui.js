// UI management and user interactions

class UIManager {
    constructor() {
        this.elements = {};
        this.gameState = 'waiting';
        this.playerBalance = 1000.00;
        this.currentBet = 0;
        this.isAutoCashOut = false;
        this.autoCashOutValue = 2.00;
        this.isPlaying = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateBalance();
    }
    
    initializeElements() {
        this.elements = {
            // Control panel
            modeToggle: document.querySelectorAll('.toggle-btn'),
            betAmount: document.getElementById('bet-amount'),
            betControlBtns: document.querySelectorAll('.bet-control-btn'),
            autoCashOutToggle: document.getElementById('auto-cashout'),
            autoCashOutValue: document.getElementById('auto-cashout-value'),
            clearBtn: document.querySelector('.clear-btn'),
            startBtn: document.getElementById('main-action-btn'),
            btnText: document.querySelector('.btn-text'),
            btnLoading: document.querySelector('.btn-loading'),
            
            // Player info
            playerBalance: document.getElementById('player-balance'),
            lastWin: document.getElementById('last-win'),
            lastWinAmount: document.getElementById('last-win-amount'),
            
            // Game overlay
            multiplier: document.getElementById('multiplier'),
            countdown: document.getElementById('countdown'),
            crashStatus: document.getElementById('crash-status'),
            crashMultiplier: document.getElementById('crash-multiplier'),
            waitingScreen: document.getElementById('waiting-screen'),
            waitingTimer: document.getElementById('waiting-timer'),
            
            // History
            historyContainer: document.getElementById('history-container'),
            
            // Players
            playersList: document.getElementById('players-list')
        };
    }
    
    setupEventListeners() {
        // Mode toggle
        this.elements.modeToggle.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleMode(e.target.dataset.mode);
            });
        });
        
        // Bet controls
        this.elements.betControlBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.adjustBetAmount(e.target.dataset.action);
            });
        });
        
        // Auto cash out toggle
        this.elements.autoCashOutToggle.addEventListener('change', (e) => {
            this.toggleAutoCashOut(e.target.checked);
        });
        
        // Clear button
        this.elements.clearBtn.addEventListener('click', () => {
            this.clearBet();
        });
        
        // Start/Cash out button
        this.elements.startBtn.addEventListener('click', () => {
            this.handleMainAction();
        });
        
        // Bet amount validation
        this.elements.betAmount.addEventListener('input', (e) => {
            this.validateBetAmount(e.target.value);
        });
        
        // Auto cash out value validation
        this.elements.autoCashOutValue.addEventListener('input', (e) => {
            this.validateAutoCashOutValue(e.target.value);
        });
        
        // Prevent form submission
        this.elements.betAmount.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleMainAction();
            }
        });
    }
    
    toggleMode(mode) {
        this.elements.modeToggle.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        // Auto mode functionality would be implemented here
        if (mode === 'auto') {
            console.log('Modo automático ativado');
        }
    }
    
    adjustBetAmount(action) {
        const currentValue = parseFloat(this.elements.betAmount.value) || 0;
        let newValue;
        
        switch (action) {
            case 'half':
                newValue = currentValue / 2;
                break;
            case 'double':
                newValue = currentValue * 2;
                break;
        }
        
        // Ensure minimum bet
        newValue = Math.max(newValue, 1);
        
        // Ensure not exceeding balance
        newValue = Math.min(newValue, this.playerBalance);
        
        this.elements.betAmount.value = newValue.toFixed(2);
        this.validateBetAmount(newValue);
    }
    
    toggleAutoCashOut(enabled) {
        this.isAutoCashOut = enabled;
        this.elements.autoCashOutValue.disabled = !enabled;
        
        if (enabled) {
            this.elements.autoCashOutValue.focus();
        }
    }
    
    clearBet() {
        this.elements.betAmount.value = '10.00';
        this.elements.autoCashOutToggle.checked = false;
        this.toggleAutoCashOut(false);
        this.elements.autoCashOutValue.value = '2.00';
    }
    
    validateBetAmount(value) {
        const amount = parseFloat(value) || 0;
        const isValid = amount >= 1 && amount <= this.playerBalance;
        
        this.elements.betAmount.style.borderColor = isValid ? '' : '#e53e3e';
        this.updateStartButton();
        
        return isValid;
    }
    
    validateAutoCashOutValue(value) {
        const multiplier = parseFloat(value) || 0;
        const isValid = multiplier >= 1.01;
        
        this.elements.autoCashOutValue.style.borderColor = isValid ? '' : '#e53e3e';
        
        return isValid;
    }
    
    handleMainAction() {
        if (this.gameState === 'waiting' || this.gameState === 'starting') {
            this.placeBet();
        } else if (this.gameState === 'flying' && this.isPlaying) {
            this.cashOut();
        }
    }
    
    placeBet() {
        const betAmount = parseFloat(this.elements.betAmount.value) || 0;
        
        if (!this.validateBetAmount(betAmount)) {
            this.showNotification('Valor de aposta inválido', 'error');
            return;
        }
        
        if (betAmount > this.playerBalance) {
            this.showNotification('Saldo insuficiente', 'error');
            return;
        }
        
        const autoCashOut = this.isAutoCashOut ? parseFloat(this.elements.autoCashOutValue.value) : null;
        
        // Send bet to server
        if (window.socketManager) {
            window.socketManager.placeBet(betAmount, autoCashOut);
        }
        
        // Update local state
        this.currentBet = betAmount;
        this.playerBalance -= betAmount;
        this.isPlaying = true;
        
        this.updateBalance();
        this.updateStartButton();
        this.showNotification(`Aposta de R$ ${betAmount.toFixed(2)} realizada!`, 'success');
    }
    
    cashOut() {
        if (!this.isPlaying) return;
        
        // Send cash out to server
        if (window.socketManager) {
            window.socketManager.cashOut();
        }
        
        this.isPlaying = false;
        this.updateStartButton();
    }
    
    updateStartButton() {
        const btn = this.elements.startBtn;
        const btnText = this.elements.btnText;
        const btnLoading = this.elements.btnLoading;
        
        if (this.gameState === 'waiting' || this.gameState === 'starting') {
            if (this.isPlaying) {
                btnText.textContent = 'Aguardando...';
                btn.disabled = true;
                btnLoading.classList.remove('hidden');
            } else {
                const betAmount = parseFloat(this.elements.betAmount.value) || 0;
                const isValidBet = this.validateBetAmount(betAmount);
                
                btnText.textContent = 'Começar o jogo';
                btn.disabled = !isValidBet;
                btnLoading.classList.add('hidden');
            }
        } else if (this.gameState === 'flying') {
            if (this.isPlaying) {
                btnText.textContent = 'Retirar';
                btn.disabled = false;
                btnLoading.classList.add('hidden');
                btn.style.background = 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)';
            } else {
                btnText.textContent = 'Aguarde...';
                btn.disabled = true;
                btnLoading.classList.add('hidden');
            }
        } else {
            btnText.textContent = 'Aguarde...';
            btn.disabled = true;
            btnLoading.classList.add('hidden');
        }
        
        // Reset button style when not flying
        if (this.gameState !== 'flying' || !this.isPlaying) {
            btn.style.background = '';
        }
    }
    
    updateBalance() {
        this.elements.playerBalance.textContent = this.playerBalance.toFixed(2);
    }
    
    showLastWin(amount) {
        this.elements.lastWinAmount.textContent = amount.toFixed(2);
        this.elements.lastWin.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            this.elements.lastWin.style.display = 'none';
        }, 5000);
    }
    
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add CSS if not already added
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 2000;
                    animation: slideInRight 0.3s ease-out;
                    max-width: 300px;
                }
                
                .notification-success {
                    background: linear-gradient(135deg, #38a169, #2f855a);
                }
                
                .notification-error {
                    background: linear-gradient(135deg, #e53e3e, #c53030);
                }
                
                .notification-info {
                    background: linear-gradient(135deg, #3182ce, #2c5282);
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Game state handlers
    setGameState(state, data = {}) {
        this.gameState = state;
        
        switch (state) {
            case 'waiting':
                this.handleWaitingState(data);
                break;
            case 'starting':
                this.handleStartingState(data);
                break;
            case 'flying':
                this.handleFlyingState(data);
                break;
            case 'crashed':
                this.handleCrashedState(data);
                break;
        }
        
        this.updateStartButton();
    }
    
    handleWaitingState(data) {
        this.elements.waitingScreen.classList.remove('hidden');
        this.elements.countdown.classList.add('hidden');
        this.elements.crashStatus.classList.add('hidden');
        this.elements.multiplier.textContent = '1.00X';
        
        if (data.nextGameIn) {
            this.startWaitingTimer(data.nextGameIn);
        }
    }
    
    handleStartingState(data) {
        this.elements.waitingScreen.classList.add('hidden');
        this.elements.countdown.classList.remove('hidden');
        this.elements.crashStatus.classList.add('hidden');
        
        if (data.countdown) {
            this.startCountdown(data.countdown);
        }
    }
    
    handleFlyingState(data) {
        this.elements.waitingScreen.classList.add('hidden');
        this.elements.countdown.classList.add('hidden');
        this.elements.crashStatus.classList.add('hidden');
        
        if (data.multiplier) {
            this.updateMultiplier(data.multiplier);
        }
    }
    
    handleCrashedState(data) {
        this.elements.waitingScreen.classList.add('hidden');
        this.elements.countdown.classList.add('hidden');
        this.elements.crashStatus.classList.remove('hidden');
        
        if (data.finalMultiplier) {
            this.elements.crashMultiplier.textContent = `${data.finalMultiplier.toFixed(2)}X`;
        }
        
        // Reset playing state
        this.isPlaying = false;
        
        // Hide crash status after 3 seconds
        setTimeout(() => {
            this.elements.crashStatus.classList.add('hidden');
        }, 3000);
    }
    
    startWaitingTimer(seconds) {
        let remaining = seconds;
        
        const updateTimer = () => {
            this.elements.waitingTimer.textContent = `${remaining.toFixed(1)}s`;
            remaining -= 0.1;
            
            if (remaining <= 0) {
                clearInterval(interval);
            }
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 100);
    }
    
    startCountdown(seconds) {
        let remaining = seconds;
        
        const updateCountdown = () => {
            this.elements.countdown.textContent = `Começando em ${remaining.toFixed(1)}s`;
            
            // Scale animation
            this.elements.countdown.style.transform = 'translate(-50%, -50%) scale(1.1)';
            setTimeout(() => {
                this.elements.countdown.style.transform = 'translate(-50%, -50%) scale(1)';
            }, 100);
            
            remaining -= 0.1;
            
            if (remaining <= 0) {
                clearInterval(interval);
                this.elements.countdown.classList.add('hidden');
            }
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 100);
    }
    
    updateMultiplier(multiplier) {
        this.elements.multiplier.textContent = `${multiplier.toFixed(2)}X`;
        
        // Scale effect based on multiplier
        const scale = Math.min(1 + (multiplier - 1) * 0.05, 1.5);
        this.elements.multiplier.style.transform = `translateX(-50%) scale(${scale})`;
        
        // Color change based on multiplier
        if (multiplier >= 10) {
            this.elements.multiplier.style.color = '#ffd700'; // Gold
        } else if (multiplier >= 5) {
            this.elements.multiplier.style.color = '#ff6b6b'; // Red
        } else if (multiplier >= 2) {
            this.elements.multiplier.style.color = '#68d391'; // Green
        } else {
            this.elements.multiplier.style.color = 'white';
        }
    }
    
    addToHistory(multiplier) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item slide-in';
        
        // Determine color based on multiplier
        if (multiplier >= 10) {
            historyItem.classList.add('purple');
        } else if (multiplier >= 2) {
            historyItem.classList.add('green');
        } else {
            historyItem.classList.add('red');
        }
        
        historyItem.textContent = `${multiplier.toFixed(2)}x`;
        
        // Add to beginning of history
        this.elements.historyContainer.insertBefore(historyItem, this.elements.historyContainer.firstChild);
        
        // Keep only last 20 items
        while (this.elements.historyContainer.children.length > 20) {
            this.elements.historyContainer.removeChild(this.elements.historyContainer.lastChild);
        }
        
        // Scroll to start
        this.elements.historyContainer.scrollLeft = 0;
    }
    
    handlePlayerCashedOut(data) {
        if (data.isCurrentPlayer) {
            const winAmount = data.amount;
            this.playerBalance += winAmount;
            this.updateBalance();
            this.showLastWin(winAmount);
            this.showNotification(`Você retirou R$ ${winAmount.toFixed(2)}!`, 'success');
            this.isPlaying = false;
        }
        
        this.updateStartButton();
    }
}

// Initialize UI Manager
let uiManager;

document.addEventListener('DOMContentLoaded', () => {
    uiManager = new UIManager();
    
    // Make it globally available
    window.uiManager = uiManager;
});

// Export for use in other modules
window.UIManager = UIManager;
