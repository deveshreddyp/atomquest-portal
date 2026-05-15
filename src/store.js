import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  setAuth: (user, role) => set({ user, role }),
  logout: () => set({ user: null, role: null })
}));
