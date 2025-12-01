
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LANDING);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

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

  // Routing
  if (view === ViewState.SETUP) {
      return <Setup errorType={setupError} onSkip={handleSkip} />;
  }

  if (!user) {
    if (view === ViewState.LANDING && setupError === "CONNECTION_ERROR") {
        return <Auth onLogin={handleLogin} onSignup={handleSignup} />;
    }
    return <Auth onLogin={handleLogin} onSignup={handleSignup} />;
  }

  try {
      switch (view) {
        case ViewState.ADMIN:
            return user.role === Role.ADMIN ? <Admin onLogout={handleLogout} /> : <div className="p-4">Unauthorized</div>;
        case ViewState.CHAT:
            return <Chat currentUser={user} onExit={() => setView(ViewState.DASHBOARD)} />;
        case ViewState.PROFILE:
            return <Profile user={user} onBack={() => setView(ViewState.DASHBOARD)} onUpdate={(u) => setUser(u)} />;
        case ViewState.DASHBOARD:
        default:
            return <Dashboard user={user} onNavigate={setView} onLogout={handleLogout} />;
      }
  } catch (err) {
      // Fallback UI if rendering crashes
      return (
          <div className="p-8 text-center">
              <h2 className="text-xl font-bold mb-4">Something went wrong.</h2>
              <button onClick={() => window.location.reload()} className="bg-nepaliRed text-white px-4 py-2 rounded">Reload App</button>
          </div>
      );
  }
};

export default App;
