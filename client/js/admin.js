const ADMIN_PASSWORD = 'henrique12';
const STORAGE_KEY = 'crash-rocket-admin-token';
const WAIT_FOR_SOCKET_TIMEOUT = 5000;

const html = {
    authForm: document.getElementById('auth-form'),
    passwordInput: document.getElementById('password-input'),
    errorMessage: document.getElementById('auth-error'),
    adminSection: document.getElementById('admin-section'),
    statusMessage: document.getElementById('status-message'),
    connectionStatus: document.getElementById('connection-status'),
    serverUrl: document.getElementById('server-url'),
    socketId: document.getElementById('socket-id'),
    forceCrashBtn: document.getElementById('force-crash-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    lastResult: document.getElementById('last-result')
};

let connectionStatusListener = null;
let reconnectListener = null;

function safeLocalStorageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        console.warn('Não foi possível ler do localStorage:', error);
        return null;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        console.warn('Não foi possível gravar no localStorage:', error);
    }
}

function safeLocalStorageRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.warn('Não foi possível remover chave do localStorage:', error);
    }
}

function isAuthenticated() {
    return safeLocalStorageGet(STORAGE_KEY) === ADMIN_PASSWORD;
}

function setAuthenticated(authenticated) {
    if (authenticated) {
        safeLocalStorageSet(STORAGE_KEY, ADMIN_PASSWORD);
    } else {
        safeLocalStorageRemove(STORAGE_KEY);
    }
}

function showElement(element) {
    element?.classList.remove('hidden');
}

function hideElement(element) {
    element?.classList.add('hidden');
}

function setStatusMessage(message, type = 'neutral') {
    if (!html.statusMessage) return;
    html.statusMessage.textContent = message || '';
    html.statusMessage.classList.remove('success', 'error');
    if (type === 'success') {
        html.statusMessage.classList.add('success');
    }
    if (type === 'error') {
        html.statusMessage.classList.add('error');
    }
}

function setLastResult(message, type = 'neutral') {
    if (!html.lastResult) return;
    html.lastResult.textContent = message || '';
    html.lastResult.classList.remove('success', 'error');
    if (type === 'success') {
        html.lastResult.classList.add('success');
    }
    if (type === 'error') {
        html.lastResult.classList.add('error');
    }
}

function setError(message) {
    if (html.errorMessage) {
        html.errorMessage.textContent = message || '';
    }
}

function clearError() {
    setError('');
}

function toggleAdminSection(show) {
    if (show) {
        hideElement(html.authForm);
        showElement(html.adminSection);
        html.passwordInput.value = '';
        setStatusMessage('Sessão administrativa ativa.', 'success');
        html.forceCrashBtn?.focus();
    } else {
        showElement(html.authForm);
        hideElement(html.adminSection);
        setStatusMessage('');
        setLastResult('');
        html.passwordInput.focus();
    }
}

function updateConnectionDetails() {
    const socketManager = window.socketManager;
    if (!socketManager || !html.connectionStatus || !html.serverUrl) {
        return;
    }

    const { connected, serverUrl, socketId, transport } = socketManager.getConnectionStatus();
    html.connectionStatus.textContent = connected ? `Conectado via ${transport || 'desconhecido'}` : 'Desconectado';
    html.connectionStatus.classList.toggle('connection-online', Boolean(connected));
    html.connectionStatus.classList.toggle('connection-offline', !connected);
    html.serverUrl.textContent = serverUrl || '-';
    html.socketId.textContent = connected && socketId ? socketId : '-';
}

function attachSocketListeners(socketManager) {
    if (!socketManager) return;

    detachSocketListeners();

    connectionStatusListener = (data) => {
        updateConnectionDetails();
        if (data.connected) {
            setStatusMessage('Conectado ao servidor.', 'success');
        } else {
            setStatusMessage('Perdemos a conexão com o servidor.', 'error');
        }
    };

    reconnectListener = () => {
        updateConnectionDetails();
        setStatusMessage('Reconectado ao servidor.', 'success');
    };

    socketManager.on('connection_status', connectionStatusListener);
    socketManager.on('reconnected', reconnectListener);
}

function detachSocketListeners() {
    const socketManager = window.socketManager;
    if (!socketManager) return;
    if (connectionStatusListener) {
        socketManager.off('connection_status', connectionStatusListener);
        connectionStatusListener = null;
    }
    if (reconnectListener) {
        socketManager.off('reconnected', reconnectListener);
        reconnectListener = null;
    }
}

function waitForSocketManager() {
    return new Promise((resolve, reject) => {
        if (window.socketManager) {
            return resolve(window.socketManager);
        }

        const start = Date.now();
        const interval = setInterval(() => {
            if (window.socketManager) {
                clearInterval(interval);
                resolve(window.socketManager);
            } else if (Date.now() - start >= WAIT_FOR_SOCKET_TIMEOUT) {
                clearInterval(interval);
                reject(new Error('SocketManager não disponível.'));
            }
        }, 100);
    });
}

function setCrashButtonLoading(isLoading) {
    if (!html.forceCrashBtn) return;
    html.forceCrashBtn.disabled = isLoading;
    html.forceCrashBtn.textContent = isLoading ? 'Enviando comando...' : 'Forçar crash agora';
}

async function triggerForceCrash() {
    const socketManager = window.socketManager;
    if (!socketManager) {
        setLastResult('SocketManager indisponível.', 'error');
        return;
    }

    setCrashButtonLoading(true);
    setLastResult('Enviando comando ao servidor...', 'neutral');

    try {
        const response = await socketManager.forceCrash(ADMIN_PASSWORD, 'manual_admin_panel');
        const multiplier = response?.crashMultiplier || response?.multiplier;
        const detail = multiplier ? `Multiplicador registrado: ${Number(multiplier).toFixed(2)}x.` : '';
        setLastResult(`Comando executado com sucesso. ${detail}`.trim(), 'success');
    } catch (error) {
        console.error('Falha ao forçar crash:', error);
        setLastResult(error.message || 'Falha ao enviar comando.', 'error');
    } finally {
        setCrashButtonLoading(false);
    }
}

function handleAuthenticate(event) {
    event.preventDefault();
    clearError();

    const password = html.passwordInput.value.trim();
    if (!password) {
        setError('Informe a senha.');
        return;
    }

    if (password === ADMIN_PASSWORD) {
        setAuthenticated(true);
        toggleAdminSection(true);
        setStatusMessage('Senha correta. Acesso liberado.');
        updateConnectionDetails();
    } else {
        setAuthenticated(false);
        setError('Senha incorreta. Tente novamente.');
        html.passwordInput.select();
    }
}

function handleLogout() {
    setAuthenticated(false);
    toggleAdminSection(false);
    setStatusMessage('Sessão encerrada.');
}

function initializeUI() {
    if (isAuthenticated()) {
        toggleAdminSection(true);
        setStatusMessage('Sessão restaurada.');
    } else {
        toggleAdminSection(false);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initializeUI();

    try {
        const manager = await waitForSocketManager();
        attachSocketListeners(manager);
        updateConnectionDetails();
    } catch (error) {
        console.error(error);
        setStatusMessage('Não foi possível inicializar a conexão automática.', 'error');
    }

    html.authForm?.addEventListener('submit', handleAuthenticate);
    html.passwordInput?.addEventListener('input', () => {
        if (html.passwordInput.value.trim()) {
            clearError();
        }
    });

    html.forceCrashBtn?.addEventListener('click', triggerForceCrash);
    html.logoutBtn?.addEventListener('click', handleLogout);

    window.addEventListener('beforeunload', () => {
        detachSocketListeners();
    });
});
