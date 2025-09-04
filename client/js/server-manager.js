class ServerManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.serverUrl = '';
    this.initializeElements();
    this.bindEvents();

    // Tentar reconectar com URL salva
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      document.getElementById('serverUrl').value = savedUrl;
    }
  }
  
  initializeElements() {
    this.serverBtn = document.getElementById('serverBtn');
    this.serverModal = document.getElementById('serverModal');
    this.closeModal = document.getElementById('closeModal');
    this.serverUrlInput = document.getElementById('serverUrl');
    this.connectBtn = document.getElementById('connectBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.connectionText = document.getElementById('connectionText');
  }
  
  bindEvents() {
    // Abrir modal
    this.serverBtn.addEventListener('click', () => {
      this.serverModal.classList.remove('hidden');
    });
    
    // Fechar modal
    this.closeModal.addEventListener('click', () => {
      this.serverModal.classList.add('hidden');
    });
    
    // Fechar modal clicando fora
    this.serverModal.addEventListener('click', (e) => {
      if (e.target === this.serverModal) {
        this.serverModal.classList.add('hidden');
      }
    });
    
    // Conectar
    this.connectBtn.addEventListener('click', () => {
      const url = this.serverUrlInput.value.trim();
      if (url) {
        this.connectToServer(url);
      }
    });
    
    // Desconectar
    this.disconnectBtn.addEventListener('click', () => {
      this.disconnectFromServer();
    });
    
    // Enter no input
    this.serverUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.connectBtn.click();
      }
    });
  }
  
  connectToServer(url) {
    this.updateStatus('connecting', 'Conectando...');
    this.serverUrl = url;
    
    try {
      // Desconectar socket anterior se existir
      if (this.socket) {
        this.socket.disconnect();
      }
      
      // Criar nova conexão
      this.socket = io(url, {
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 3
      });
      
      // Eventos do socket
      this.socket.on('connect', () => {
        this.updateStatus('online', 'Conectado');
        this.isConnected = true;
        localStorage.setItem('serverUrl', url);
        this.serverModal.classList.add('hidden');
        
        // Inicializar jogo
        this.initializeGame();
      });
      
      this.socket.on('disconnect', () => {
        this.updateStatus('offline', 'Desconectado');
        this.isConnected = false;
      });
      
      this.socket.on('connect_error', (error) => {
        this.updateStatus('offline', 'Erro de conexão');
        console.error('Connection error:', error);
        alert('Erro ao conectar com o servidor. Verifique a URL.');
      });
      
      // Eventos do jogo
      this.socket.on('game_state', (data) => {
        // Aqui você chama suas funções do jogo
        handleGameState(data);
      });
      
    } catch (error) {
      this.updateStatus('offline', 'Erro de conexão');
      console.error('Connection error:', error);
    }
  }
  
  disconnectFromServer() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.updateStatus('offline', 'Desconectado');
    this.isConnected = false;
    localStorage.removeItem('serverUrl');
  }
  
  updateStatus(status, text) {
    this.connectionStatus.className = `status ${status}`;
    this.connectionText.textContent = text;
    
    if (status === 'online') {
      this.connectBtn.classList.add('hidden');
      this.disconnectBtn.classList.remove('hidden');
    } else {
      this.connectBtn.classList.remove('hidden');
      this.disconnectBtn.classList.add('hidden');
    }
  }
  
  initializeGame() {
    // Aqui você inicializa o jogo após conectar
    console.log('Game initialized with server:', this.serverUrl);
    
    // Exemplo: solicitar estado inicial do jogo
    if (this.socket) {
      this.socket.emit('request_game_state');
    }
  }
  
  // Métodos públicos para usar no jogo
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      alert('Não conectado ao servidor!');
    }
  }
  
  isSocketConnected() {
    return this.isConnected;
  }
}

// Inicializar quando a página carregar
let serverManager;
document.addEventListener('DOMContentLoaded', () => {
  serverManager = new ServerManager();
});

// Exemplo de como usar no seu jogo:
function handleGameState(data) {
  // Suas funções existentes do jogo
  console.log('Game state received:', data);
}

// Para fazer apostas ou outras ações:
function placeBet(amount) {
  if (serverManager && serverManager.isSocketConnected()) {
    serverManager.emit('place_bet', { amount });
  } else {
    alert('Conecte-se ao servidor primeiro!');
  }
}
