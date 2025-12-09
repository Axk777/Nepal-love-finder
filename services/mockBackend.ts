import { User, Role, Match, Message, Report, Announcement } from '../types';
import { supabase } from '../supabaseClient';
import { rtdb, logAnalyticsEvent } from '../firebaseClient'; 
import { ref, set, onDisconnect, get } from "firebase/database";
import { MAX_AGE_GAP, MIN_AGE, PROFANITY_LIST, SYSTEM_USER_ID, MESSAGE_TTL } from '../constants';

// --- Helpers to map Supabase snake_case to TS camelCase ---

const mapUser = (data: any): User => ({
  id: data.id,
  displayName: data.display_name,
  age: data.age,
  role: data.role as Role,
  email: data.email,
  bio: data.bio || '',
  photoUrl: data.photo_url || '',
  interests: data.interests || [],
  favorites: data.favorites || [],
  fcmToken: data.fcm_token,
  online: data.online,
  lastSeen: data.last_seen,
  blockedUsers: data.blocked_users || [],
  isBanned: data.is_banned
});

const mapMatch = (data: any): Match => ({
  id: data.id,
  userA: data.user_a,
  userB: data.user_b,
  createdAt: data.created_at,
  chatRoomId: data.chat_room_id,
  active: data.active
});

const mapMessage = (data: any): Message => ({
  id: data.id,
  chatRoomId: data.chat_room_id,
  fromUserId: data.from_user_id,
  text: data.text,
  timestamp: data.timestamp,
  isSystem: data.is_system
});

const mapReport = (data: any): Report => ({
  id: data.id,
  targetUserId: data.target_user_id,
  reporterUserId: data.reporter_user_id,
  reason: data.reason,
  timestamp: data.timestamp,
  resolved: data.resolved
});

const mapAnnouncement = (data: any): Announcement => ({
    id: data.id,
    text: data.text,
    active: data.active,
    createdAt: data.created_at
});

// --- System Checks ---

export const apiCheckDatabase = async () => {
    let retries = 3;
    while (retries > 0) {
        try {
            // Check for table existence
            const { error } = await supabase.from('profiles').select('id').limit(1);
            if (error) {
                 const msg = error.message || '';
                 const code = error.code || '';
                 if (
                    msg.includes('relation "public.profiles" does not exist') || 
                    msg.includes('Could not find the table') || 
                    code === '42P01' || 
                    code === 'PGRST200'
                ) {
                     throw new Error("MISSING_TABLES");
                }
                throw error;
            }

            // Check for schema/column updates (Migrations)
            const { error: colError } = await supabase.from('profiles').select('interests, favorites, fcm_token').limit(1);
            if (colError && (colError.message.includes('Could not find the') || colError.code === 'PGRST200')) {
                throw new Error("SCHEMA_MISMATCH");
            }
            
            return; // Success

        } catch (err: any) {
            const msg = err.message || JSON.stringify(err);
            if (msg === "MISSING_TABLES") throw new Error("MISSING_TABLES");
            if (msg === "SCHEMA_MISMATCH") throw new Error("SCHEMA_MISMATCH");

            // Ignore network errors for retry
            if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
                // Just continue to retry loop
            } else {
                 // Throw other unknown errors immediately (or log them)
                 // console.warn("Unknown DB Error", err);
            }

            if (retries <= 1) throw new Error("CONNECTION_ERROR");

            await new Promise(r => setTimeout(r, 1000));
        }
        retries--;
    }
};

// --- Heartbeat (Hybrid: Firebase + Supabase) ---
export const apiHeartbeat = async (userId: string) => {
    if (!userId) return false;
    
    // 1. Write to Firebase (Fast)
    // Wrapped in try/catch to ensure app doesn't crash if Firebase is mocked or fails
    try {
        const userStatusRef = ref(rtdb, 'status/' + userId);
        set(userStatusRef, {
            state: 'online',
            last_changed: Date.now(),
        });
        onDisconnect(userStatusRef).set({
            state: 'offline',
            last_changed: Date.now(),
        });
    } catch (e) {
        // Ignore firebase errors
    }

    try {
        // 2. Keep Supabase update for legacy compatibility (Matchmaking needs it)
        const { error } = await supabase.from('profiles').update({
            last_seen: Date.now(),
            online: true
        }).eq('id', userId);
        
        if (error) return false;
        return true;
    } catch (e) {
        return false;
    }
};

export const apiGetOnlineCountAsync = async () => {
    try {
        // Try Firebase First
        const snapshot = await get(ref(rtdb, 'status'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            let count = 0;
            const threshold = Date.now() - (120 * 1000); // 2 mins
            Object.values(data).forEach((s: any) => {
                if (s.state === 'online' || s.last_changed > threshold) count++;
            });
            return count > 0 ? count : 1;
        }
        throw new Error("Firebase empty");
    } catch(e) {
        // Fallback to Supabase
        const threshold = Date.now() - (90 * 1000);
        const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('last_seen', threshold);
        return count && count > 0 ? count : 1;
    }
};

// --- Auth Services ---

export const apiSignup = async (data: Partial<User>): Promise<User> => {
  if (!data.email || !data.password) throw new Error("Missing email or password");
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  let userId = authData.user?.id;

  if (authError) {
      if (authError.message.includes("already registered") || authError.status === 400) {
          console.log("User exists, attempting recovery via login...");
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
              email: data.email,
              password: data.password
          });

          if (loginError) {
             if (loginError.message.includes("Email not confirmed")) {
                 throw new Error("EMAIL_NOT_CONFIRMED");
             }
             throw new Error("Account already exists. Please log in.");
          }

          userId = loginData.user?.id;
          if (!userId) throw new Error("Login failed during recovery.");

          const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (existingProfile) return mapUser(existingProfile);
      } else {
          throw authError;
      }
  }
  
  if (!userId) {
      if (authData && !authData.session) {
          throw new Error("EMAIL_NOT_CONFIRMED");
      }
      throw new Error("Signup failed");
  }

  // MAGIC ADMIN RULE: If email is admin@admin.com, make them Admin.
  const assignedRole = data.email === 'admin@admin.com' ? Role.ADMIN : data.role;

  const newUserProfile = {
    id: userId,
    display_name: data.displayName,
    age: data.age,
    role: assignedRole,
    email: data.email,
    bio: data.bio || '',
    photo_url: data.photoUrl || `https://picsum.photos/seed/${userId}/200`,
    interests: [],
    favorites: [],
    online: true,
    last_seen: Date.now(),
    blocked_users: [],
    is_banned: false
  };

  const { error: profileError } = await supabase.from('profiles').upsert(newUserProfile);

  if (profileError) {
    if (profileError.message.includes('relation "public.profiles" does not exist') ||
        profileError.message.includes('Could not find the table')) {
        throw new Error("DATABASE ERROR: Tables missing. Please run the SQL script in your Supabase Dashboard.");
    }
    if (profileError.message.includes("Could not find the") && profileError.message.includes("column")) {
         throw new Error("SCHEMA_MISMATCH");
    }
    throw profileError;
  }
  
  logAnalyticsEvent('sign_up', { method: 'email' });

  return mapUser(newUserProfile);
};

export const apiLogin = async (email: string, pass: string): Promise<User> => {
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });

  if (error) {
      if (error.message.includes("Email not confirmed")) {
          throw new Error("EMAIL_NOT_CONFIRMED");
      }
      if (email === 'admin@admin.com') {
          throw new Error("Admin account not found. Please switch to Sign Up to create it.");
      }
      throw error;
  }
  if (!authData.user) throw new Error("Login failed");

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
      if (profileError.message.includes('relation "public.profiles" does not exist') ||
          profileError.message.includes('Could not find the table')) {
          throw new Error("DATABASE ERROR: Tables missing.");
      }
      if (profileError.code === 'PGRST116') {
           const defaultProfile = {
                id: authData.user.id,
                display_name: email.split('@')[0],
                age: 18,
                role: email === 'admin@admin.com' ? Role.ADMIN : Role.KTA, 
                email: email,
                online: true,
                last_seen: Date.now()
           };
           await supabase.from('profiles').upsert(defaultProfile);
           return mapUser(defaultProfile);
      }
      throw profileError;
  }

  try {
      await supabase.from('profiles').update({ online: true, last_seen: Date.now() }).eq('id', authData.user.id);
  } catch (e) {
      console.warn("Failed to update last_seen on login", e);
  }
  
  logAnalyticsEvent('login', { method: 'email' });
  
  return mapUser(profile);
};

export const apiLogout = async (userId: string) => {
    if (userId === "offline") return; 
    try {
        await supabase.from('profiles').update({ online: false, last_seen: Date.now() }).eq('id', userId);
        
        // Update Firebase Presence
        // Try/Catch to handle mock/failure without blocking logout
        try {
            const userStatusRef = ref(rtdb, 'status/' + userId);
            set(userStatusRef, { state: 'offline', last_changed: Date.now() });
        } catch (e) {
            // ignore
        }

        await supabase.auth.signOut();
    } catch(e) {
        console.warn("Logout error", e);
    }
};

export const apiUpdateProfile = async (userId: string, updates: Partial<User>): Promise<User> => {
  const dbUpdates: any = {};
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
  if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
  if (updates.age !== undefined) dbUpdates.age = updates.age;
  if (updates.interests !== undefined) dbUpdates.interests = updates.interests;
  if (updates.favorites !== undefined) dbUpdates.favorites = updates.favorites;
  if (updates.fcmToken !== undefined) dbUpdates.fcm_token = updates.fcmToken;
  
  const { data, error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
      if (error.message.includes("Could not find the") && (error.message.includes('interests') || error.message.includes('favorites') || error.message.includes('fcm_token'))) {
         throw new Error("SCHEMA_MISMATCH");
      }
      throw error;
  }
  return mapUser(data);
};

export const apiToggleFavorite = async (userId: string, targetId: string): Promise<User> => {
    const { data: user } = await supabase.from('profiles').select('favorites').eq('id', userId).single();
    const currentFavorites: string[] = user?.favorites || [];
    
    let newFavorites;
    if (currentFavorites.includes(targetId)) {
        newFavorites = currentFavorites.filter(id => id !== targetId);
    } else {
        if (currentFavorites.length >= 3) {
            throw new Error("You can only have up to 3 favorites.");
        }
        newFavorites = [...currentFavorites, targetId];
    }
    
    return apiUpdateProfile(userId, { favorites: newFavorites });
};

export const apiGetFavorites = async (userId: string): Promise<User[]> => {
    const { data: user } = await supabase.from('profiles').select('favorites').eq('id', userId).single();
    const favIds: string[] = user?.favorites || [];
    
    if (favIds.length === 0) return [];
    
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', favIds);
    return (profiles || []).map(mapUser);
};

// --- Matching Services ---

export const apiFindMatch = async (currentUserId: string): Promise<Match | null> => {
  await apiHeartbeat(currentUserId);
  logAnalyticsEvent('search_started');

  const { data: existingMatch } = await supabase.from('matches')
      .select('*')
      .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
  
  if (existingMatch) {
      if (existingMatch.user_a === currentUserId && !existingMatch.user_b) {
          return null; 
      }
      return mapMatch(existingMatch);
  }

  const { data: me } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
  if (!me) throw new Error("Profile not found");
  
  const targetRole = me.role === Role.KTA ? Role.KTI : Role.KTA;
  const minAge = Math.max(MIN_AGE, me.age - MAX_AGE_GAP);
  const maxAge = me.age + MAX_AGE_GAP;
  
  const staleThreshold = Date.now() - (2 * 60 * 1000); 
  
  const { data: tickets } = await supabase.from('matches')
      .select('id, user_a, created_at')
      .is('user_b', null)
      .eq('active', true)
      .order('created_at', { ascending: true }) 
      .limit(20); 

  if (tickets && tickets.length > 0) {
      for (const ticket of tickets) {
          if (ticket.user_a === currentUserId) continue;

          const { data: waiter } = await supabase.from('profiles').select('*').eq('id', ticket.user_a).single();
          if (!waiter) continue;

          if (waiter.last_seen < staleThreshold) continue;
          
          if (waiter.role !== targetRole) continue;
          if (waiter.age < minAge || waiter.age > maxAge) continue;
          
          if ((me.blocked_users || []).includes(waiter.id)) continue;
          if ((waiter.blocked_users || []).includes(me.id)) continue;

          const { data: joinedMatch } = await supabase
              .from('matches')
              .update({ user_b: currentUserId })
              .eq('id', ticket.id)
              .is('user_b', null) 
              .select()
              .maybeSingle();
              
          if (joinedMatch) {
              await apiSendMessage(joinedMatch.chat_room_id, SYSTEM_USER_ID, "It's a match! Say Namaste. 🙏", true);
              logAnalyticsEvent('match_found');
              
              if (waiter.fcm_token) {
                  // Simulate Push
                  console.log(`[PUSH] Sending 'Match Found' to ${waiter.display_name}`);
              }
              
              return mapMatch(joinedMatch);
          }
      }
  }

  const chatRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  await supabase.from('matches').insert({
      user_a: currentUserId,
      user_b: null,
      created_at: Date.now(),
      chat_room_id: chatRoomId,
      active: true
  });

  return null; 
};

export const apiCancelSearch = async (userId: string) => {
    await supabase.from('matches')
        .delete()
        .eq('user_a', userId)
        .is('user_b', null)
        .eq('active', true);
};

export const apiGetActiveMatch = async (userId: string): Promise<{ match: Match, partner: User } | null> => {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('active', true)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .not('user_b', 'is', null) 
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const match = mapMatch(data);
  const partnerId = match.userA === userId ? match.userB : match.userA;

  const { data: partnerData } = await supabase.from('profiles').select('*').eq('id', partnerId).single();
  if (!partnerData) return null;

  return { match, partner: mapUser(partnerData) };
};

export const apiEndMatch = async (matchId: string) => {
  try {
      const { data: match } = await supabase.from('matches').select('chat_room_id').eq('id', matchId).maybeSingle();
      if (match && match.chat_room_id) {
        await supabase.from('messages').delete().eq('chat_room_id', match.chat_room_id);
      }
      await supabase.from('matches').update({ active: false }).eq('id', matchId);
  } catch(e) { }
};

// --- Chat Services ---

export const apiGetMessages = async (chatRoomId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_room_id', chatRoomId)
    .order('timestamp', { ascending: true });

  if (error) return [];
  return data.map(mapMessage);
};

export const subscribeToMessages = (chatRoomId: string, onMessage: (msg: Message | null) => void) => {
    return supabase
        .channel(`chat:${chatRoomId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${chatRoomId}` },
            (payload) => {
                onMessage(mapMessage(payload.new));
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${chatRoomId}` },
            (payload) => {
                 onMessage(null); // Signal refresh or deletion
            }
        )
        .subscribe();
};

const apiCleanupOldMessages = async (chatRoomId: string) => {
    const threshold = Date.now() - MESSAGE_TTL;
    await supabase.from('messages')
        .delete()
        .eq('chat_room_id', chatRoomId)
        .lt('timestamp', threshold);
};

export const apiSendMessage = async (chatRoomId: string, fromUserId: string, text: string, isSystem = false) => {
  apiCleanupOldMessages(chatRoomId);

  const cleanText = text.split(' ').map(word => {
    return PROFANITY_LIST.includes(word.toLowerCase()) ? '****' : word;
  }).join(' ');

  const { error } = await supabase.from('messages').insert({
      chat_room_id: chatRoomId,
      from_user_id: isSystem ? null : fromUserId, 
      text: cleanText,
      timestamp: Date.now(),
      is_system: isSystem
  });
  if (error) console.error("Send msg error", error);
  
  if (!isSystem && !error) {
      logAnalyticsEvent('send_message');
  }
};

// --- Safety Services ---

export const apiReportUser = async (reporterId: string, targetId: string, reason: string) => {
  await supabase.from('reports').insert({
      reporter_user_id: reporterId,
      target_user_id: targetId,
      reason,
      timestamp: Date.now(),
      resolved: false
  });
};

export const apiBlockUser = async (blockerId: string, targetId: string) => {
  const { data: user } = await supabase.from('profiles').select('blocked_users').eq('id', blockerId).single();
  const currentBlocks = user?.blocked_users || [];
  
  if (!currentBlocks.includes(targetId)) {
      const newBlocks = [...currentBlocks, targetId];
      await supabase.from('profiles').update({ blocked_users: newBlocks }).eq('id', blockerId);
  }

  const { data: match } = await supabase.from('matches')
    .select('id')
    .eq('active', true)
    .or(`user_a.eq.${blockerId},user_b.eq.${blockerId}`)
    .maybeSingle();

  if (match) {
      const fullMatch = await apiGetActiveMatch(blockerId);
      if (fullMatch && fullMatch.partner.id === targetId) {
          await apiEndMatch(fullMatch.match.id);
      }
  }
};

// --- Admin Services ---

export const apiGetAdminData = async () => {
  const { data: users } = await supabase.from('profiles').select('*');
  const { data: reports } = await supabase.from('reports').select('*');
  const { data: matches } = await supabase.from('matches').select('*');
  
  return {
      users: (users || []).map(mapUser),
      reports: (reports || []).map(mapReport),
      matches: (matches || []).map(mapMatch)
  };
};

export const apiBanUser = async (userId: string) => {
  await supabase.from('profiles').update({ is_banned: true, online: false }).eq('id', userId);
};

// --- Announcement Services ---

export const apiGetAnnouncement = async (): Promise<Announcement | null> => {
    try {
        const { data } = await supabase
            .from('announcements')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return data ? mapAnnouncement(data) : null;
    } catch (e) {
        return null;
    }
};

export const apiPostAnnouncement = async (text: string) => {
    await supabase.from('announcements').insert({
        text,
        active: true,
        created_at: Date.now()
    });
};

export const apiDeleteAnnouncement = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
};

// --- RESET SERVICES (Danger Zone) ---

export const apiResetAllData = async () => {
    try {
        await supabase.from('messages').delete().neq('chat_room_id', 'cleanup'); 
        await supabase.from('matches').delete().neq('chat_room_id', 'cleanup');
        await supabase.from('reports').delete().neq('reason', 'cleanup');
        await supabase.from('announcements').delete().neq('text', 'cleanup');
        await supabase.from('profiles').delete().neq('email', 'cleanup');
        return true;
    } catch (e) {
        console.error("Reset failed", e);
        return false;
    }
};
