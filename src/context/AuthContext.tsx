import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService, type Profile, isSupabaseConfigured, supabase } from '../services/dbService';


interface UserSession {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
}

interface AuthContextProps {
  user: Profile | null;
  role: 'user' | 'admin' | null;
  session: UserSession | null;
  isLoading: boolean;
  signUp: (email: string, password: string, username: string, fullName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  updateProfile: (updates: { full_name: string | null; username: string; avatar_url: string | null }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// LocalStorage key for mock auth sessions and users
const LS_MOCK_USERS = 'dreamvault_mock_auth_users';
const LS_MOCK_SESSION = 'dreamvault_mock_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          // Supabase Session Restoration
          const { data: { session: sbSession }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (sbSession) {
            const profile = await dbService.getProfile(sbSession.user.id);
            if (profile) {
              if (profile.suspended) {
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
                setRole(null);
              } else {
                const sess: UserSession = {
                  id: sbSession.user.id,
                  email: sbSession.user.email || '',
                  username: profile.username,
                  role: profile.role,
                };
                setSession(sess);
                setUser(profile);
                setRole(profile.role);
              }
            } else {
              // Session exists but profile doesn't. We'll sign out to allow clean re-auth.
              await supabase.auth.signOut();
              setSession(null);
              setUser(null);
              setRole(null);
            }
          } else {
            setSession(null);
            setUser(null);
            setRole(null);
          }
        } else {
          // Mock Session Restoration
          const localSess = localStorage.getItem(LS_MOCK_SESSION);
          if (localSess) {
            const parsed = JSON.parse(localSess) as UserSession;
            const profile = await dbService.getProfile(parsed.id);
            if (profile) {
              if (profile.suspended) {
                localStorage.removeItem(LS_MOCK_SESSION);
                setSession(null);
                setUser(null);
                setRole(null);
              } else {
                setSession(parsed);
                setUser(profile);
                setRole(profile.role);
              }
            }
          }
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Listen to Auth State Changes
    let authListener: any = null;
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
        if (event === 'SIGNED_IN' && sbSession) {
          const profile = await dbService.getProfile(sbSession.user.id);
          if (profile) {
            if (profile.suspended) {
              await supabase.auth.signOut();
            } else {
              const sess: UserSession = {
                id: sbSession.user.id,
                email: sbSession.user.email || '',
                username: profile.username,
                role: profile.role,
              };
              setSession(sess);
              setUser(profile);
              setRole(profile.role);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setRole(null);
        }
      });
      authListener = subscription;
    }

    return () => {
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, fullName: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // Supabase SignUp
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password,
          options: {
            data: {
              username: username.toLowerCase(),
              full_name: fullName,
            }
          }
        });

        if (error) throw error;

        // If session is returned immediately (email confirmation disabled or auto-confirmed)
        if (data.session) {
          // Create Profile in database
          const profile = await dbService.createProfile({
            id: data.user!.id,
            username: username.toLowerCase(),
            full_name: fullName,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            role: 'user',
          });

          // Initialize default Diary
          await dbService.createDiary(data.user!.id, `${fullName}'s Diary`);

          // Log action
          await dbService.createActivityLog(data.user!.id, 'Account registered and diary created');

          const sess: UserSession = {
            id: data.user!.id,
            email: email.toLowerCase(),
            username: username.toLowerCase(),
            role: 'user',
          };

          setSession(sess);
          setUser(profile);
          setRole('user');
        } else {
          // Email confirmation is required, session is null.
          // In this case we cannot write to public.profiles from here because the user is not signed in.
          // Instead, profile creation is deferred to the first successful login.
          throw new Error('VERIFY_EMAIL: Registration successful! Please check your email inbox to verify your account, then sign in.');
        }
      } else {
        // Mock SignUp
        const users = JSON.parse(localStorage.getItem(LS_MOCK_USERS) || '[]');
        if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('Email already registered');
        }
        if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
          throw new Error('Username already taken');
        }

        const newUserId = crypto.randomUUID();
        const newUser = {
          id: newUserId,
          email: email.toLowerCase(),
          password,
          username: username.toLowerCase(),
          full_name: fullName,
          role: 'user' as const,
        };

        users.push(newUser);
        localStorage.setItem(LS_MOCK_USERS, JSON.stringify(users));

        // Create Profile in database
        const profile = await dbService.createProfile({
          id: newUserId,
          username: username.toLowerCase(),
          full_name: fullName,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
          role: 'user',
        });

        // Initialize default Diary
        await dbService.createDiary(newUserId, `${fullName}'s Diary`);

        // Log action
        await dbService.createActivityLog(newUserId, 'Account registered and diary created');

        // Automatically log in
        const sess: UserSession = {
          id: newUserId,
          email: newUser.email,
          username: newUser.username,
          role: 'user',
        };

        localStorage.setItem(LS_MOCK_SESSION, JSON.stringify(sess));
        setSession(sess);
        setUser(profile);
        setRole('user');
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // Supabase login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('Unable to establish session. Please verify your email.');
        }

        // Fetch or create profile if it doesn't exist yet (first-time login after verification)
        let profile = await dbService.getProfile(data.user.id);
        if (!profile) {
          profile = await dbService.createProfile({
            id: data.user.id,
            username: data.user.user_metadata.username || email.split('@')[0],
            full_name: data.user.user_metadata.full_name || 'Journal User',
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user.id}`,
            role: 'user',
          });
          // Initialize default Diary
          await dbService.createDiary(data.user.id, `${profile.full_name}'s Diary`);
        }

        if (profile.suspended) {
          await supabase.auth.signOut();
          throw new Error('Your account has been suspended by an admin.');
        }

        const sess: UserSession = {
          id: data.user.id,
          email: data.user.email || '',
          username: profile.username,
          role: profile.role,
        };

        setSession(sess);
        setUser(profile);
        setRole(profile.role);

        await dbService.createActivityLog(data.user.id, 'User logged in successfully');
      } else {
        // Mock Login
        const users = JSON.parse(localStorage.getItem(LS_MOCK_USERS) || '[]');
        const matched = users.find(
          (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!matched) {
          throw new Error('Invalid email or password');
        }

        const profile = await dbService.getProfile(matched.id);
        if (!profile) {
          throw new Error('Profile not found');
        }

        if (profile.suspended) {
          throw new Error('Your account has been suspended by an admin.');
        }

        const sess: UserSession = {
          id: matched.id,
          email: matched.email,
          username: matched.username,
          role: profile.role,
        };

        localStorage.setItem(LS_MOCK_SESSION, JSON.stringify(sess));
        setSession(sess);
        setUser(profile);
        setRole(profile.role);

        await dbService.createActivityLog(matched.id, 'User logged in successfully');
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const adminLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // Supabase admin login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('Unable to establish admin session.');
        }

        const profile = await dbService.getProfile(data.user.id);
        if (!profile || profile.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error('Not authorized as an admin');
        }

        const sess: UserSession = {
          id: data.user.id,
          email: data.user.email || '',
          username: profile.username,
          role: 'admin',
        };

        setSession(sess);
        setUser(profile);
        setRole('admin');

        await dbService.createActivityLog(data.user.id, 'Admin logged in to Dashboard');
      } else {
        // Mock Admin Login
        const users = JSON.parse(localStorage.getItem(LS_MOCK_USERS) || '[]');
        
        let matched = users.find(
          (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.role === 'admin'
        );

        if (!matched && email.toLowerCase() === 'admin@dreamvault.com' && password === 'admin123') {
          const adminId = crypto.randomUUID();
          const newAdmin = {
            id: adminId,
            email: 'admin@dreamvault.com',
            password: 'admin123',
            username: 'admin',
            full_name: 'System Administrator',
            role: 'admin' as const,
          };
          users.push(newAdmin);
          localStorage.setItem(LS_MOCK_USERS, JSON.stringify(users));

          await dbService.createProfile({
            id: adminId,
            username: 'admin',
            full_name: 'System Administrator',
            avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin',
            role: 'admin',
          });

          matched = newAdmin;
        }

        if (!matched) {
          throw new Error('Invalid admin credentials');
        }

        const profile = await dbService.getProfile(matched.id);
        if (!profile || profile.role !== 'admin') {
          throw new Error('Not authorized as an admin');
        }

        const sess: UserSession = {
          id: matched.id,
          email: matched.email,
          username: matched.username,
          role: 'admin',
        };

        localStorage.setItem(LS_MOCK_SESSION, JSON.stringify(sess));
        setSession(sess);
        setUser(profile);
        setRole('admin');

        await dbService.createActivityLog(matched.id, 'Admin logged in to Dashboard');
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (session) {
      await dbService.createActivityLog(session.id, 'User logged out');
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LS_MOCK_SESSION);
    setSession(null);
    setUser(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } else {
      const users = JSON.parse(localStorage.getItem(LS_MOCK_USERS) || '[]');
      const matched = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      if (!matched) {
        throw new Error('Email address not registered');
      }
      await dbService.createActivityLog(matched.id, 'Password reset request generated');
    }
  };

  const verifyEmail = async () => {
    if (session) {
      await dbService.createActivityLog(session.id, 'Email address verified');
    }
  };

  const updateProfile = async (updates: { full_name: string | null; username: string; avatar_url: string | null }) => {
    if (!user) return;
    try {
      const updatedProfile = await dbService.updateProfile(user.id, updates);
      setUser(updatedProfile);
      
      // Sync mock user password and other data in LS_MOCK_USERS if mock mode
      if (!isSupabaseConfigured) {
        const users = JSON.parse(localStorage.getItem(LS_MOCK_USERS) || '[]');
        const idx = users.findIndex((u: any) => u.id === user.id);
        if (idx !== -1) {
          users[idx].username = updates.username;
          users[idx].fullName = updates.full_name;
          localStorage.setItem(LS_MOCK_USERS, JSON.stringify(users));
        }
      }

      if (session) {
        const newSession = { ...session, username: updates.username };
        setSession(newSession);
        if (!isSupabaseConfigured) {
          localStorage.setItem(LS_MOCK_SESSION, JSON.stringify(newSession));
        }
      }
      await dbService.createActivityLog(user.id, 'Updated user profile metadata');
    } catch (err: any) {
      throw err;
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    // Validate type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Unsupported format. Please use JPEG, PNG, WebP, or GIF.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Image too large. Maximum size is 2 MB.');
    }


    // Helper: read file as base64 data URL (used in mock mode and as Supabase fallback)
    const toBase64 = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

    let avatarUrl: string;

    if (isSupabaseConfigured && supabase) {
      try {
        // Try uploading to Supabase Storage (requires the "avatars" bucket to exist)
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) {
          // Check if the bucket simply doesn't exist yet — fall back to base64
          const isBucketMissing =
            uploadError.message?.toLowerCase().includes('bucket not found') ||
            uploadError.message?.toLowerCase().includes('not found') ||
            (uploadError as any).statusCode === 404 ||
            (uploadError as any).error === 'Bucket not found';

          if (isBucketMissing) {
            console.warn(
              '[DreamVault] Supabase "avatars" bucket not found. ' +
              'Run the storage SQL in schema.sql to create it. ' +
              'Falling back to base64 storage.'
            );
            avatarUrl = await toBase64();
          } else {
            throw new Error(uploadError.message);
          }
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      } catch (err: any) {
        // If it's already our thrown error, re-throw it
        if (err.message && !err.message.includes('bucket')) throw err;
        // Otherwise fall back to base64
        console.warn('[DreamVault] Supabase Storage unavailable, falling back to base64:', err.message);
        avatarUrl = await toBase64();
      }
    } else {
      // Mock mode: convert to base64 data URL stored in localStorage profile
      avatarUrl = await toBase64();
    }

    await updateProfile({
      full_name: user.full_name,
      username: user.username,
      avatar_url: avatarUrl,
    });

    await dbService.createActivityLog(user.id, 'Updated profile photo');
  };

  return (
    <AuthContext.Provider
      value={{ user, role, session, isLoading, signUp, login, adminLogin, logout, resetPassword, verifyEmail, updateProfile, uploadAvatar }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
