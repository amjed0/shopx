'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function useUser() {
  const { data: session } = useSession();

  const [user, setUser] = useState<{ uid: string; email: string } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('shopx-user');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return !localStorage.getItem('shopx-user');
      } catch {}
    }
    return true;
  });

  // Immediately populate user when NextAuth session is ready without waiting for /api/auth/me
  useEffect(() => {
    if (session?.user) {
      const id = (session.user as any).id || (session.user as any).uid || '';
      const email = session.user.email || '';
      if (id) {
        const sessionUser = { uid: id, email };
        setUser(sessionUser);
        setLoading(false);
        try {
          localStorage.setItem('shopx-user', JSON.stringify(sessionUser));
        } catch {}
      }
    }
  }, [session]);

  useEffect(() => {
    let isMounted = true;

    // Verify session with the backend API
    async function verifySession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.user) {
            const updatedUser = { uid: data.user.uid, email: data.user.email };
            setUser(updatedUser);
            localStorage.setItem('shopx-user', JSON.stringify(updatedUser));
          }
        }
      } catch (err) {
        // Keep localStorage fallback if network fails
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verifySession();

    // Event listener for auth state updates across components
    const handleAuthStateChange = (e: any) => {
      if (isMounted) {
        setUser(e.detail);
        setLoading(false);
      }
    };

    window.addEventListener('auth-state-change', handleAuthStateChange);

    return () => {
      isMounted = false;
      window.removeEventListener('auth-state-change', handleAuthStateChange);
    };
  }, []);

  return { user, loading };
}
