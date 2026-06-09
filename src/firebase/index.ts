'use client';

import { mutationEmitter } from './mutation-emitter';

// Mock auth object to maintain compatibility with existing client-side code
export const auth = {
  get currentUser() {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('shopx-user');
    if (!userStr) return null;
    try {
      const parsed = JSON.parse(userStr);
      return { uid: parsed.uid, email: parsed.email };
    } catch {
      return null;
    }
  }
};

export function initializeFirebase(): {
  app: any;
  firestore: any;
  auth: typeof auth;
} {
  return { app: {} as any, firestore: 'mongodb', auth };
}

export function getFirestore() {
  return 'mongodb';
}

// Virtual query structure helpers
export function collection(db: any, path: string) {
  return { type: 'collection', path };
}

export function doc(db: any, pathOrCollection: string, ...pathSegments: string[]) {
  const fullPath = [pathOrCollection, ...pathSegments].join('/');
  const segments = fullPath.split('/');
  return {
    type: 'doc',
    path: fullPath,
    collection: segments[0],
    id: segments[1],
  };
}

export function query(colRef: any, ...constraints: any[]) {
  return colRef;
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

// Database write wrappers using native API routes
export async function addDoc(colRef: any, data: any) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const res = await fetch(`/api/${colRef.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUser.uid,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || `Failed to add document to ${colRef.path}`);
  }

  const result = await res.json();
  mutationEmitter.emit(colRef.path);
  return { id: result.id };
}

export async function updateDoc(docRef: any, data: any) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const res = await fetch(`/api/${docRef.collection}/${docRef.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUser.uid,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || `Failed to update document ${docRef.collection}/${docRef.id}`);
  }

  const result = await res.json();
  mutationEmitter.emit(docRef.collection);
  return result;
}

export async function setDoc(docRef: any, data: any) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('User not authenticated');

  const res = await fetch(`/api/${docRef.collection}/${docRef.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUser.uid,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || `Failed to set document ${docRef.collection}/${docRef.id}`);
  }

  const result = await res.json();
  mutationEmitter.emit(docRef.collection);
  return result;
}

// ------------------------------------------------------------------
// Native MongoDB Authentication Helpers
// ------------------------------------------------------------------
export async function signInWithEmailAndPassword(dummyAuth: any, email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to authenticate');
  }

  const data = await res.json();
  localStorage.setItem('shopx-user', JSON.stringify({ uid: data.user.uid, email: data.user.email }));
  window.dispatchEvent(new CustomEvent('auth-state-change', { detail: data.user }));
  return { user: data.user };
}

export async function createUserWithEmailAndPassword(dummyAuth: any, email: string, password: string) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to sign up');
  }

  const data = await res.json();
  localStorage.setItem('shopx-user', JSON.stringify({ uid: data.user.uid, email: data.user.email }));
  window.dispatchEvent(new CustomEvent('auth-state-change', { detail: data.user }));
  return { user: data.user };
}

export async function signOut(dummyAuth?: any) {
  await fetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('shopx-user');
  window.dispatchEvent(new CustomEvent('auth-state-change', { detail: null }));
}

export * from './provider';
export * from './client-provider';
export * from '../app/auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
