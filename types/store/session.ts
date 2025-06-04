// Session store types

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

export interface SessionState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface SessionActions {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  updateUser: (user: Partial<User>) => Promise<void>
} 