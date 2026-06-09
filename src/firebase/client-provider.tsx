'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [instances, setInstances] = useState<any | null>(null);

  useEffect(() => {
    const { app, firestore, auth } = initializeFirebase();
    setInstances({ app, firestore, auth });
  }, []);

  if (!instances) return null;

  return (
    <FirebaseProvider
      app={instances.app}
      firestore={instances.firestore}
      auth={instances.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
