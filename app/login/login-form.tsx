'use client'

import { useState } from 'react'
import styles from './login.module.css'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandMark } from '../brand-mark'
import { BackHomeLink } from '../back-home-link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export function LoginForm({ dict, embedded = false, onRegister }: { dict: Dictionary; embedded?: boolean; onRegister?: () => void }) {
  const router = useRouter()
  const supabase = createClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault() // กันไม่ให้เบราว์เซอร์ reload หน้าเองตามพฤติกรรมเดิมของ form
    setLoading(true)
    setError(null)

    // Supabase Auth ผูกกับอีเมลเสมอ แต่แต่ละคนสมัครด้วยอีเมลจริงของตัวเอง
    // (คนละโดเมนกัน) เลยต้องแปลง username → อีเมลจริงก่อน ผ่าน RPC
    // (docs/sql/11_username_login.sql) แล้วค่อยเอาอีเมลนั้นไป signIn ตามปกติ
    const { data: email, error: lookupError } = await supabase.rpc(
      'get_email_by_username',
      { p_username: username.trim() },
    )

    if (lookupError || !email) {
      // ข้อความเดียวกับตอนรหัสผ่านผิด เพื่อไม่บอกคนนอกว่า username นี้มีอยู่จริงไหม
      setError(dict.login.invalidCreds)
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(dict.login.invalidCreds)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh() // สั่งให้ Server Component ดึงข้อมูลใหม่ ไม่งั้นจะยังเห็นสถานะเดิม
  }

  const formContent = <>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div>
              <label htmlFor="username"><LoginIcon name="user" />{dict.login.username}</label>
              <input id="username" name="username" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false}
                placeholder={dict.login.usernamePlaceholder} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password"><LoginIcon name="lock" />{dict.login.password}</label>
              <div className={styles.passwordField}>
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
                  placeholder={dict.login.passwordPlaceholder} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className={styles.reveal} type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? dict.login.hidePassword : dict.login.showPassword} aria-pressed={showPassword} aria-controls="password">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
                    {!showPassword && <path d="m3 3 18 18" />}
                  </svg>
                </button>
              </div>
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? dict.login.submitting : dict.login.submit}<span aria-hidden="true">&rarr;</span>
            </button>
          </form>
          {onRegister && <p className={styles.register}>{dict.login.noAccount}{' '}<button type="button" onClick={onRegister}>{dict.login.registerLink}</button></p>}
          <p className={styles.support}><LoginIcon name="support" />{dict.login.support}</p>
  </>

  if (embedded) return formContent

  const features = [
    { icon: 'shield', title: dict.entryHub.transparentTitle, desc: dict.login.transparentDesc },
    { icon: 'heart', title: dict.entryHub.fastTitle, desc: dict.login.fastDesc },
    { icon: 'people', title: dict.entryHub.togetherTitle, desc: dict.login.togetherDesc },
  ] as const

  return (
    <main className={styles.hero}>
      <div className={styles.artwork} aria-hidden="true" />
      <div className={styles.back}><BackHomeLink label={dict.common.backHome} /></div>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="login-intro">
          <div className={styles.brand}><BrandMark size="lg" /></div>
          <h2 id="login-intro">{dict.login.welcomeTitle}</h2>
          <p className={styles.tagline}>{dict.entryHub.title}</p>
          <p className={styles.description}>{dict.entryHub.subtitle}</p>
        </section>

        <section className={styles.panel} aria-labelledby="login-title">
          <header className={styles.formHeader}>
            <BrandMark size="lg" />
            <h1 id="login-title">{dict.login.welcomeBack}</h1>
            <p>{dict.login.subtitle}</p>
          </header>
          {formContent}
        </section>

        <aside className={styles.features}>
          {features.map((feature) => <div className={styles.feature} key={feature.icon}>
            <span className={styles[feature.icon]}><LoginIcon name={feature.icon} /></span>
            <div><h2>{feature.title}</h2><p>{feature.desc}</p></div>
          </div>)}
        </aside>
      </div>
    </main>
  )
}

export function LoginIcon({ name }: { name: 'user' | 'lock' | 'shield' | 'heart' | 'people' | 'support' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'user' && <><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>}
    {name === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>}
    {name === 'shield' && <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>}
    {name === 'heart' && <path d="M12 21S2 15 2 8a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7-10 13-10 13Z" fill="currentColor" stroke="none" />}
    {name === 'people' && <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3H6ZM4 4a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M3 15a4 4 0 0 0-2 4v1m20-5a4 4 0 0 1 2 4v1" /></>}
    {name === 'support' && <><path d="M4 14v-3a8 8 0 0 1 16 0v7a3 3 0 0 1-3 3h-3" /><rect x="2" y="11" width="4" height="7" rx="2" /><rect x="18" y="11" width="4" height="7" rx="2" /></>}
  </svg>
}
