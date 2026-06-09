'use client';

import { useState, useEffect } from 'react';

export function useUser() {
  const [user, setUser] = useState<{ uid: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Load initial user state from localStorage
    const storedUser = localStorage.getItem('shopx-user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }

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
        } else {
          if (isMounted) {
            setUser(null);
            localStorage.removeItem('shopx-user');
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
