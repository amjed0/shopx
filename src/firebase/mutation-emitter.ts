'use client';

class MutationEmitter {
  private listeners: Record<string, (() => void)[]> = {};

  on(event: string, callback: () => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: () => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event: string) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb());
  }
}

export const mutationEmitter = new MutationEmitter();
