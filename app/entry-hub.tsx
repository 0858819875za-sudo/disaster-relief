import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { BrandMark } from './brand-mark'
import styles from './entry-hub.module.css'

type IconName = 'staff' | 'home' | 'heart' | 'help' | 'shield' | 'people'

function EntryIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      {name === 'staff' && <><circle cx="16" cy="10" r="6" fill="currentColor" /><path d="M5 27v-3a11 9 0 0 1 22 0v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" fill="currentColor" /></>}
      {name === 'home' && <><path d="m3 14 13-11 13 11a2 2 0 0 1-2 3h-2v10a2 2 0 0 1-2 2h-5V19h-4v10H9a2 2 0 0 1-2-2V17H5a2 2 0 0 1-2-3Z" fill="currentColor" /></>}
      {name === 'heart' && <path d="M16 28S3 20 3 11a7 7 0 0 1 13-4 7 7 0 0 1 13 4c0 9-13 17-13 17Z" fill="currentColor" />}
      {name === 'help' && <><rect x="3" y="3" width="26" height="26" rx="6" fill="currentColor" /><path d="M10 12H7v4h3v4H7m18-8h-3v4h3v4h-3m-8-8h4v8h-4Z" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>}
      {name === 'shield' && <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 11 4v8c0 7-11 14-11 14S5 22 5 15V7l11-4Z" /><path d="m11 15 4 4 7-8" /></g>}
      {name === 'people' && <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="9" r="4" /><path d="M8 27v-3a8 8 0 0 1 16 0v3H8Z" /><path d="M7 6a4 4 0 0 0 0 8M25 6a4 4 0 0 1 0 8M5 19a6 6 0 0 0-3 5v2h3m22-7a6 6 0 0 1 3 5v2h-3" /></g>}
    </svg>
  )
}

export function EntryHub({ dict }: { dict: Dictionary }) {
  const copy = dict.entryHub
  const choices = [
    { href: '/login', icon: 'staff', tone: 'blue', label: copy.staffLabel, desc: copy.staffDesc },
    { href: '/register', icon: 'home', tone: 'green', label: copy.volunteerLabel, desc: copy.volunteerDesc },
    { href: '/pledge', icon: 'heart', tone: 'red', label: copy.donateLabel, desc: copy.donateDesc },
    { href: '/help-request', icon: 'help', tone: 'red', label: copy.helpLabel, desc: copy.helpDesc },
  ] as const
  const values = [
    { icon: 'shield', title: copy.transparentTitle, desc: copy.transparentDesc },
    { icon: 'heart', title: copy.fastTitle, desc: copy.fastDesc },
    { icon: 'people', title: copy.togetherTitle, desc: copy.togetherDesc },
  ] as const

  return (
    <main className={styles.hero}>
      <div className={styles.artwork} aria-hidden="true" />
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.brand}><BrandMark size="lg" /></div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        <div className={styles.choices}>
          {choices.map((choice) => (
            <Link key={choice.href} href={choice.href} className={styles.card}>
              <span className={`${styles.icon} ${styles[choice.tone]}`}><EntryIcon name={choice.icon} /></span>
              <div className={styles.cardText}>
                <h2>{choice.label}</h2>
                <p>{choice.desc}</p>
              </div>
              <svg className={styles.arrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
            </Link>
          ))}
        </div>

        <p className={styles.motto}>{copy.motto}<span aria-hidden="true">♡</span></p>

        <ul className={styles.values}>
          {values.map((value) => (
            <li key={value.icon}>
              <span className={styles.valueIcon}><EntryIcon name={value.icon} /></span>
              <p><span>{value.title}</span><span>{value.desc}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
