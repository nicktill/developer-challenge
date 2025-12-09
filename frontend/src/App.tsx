import React, { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import "./App.css";

interface Asset {
  id: number;
  isAvailable: boolean;
  currentHolder: string;
  checkoutTime: number;
}

type UserId = "member0" | "member1";

const USER_ADDRESSES = {
  member0: "0xf56dfc48a146b9b4511465ecbf7f4b4e7308ce5a", // Peter
  member1: "0x58521a46882c3049f392a9022204e47201ca7ca4", // Madison
};

const USER_NAMES = {
  member0: "Peter", 
  member1: "Madison"
};

function App() {
  const [currentUser, setCurrentUser] = useState<UserId>("member0");
  const [userName, setUserName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetCount, setAssetCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper functions
  const getUserAddress = useCallback(() => USER_ADDRESSES[currentUser], [currentUser]);
  const getUserDisplayName = useCallback(() => USER_NAMES[currentUser], [currentUser]);

  const apiCall = async (endpoint: string, method = 'GET', body?: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: method !== 'GET' ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error);
        return null;
      }
      return data;
    } catch (err: any) {
      setErrorMsg(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async () => {
    if (!userName.trim()) {
      setErrorMsg("Please enter a name");
      return;
    }

    const result = await apiCall('/api/user/register', 'POST', {
      userId: currentUser,
      name: userName,
    });

    if (result) {
      setIsRegistered(true);
      setSuccessMsg(`Registered as ${userName}!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const createAsset = async () => {
    const result = await apiCall('/api/asset/register', 'POST', { userId: currentUser });
    if (result) {
      setSuccessMsg("Asset created successfully!");
      setTimeout(() => {
        setSuccessMsg(null);
        fetchAssets();
      }, 1000);
    }
  };

  const checkoutAsset = async (assetId: number) => {
    const result = await apiCall('/api/asset/checkout', 'POST', { userId: currentUser, assetId });
    if (result) {
      setSuccessMsg(`Asset #${assetId} checked out!`);
      setTimeout(() => {
        setSuccessMsg(null);
        fetchAssets();
      }, 1000);
    }
  };

  const returnAsset = async (assetId: number) => {
    const result = await apiCall('/api/asset/return', 'POST', { userId: currentUser, assetId });
    if (result) {
      setSuccessMsg(`Asset #${assetId} returned!`);
      setTimeout(() => {
        setSuccessMsg(null);
        fetchAssets(); // refresh to see the change
      }, 1000);
    }
  };

  const fetchAssetDetails = useCallback(async (assetId: number): Promise<Asset | null> => {
    try {
      const res = await fetch(`/api/asset/${assetId}`);
      const data = await res.json();
      return {
        id: parseInt(data.output.id),
        isAvailable: data.output.isAvailable,
        currentHolder: data.output.currentHolder,
        checkoutTime: parseInt(data.output.checkoutTime),
      };
    } catch (err) {
      console.error(`Error fetching asset ${assetId}:`, err);
      return null;
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/assets/count');
      const data = await res.json();
      const count = parseInt(data.output);
      setAssetCount(count);
      
      if (count > 0) {
        const assetPromises = Array.from({ length: count }, (_, i) => 
          fetchAssetDetails(i + 1)
        );
        const fetchedAssets = await Promise.all(assetPromises);
        setAssets(fetchedAssets.filter(Boolean) as Asset[]);
      } else {
        setAssets([]);
      }
    } catch (err) {
      console.error("Error fetching assets:", err);
    }
  }, [fetchAssetDetails]);

  const checkUserRegistration = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/${getUserAddress()}`);
      const data = await res.json();
      
      if (res.ok && data.output?.length > 0) {
        setIsRegistered(true);
        setUserName(data.output);
      } else {
        setIsRegistered(false);
        setUserName("");
      }
    } catch (err) {
      console.error("Error checking user registration:", err);
      setIsRegistered(false);
      setUserName("");
    }
  }, [getUserAddress]);

  // Load data on mount and user change
  useEffect(() => {
    checkUserRegistration();
    fetchAssets();
  }, [currentUser, checkUserRegistration, fetchAssets]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    console.log('Connecting to WebSocket server...');
    const socket: Socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    // Listen for blockchain events and refresh assets
    const handleBlockchainEvent = (eventData: any) => {
      console.log('Received blockchain event:', eventData.name);
      fetchAssets(); // Refresh assets when any blockchain event occurs
    };

    socket.on('AssetRegistered', handleBlockchainEvent);
    socket.on('AssetCheckedOut', handleBlockchainEvent);
    socket.on('AssetReturned', handleBlockchainEvent);
    socket.on('UserRegistered', handleBlockchainEvent);
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket connection...');
      socket.disconnect();
    };
  }, [fetchAssets]);

  const isOwner = (asset: Asset) => 
    asset.currentHolder.toLowerCase() === getUserAddress().toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src="/kaleido_logo.svg"
                className={`h-10 w-10 ${loading ? 'animate-spin' : ''}`}
                alt="Kaleido Logo"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">Asset Checkout System</h1>
                <p className="text-sm text-blue-200">Powered by Kaleido FireFly</p>
              </div>
            </div>
            
            {/* User Selector */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-blue-200">Current User</p>
                <p className="text-white font-medium">{getUserDisplayName()}</p>
                <p className="text-xs text-blue-300">{getUserAddress().slice(0, 16)}...</p>
              </div>
              <div className="flex space-x-2">
                <select
                  value={currentUser}
                  onChange={(e) => setCurrentUser(e.target.value as UserId)}
                  className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  <option value="member0" className="bg-slate-800">Peter (Member 0)</option>
                  <option value="member1" className="bg-slate-800">Madison (Member 1)</option>
                </select>
                <button
                  onClick={() => {
                    setIsRegistered(false);
                    setUserName("");
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-2 rounded-lg"
                  title="Reset user registration for demo"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Registration */}
        {!isRegistered && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-md border border-amber-400/30 rounded-xl p-8 mb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👤</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Register as {getUserDisplayName()}</h2>
              <p className="text-amber-200">Enter your display name to start managing assets</p>
            </div>
            
            <div className="max-w-md mx-auto">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={`Display name for ${getUserDisplayName()}`}
                  className="flex-1 bg-white/10 border border-white/20 text-white px-4 py-3 rounded-lg placeholder-gray-300 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                />
                <button
                  onClick={registerUser}
                  disabled={loading || !userName.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
                >
                  {loading ? '⏳' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Registered User Interface */}
        {isRegistered && (
          <div className="space-y-8">
            {/* Welcome & Stats */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-xl">✅</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Welcome, {userName}!</h3>
                    <p className="text-blue-200">Registered as {getUserDisplayName()}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg px-4 py-2">
                    <p className="text-sm text-blue-200">Total Assets</p>
                    <p className="text-2xl font-bold text-white">{assetCount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Asset Button */}
            <div className="text-center">
              <button
                onClick={createAsset}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <span className="flex items-center space-x-2">
                  <span className="text-xl">➕</span>
                  <span>Create New Asset</span>
                </span>
              </button>
            </div>

            {/* Assets Grid */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
                <span>📦</span>
                <span>Asset Management</span>
                {loading && <span className="text-lg animate-pulse">⏳</span>}
              </h2>
              
              {assets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📦</div>
                  <p className="text-gray-400 text-lg">No assets available yet</p>
                  <p className="text-gray-500">Create your first asset to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className={`backdrop-blur-md border rounded-xl p-6 transition-all duration-200 hover:scale-105 ${
                        asset.isAvailable 
                          ? 'bg-green-500/10 border-green-400/30 hover:shadow-green-400/20' 
                          : 'bg-red-500/10 border-red-400/30 hover:shadow-red-400/20'
                      } hover:shadow-xl`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">Asset #{asset.id}</h3>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`w-3 h-3 rounded-full ${asset.isAvailable ? 'bg-green-400' : 'bg-red-400'}`}></span>
                            <span className={`font-medium ${asset.isAvailable ? 'text-green-300' : 'text-red-300'}`}>
                              {asset.isAvailable ? 'Available' : 'Checked Out'}
                            </span>
                          </div>
                          {!asset.isAvailable && (
                            <div className="text-sm text-gray-400">
                              <p>Holder: {asset.currentHolder.slice(0, 16)}...</p>
                              {isOwner(asset) && (
                                <p className="text-blue-300 font-medium">👤 You own this asset</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-white/10">
                        {asset.isAvailable ? (
                          <button
                            onClick={() => checkoutAsset(asset.id)}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                          >
                            {loading ? '⏳ Processing...' : '🔓 Check Out'}
                          </button>
                        ) : isOwner(asset) ? (
                          <button
                            onClick={() => returnAsset(asset.id)}
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors duration-200"
                          >
                            {loading ? '⏳ Processing...' : '🔒 Return Asset'}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full bg-gray-600 cursor-not-allowed text-gray-300 font-semibold py-3 rounded-lg"
                          >
                            🚫 Unavailable
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

        {/* Messages */}
        {(successMsg || errorMsg) && (
          <div className="fixed bottom-4 right-4 max-w-sm z-50">
            {successMsg && (
              <div className="bg-green-500/90 backdrop-blur-md text-white p-4 rounded-lg shadow-lg mb-2 border border-green-400/30">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">✅</span>
                  <span>{successMsg}</span>
                </div>
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-lg shadow-lg border border-red-400/30">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">❌</span>
                  <div>
                    <p className="font-semibold">Error</p>
                    <pre className="text-sm opacity-90 whitespace-pre-wrap">{errorMsg}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
