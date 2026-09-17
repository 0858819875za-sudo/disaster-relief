import Link from 'next/link'
import { LogoutButton } from './logout-button'
import { BrandMark } from './brand-mark'
import { ThemeToggle } from './theme-toggle'
import { LocaleToggle } from './locale-toggle'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'

// แสดงเฉพาะตอน login แล้วเท่านั้น (root layout เป็นคนเช็ค user ก่อนค่อยเรียก
// nav นี้) — /login กับ /pledge (สาธารณะ) จะไม่เห็นแถบนี้เลย

export function Nav({
  role,
  locale,
  pendingReceipts = 0,
}: {
  role: string | null
  locale: Locale
  pendingReceipts?: number
}) {
  const dict = getDictionary(locale)

  // ตัวเลข "รอรับของ" — staff/admin ติดที่เมนูจัดสรร อาสาสมัครติดที่หน้าหลักของตัวเอง
  // (นับใน root layout: admin = ทั้งระบบ, คนอื่น = ของที่กำลังส่งมาศูนย์ตัวเอง)
  const badgeHref = role === 'volunteer' ? '/volunteer' : '/allocations'
  const badge = (href: string) =>
    href === badgeHref && pendingReceipts > 0 ? (
      <span
        aria-label={dict.nav.pendingReceipt.replace('{n}', String(pendingReceipts))}
        className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-accent px-1.5 text-xs font-semibold leading-5 text-white"
      >
        {pendingReceipts}
      </span>
    ) : null

  // 5 ฟีเจอร์หลักที่ staff เปิดใช้งานทุกวัน — อยู่แถวเมนูตรงๆ กดถึงเร็วที่สุด
  const STAFF_LINKS = [
    { href: '/', label: dict.nav.home },
    { href: '/donations', label: dict.nav.donations },
    { href: '/inventory', label: dict.nav.inventory },
    { href: '/requests', label: dict.nav.requests },
    { href: '/allocations', label: dict.nav.allocations },
    { href: '/donors', label: dict.nav.donors },
  ]

  // คิวจากคนนอกระบบ (ไม่ต้อง login มาส่ง) — staff เข้ามาตรวจเป็นครั้งคราว
  // ไม่ใช่งานที่เปิดค้างทั้งวันเหมือน 5 อันบน จึงพับไว้ใน dropdown เดียวกัน
  // กันแถวเมนูหลักยาวเกินจนล้นบรรทัดบนจอที่ไม่ได้กว้างมาก
  const QUEUE_LINKS = [
    { href: '/pledges', label: dict.nav.donationPledges },
    { href: '/help-requests', label: dict.nav.helpRequests },
  ]

  // อาสาสมัครมีแค่หน้าเดียวของตัวเอง ไม่เห็นเมนูของ staff/admin เลย — สิทธิ์
  // จริงถูกกันด้วย RLS อยู่แล้ว แต่ไม่โชว์ลิงก์ที่กดไปแล้วเจอ redirect เปล่าๆ
  const VOLUNTEER_LINKS = [{ href: '/volunteer', label: dict.nav.volunteerHome }]

  // แถบเมนูพื้นกรมท่าเข้ม (ตามที่ชมพู่ทำ mockup ไว้) ต้องใช้ตัวหนังสือสี
  // อ่อนแทน slate เข้มแบบพื้นขาวเดิม
  const linkClass = 'text-sm font-medium text-blue-100 hover:text-white'
  const isAdmin = role === 'admin'
  const isVolunteer = role === 'volunteer'
  const LINKS = isVolunteer ? VOLUNTEER_LINKS : STAFF_LINKS

  return (
    <nav className="bg-brand dark:bg-slate-900">
      <div className="mx-auto w-full max-w-5xl px-6 py-3">
        {/* จอกว้าง (md+): แสดงลิงก์ทั้งหมดแถวเดียว ไม่ต้องกดเปิด */}
        <div className="hidden md:flex md:items-center md:justify-between md:gap-x-6">
          <Link href="/" className="shrink-0">
            <BrandMark size="sm" onDark />
          </Link>
          <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={`${linkClass} inline-flex items-center`}>
                {link.label}
                {badge(link.href)}
              </Link>
            ))}

            {!isVolunteer && (
              <details className="group relative">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${linkClass}`}
                >
                  {dict.nav.publicQueue}
                  <span className="text-blue-200 transition group-open:rotate-180">▾</span>
                </summary>
                <div className="absolute left-0 top-full z-10 mt-2 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {QUEUE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <LocaleToggle locale={locale} label={dict.common.langToggleLabel} onDark />
            <ThemeToggle
              labelToDark={dict.common.themeToggleToDark}
              labelToLight={dict.common.themeToggleToLight}
              onDark
            />

            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand">
                  {role === 'admin' ? 'A' : role === 'volunteer' ? 'V' : 'S'}
                </span>
              </summary>
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {isAdmin && (
                  <Link
                    href="/admin/centers"
                    className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {dict.nav.manage}
                  </Link>
                )}
                <div className="px-3 py-2">
                  <LogoutButton label={dict.nav.logout} />
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* จอมือถือ: พับเมนูไว้ในปุ่มเดียว ใช้ details/summary ของ HTML ล้วนๆ
            ไม่ต้องพึ่ง client-side JS หรือ state ใดๆ — หน้าจอเล็กพอจะไล่
            ลิงก์ทั้งหมดเป็นแนวตั้งได้อยู่แล้ว เลยไม่ต้องแยกกลุ่มแบบจอกว้าง */}
        <details className="group md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium text-blue-100 [&::-webkit-details-marker]:hidden">
            <BrandMark size="sm" onDark />
            <span className="text-blue-200 group-open:rotate-180">▾</span>
          </summary>
          <div className="flex flex-col gap-1 border-t border-white/10 pb-2 pt-3">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={`${linkClass} inline-flex items-center py-1.5`}>
                {link.label}
                {badge(link.href)}
              </Link>
            ))}
            {!isVolunteer &&
              QUEUE_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={`${linkClass} py-1.5`}>
                  {link.label}
                </Link>
              ))}
            {isAdmin && (
              <Link href="/admin/centers" className={`${linkClass} py-1.5`}>
                {dict.nav.manage}
              </Link>
            )}
            <div className="mt-1 flex items-center gap-1 border-t border-white/10 pt-2">
              <LocaleToggle locale={locale} label={dict.common.langToggleLabel} onDark />
              <ThemeToggle
                labelToDark={dict.common.themeToggleToDark}
                labelToLight={dict.common.themeToggleToLight}
                onDark
              />
            </div>
            <div className="pt-1">
              <LogoutButton label={dict.nav.logout} onDark />
            </div>
          </div>
        </details>
      </div>
    </nav>
  )
}
