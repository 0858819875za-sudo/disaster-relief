// =====================================================================
// หน้าหลักของอาสาสมัคร — แยกจาก dashboard ของ staff/admin โดยเจตนา
//
// ขอบเขตสิทธิ์อาสาสมัคร (ตามที่ตกลงกันไว้):
//   - ดูข้อมูลศูนย์ตัวเอง: คำขอที่ยังไม่ปิด + รายการที่รอส่งมอบ (อ่านอย่างเดียว)
//   - ทำได้อย่างเดียว: กดยืนยันว่าของถึงศูนย์แล้ว (mark_delivered)
//   - ทำไม่ได้: บันทึกของเข้าคลัง, สร้าง/แก้คำขอ, จัดการผู้บริจาค, หน้า admin
//     (บังคับด้วย RLS ใน docs/sql/13_volunteer_role.sql อีกชั้นหนึ่ง
//     ไม่ได้พึ่งแค่การซ่อนปุ่มในหน้านี้)
// =====================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VolunteerDashboard } from './volunteer-dashboard'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'


export default async function VolunteerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, role, center_id, centers(name, type, address, contact_phone)')
    .eq('id', user.id)
    .single()

  // หน้านี้เฉพาะอาสาสมัครเท่านั้น — staff/admin ใช้ dashboard ปกติที่ /
  if (profile?.role !== 'volunteer') {
    redirect('/')
  }

  const centerId = profile.center_id
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const start = `${day}T00:00:00+07:00`
  const end = new Date(new Date(start).getTime() + 86400000).toISOString()
  const empty = { data: [], error: null, count: 0 }
  const [requests, pending, history, delivered, urgent] = await Promise.all([
    centerId ? supabase.from('requests')
      .select('id, item_name, category, quantity_requested, quantity_fulfilled, urgency, status', { count: 'exact' })
      .eq('center_id', centerId).in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false }) : Promise.resolve(empty),
    centerId ? supabase.from('allocations')
      .select('id, quantity_allocated, allocated_at, requests!inner(item_name, center_id), donations(unit)', { count: 'exact' })
      .eq('status', 'allocated').eq('requests.center_id', centerId)
      .order('allocated_at', { ascending: true }) : Promise.resolve(empty),
    centerId ? supabase.from('allocations')
      .select('id, quantity_allocated, received_quantity, delivered_at, requests!inner(item_name, center_id), donations(unit)')
      .eq('status', 'delivered').eq('requests.center_id', centerId)
      .order('delivered_at', { ascending: false }).limit(5) : Promise.resolve(empty),
    centerId ? supabase.from('allocations')
      .select('id, requests!inner(center_id)', { count: 'exact', head: true })
      .eq('status', 'delivered').eq('requests.center_id', centerId)
      .gte('delivered_at', start).lt('delivered_at', end) : Promise.resolve(empty),
    centerId ? supabase.from('requests').select('id', { count: 'exact', head: true })
      .eq('center_id', centerId).in('status', ['pending', 'partial']).eq('urgency', 'high') : Promise.resolve(empty),
  ])

  return <VolunteerDashboard
    dict={dict} locale={locale} error={error}
    name={profile.full_name || profile.username || dict.volunteer.defaultName}
    center={profile.centers as unknown as { name: string; type: string; address: string | null; contact_phone: string | null } | null}
    requests={requests.data ? sortByUrgency([...requests.data]) : []}
    pending={pending.data ?? []} history={history.data ?? []}
    counts={[pending.error ? null : pending.count, urgent.error ? null : urgent.count, requests.error ? null : requests.count, delivered.error ? null : delivered.count]}
    failed={{ requests: !!requests.error, pending: !!pending.error, history: !!history.error }}
    loadError={[requests, pending, history, delivered, urgent].some(result => result.error)}
  />
}
