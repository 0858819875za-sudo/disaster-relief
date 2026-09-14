// =====================================================================
// หน้าสมัครสมาชิก — เปิดให้สมัครเองได้เฉพาะ "อาสาสมัคร" เท่านั้น
//
// staff/admin ยังคงสร้างบัญชีโดย admin เท่านั้นเหมือนเดิม (ผ่าน Supabase
// Dashboard + หน้า /admin/centers) — หน้านี้ส่ง role: 'volunteer' ไปใน
// signUp metadata เสมอ ฝั่ง DB (docs/sql/13_volunteer_role.sql) มี
// allowlist บังคับไว้อีกชั้นว่ารับได้แค่ค่านี้ค่าเดียวจาก client
// =====================================================================

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '../login/login.module.css'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Center = { id: string; name: string; type: string }

export function RegisterForm({ dict, onLogin }: { dict: Dictionary; onLogin: () => void }) {
  const supabase = createClient()

  const [centers, setCenters] = useState<Center[]>([])
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [centerId, setCenterId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase
      .from('centers')
      .select('id, name, type')
      .order('name')
      .then(({ data }) => setCenters(data ?? []))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username.trim(),
          role: 'volunteer',
          center_id: centerId || null,
        },
      },
    })

    if (error) {
      setError(
        error.message.includes('already registered')
          ? dict.register.errAlreadyRegistered
          : error.message.includes('duplicate') || error.message.includes('unique')
            ? dict.register.errUsernameTaken
            : dict.register.errGeneric,
      )
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div className={styles.success} role="status">
      <h2>{dict.register.successTitle}</h2>
      <p>{dict.register.successDesc}</p>
      <button type="button" onClick={onLogin} className={styles.submit}>{dict.register.goToLogin}</button>
    </div>
  )

  return <>
    <form onSubmit={handleSubmit} className={styles.form}>
      <div><label htmlFor="register-name">{dict.register.fullName}</label>
        <input id="register-name" autoComplete="name" required value={fullName} onChange={e => setFullName(e.target.value)} /></div>
      <div><label htmlFor="register-username">{dict.register.username}</label>
        <input id="register-username" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={e => setUsername(e.target.value)} /></div>
      <div><label htmlFor="register-email">{dict.form.email}</label>
        <input id="register-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div><label htmlFor="register-password">{dict.register.password}</label>
        <input id="register-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div>
      <div><label htmlFor="register-center">{dict.register.centerWanted}</label>
        <select id="register-center" required value={centerId} onChange={e => setCenterId(e.target.value)}>
          <option value="">{dict.form.selectCenterPlaceholder}</option>
          {centers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'warehouse' ? dict.register.centerTypeWarehouse : dict.register.centerTypeShelter})</option>)}
        </select></div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button type="submit" disabled={loading} className={styles.submit}>{loading ? dict.register.submitting : dict.register.submit}</button>
    </form>
    <p className={styles.register}>{dict.register.haveAccount}{' '}<button type="button" onClick={onLogin}>{dict.register.loginLink}</button></p>
  </>
}
