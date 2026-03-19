export interface User {
  username: string
  name?: string
  avatar?: string
  loginType: 'simple' | 'github'
}

export interface Prefs {
  initialMode: 'normal' | 'dev'
}

const STORAGE_USER_KEY = 'escritorio_user'
const STORAGE_PREFS_KEY = 'escritorio_prefs'

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as User
    if (u.username && u.loginType) return u
  } catch { /* ignore */ }
  return null
}

export function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(STORAGE_USER_KEY)
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { initialMode: 'normal' }
}

export function savePrefs(prefs: Prefs) {
  localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs))
}
