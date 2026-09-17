import Link from 'next/link'
import { BrandMark } from './brand-mark'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// footer ของทั้งเว็บ (root layout)
//   full  — ยังไม่ login: ลิงก์สำหรับประชาชน + เบอร์หน่วยงานจริงกรณีเร่งด่วน + ข้อความกำกับว่าเป็นต้นแบบ
//           เว็บเปิดสาธารณะ จึงต้องบอกชัดว่ายังไม่ใช่ช่องทางทางการ กันผู้ประสบภัยจริงเข้าใจผิด
//   slim  — login แล้ว: บรรทัดเดียว ไม่แย่งพื้นที่งานของเจ้าหน้าที่ ไม่มีลิงก์ซ้ำกับแถบเมนู
// ซ่อนตอนสั่งพิมพ์ (ใบรับของ / ใบส่งมอบ)
export function SiteFooter({ dict, variant }: { dict: Dictionary; variant: 'full' | 'slim' }) {
  const f = dict.footer

  if (variant === 'slim') {
    return (
      <footer className="mt-auto border-t border-slate-200 bg-white/70 print:hidden dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-slate-500 sm:px-6 dark:text-slate-400">
          <p>
            {f.rights} · {f.prototypeShort}
          </p>
          <p>{f.courseShort}</p>
        </div>
      </footer>
    )
  }

  const link =
    'rounded text-sm text-blue-100 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
  const publicLinks = [
    { href: '/pledge', label: f.pledge },
    { href: '/help-request', label: f.helpRequest },
    { href: '/register', label: f.volunteer },
    { href: '/login', label: f.staffLogin },
  ]
  const contacts = [
    { name: f.hospitalName, phone: f.hospitalPhone, tel: 'tel:+6675479999' },
    { name: f.universityName, phone: f.universityPhone, tel: 'tel:+6675673000' },
  ]

  return (
    <footer className="mt-auto bg-brand text-blue-100 print:hidden dark:bg-slate-900">
      <div className="mx-auto w-full max-w-6xl px-5 pb-6 pt-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.7fr]">
          <div>
            <BrandMark size="sm" onDark />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-blue-200">{f.tagline}</p>
          </div>

          <nav aria-labelledby="footer-public-title">
            <h2 id="footer-public-title" className="text-sm font-semibold text-white">
              {f.forPublic}
            </h2>
            <ul className="mt-3 space-y-2">
              {publicLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={link}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="footer-contact-title" className="sm:col-span-2 lg:col-span-1">
            <h2 id="footer-contact-title" className="text-sm font-semibold text-white">
              {f.emergencyTitle}
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {contacts.map((item) => (
                <li key={item.tel} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-blue-100">{item.name}</span>
                  <a href={item.tel} className={`${link} font-semibold text-white`}>
                    {item.phone}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-blue-200">{f.adhocNote}</p>
          </section>
        </div>

        <p className="mt-8 flex items-start gap-2 rounded-lg bg-white/10 px-4 py-3 text-xs leading-relaxed text-blue-50">
          <span aria-hidden="true">ⓘ</span>
          {f.prototypeNote}
        </p>

        <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-white/15 pt-4 text-xs text-blue-200">
          <p>{f.rights}</p>
          <p>{f.course}</p>
        </div>
      </div>
    </footer>
  )
}
