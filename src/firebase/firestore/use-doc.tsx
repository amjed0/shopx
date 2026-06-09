'use client';

import { useState, useEffect } from 'react';
import { auth } from '../index';
import { mutationEmitter } from '../mutation-emitter';

export function useDoc<T = any>(docRef: any) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!docRef || !docRef.collection || !docRef.id) {
      setLoading(false);
      return;
    }

    const { collection: collectionName, id } = docRef;
    let isMounted = true;

    const fetchData = async () => {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          currentUser = auth.currentUser;
          if (currentUser) break;
        }
      }

      if (!currentUser) {
        if (isMounted) {
          setError(new Error('User not authenticated'));
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(`/api/${collectionName}/${id}`, {
          headers: {
            'x-user-id': currentUser.uid,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch doc ${collectionName}/${id}`);
        }
        const resultData = await res.json();
        if (isMounted) {
          setData(resultData);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    fetchData();

    const unsubscribeMutation = mutationEmitter.on(collectionName, () => {
      fetchData();
    });

    return () => {
      isMounted = false;
      unsubscribeMutation();
    };
  }, [docRef?.collection, docRef?.id]);

  return { data, loading, error };
}
