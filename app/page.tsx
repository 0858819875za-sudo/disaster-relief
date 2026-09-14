// =====================================================================
// เส้นทางเดียว 2 หน้าจอ:
//   - ยังไม่ login  → Entry Hub ให้เลือกว่าจะเข้าเว็บในฐานะอะไร
//   - login แล้ว    → Dashboard เดิม (volunteer เด้งไปหน้าของตัวเองที่ /volunteer)
//
// เป็น Server Component (ไม่มี 'use client') เพราะแค่ดึงข้อมูลมาแสดง
// ไม่มี state ไม่มีปุ่มที่ต้อง onClick
// =====================================================================

import { Dashboard } from './dashboard'
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

  return <Dashboard supabase={supabase} dict={dict} locale={locale} name={profile?.full_name || profile?.username || dict.home.defaultUser} isAdmin={profile?.role === 'admin'} />
}
