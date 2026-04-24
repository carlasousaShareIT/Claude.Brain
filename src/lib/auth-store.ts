import { create } from 'zustand'

export interface User {
  id: string
  email: string
  displayName: string
  isBootstrap: boolean
  mustChangePassword: boolean
}

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User) => void
  clearUser: () => void
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
  loadUser: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/auth/me', { credentials: 'include' })
      if (res.status === 401) {
        set({ user: null, loading: false })
        return
      }
      if (!res.ok) {
        set({ user: null, loading: false })
        return
      }
      const data = await res.json()
      set({
        user: {
          id: data.id,
          email: data.email,
          displayName: data.displayName,
          isBootstrap: data.isBootstrap,
          mustChangePassword: data.mustChangePassword,
        },
        loading: false,
      })
    } catch {
      set({ user: null, loading: false })
    }
  },
}))
