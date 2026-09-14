// =====================================================================
// หน้าจัดสรรของ (F5) — เลือกคำขอ แล้วระบบเติมจำนวนจากล็อตในคลังให้ (FEFO)
// ยืนยันแล้วตัดจ่ายได้หลายล็อตในครั้งเดียว
//
// การตัดยอดจริงเกิดที่ allocate_items_multi → allocate_items
// (docs/sql/17_f5_hardening.sql, 18_f5_features.sql, 23_f5_improvements.sql) ทั้งหมด
// ฝั่งนี้แค่แสดงตัวเลือกแล้วส่ง id/จำนวนไปเรียก rpc — ไม่ตัดยอดเองที่ frontend
// เพื่อไม่ให้กฎ (หมดอายุ/เกินยอด/หมวดหมู่/หน่วยไม่ตรง/ข้ามศูนย์) หลุดไปสองที่
//
// จัดสรรข้ามศูนย์ = admin เท่านั้น (staff เห็นแค่ข้อมูลศูนย์ตัวเองตาม RLS อยู่แล้ว)
// เปิดพร้อม ?request=<id> (จากปุ่ม "จัดสรร" ในหน้าคำขอ) จะเลือกคำขอนั้นไว้ให้
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { AllocateForm } from './allocate-form'
import { PageHeader } from '../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'
import { SuccessDialog, type AllocationSummary } from './success-dialog'
import { ErrorDialog } from './error-dialog'
import { unitLabel } from '@/lib/units'
import { itemsMatch } from '@/lib/item-match'
import { bangkokToday, daysFromToday } from '@/lib/dates'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string; request?: string }>
}) {
  const { error, done, request } = await searchParams
  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const [{ data: me }, { data: requestRows }, { data: donations }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('requests')
      .select(
        'id, center_id, item_name, category, unit, quantity_requested, quantity_fulfilled, urgency, created_at, centers(name)',
      )
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: true }),
    // FEFO: ใกล้หมดอายุก่อน และตัดล็อตที่หมดอายุแล้ว (ตามวันที่เวลาไทย) ออกตั้งแต่ตอนดึง
    supabase
      .from('donations')
      .select('id, center_id, item_name, category, unit, quantity_remaining, expiry_date, received_at, centers(name)')
      .gt('quantity_remaining', 0)
      .or(`expiry_date.is.null,expiry_date.gte.${bangkokToday()}`)
      .order('expiry_date', { ascending: true, nullsFirst: false }),
  ])

  const isAdmin = me?.role === 'admin'
  const lots = donations ?? []
  // แนะนำคำขอที่ควรจัดสรรก่อน: เรียงตามความเร่งด่วน และภายในระดับเดียวกัน
  // คำขอที่มีล็อตชื่อตรง (และหน่วยตรงถ้าคำขอระบุ) พร้อมจ่ายอยู่แล้วขึ้นก่อน
  const withReady = (requestRows ?? []).map((r) => ({
    ...r,
    ready: lots.some(
      (d) =>
        d.category === r.category &&
        (isAdmin || d.center_id === r.center_id) &&
        itemsMatch(r.item_name, d.item_name) &&
        (!r.unit?.trim() || d.unit.trim() === r.unit.trim()),
    ),
  }))
  const requests = sortByUrgency([...withReady].sort((a, b) => Number(b.ready) - Number(a.ready)))

  // สรุปผลการจัดสรรที่เพิ่งทำ (มาจาก redirect ของ allocate action)
  let summary: AllocationSummary | null = null
  const doneIds = (done ?? '').split(',').filter((id) => UUID_RE.test(id))
  if (doneIds.length > 0) {
    const { data: rows } = await supabase
      .from('allocations')
      .select(
        'quantity_allocated, requests(item_name, quantity_requested, quantity_fulfilled, status, centers(name)), donations(unit, quantity_remaining, centers(name))',
      )
      .in('id', doneIds)
    if (rows && rows.length > 0) {
      const REQUEST_STATUS: Record<string, string> = {
        pending: dict.requests.statusPending,
        partial: dict.requests.statusPartial,
        fulfilled: dict.requests.statusFulfilled,
        cancelled: dict.requests.statusCancelled,
      }
      const req = rows[0].requests as unknown as {
        item_name: string
        quantity_requested: number
        quantity_fulfilled: number
        status: string
        centers: { name?: string } | null
      } | null
      summary = {
        itemName: req?.item_name ?? '—',
        toCenter: req?.centers?.name ?? '—',
        requestFulfilled: req?.quantity_fulfilled ?? 0,
        requestRequested: req?.quantity_requested ?? 0,
        requestStatusLabel: req ? (REQUEST_STATUS[req.status] ?? req.status) : '—',
        lots: rows.map((row) => {
          const don = row.donations as unknown as {
            unit: string
            quantity_remaining: number
            centers: { name?: string } | null
          } | null
          return {
            fromCenter: don?.centers?.name ?? '—',
            quantity: row.quantity_allocated,
            unit: unitLabel(don?.unit, locale),
            lotRemaining: don?.quantity_remaining ?? 0,
          }
        }),
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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
        <ErrorDialog
          key={error}
          title={dict.allocations.errorTitle}
          message={error}
          closeLabel={dict.allocations.close}
          clearHref="/allocations"
        />
      )}

      {summary && <SuccessDialog key={`success-${done}`} summary={summary} dict={dict} />}

      {/* remount ฟอร์มหลังจัดสรรสำเร็จ — Next เก็บ state ของ client component ไว้ตอน
          redirect กลับหน้าเดิม ถ้าไม่ remount คำขอที่เพิ่งจัดสรรจะค้างอยู่ในฟอร์ม
          (ตอน error ไม่ remount เพื่อให้ผู้ใช้แก้ตัวเลขเดิมต่อได้) */}
      <AllocateForm
        key={`form-${done ?? ''}-${request ?? ''}`}
        dict={dict}
        isAdmin={isAdmin}
        locale={locale}
        initialRequestId={request && UUID_RE.test(request) ? request : ''}
        requests={requests.map((r) => ({
          ...r,
          centers: r.centers as unknown as { name?: string } | null,
        }))}
        donations={lots.map((d) => ({
          ...d,
          centers: d.centers as unknown as { name?: string } | null,
          days_left: d.expiry_date ? daysFromToday(d.expiry_date) : null,
        }))}
      />
    </main>
  )
}
