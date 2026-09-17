// =====================================================================
// รายละเอียดการจัดสรร (F5) — เส้นเวลา จัดสรร → รับของ / ยกเลิก
// พร้อมข้อมูลคำขอปลายทางและล็อตต้นทาง ลิงก์ไปจัดสรรเพิ่ม ใบรับของของล็อต และใบส่งมอบ
// ปุ่มยืนยันรับของ/ยกเลิกใช้กฎเดียวกับหน้าประวัติ (ฟังก์ชันใน DB บังคับซ้ำอีกชั้น)
// =====================================================================

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmDelivery } from '../actions'
import { CancelAllocationButton } from '../cancel-dialog'
import { DeliverButton } from '../deliver-dialog'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'
import { formatDateOnly } from '@/lib/dates'
import { STAFF_CANCEL_WINDOW_MS } from '@/lib/allocation-history'
import { fill } from '@/lib/notice'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
const smallBtn =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
const STATUS_PILL: Record<string, string> = {
  allocated: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

// อยู่นอก component เพราะอ่านเวลาปัจจุบัน
function staffCancelMinutesLeft(allocatedAt: string) {
  return Math.ceil((STAFF_CANCEL_WINDOW_MS - (Date.now() - new Date(allocatedAt).getTime())) / 60000)
}

type RequestInfo = {
  id: string
  item_name: string
  center_id: string
  unit: string | null
  quantity_requested: number
  quantity_fulfilled: number
  status: string
  centers: { name?: string } | null
}
type LotInfo = {
  id: string
  item_name: string
  unit: string
  expiry_date: string | null
  quantity_remaining: number
  centers: { name?: string } | null
}

export default async function AllocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.allocations

  const [{ data: me }, { data: a }] = await Promise.all([
    supabase.from('profiles').select('role, center_id').eq('id', user.id).single(),
    supabase
      .from('allocations')
      .select(
        'id, quantity_allocated, received_quantity, delivery_note, status, allocated_at, allocated_by, delivered_at, cancel_reason, cancelled_at, allocated_by_name, delivered_by_name, cancelled_by_name, requests(id, item_name, center_id, unit, quantity_requested, quantity_fulfilled, status, centers(name)), donations(id, item_name, unit, expiry_date, quantity_remaining, centers(name))',
      )
      .eq('id', id)
      .maybeSingle(),
  ])
  if (!a) notFound()

  const req = a.requests as unknown as RequestInfo | null
  const lot = a.donations as unknown as LotInfo | null
  const isAdmin = me?.role === 'admin'
  const unit = unitLabel(lot?.unit, locale)
  const requestUnit = req?.unit ? unitLabel(req.unit, locale) : ''
  const itemName = req?.item_name ?? lot?.item_name ?? '—'
  const received = a.received_quantity ?? a.quantity_allocated

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        })
      : '—'

  const STATUS_LABEL: Record<string, string> = {
    allocated: t.statusAllocated,
    delivered: t.statusDelivered,
    cancelled: t.statusCancelled,
  }
  const REQUEST_STATUS: Record<string, string> = {
    pending: dict.requests.statusPending,
    partial: dict.requests.statusPartial,
    fulfilled: dict.requests.statusFulfilled,
    cancelled: dict.requests.statusCancelled,
  }

  const canDeliver =
    a.status === 'allocated' && (isAdmin || (!!me?.center_id && req?.center_id === me.center_id))
  const minutesLeft =
    me?.role === 'staff' && a.allocated_by === user.id && a.status === 'allocated'
      ? staffCancelMinutesLeft(a.allocated_at)
      : 0
  const canCancel = a.status === 'allocated' && (isAdmin || minutesLeft > 0)
  const requestOpen = req?.status === 'pending' || req?.status === 'partial'

  const steps = [
    {
      key: 'allocated',
      tone: 'bg-sky-600 dark:bg-sky-400',
      title: t.timelineAllocated,
      time: formatDate(a.allocated_at),
      detail: `${a.quantity_allocated} ${unit} · ${t.by} ${a.allocated_by_name ?? '—'}`,
    },
    a.status === 'cancelled'
      ? {
          key: 'cancelled',
          tone: 'bg-red-500',
          title: t.timelineCancelled,
          time: formatDate(a.cancelled_at),
          detail: `${a.cancel_reason ?? ''}${a.cancelled_by_name ? ` · ${t.by} ${a.cancelled_by_name}` : ''}`,
        }
      : a.status === 'delivered'
        ? {
            key: 'delivered',
            tone: 'bg-emerald-500',
            title: t.timelineReceived,
            time: formatDate(a.delivered_at),
            detail: `${t.receivedQuantity} ${received} ${unit}${a.delivered_by_name ? ` · ${t.by} ${a.delivered_by_name}` : ''}${a.delivery_note ? ` · ${t.deliveryNote}: ${a.delivery_note}` : ''}`,
          }
        : {
            key: 'waiting',
            tone: 'border-2 border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900',
            title: t.timelineWaiting,
            time: '',
            detail: '',
          },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/allocations/history"
        className="text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        {t.backToHistory}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.detailTitle} · {t.slipNo} {a.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{itemName}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {lot?.centers?.name ?? '—'} → {req?.centers?.name ?? '—'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_PILL[a.status] ?? ''}`}>
          {STATUS_LABEL[a.status] ?? a.status}
        </span>
      </header>

      <section className={`${panel} mt-6 p-5`}>
        <ol className="space-y-5">
          {steps.map((step, index) => (
            <li key={step.key} className="relative flex gap-4">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-0.5 bg-slate-200 dark:bg-slate-700" />
              )}
              <span aria-hidden="true" className={`relative mt-1 h-4 w-4 shrink-0 rounded-full ${step.tone}`} />
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">{step.title}</p>
                {step.time && <p className="text-xs text-slate-500 dark:text-slate-400">{step.time}</p>}
                {step.detail && (
                  <p className="mt-1 whitespace-normal text-sm text-slate-600 dark:text-slate-300">{step.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {(canDeliver || canCancel || a.status !== 'cancelled') && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {canDeliver && (
              <DeliverButton
                id={a.id}
                itemName={itemName}
                allocated={a.quantity_allocated}
                unit={unit}
                action={confirmDelivery}
                variant="button"
                labels={{
                  button: t.confirmDelivery,
                  title: t.deliverTitle,
                  message: t.deliverMessage,
                  allocated: t.allocatedQuantity,
                  received: t.receivedQuantity,
                  note: t.deliveryNote,
                  notePlaceholder: t.deliveryNotePlaceholder,
                  noteRequired: t.deliveryNoteRequired,
                  back: t.close,
                  submit: t.deliverSubmit,
                  receivedFull: t.receivedFull,
                  receivedPartial: t.receivedPartial,
                  receivedInvalid: t.receivedInvalid,
                  noteTooShort: t.noteTooShort,
                  saving: dict.common.saving,
                }}
              />
            )}
            {a.status !== 'cancelled' && (
              <Link href={`/allocations/${a.id}/slip`} className={smallBtn}>
                {t.printSlip}
              </Link>
            )}
            {canCancel && (
              <CancelAllocationButton
                id={a.id}
                triggerClassName="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                labels={{
                  button: t.cancelAllocation,
                  title: t.cancelAllocation,
                  message: t.cancelConfirm,
                  reasonLabel: t.cancelReasonLabel,
                  reasonPlaceholder: t.cancelReasonPlaceholder,
                  back: t.close,
                  submit: t.cancelSubmit,
                  reasonTooShort: t.reasonTooShort,
                  saving: dict.common.saving,
                }}
              />
            )}
            {minutesLeft > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">{fill(t.staffCancelLeft, { n: minutesLeft })}</span>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className={`${panel} p-5`}>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t.requestSection}</h2>
          {req ? (
            <>
              <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{req.item_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{req.centers?.name ?? '—'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {dict.requests.fulfilled} {req.quantity_fulfilled} / {req.quantity_requested} {requestUnit} ·{' '}
                {REQUEST_STATUS[req.status] ?? req.status}
              </p>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span
                  className="block h-full rounded-full bg-sky-600 dark:bg-sky-400"
                  style={{
                    width: `${req.quantity_requested > 0 ? Math.round((req.quantity_fulfilled / req.quantity_requested) * 100) : 0}%`,
                  }}
                />
              </span>
              <Link href={requestOpen ? `/allocations?request=${req.id}` : '/requests'} className={`${smallBtn} mt-4`}>
                {requestOpen ? t.allocateMore : t.viewRequests}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">—</p>
          )}
        </section>

        <section className={`${panel} p-5`}>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t.lotSection}</h2>
          {lot ? (
            <>
              <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">{lot.item_name}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{lot.centers?.name ?? '—'}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t.expiryHeader}: {formatDateOnly(lot.expiry_date, locale)} · {t.lotLeft} {lot.quantity_remaining} {unit}
              </p>
              <Link href={`/donations/${lot.id}/receipt`} className={`${smallBtn} mt-4`}>
                {t.viewLotReceipt}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">—</p>
          )}
        </section>
      </div>
    </main>
  )
}
