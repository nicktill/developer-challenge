import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import "./App.css";

interface Asset {
  id: number;
  isAvailable: boolean;
  currentHolder: string;
  checkoutTime: number;
}

type UserId = "member0" | "member1";
type MessageType = "success" | "info";

const USERS = {
  member0: { name: "Peter", address: "0xf56dfc48a146b9b4511465ecbf7f4b4e7308ce5a" },
  member1: { name: "Madison", address: "0x58521a46882c3049f392a9022204e47201ca7ca4" },
};

function App() {
  const [currentUser, setCurrentUser] = useState<UserId>("member0");
  const [userName, setUserName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: MessageType, text: string } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? saved === 'true' : true;
  });
  const [processingAsset, setProcessingAsset] = useState<number | null>(null);

  const user = USERS[currentUser];

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('darkMode', String(newValue));
      return newValue;
    });
  };

  const showMessage = (text: string, type: MessageType = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: method !== 'GET' ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err: any) {
      showMessage(err.message, 'info');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = useCallback(async () => {
    const countData = await fetch('/api/assets/count').then(r => r.json()).catch(() => ({ output: 0 }));
    const count = parseInt(countData.output);

    if (count === 0) return setAssets([]);

    const promises = Array.from({ length: count }, (_, i) =>
      fetch(`/api/asset/${i + 1}`)
        .then(r => r.json())
        .then(d => ({
          id: parseInt(d.output.id),
          isAvailable: d.output.isAvailable,
          currentHolder: d.output.currentHolder,
          checkoutTime: parseInt(d.output.checkoutTime),
        }))
        .catch(() => null)
    );
    const fetchedAssets = await Promise.all(promises);
    setAssets(fetchedAssets.filter(Boolean) as Asset[]);
  }, []);

  const checkRegistration = useCallback(async () => {
    const res = await fetch(`/api/user/${user.address}`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      if (data.output) {
        setIsRegistered(true);
        setUserName(data.output);
        return;
      }
    }
    setIsRegistered(false);
    setUserName("");
  }, [user.address]);

  const registerUser = async () => {
    if (!userName.trim()) return showMessage("Please enter a name", 'info');
    if (await apiCall('/api/user/register', 'POST', { userId: currentUser, name: userName })) {
      setIsRegistered(true);
      showMessage(`Registered as ${userName}!`);
    }
  };

  const createAsset = async () => {
    if (await apiCall('/api/asset/register', 'POST', { userId: currentUser })) {
      showMessage("Asset created!");
      setTimeout(fetchAssets, 1000);
    }
  };

  const checkoutAsset = async (id: number) => {
    setProcessingAsset(id);
    if (await apiCall('/api/asset/checkout', 'POST', { userId: currentUser, assetId: id })) {
      showMessage(`Asset #${id} checked out!`, 'success');
      setTimeout(() => { fetchAssets(); setProcessingAsset(null); }, 3500);
    } else {
      setProcessingAsset(null);
    }
  };

  const returnAsset = async (id: number) => {
    setProcessingAsset(id);
    if (await apiCall('/api/asset/return', 'POST', { userId: currentUser, assetId: id })) {
      showMessage(`Asset #${id} returned!`, 'info');
      setTimeout(() => { fetchAssets(); setProcessingAsset(null); }, 3500);
    } else {
      setProcessingAsset(null);
    }
  };

  useEffect(() => {
    checkRegistration();
    fetchAssets();
  }, [currentUser, checkRegistration, fetchAssets]);

  useEffect(() => {
    const socket = io('http://localhost:3001');
    const refresh = () => fetchAssets();
    ['AssetRegistered', 'AssetCheckedOut', 'AssetReturned', 'UserRegistered'].forEach(
      event => socket.on(event, refresh)
    );
    return () => { socket.disconnect(); };
  }, [fetchAssets]);

  const isOwner = (asset: Asset) => asset.currentHolder.toLowerCase() === user.address.toLowerCase();

  const bg = darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-blue-50';
  const headerBg = darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200';
  const cardBg = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const text = darkMode ? 'text-white' : 'text-slate-900';
  const textMuted = darkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bg}`}>
      <header className={`backdrop-blur-sm border-b shadow-sm sticky top-0 z-10 transition-colors ${headerBg}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="/kaleido_logo.svg" className={`h-9 w-9 ${loading ? 'animate-spin' : ''}`} alt="Logo" />
              {loading && <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>}
            </div>
            <div>
              <h1 className={`text-xl font-bold ${text}`}>Asset Checkout</h1>
              <p className={`text-xs font-medium ${textMuted}`}>Kaleido FireFly Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <div className={`text-right text-sm rounded-lg px-3 py-2 border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`font-medium ${text}`}>{user.name}</p>
              <p className={`text-xs font-mono ${textMuted}`}>{user.address.slice(0, 10)}...</p>
            </div>
            <select
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value as UserId)}
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300'}`}
            >
              <option value="member0">Peter</option>
              <option value="member1">Madison</option>
            </select>
            <button
              onClick={() => { setIsRegistered(false); setUserName(""); }}
              className={`px-3 py-2 text-sm rounded-lg ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!isRegistered ? (
          <div className="max-w-md mx-auto">
            <div className={`rounded-xl border shadow-lg p-8 ${cardBg}`}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${text}`}>Welcome, {user.name}</h2>
                <p className={textMuted}>Enter your display name to continue</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Display name"
                  className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 ${darkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'border-slate-300'}`}
                />
                <button
                  onClick={registerUser}
                  disabled={loading || !userName.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-300 text-white py-3 rounded-lg font-medium shadow-md transition-all"
                >
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`rounded-lg border p-5 flex items-center justify-between ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div>
                <h3 className={`text-lg font-semibold ${text}`}>Welcome back, {userName}</h3>
                <p className={`text-sm ${textMuted}`}>Signed in as {user.name}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs uppercase tracking-wide font-medium ${textMuted}`}>Total Assets</p>
                <p className={`text-3xl font-bold ${text}`}>{assets.length}</p>
              </div>
            </div>

            <div>
              <button
                onClick={createAsset}
                disabled={loading}
                className={`px-4 py-2 rounded font-medium transition-colors flex items-center gap-2 ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'} disabled:bg-slate-400`}
              >
                {loading && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                {loading ? 'Creating...' : 'Create Asset'}
              </button>
            </div>

            <div>
              <h2 className={`text-lg font-semibold mb-4 ${text}`}>
                Assets {loading && <span className="text-sm font-normal text-slate-400">(updating...)</span>}
              </h2>
              {assets.length === 0 ? (
                <div className={`rounded-lg border-2 border-dashed p-12 text-center ${cardBg}`}>
                  <p className={`font-medium ${text}`}>No assets yet</p>
                  <p className="text-sm text-slate-500 mt-1">Create your first asset to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => {
                    const isProcessing = processingAsset === asset.id;
                    const owned = isOwner(asset);
                    return (
                      <div key={asset.id} className={`rounded-lg border p-5 hover:shadow-lg transition-shadow ${cardBg} ${darkMode ? 'hover:border-blue-500' : 'hover:border-blue-300'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`font-semibold ${text}`}>Asset #{asset.id}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${asset.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {asset.isAvailable ? 'Available' : 'In Use'}
                          </span>
                        </div>
                        {!asset.isAvailable && (
                          <div className={`text-sm mb-3 pb-3 border-b p-2 rounded ${darkMode ? 'bg-slate-900 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <p className={`text-xs ${textMuted}`}>Holder: <span className="font-mono">{asset.currentHolder.slice(0, 18)}...</span></p>
                            {owned && <p className="text-xs text-blue-500 mt-1">You have this</p>}
                          </div>
                        )}
                        <div>
                          {asset.isAvailable ? (
                            <button
                              onClick={() => checkoutAsset(asset.id)}
                              disabled={loading || isProcessing}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white py-2 rounded font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {isProcessing && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                              {isProcessing ? 'Checking Out...' : 'Check Out'}
                            </button>
                          ) : owned ? (
                            <button
                              onClick={() => returnAsset(asset.id)}
                              disabled={loading || isProcessing}
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-2 rounded font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {isProcessing && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>}
                              {isProcessing ? 'Returning...' : 'Return'}
                            </button>
                          ) : (
                            <button disabled className={`w-full py-2 rounded font-medium ${darkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                              Unavailable
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className="fixed bottom-6 right-6 z-50">
            <div className={`text-white px-4 py-3 rounded shadow-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-600' : 'bg-blue-600'}`}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {message.text}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
