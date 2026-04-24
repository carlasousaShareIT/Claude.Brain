import { useState, useEffect, useCallback } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/auth-store'

interface ApiToken {
  id: string
  name: string
  scope: string
  tokenPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

interface TeamUser {
  id: string
  email: string
  displayName: string
  status: string
  invitedBy: string | null
  createdAt: string
  lastSeenAt: string | null
}

function ProfileSection() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Save failed.')
        setProfileMsg({ text: text || 'Save failed.', ok: false })
        return
      }
      const data = await res.json()
      setUser(data)
      setProfileMsg({ text: 'Profile updated.', ok: true })
    } catch {
      setProfileMsg({ text: 'Network error.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: 'Passwords do not match.', ok: false })
      return
    }
    if (newPassword.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters.', ok: false })
      return
    }
    setChangingPw(true)
    try {
      const res = await fetch('/auth/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Password change failed.')
        setPwMsg({ text: text || 'Password change failed.', ok: false })
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwMsg({ text: 'Password changed.', ok: true })
    } catch {
      setPwMsg({ text: 'Network error.', ok: false })
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#62627a]">Profile</h2>
      <form onSubmit={handleSaveProfile} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#62627a]">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#62627a]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          />
        </div>
        {profileMsg && (
          <p className={`text-xs ${profileMsg.ok ? 'text-brain-green' : 'text-brain-red'}`}>{profileMsg.text}</p>
        )}
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
      </form>

      <form onSubmit={handleChangePassword} className="space-y-3 border-t border-brain-surface pt-4">
        <p className="text-xs font-medium text-[#62627a]">Change password</p>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#62627a]">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#62627a]">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#62627a]">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
          />
        </div>
        {pwMsg && (
          <p className={`text-xs ${pwMsg.ok ? 'text-brain-green' : 'text-brain-red'}`}>{pwMsg.text}</p>
        )}
        <Button type="submit" size="sm" disabled={changingPw}>{changingPw ? 'Changing…' : 'Change password'}</Button>
      </form>
    </section>
  )
}

function TokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [mintOpen, setMintOpen] = useState(false)
  const [mintName, setMintName] = useState('')
  const [mintScope, setMintScope] = useState<'user' | 'service'>('user')
  const [minting, setMinting] = useState(false)
  const [mintedToken, setMintedToken] = useState<string | null>(null)
  const [mintErr, setMintErr] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/auth/tokens', { credentials: 'include' })
      if (res.ok) setTokens(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    setMintErr('')
    setMinting(true)
    try {
      const res = await fetch('/auth/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mintName, scope: mintScope }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Failed to mint token.')
        setMintErr(text || 'Failed to mint token.')
        return
      }
      const data = await res.json()
      setMintedToken(data.token)
      setMintName('')
      fetchTokens()
    } catch {
      setMintErr('Network error.')
    } finally {
      setMinting(false)
    }
  }

  const handleRevoke = async (id: string) => {
    await fetch(`/auth/tokens/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchTokens()
  }

  const handleCopy = () => {
    if (mintedToken) {
      navigator.clipboard.writeText(mintedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseMintDialog = () => {
    setMintOpen(false)
    setMintedToken(null)
    setMintErr('')
    setCopied(false)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#62627a]">API tokens</h2>
        <Button size="xs" variant="ghost" className="text-[#62627a] hover:text-foreground" onClick={() => setMintOpen(true)}>
          Mint token
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-[#62627a]">Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <p className="text-xs text-[#62627a]">No tokens. Mint one to use with agents and hooks.</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div key={t.id} className={`flex items-center justify-between rounded bg-brain-surface px-3 py-2 ${t.revokedAt ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <p className={`text-xs font-medium ${t.revokedAt ? 'text-[#62627a] line-through' : 'text-foreground'}`}>{t.name}</p>
                <p className="text-[10px] text-[#62627a]">
                  {t.tokenPrefix}… · {t.scope} · {t.revokedAt
                    ? <span className="text-brain-red">revoked</span>
                    : <span className="text-brain-green">active</span>}
                </p>
              </div>
              {!t.revokedAt && (
                <Button size="icon-xs" variant="ghost" className="text-[#62627a] hover:text-brain-red" onClick={() => handleRevoke(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={mintOpen} onOpenChange={(open) => { if (!open) handleCloseMintDialog() }}>
        <DialogContent>
          <DialogTitle>{mintedToken ? 'Token created' : 'Mint API token'}</DialogTitle>
          {mintedToken ? (
            <div className="space-y-4 mt-4">
              <p className="text-xs text-brain-amber">This token will not be shown again. Copy it now.</p>
              <div className="flex items-center gap-2 rounded bg-brain-surface px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs text-brain-green">{mintedToken}</code>
                <Button size="icon-xs" variant="ghost" onClick={handleCopy}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {copied && <p className="text-xs text-brain-green">Copied.</p>}
              <div className="flex justify-end">
                <DialogClose render={<Button size="sm" onClick={handleCloseMintDialog}>Done</Button>} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleMint} className="space-y-4 mt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#62627a]">Name</label>
                <input
                  autoFocus
                  type="text"
                  value={mintName}
                  onChange={(e) => setMintName(e.target.value)}
                  className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
                  placeholder="e.g. hooks-token"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#62627a]">Scope</label>
                <select
                  value={mintScope}
                  onChange={(e) => setMintScope(e.target.value as 'user' | 'service')}
                  className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="user">user</option>
                  <option value="service">service</option>
                </select>
              </div>
              {mintErr && <p className="text-xs text-brain-red">{mintErr}</p>}
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button size="sm" variant="ghost" type="button">Cancel</Button>} />
                <Button size="sm" type="submit" disabled={minting || !mintName.trim()}>
                  {minting ? 'Minting…' : 'Mint'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function TeamSection() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDisplayName, setInviteDisplayName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ user: TeamUser; tempPassword: string } | null>(null)
  const [inviteErr, setInviteErr] = useState('')
  const [copiedPw, setCopiedPw] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/auth/users', { credentials: 'include' })
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteErr('')
    setInviting(true)
    try {
      const res = await fetch('/auth/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, displayName: inviteDisplayName }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Invite failed.')
        setInviteErr(text || 'Invite failed.')
        return
      }
      const data = await res.json()
      setInviteResult(data)
      setInviteEmail('')
      setInviteDisplayName('')
      fetchUsers()
    } catch {
      setInviteErr('Network error.')
    } finally {
      setInviting(false)
    }
  }

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const status = currentStatus === 'active' ? 'disabled' : 'active'
    await fetch(`/auth/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchUsers()
  }

  const handleResetPassword = async (id: string) => {
    const res = await fetch(`/auth/users/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPassword: true }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.tempPassword) {
        alert(`Temporary password: ${data.tempPassword}\n\nShare this with the user. They must change it on next login.`)
      }
    }
  }

  const handleCloseInviteDialog = () => {
    setInviteOpen(false)
    setInviteResult(null)
    setInviteErr('')
    setCopiedPw(false)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#62627a]">Team</h2>
        <Button size="xs" variant="ghost" className="text-[#62627a] hover:text-foreground" onClick={() => setInviteOpen(true)}>
          Invite user
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-[#62627a]">Loading users…</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded bg-brain-surface px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{u.displayName}</p>
                <p className="text-[10px] text-[#62627a]">{u.email} · {u.status}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="xs" variant="ghost" className="text-[#62627a] hover:text-foreground" onClick={() => handleResetPassword(u.id)}>
                  Reset pw
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className={u.status === 'active' ? 'text-[#62627a] hover:text-brain-red' : 'text-[#62627a] hover:text-brain-green'}
                  onClick={() => handleStatusToggle(u.id, u.status)}
                >
                  {u.status === 'active' ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) handleCloseInviteDialog() }}>
        <DialogContent>
          <DialogTitle>{inviteResult ? 'User invited' : 'Invite user'}</DialogTitle>
          {inviteResult ? (
            <div className="space-y-4 mt-4">
              <p className="text-xs text-[#62627a]">
                Share the temporary password with <strong>{inviteResult.user.email}</strong>. They must change it on first login.
              </p>
              <div className="flex items-center gap-2 rounded bg-brain-surface px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs text-brain-green">{inviteResult.tempPassword}</code>
                <Button size="icon-xs" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(inviteResult.tempPassword)
                  setCopiedPw(true)
                  setTimeout(() => setCopiedPw(false), 2000)
                }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {copiedPw && <p className="text-xs text-brain-green">Copied.</p>}
              <p className="text-xs text-brain-amber">This password will not be shown again.</p>
              <div className="flex justify-end">
                <DialogClose render={<Button size="sm" onClick={handleCloseInviteDialog}>Done</Button>} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4 mt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#62627a]">Email</label>
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[#62627a]">Display name</label>
                <input
                  type="text"
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  className="rounded bg-brain-surface px-3 py-2 text-sm text-foreground placeholder:text-[#62627a] focus:outline-none focus:ring-1 focus:ring-brain-accent/50"
                  required
                />
              </div>
              {inviteErr && <p className="text-xs text-brain-red">{inviteErr}</p>}
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button size="sm" variant="ghost" type="button">Cancel</Button>} />
                <Button size="sm" type="submit" disabled={inviting || !inviteEmail.trim() || !inviteDisplayName.trim()}>
                  {inviting ? 'Inviting…' : 'Send invite'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function AccountView() {
  const user = useAuthStore((s) => s.user)
  const isBootstrap = user?.isBootstrap ?? false

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg space-y-10 px-6 py-8">
        <ProfileSection />
        <div className="border-t border-brain-surface" />
        <TokensSection />
        {isBootstrap && (
          <>
            <div className="border-t border-brain-surface" />
            <TeamSection />
          </>
        )}
      </div>
    </ScrollArea>
  )
}
