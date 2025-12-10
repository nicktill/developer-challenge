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
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const user = USERS[currentUser];

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
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
      showMessage(err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = useCallback(async () => {
    const countData = await fetch('/api/assets/count').then(r => r.json()).catch(() => ({ output: 0 }));
    const count = parseInt(countData.output);

    if (count > 0) {
      const promises = Array.from({ length: count }, (_, i) =>
        fetch(`/api/asset/${i + 1}`).then(r => r.json())
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
    } else {
      setAssets([]);
    }
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
    if (!userName.trim()) return showMessage("Please enter a name", 'error');
    const result = await apiCall('/api/user/register', 'POST', { userId: currentUser, name: userName });
    if (result) {
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
    if (await apiCall('/api/asset/checkout', 'POST', { userId: currentUser, assetId: id })) {
      showMessage(`Asset #${id} checked out!`);
      setTimeout(fetchAssets, 1000);
    }
  };

  const returnAsset = async (id: number) => {
    if (await apiCall('/api/asset/return', 'POST', { userId: currentUser, assetId: id })) {
      showMessage(`Asset #${id} returned!`);
      setTimeout(fetchAssets, 1000);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/kaleido_logo.svg" className={`h-8 w-8 ${loading ? 'animate-spin' : ''}`} alt="Logo" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Asset Checkout</h1>
              <p className="text-xs text-slate-500">Kaleido FireFly</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="text-slate-600">{user.name}</p>
              <p className="text-xs text-slate-400">{user.address.slice(0, 12)}...</p>
            </div>
            <select
              value={currentUser}
              onChange={(e) => setCurrentUser(e.target.value as UserId)}
              className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
            >
              <option value="member0">Peter</option>
              <option value="member1">Madison</option>
            </select>
            <button
              onClick={() => { setIsRegistered(false); setUserName(""); }}
              className="text-slate-600 hover:text-slate-900 px-2 py-1.5 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {!isRegistered ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg border shadow-sm p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">Welcome, {user.name}</h2>
                <p className="text-slate-600">Enter your display name to continue</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Display name"
                  className="w-full border border-slate-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={registerUser}
                  disabled={loading || !userName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded font-medium"
                >
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border shadow-sm p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Welcome back, {userName}</h3>
                <p className="text-sm text-slate-600">Signed in as {user.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Total Assets</p>
                <p className="text-2xl font-semibold text-slate-900">{assets.length}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={createAsset}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-medium"
              >
                {loading ? 'Creating...' : 'Create Asset'}
              </button>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Assets {loading && <span className="text-slate-400">(updating...)</span>}
              </h2>
              {assets.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
                  <p className="text-slate-600 mb-1">No assets created yet</p>
                  <p className="text-sm text-slate-500">Create your first asset to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">Asset #{asset.id}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          asset.isAvailable
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {asset.isAvailable ? 'Available' : 'In Use'}
                        </span>
                      </div>
                      {!asset.isAvailable && (
                        <div className="text-sm text-slate-600 mb-4 pb-4 border-b">
                          <p className="mb-1">Current holder:</p>
                          <p className="font-mono text-xs text-slate-500">{asset.currentHolder.slice(0, 20)}...</p>
                          {isOwner(asset) && <p className="text-blue-600 mt-1">You have this asset</p>}
                        </div>
                      )}
                      <div className="mt-auto">
                        {asset.isAvailable ? (
                          <button
                            onClick={() => checkoutAsset(asset.id)}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded font-medium"
                          >
                            {loading ? 'Processing...' : 'Check Out'}
                          </button>
                        ) : isOwner(asset) ? (
                          <button
                            onClick={() => returnAsset(asset.id)}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2 rounded font-medium"
                          >
                            {loading ? 'Processing...' : 'Return Asset'}
                          </button>
                        ) : (
                          <button disabled className="w-full bg-slate-100 text-slate-400 py-2 rounded font-medium cursor-not-allowed">
                            Unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {message && (
          <div className="fixed bottom-4 right-4 max-w-sm z-50">
            <div className={`${
              message.type === 'success'
                ? 'bg-green-600 border-green-500'
                : 'bg-red-600 border-red-500'
            } text-white px-4 py-3 rounded shadow-lg border`}>
              {message.text}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
