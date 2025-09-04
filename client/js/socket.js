// Socket.IO client connection and event handling

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        this.eventCallbacks = new Map();
        
        this.connect();
    }
    
    connect() {
        // Determine socket URL based on environment
        const socketUrl = this.getSocketUrl();
        
        this.socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            timeout: 20000
        });
        
        this.setupEventHandlers();
    }
    
    getSocketUrl() {
        // Development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // Production - use environment variable or fallback
        return process.env.SOCKET_URL || 'wss://your-backend-url.railway.app';
    }
    
    setupEventHandlers() {
        this.socket.on('connect', () => {
            console.log('🚀 Conectado ao servidor');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connection_status', { connected: true });
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('❌ Desconectado do servidor:', reason);
            this.isConnected = false;
            this.emit('connection_status', { connected: false, reason });
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('🔴 Erro de conexão:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.emit('connection_error', { 
                    error: 'Falha ao conectar após várias tentativas',
                    attempts: this.reconnectAttempts 
                });
            }
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconectado após', attemptNumber, 'tentativas');
            this.emit('reconnected', { attempts: attemptNumber });
        });
        
        // Game events
        this.socket.on('game_state', (data) => {
            this.emit('game_state', data);
        });
        
        this.socket.on('player_joined', (data) => {
            this.emit('player_joined', data);
        });
        
        this.socket.on('player_left', (data) => {
            this.emit('player_left', data);
        });
        
        this.socket.on('player_bet', (data) => {
            this.emit('player_bet', data);
        });
        
        this.socket.on('player_cashed_out', (data) => {
            this.emit('player_cashed_out', data);
        });
        
        this.socket.on('game_history', (data) => {
            this.emit('game_history', data);
        });
        
        this.socket.on('error', (data) => {
            console.error('🚨 Erro do servidor:', data);
            this.emit('server_error', data);
        });
    }
    
    // Event emitter methods
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Erro no callback do evento', event, ':', error);
                }
            });
        }
    }
    
    // Socket.IO specific methods
    send(event, data) {
        if (this.isConnected && this.socket) {
            this.socket.emit(event, data);
        } else {
            console.warn('⚠️ Tentativa de envio sem conexão:', event);
        }
    }
    
    // Game specific methods
    placeBet(amount, autoCashOut = null) {
        this.send('place_bet', {
            amount: amount,
            autoCashOut: autoCashOut,
            timestamp: Date.now()
        });
    }
    
    cashOut() {
        this.send('cash_out', {
            timestamp: Date.now()
        });
    }
    
    joinGame(playerName = null) {
        this.send('join_game', {
            playerName: playerName || this.generatePlayerName(),
            timestamp: Date.now()
        });
    }
    
    generatePlayerName() {
        const adjectives = ['Rápido', 'Sortudo', 'Corajoso', 'Esperto', 'Audaz'];
        const nouns = ['Piloto', 'Astronauta', 'Foguete', 'Explorador', 'Aventureiro'];
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const number = Math.floor(Math.random() * 999) + 1;
        
        return `${adj}${noun}${number}`;
    }
    
    // Connection management
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    reconnect() {
        if (this.socket) {
            this.socket.connect();
        }
    }
    
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            socketId: this.socket?.id || null,
            transport: this.socket?.io?.engine?.transport?.name || null
        };
    }
}

// Game state constants matching server
const GAME_STATES = {
    WAITING: 'waiting',
    STARTING: 'starting',
    FLYING: 'flying',
    CRASHED: 'crashed'
};

// Initialize socket manager
let socketManager;

// Wait for DOM to load before initializing
document.addEventListener('DOMContentLoaded', () => {
    socketManager = new SocketManager();
    
    // Make it globally available
    window.socketManager = socketManager;
    window.GAME_STATES = GAME_STATES;
    
    // Auto-join game when connected
    socketManager.on('connection_status', (data) => {
        if (data.connected) {
            setTimeout(() => {
                socketManager.joinGame();
            }, 500);
        }
    });
});

// Connection status indicator
class ConnectionIndicator {
    constructor() {
        this.indicator = this.createIndicator();
        this.setupEventListeners();
    }
    
    createIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'connection-indicator';
        indicator.innerHTML = `
            <div class="connection-dot"></div>
            <span class="connection-text">Conectando...</span>
        `;
        
        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .connection-indicator {
                position: fixed;
                top: 10px;
                right: 10px;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.8rem;
                z-index: 1000;
                transition: all 0.3s ease;
            }
            
            .connection-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #ffc107;
                animation: pulse 1.5s infinite;
            }
            
            .connection-indicator.connected .connection-dot {
                background: #28a745;
                animation: none;
            }
            
            .connection-indicator.disconnected .connection-dot {
                background: #dc3545;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(indicator);
        
        return indicator;
    }
    
    setupEventListeners() {
        if (window.socketManager) {
            window.socketManager.on('connection_status', (data) => {
                this.updateStatus(data.connected);
            });
        }
    }
    
    updateStatus(connected) {
        const dot = this.indicator.querySelector('.connection-dot');
        const text = this.indicator.querySelector('.connection-text');
        
        if (connected) {
            this.indicator.className = 'connection-indicator connected';
            text.textContent = 'Online';
        } else {
            this.indicator.className = 'connection-indicator disconnected';
            text.textContent = 'Desconectado';
        }
    }
}

// Initialize connection indicator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ConnectionIndicator();
});
