// =====================================================================
// ประวัติการจัดสรร (F5) — หลักฐานตรวจสอบย้อนหลังว่าของแต่ละล็อตถูกส่งไปที่ไหน
// แสดงศูนย์ต้นทาง/ปลายทาง วันที่ คนจัดสรร ผู้ยืนยันรับของ จำนวนที่ได้รับจริง
// เหตุผลการยกเลิก + ใบส่งมอบพิมพ์ได้ + ส่งออก CSV
// กรองตามสถานะ / ศูนย์ที่รับ (admin) / ช่วงวันที่ ผ่าน query string (GET form) แบ่งหน้าละ 25 รายการ
// เห็นเฉพาะรายการที่ศูนย์ตัวเองเกี่ยวข้อง / admin เห็นทั้งหมด (allocations_select)
// =====================================================================

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmDelivery } from '../actions'
import { CancelAllocationButton } from '../cancel-dialog'
import { DeliverButton } from '../deliver-dialog'
import { ErrorDialog } from '../error-dialog'
import { PageHeader } from '../../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'
import {
  HISTORY_PAGE_SIZE,
  HISTORY_STATUSES,
  STAFF_CANCEL_WINDOW_MS,
  historyQuery,
  historySearch,
  parseHistoryFilters,
  type HistoryRow,
} from '@/lib/allocation-history'

// สีป้ายสถานะ — ให้ความหมายตรงกันทั้งเว็บ: ฟ้า=กำลังดำเนินการ,
// เขียว=จบสมบูรณ์, แดง=ยกเลิก (ชุดสีเดียวกับที่ F2 ใช้ในตารางของบริจาค)
const STATUS_PILL: Record<string, string> = {
  allocated: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400'
const pagerClass =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'

// อยู่นอก component เพราะอ่านเวลาปัจจุบัน
function withinStaffCancelWindow(allocatedAt: string) {
  return Date.now() - new Date(allocatedAt).getTime() < STAFF_CANCEL_WINDOW_MS
}

export default async function AllocationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; center?: string; from?: string; to?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.allocations

  const STATUS_LABEL: Record<string, string> = {
    allocated: t.statusAllocated,
    delivered: t.statusDelivered,
    cancelled: t.statusCancelled,
  }

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(locale === 'th' ? 'th-TH' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
          // server (Vercel) รันเป็น UTC — ต้องระบุเขตเวลาไม่งั้นเวลาคลาดไป 7 ชั่วโมง
          timeZone: 'Asia/Bangkok',
        })
      : '—'

  const { data: me } = await supabase.from('profiles').select('role, center_id').eq('id', user.id).single()
  const isAdmin = me?.role === 'admin'
  const filters = parseHistoryFilters(params, isAdmin)
  const page = Math.max(1, Math.floor(Number(params.page)) || 1)
  const offset = (page - 1) * HISTORY_PAGE_SIZE

  const [{ data, count, error: loadError }, { data: centers }] = await Promise.all([
    historyQuery(supabase, filters, true).range(offset, offset + HISTORY_PAGE_SIZE - 1),
    isAdmin
      ? supabase.from('centers').select('id, name').order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  // เปิดหน้าที่เกินจำนวนหน้าจริง (เช่นเปลี่ยนตัวกรองแล้วรายการน้อยลง) → กลับหน้าแรก
  if (loadError && page > 1) redirect(`/allocations/history${historySearch(filters)}`)

  const allocations = (data ?? []) as unknown as HistoryRow[]
  const total = count ?? allocations.length
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const hasFilter = !!(filters.status || filters.center || filters.from || filters.to)

  const deliverLabels = {
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
  }
  const cancelLabels = {
    button: t.cancelAllocation,
    title: t.cancelAllocation,
    message: t.cancelConfirm,
    reasonLabel: t.cancelReasonLabel,
    reasonPlaceholder: t.cancelReasonPlaceholder,
    back: t.close,
    submit: t.cancelSubmit,
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <PageHeader
        color="blue"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        title={t.historyTitle}
        subtitle={t.historySubtitle}
        action={
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`/allocations/history/export${historySearch(filters)}`}
              className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.exportCsv}
            </a>
            <Link
              href="/allocations"
              className="whitespace-nowrap text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {t.backToAllocate}
            </Link>
          </div>
        }
      />

      {params.error && (
        <ErrorDialog
          key={params.error}
          title={t.errorTitle}
          message={params.error}
          closeLabel={t.close}
          clearHref="/allocations/history"
        />
      )}

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label htmlFor="filter-status" className={labelClass}>{dict.common.status}</label>
          <select id="filter-status" name="status" defaultValue={filters.status} className={inputClass}>
            <option value="">{t.filterAll}</option>
            {HISTORY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="filter-center" className={labelClass}>{t.receivingCenter}</label>
            <select id="filter-center" name="center" defaultValue={filters.center} className={inputClass}>
              <option value="">{t.filterAll}</option>
              {(centers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="filter-from" className={labelClass}>{t.filterFrom}</label>
          <input id="filter-from" type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </div>
        <div>
          <label htmlFor="filter-to" className={labelClass}>{t.filterTo}</label>
          <input id="filter-to" type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
          >
            {t.applyFilter}
          </button>
          {hasFilter && (
            <Link
              href="/allocations/history"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t.clearFilter}
            </Link>
          )}
        </div>
      </form>

      {allocations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {t.noAllocations}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full min-w-[980px] whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">{t.allocatedAt}</th>
                  <th className="px-4 py-2 font-medium">{t.item}</th>
                  <th className="px-4 py-2 font-medium">{dict.form.quantity}</th>
                  <th className="px-4 py-2 font-medium">{t.sourceCenter}</th>
                  <th className="px-4 py-2 font-medium">{t.receivingCenter}</th>
                  <th className="px-4 py-2 font-medium">{t.allocatedBy}</th>
                  <th className="px-4 py-2 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-2 font-medium">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => {
                  const req = a.requests
                  const don = a.donations
                  const unit = unitLabel(don?.unit, locale)
                  const itemName = req?.item_name ?? don?.item_name ?? '—'
                  const received = a.received_quantity ?? a.quantity_allocated
                  const receivedShort = a.status === 'delivered' && received < a.quantity_allocated
                  // ปุ่มยืนยันส่งมอบโชว์เฉพาะคนที่ mark_delivered จะยอม: admin หรือศูนย์ปลายทาง
                  const canDeliver = isAdmin || (!!me?.center_id && req?.center_id === me.center_id)
                  // ยกเลิก: admin หรือ staff ที่จัดสรรรายการนี้เองภายใน 30 นาที (cancel_allocation บังคับซ้ำ)
                  const canCancel =
                    isAdmin ||
                    (me?.role === 'staff' && a.allocated_by === user.id && withinStaffCancelWindow(a.allocated_at))
                  return (
                    <tr key={a.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(a.allocated_at)}</td>
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{itemName}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {a.quantity_allocated} {unit}
                        {receivedShort && (
                          <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                            {t.receivedShort} {received} {unit}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{don?.centers?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{req?.centers?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{a.allocated_by_name ?? '—'}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[a.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                        {a.status === 'delivered' && (
                          <span className="mt-1 block max-w-[240px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
                            {t.deliveredAt} {formatDate(a.delivered_at)}
                            {a.delivered_by_name ? ` · ${t.deliveredBy} ${a.delivered_by_name}` : ''}
                            {a.delivery_note ? ` · ${t.deliveryNote}: ${a.delivery_note}` : ''}
                          </span>
                        )}
                        {a.status === 'cancelled' && a.cancel_reason && (
                          <span className="mt-1 block max-w-[220px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
                            {t.cancelReason}: {a.cancel_reason}
                            {a.cancelled_by_name ? ` (${a.cancelled_by_name})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {a.status === 'allocated' && canDeliver && (
                            <DeliverButton
                              id={a.id}
                              itemName={itemName}
                              allocated={a.quantity_allocated}
                              unit={unit}
                              action={confirmDelivery}
                              variant="icon"
                              labels={deliverLabels}
                            />
                          )}
                          {a.status === 'allocated' && canCancel && (
                            <CancelAllocationButton id={a.id} labels={cancelLabels} />
                          )}
                          {a.status !== 'cancelled' && (
                            <Link
                              href={`/allocations/${a.id}/slip`}
                              title={t.printSlip}
                              aria-label={t.printSlip}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z" strokeLinejoin="round" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <nav aria-label={t.historyTitle} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              {t.pageInfo
                .replace('{page}', String(page))
                .replace('{pages}', String(pages))
                .replace('{total}', String(total))}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/allocations/history${historySearch(filters, page - 1)}`} className={pagerClass}>
                  {t.prevPage}
                </Link>
              )}
              {page < pages && (
                <Link href={`/allocations/history${historySearch(filters, page + 1)}`} className={pagerClass}>
                  {t.nextPage}
                </Link>
              )}
            </div>
          </nav>
        </>
      )}
    </main>
  )
}
