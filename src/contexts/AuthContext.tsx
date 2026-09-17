import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User, Role } from '../types.ts';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  role: Role;
  loading: boolean;
  demoRole: Role | null;
  signInWithGoogle: () => Promise<void>;
  switchDemoRole: (role: Role) => void;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [demoRole, setDemoRole] = useState<Role | null>('librarian'); // Mặc định mở vai trò Thủ thư để tiện trải nghiệm ngay
  const [loading, setLoading] = useState<boolean>(true);

  // Lấy header xác thực (ưu tiên Bearer token nếu đã đăng nhập Google, nếu không dùng demo persona)
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    if (demoRole) {
      return { 'x-demo-role': demoRole };
    }
    return {};
  };

  const syncUserWithBackend = async (fbUser?: FirebaseUser) => {
    try {
      let headers: Record<string, string> = {};
      if (fbUser) {
        const token = await fbUser.getIdToken();
        headers = { Authorization: `Bearer ${token}` };
      } else if (demoRole) {
        headers = { 'x-demo-role': demoRole };
      }

      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Không thể đồng bộ hồ sơ người dùng:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        setDemoRole(null);
        await syncUserWithBackend(currentUser);
      } else {
        // Nếu không có tài khoản Google, sử dụng demo persona để người dùng luôn có trải nghiệm mượt mà
        await syncUserWithBackend();
      }
    });

    return () => unsubscribe();
  }, [demoRole]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleAuthProvider);
      setFirebaseUser(result.user);
      setDemoRole(null);
      await syncUserWithBackend(result.user);
    } catch (error: any) {
      console.error('Lỗi đăng nhập Google:', error);
      alert(`Đăng nhập Google không thành công: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const switchDemoRole = async (newRole: Role) => {
    setLoading(true);
    setFirebaseUser(null);
    setDemoRole(newRole);
    // syncUserWithBackend sẽ được trigger qua dependency useEffect
  };

  const signOut = async () => {
    try {
      if (firebaseUser) {
        await firebaseSignOut(auth);
      }
      setFirebaseUser(null);
      setDemoRole('student'); // Sau khi logout chuyển về giao diện sinh viên
      setUser(null);
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
    }
  };

  const refreshProfile = async () => {
    await syncUserWithBackend(firebaseUser || undefined);
  };

  const currentRole: Role = user?.role || demoRole || 'student';

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role: currentRole,
        loading,
        demoRole,
        signInWithGoogle,
        switchDemoRole,
        signOut,
        getAuthHeaders,
        refreshProfile,
      }}
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
