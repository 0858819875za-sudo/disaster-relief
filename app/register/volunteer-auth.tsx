'use client'

import { useState, type KeyboardEvent } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { BrandMark } from '../brand-mark'
import { BackHomeLink } from '../back-home-link'
import { LoginForm, LoginIcon } from '../login/login-form'
import { RegisterForm } from './register-form'
import styles from '../login/login.module.css'

export function VolunteerAuth({ dict }: { dict: Dictionary }) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  function keyboardTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'login' : event.key === 'End' ? 'register' : tab === 'login' ? 'register' : 'login'
    setTab(next)
    document.getElementById(`volunteer-${next}-tab`)?.focus()
  }
  const features = [
    { icon: 'people', title: dict.entryHub.volunteerLabel, desc: dict.entryHub.volunteerDesc },
    { icon: 'heart', title: dict.entryHub.togetherTitle, desc: dict.login.togetherDesc },
    { icon: 'shield', title: dict.entryHub.transparentTitle, desc: dict.login.transparentDesc },
  ] as const
  return <main className={styles.hero}>
    <div className={styles.artwork} aria-hidden="true" />
    <div className={styles.back}><BackHomeLink label={dict.common.backHome} /></div>
    <div className={styles.layout}>
      <section className={styles.intro}>
        <div className={styles.brand}><BrandMark size="lg" /></div>
        <h2>{dict.login.welcomeBack}<span className={styles.volunteerAccent}>{dict.entryHub.volunteerLabel}</span></h2>
        <p className={styles.description}>{dict.entryHub.subtitle}</p>
        <p className={styles.volunteerMotto}>{dict.entryHub.motto} <span aria-hidden="true">♡</span></p>
      </section>
      <section className={`${styles.panel} ${styles.volunteerPanel}`} aria-labelledby="volunteer-title">
        <header className={styles.formHeader}>
          <BrandMark size="lg" /><h1 id="volunteer-title">{dict.entryHub.volunteerLabel}</h1>
          <p>{dict.entryHub.volunteerDesc}</p>
        </header>
        <div className={styles.tabs} role="tablist" aria-label={dict.entryHub.volunteerLabel}>
          {(['login', 'register'] as const).map(value => <button key={value} type="button" role="tab"
            id={`volunteer-${value}-tab`} aria-controls={`volunteer-${value}-panel`} aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1} onKeyDown={keyboardTab} onClick={() => setTab(value)}>
            <LoginIcon name={value === 'login' ? 'user' : 'people'} />
            {value === 'login' ? dict.login.submit : dict.login.registerLink}
          </button>)}
        </div>
        <div className={styles.tabContent} id="volunteer-login-panel" role="tabpanel" aria-labelledby="volunteer-login-tab" hidden={tab !== 'login'}>
          <LoginForm dict={dict} embedded onRegister={() => setTab('register')} />
        </div>
        <div className={styles.tabContent} id="volunteer-register-panel" role="tabpanel" aria-labelledby="volunteer-register-tab" hidden={tab !== 'register'}>
          <RegisterForm dict={dict} onLogin={() => setTab('login')} />
        </div>
      </section>
      <aside className={styles.features}>
        {features.map(feature => <div className={styles.feature} key={feature.icon}>
          <span className={styles[feature.icon]}><LoginIcon name={feature.icon} /></span>
          <div><h2>{feature.title}</h2><p>{feature.desc}</p></div>
        </div>)}
      </aside>
    </div>
  </main>
}
