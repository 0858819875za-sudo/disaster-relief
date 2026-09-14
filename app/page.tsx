// =====================================================================
// เส้นทางเดียว 2 หน้าจอ:
//   - ยังไม่ login  → Entry Hub ให้เลือกว่าจะเข้าเว็บในฐานะอะไร
//   - login แล้ว    → Dashboard เดิม (volunteer เด้งไปหน้าของตัวเองที่ /volunteer)
//
// เป็น Server Component (ไม่มี 'use client') เพราะแค่ดึงข้อมูลมาแสดง
// ไม่มี state ไม่มีปุ่มที่ต้อง onClick
// =====================================================================

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntryHub } from './entry-hub'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function HomePage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  // ตรวจสิทธิ์ซ้ำที่นี่อีกชั้น แม้ proxy.ts จะกันไว้แล้ว
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <EntryHub dict={dict} />
  }

  // ดึงชื่อและบทบาทจากตาราง profiles มาแสดงหัวหน้าจอ
  // .single() = คาดว่าจะได้แถวเดียว ถ้าได้ 0 หรือมากกว่า 1 แถวจะเป็น error
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, role, centers(name)')
    .eq('id', user.id)
    .single()

  // อาสาสมัครมีหน้าของตัวเองแยกต่างหาก ไม่ใช้ dashboard ชุดนี้
  if (profile?.role === 'volunteer') {
    redirect('/volunteer')
  }

  // รายการเมนู = 6 ฟีเจอร์ตามตารางแบ่งงานใน docs/Week10_Topic8_Analysis.md
  // หน้าไหนยังไม่มีคนทำ ให้ตั้ง ready: false ไว้ก่อน จะได้ไม่กดแล้ว 404
  const MENU = [
    { href: '/donations', label: dict.home.donationsLabel, desc: dict.home.donationsDesc, ready: true },
    { href: '/inventory', label: dict.home.inventoryLabel, desc: dict.home.inventoryDesc, ready: true },
    { href: '/requests', label: dict.home.requestsLabel, desc: dict.home.requestsDesc, ready: true },
    { href: '/allocations', label: dict.home.allocationsLabel, desc: dict.home.allocationsDesc, ready: true },
    { href: '/donors', label: dict.home.donorsLabel, desc: dict.home.donorsDesc, ready: true },
    { href: '/admin/centers', label: dict.home.adminLabel, desc: dict.home.adminDesc, ready: true },
    { href: '/pledges', label: dict.home.pledgesLabel, desc: dict.home.pledgesDesc, ready: true },
    { href: '/help-requests', label: dict.home.helpRequestsLabel, desc: dict.home.helpRequestsDesc, ready: true },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.home.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {profile?.full_name || profile?.username || dict.home.defaultUser}
          {profile?.role === 'admin' ? dict.home.roleAdmin : dict.home.roleStaff}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {MENU.map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
            >
              <h2 className="font-medium text-slate-900 dark:text-slate-100">{item.label}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
            </Link>
          ) : (
            // ยังไม่มีหน้านี้ จึงเรนเดอร์เป็น div เฉย ๆ ไม่ใช่ Link
            <div
              key={item.href}
              className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900"
            >
              <h2 className="font-medium text-slate-400">{item.label}</h2>
              <p className="mt-1 text-sm text-slate-400">{item.desc}</p>
              <p className="mt-2 text-xs text-slate-400">{dict.home.notReady}</p>
            </div>
          ),
        )}
      </div>
    </main>
  )
}
