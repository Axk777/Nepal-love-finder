
import React, { useState, useEffect } from 'react';
import { User, Role, ViewState } from './types';
import { apiLogin, apiSignup, apiLogout, apiCheckDatabase, apiHeartbeat } from './services/mockBackend';
import { supabase } from './supabaseClient';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Setup } from './pages/Setup';
import { Icons } from './components/UI';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LANDING);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [showDownloadPopup, setShowDownloadPopup] = useState(true);

  // Safe Error Handling helper
  const safeError = (e: any) => {
      if (typeof e === 'string') return e;
      if (e && e.message) return e.message;
      return "Unknown Error";
  };

  // Restore session from Supabase on mount
  useEffect(() => {
    const init = async () => {
      // 1. Check DB health first
      try {
        await apiCheckDatabase();
      } catch (e: any) {
        const msg = safeError(e);
        if (msg === "MISSING_TABLES" || msg === "CONNECTION_ERROR" || msg === "SCHEMA_MISMATCH") {
            setSetupError(msg);
            setView(ViewState.SETUP);
            setLoading(false);
            return;
        }
      }

      // 2. Check Session (Only if DB check passed)
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            // Fetch full profile
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (profile) {
                const mappedUser: User = {
                    id: profile.id,
                    displayName: profile.display_name,
                    age: profile.age,
                    role: profile.role,
                    email: profile.email,
                    online: profile.online,
                    lastSeen: profile.last_seen,
                    blockedUsers: profile.blocked_users || [],
                    isBanned: profile.is_banned,
                    bio: profile.bio,
                    photoUrl: profile.photo_url,
                    interests: profile.interests
                };
                setUser(mappedUser);
                if (mappedUser.role === Role.ADMIN) setView(ViewState.ADMIN);
                else setView(ViewState.DASHBOARD);
                
                // Immediately update status
                apiHeartbeat(mappedUser.id);
            }
          }
      } catch (e) {
          console.warn("Session check failed", e);
      }
      setLoading(false);
    };

    init();
  }, []);

  // Heartbeat interval & Force Logout Check
  useEffect(() => {
      if (!user) return;
      const interval = setInterval(async () => {
          const alive = await apiHeartbeat(user.id);
          // If heartbeat returns false, it means the user was deleted from DB (e.g. Admin Reset)
          if (!alive) {
              console.warn("User profile not found. Force logout.");
              handleLogout();
          }
      }, 30000); // Every 30s
      return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async (email: string, pass: string) => {
    try {
        const u = await apiLogin(email, pass);
        setUser(u);
        if (u.role === Role.ADMIN) setView(ViewState.ADMIN);
        else setView(ViewState.DASHBOARD);
        return u;
    } catch (e: any) {
        if (e.message === "SCHEMA_MISMATCH") {
             setSetupError("SCHEMA_MISMATCH");
             setView(ViewState.SETUP);
             throw e; // Re-throw to stop auth component from clearing error
        }
        throw e;
    }
  };

  const handleSignup = async (data: any) => {
    try {
        const u = await apiSignup(data);
        setUser(u);
        setView(ViewState.DASHBOARD);
        return u;
    } catch (e: any) {
         if (e.message === "SCHEMA_MISMATCH") {
             setSetupError("SCHEMA_MISMATCH");
             setView(ViewState.SETUP);
             throw e;
        }
        throw e;
    }
  };

  const handleLogout = async () => {
    if (user) await apiLogout(user.id);
    setUser(null);
    setView(ViewState.LANDING);
  };

  // Skip handler for offline/demo mode
  const handleSkip = () => {
      setView(ViewState.LANDING);
      setLoading(false);
      // Create a fake offline user for UI testing if needed
  };

  if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-nepaliRed font-bold animate-pulse text-xl">Loading App...</div>
        </div>
      );
  }

  // Define main content based on state
  let content;
  if (view === ViewState.SETUP) {
      content = <Setup errorType={setupError} onSkip={handleSkip} />;
  } else if (!user) {
    if (view === ViewState.LANDING && setupError === "CONNECTION_ERROR") {
        content = <Auth onLogin={handleLogin} onSignup={handleSignup} />;
    } else {
        content = <Auth onLogin={handleLogin} onSignup={handleSignup} />;
    }
  } else {
      try {
          switch (view) {
            case ViewState.ADMIN:
                content = user.role === Role.ADMIN ? <Admin onLogout={handleLogout} /> : <div className="p-4">Unauthorized</div>;
                break;
            case ViewState.CHAT:
                content = <Chat currentUser={user} onExit={() => setView(ViewState.DASHBOARD)} />;
                break;
            case ViewState.PROFILE:
                content = <Profile user={user} onBack={() => setView(ViewState.DASHBOARD)} onUpdate={(u) => setUser(u)} />;
                break;
            case ViewState.DASHBOARD:
            default:
                content = <Dashboard user={user} onNavigate={setView} onLogout={handleLogout} />;
                break;
          }
      } catch (err) {
          content = (
              <div className="p-8 text-center">
                  <h2 className="text-xl font-bold mb-4">Something went wrong.</h2>
                  <button onClick={() => window.location.reload()} className="bg-nepaliRed text-white px-4 py-2 rounded">Reload App</button>
              </div>
          );
      }
  }

  return (
    <>
      {showDownloadPopup && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-nepaliRed to-pink-600"></div>
               <button
                 onClick={() => setShowDownloadPopup(false)}
                 className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
               >
                 <Icons.X className="w-5 h-5" />
               </button>
    
               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-blue-100/50">
                  <Icons.Download className="w-8 h-8 text-nepaliBlue" />
               </div>
    
               <h2 className="text-xl font-bold text-gray-800 mb-2">Need Application Version</h2>
               <p className="text-sm text-gray-600 mb-6 leading-relaxed px-2">
                 For the best experience, download our latest Android APK. It's faster and smoother!
               </p>
    
               <a
                 href="https://www.mediafire.com/file/3p2u4779phcrnbe/app-release_%25281%2529.apk/file"
                 target="_blank"
                 rel="noreferrer"
                 className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-nepaliRed to-pink-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] transition-all mb-4"
                 onClick={() => setShowDownloadPopup(false)}
               >
                 <Icons.Download className="w-5 h-5" />
                 Download APK
               </a>
    
               <button
                 onClick={() => setShowDownloadPopup(false)}
                 className="text-xs text-gray-400 hover:text-gray-700 font-bold uppercase tracking-wider transition-colors"
               >
                 Continue on Web
               </button>
            </div>
        </div>
      )}
      {content}
    </>
  );
};

export default App;
