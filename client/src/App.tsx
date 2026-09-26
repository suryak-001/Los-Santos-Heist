import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import AdminPanel from './components/AdminPanel';
import Dashboard from './components/Dashboard';
import Leaderboard from './components/Leaderboard';
import Lottery from './components/Lottery';
import Timer from './components/Timer';
import Hub from './components/Hub';
import PublicLayout from './components/PublicLayout';
import type { GameState } from './types/game';

// Initialize Socket outside component to prevent multiple connections
// Initialize Socket (relative path for production, localhost for dev if serving separately)
// If in dev mode (Vite typically runs on 5173 and Server on 3000), we need localhost:3000
// If in prod (served by express), we need /
const isDev = import.meta.env.DEV;
const socket: Socket = io(isDev ? 'http://localhost:3000' : undefined);

const PUBLIC_PATHS = ['/hub', '/control', '/leaderboard', '/lottery', '/timer'];

function App() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [myId, setMyId] = useState<string>('');
    const [path, setPath] = useState(globalThis.location.pathname);

    // Handle browser back/forward buttons
    useEffect(() => {
        const handlePopState = () => {
            setPath(globalThis.location.pathname);
        };
        globalThis.addEventListener('popstate', handlePopState);
        return () => globalThis.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = (newPath: string) => {
        globalThis.history.pushState({}, '', newPath);
        setPath(newPath);
    };

    // --- SESSIONS ---
    // Public screens never log in: joining would take the player's session
    // away from their game tab.
    const isPublicPath = PUBLIC_PATHS.includes(path) || path === '/lead';
    useEffect(() => {
        const storedAlias = localStorage.getItem('player_alias');
        if (storedAlias && isConnected && !isPublicPath) {
            console.log('Restoring session for:', storedAlias);
            socket.emit('join', { alias: storedAlias });
        }
    }, [isConnected, isPublicPath]);

    // --- SOCKET EVENTS ---
    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            setMyId(socket.id || '');
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        function onStateUpdate(newState: GameState) {
            setGameState(newState);
        }

        function onLoginResponse(res: { success: boolean; error?: string; player?: { alias: string } }) {
            if (res.success && res.player?.alias) {
                localStorage.setItem('player_alias', res.player.alias);
            } else {
                localStorage.removeItem('player_alias');
            }
        }

        function onKicked(data: { message: string }) {
            alert(data.message);
            localStorage.removeItem('player_alias');
            globalThis.location.reload();
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('state_update', onStateUpdate);
        socket.on('login_response', onLoginResponse);
        socket.on('kicked', onKicked);

        if (socket.connected) onConnect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('state_update', onStateUpdate);
            socket.off('login_response', onLoginResponse);
            socket.off('kicked', onKicked);
        };
    }, []);

    if (!isConnected) {
        return (
            <div className="h-screen city-bg flex items-center justify-center text-heist-light font-mono font-bold tracking-[0.3em] animate-pulse">
                CONNECTING TO LOS SANTOS...
            </div>
        );
    }

    // 0. Standalone Leaderboard (No Navigation)
    if (path === '/lead') {
        return (
            <div className="min-h-screen city-bg text-white font-sans selection:bg-heist-pink selection:text-white overflow-auto">
                <Leaderboard socket={socket} />
            </div>
        );
    }

    // 0.5. Public Routes (Wrapped in a single persistent PublicLayout)
    if (PUBLIC_PATHS.includes(path)) {
        let activeTab: 'hub' | 'leaderboard' | 'lottery' | 'timer' | undefined = undefined;
        if (path === '/hub') activeTab = 'hub';
        if (path === '/leaderboard') activeTab = 'leaderboard';
        if (path === '/lottery') activeTab = 'lottery';
        if (path === '/timer') activeTab = 'timer';

        return (
            <PublicLayout gameState={gameState} activeTab={activeTab} onNavigate={navigate}>
                {path === '/hub' || path === '/control' ? <Hub socket={socket} onNavigate={navigate} /> : null}
                {path === '/leaderboard' ? <Leaderboard socket={socket} /> : null}
                {path === '/lottery' ? <Lottery gameState={gameState} /> : null}
                {path === '/timer' ? <Timer socket={socket} gameState={gameState} /> : null}
            </PublicLayout>
        );
    }

    // 1. Not Logged In
    const me = gameState?.players[myId];
    if (!gameState || !me) {
        return <Lobby socket={socket} />;
    }

    // 2. Admin
    if (me.alias === 'admin') {
        return <AdminPanel socket={socket} gameState={gameState} />;
    }

    // 3. Player Dashboard
    return <Dashboard socket={socket} gameState={gameState} myId={myId} />;
}

export default App;
