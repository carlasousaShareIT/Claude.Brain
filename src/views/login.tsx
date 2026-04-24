import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth-store'

interface LoginError {
  message: string
}

function PasswordChangeStep({
  loginPassword,
  onChanged,
}: {
  loginPassword?: string
  onChanged: () => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, string> = { newPassword }
      if (loginPassword) body.currentPassword = loginPassword
      const res = await fetch('/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Password change failed.')
        setError(text || 'Password change failed.')
        return
      }
      onChanged()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-[#62627a] mb-4">
          You must set a new password before continuing.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#62627a]">New password</label>
        <input
          type="password"
          autoFocus
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          placeholder="New password"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#62627a]">Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          placeholder="Confirm password"
          required
        />
      </div>
      {error && (
        <p className="text-xs text-brain-red">{error}</p>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? 'Setting password…' : 'Set password'}
      </Button>
    </form>
  )
}

export function LoginView({ initialMode }: { initialMode?: 'change-password' } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(initialMode === 'change-password')
  const [loginPassword, setLoginPassword] = useState('')

  const setUser = useAuthStore((s) => s.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Login failed.')
        setError({ message: text || 'Invalid email or password.' })
        return
      }
      const data = await res.json()
      if (data.mustChangePassword) {
        setLoginPassword(password)
        setMustChangePassword(true)
        return
      }
      setUser(data.user)
    } catch {
      setError({ message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordChanged = () => {
    useAuthStore.getState().loadUser()
  }

  return (
    <div className="flex h-screen items-center justify-center bg-brain-base">
      <div className="w-full max-w-sm rounded-lg border border-brain-surface bg-brain-raised p-8 shadow-lg">
        <h1 className="mb-6 text-base font-semibold text-foreground">Brain</h1>

        {mustChangePassword ? (
          <PasswordChangeStep
            loginPassword={loginPassword}
            onChanged={handlePasswordChanged}
          />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#62627a]">Email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#62627a]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
                placeholder="Password"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-brain-red">{error.message}</p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
