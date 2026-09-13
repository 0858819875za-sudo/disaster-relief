// =====================================================================
// หน้าจัดสรรของ (F5) — เลือกคำขอ + เลือกล็อตในคลัง แล้วยืนยันจัดสรร/ตัดจ่าย
//
// การตัดยอดจริงเกิดที่ allocate_items (docs/sql/17_f5_hardening.sql) ทั้งหมด
// ฝั่งนี้แค่แสดงตัวเลือกแล้วส่ง id/จำนวนไปเรียก rpc — ไม่คำนวณยอดเองที่ frontend
// เพื่อไม่ให้กฎ (หมดอายุ/เกินยอด/หมวดหมู่ไม่ตรง/ข้ามศูนย์) หลุดไปสองที่
//
// จัดสรรข้ามศูนย์ = admin เท่านั้น (staff เห็นแค่ข้อมูลศูนย์ตัวเองตาม RLS อยู่แล้ว)
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { AllocateForm } from './allocate-form'
import { PageHeader } from '../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'

// วันที่แบบ YYYY-MM-DD ตาม UTC ให้ตรงกับ current_date ของ Postgres (Supabase ใช้ UTC)
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export default async function AllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const [{ data: me }, { data: requestRows }, { data: donations }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('requests')
      .select(
        'id, center_id, item_name, category, quantity_requested, quantity_fulfilled, urgency, created_at, centers(name)',
      )
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: true }),
    // FEFO: ใกล้หมดอายุก่อน และตัดล็อตที่หมดอายุแล้วออกตั้งแต่ตอนดึง
    supabase
      .from('donations')
      .select('id, center_id, item_name, category, unit, quantity_remaining, expiry_date, centers(name)')
      .gt('quantity_remaining', 0)
      .or(`expiry_date.is.null,expiry_date.gte.${todayIso()}`)
      .order('expiry_date', { ascending: true, nullsFirst: false }),
  ])

  const isAdmin = me?.role === 'admin'
  const requests = sortByUrgency(requestRows ?? [])

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <PageHeader
        color="rose"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        title={dict.allocations.title}
        subtitle={dict.allocations.subtitle}
        action={
          <Link
            href="/allocations/history"
            className="whitespace-nowrap text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            {dict.allocations.viewHistory}
          </Link>
        }
      />

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <AllocateForm
        dict={dict}
        isAdmin={isAdmin}
        requests={requests.map((r) => ({
          ...r,
          centers: r.centers as unknown as { name?: string } | null,
        }))}
        donations={(donations ?? []).map((d) => ({
          ...d,
          centers: d.centers as unknown as { name?: string } | null,
        }))}
      />
    </main>
  )
}
