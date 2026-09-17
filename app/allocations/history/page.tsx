// =====================================================================
// ประวัติการจัดสรร (F5) — หลักฐานตรวจสอบย้อนหลังว่าของแต่ละล็อตถูกส่งไปที่ไหน
// ตัวเลขสรุปตามสถานะ (กดเพื่อกรอง) + ตัวกรองศูนย์ (admin) / ช่วงวันที่ + แบ่งหน้า 25 รายการ
// แต่ละรายการ: ยืนยันรับของ / รายละเอียด / พิมพ์ใบส่งมอบ / ยกเลิก (อยู่ในเมนู "เพิ่มเติม")
// จอเล็กแสดงเป็นการ์ด จอใหญ่เป็นตาราง
// เห็นเฉพาะรายการที่ศูนย์ตัวเองเกี่ยวข้อง / admin เห็นทั้งหมด (allocations_select)
// =====================================================================

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmDelivery } from '../actions'
import { CancelAllocationButton } from '../cancel-dialog'
import { DeliverButton, type DeliverLabels } from '../deliver-dialog'
import { ErrorDialog } from '../error-dialog'
import { FlashNotice } from '../../flash-notice'
import { PageHeader } from '../../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'
import { fill, noticeMessage, type NoticeParams } from '@/lib/notice'
import {
  HISTORY_PAGE_SIZE,
  HISTORY_STATUSES,
  STAFF_CANCEL_WINDOW_MS,
  historyQuery,
  historySearch,
  parseHistoryFilters,
  type HistoryRow,
} from '@/lib/allocation-history'

// สีป้ายสถานะ — ให้ความหมายตรงกันทั้งเว็บ: ฟ้า=รอรับของ, เขียว=รับของแล้ว, แดง=ยกเลิก
const STATUS_PILL: Record<string, string> = {
  allocated: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400'
const smallBtn =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
const pagerClass =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'

// อยู่นอก component เพราะอ่านเวลาปัจจุบัน — นาทีที่ staff ยังยกเลิกรายการของตัวเองได้
function staffCancelMinutesLeft(allocatedAt: string) {
  return Math.ceil((STAFF_CANCEL_WINDOW_MS - (Date.now() - new Date(allocatedAt).getTime())) / 60000)
}

export default async function AllocationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<
    { error?: string; status?: string; center?: string; from?: string; to?: string; page?: string } & NoticeParams
  >
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

  const [{ data, count, error: loadError }, { data: centers }, statusCounts] = await Promise.all([
    historyQuery(supabase, filters, true).range(offset, offset + HISTORY_PAGE_SIZE - 1),
    isAdmin
      ? supabase.from('centers').select('id, name').order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    // ตัวเลขสรุปต่อสถานะ — ใช้ตัวกรองศูนย์/วันที่เดียวกับตาราง
    Promise.all(HISTORY_STATUSES.map((status) => historyQuery(supabase, { ...filters, status }, true, true))),
  ])

  // เปิดหน้าที่เกินจำนวนหน้าจริง (เช่นเปลี่ยนตัวกรองแล้วรายการน้อยลง) → กลับหน้าแรก
  if (loadError && page > 1) redirect(`/allocations/history${historySearch(filters)}`)

  const allocations = (data ?? []) as unknown as HistoryRow[]
  const total = count ?? allocations.length
  const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE))
  const hasFilter = !!(filters.status || filters.center || filters.from || filters.to)
  const countByStatus: Record<string, number> = Object.fromEntries(
    HISTORY_STATUSES.map((status, i) => [status, statusCounts[i].count ?? 0]),
  )
  const summaryChips = [
    { value: '', label: t.filterAll, count: HISTORY_STATUSES.reduce((sum, s) => sum + countByStatus[s], 0) },
    ...HISTORY_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: countByStatus[s] })),
  ]
  const notice = noticeMessage(params, dict, locale)

  const deliverLabels: DeliverLabels = {
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
  }
  const cancelLabels = {
    button: t.cancelAllocation,
    title: t.cancelAllocation,
    message: t.cancelConfirm,
    reasonLabel: t.cancelReasonLabel,
    reasonPlaceholder: t.cancelReasonPlaceholder,
    back: t.close,
    submit: t.cancelSubmit,
    reasonTooShort: t.reasonTooShort,
    saving: dict.common.saving,
  }

  const rows = allocations.map((a) => {
    const received = a.received_quantity ?? a.quantity_allocated
    const minutesLeft =
      me?.role === 'staff' && a.allocated_by === user.id && a.status === 'allocated'
        ? staffCancelMinutesLeft(a.allocated_at)
        : 0
    return {
      a,
      unit: unitLabel(a.donations?.unit, locale),
      itemName: a.requests?.item_name ?? a.donations?.item_name ?? '—',
      received,
      receivedShort: a.status === 'delivered' && received < a.quantity_allocated,
      // ปุ่มยืนยันรับของโชว์เฉพาะคนที่ mark_delivered จะยอม: admin หรือศูนย์ปลายทาง
      canDeliver:
        a.status === 'allocated' && (isAdmin || (!!me?.center_id && a.requests?.center_id === me.center_id)),
      // ยกเลิก: admin หรือ staff ที่จัดสรรรายการนี้เองภายใน 30 นาที (cancel_allocation บังคับซ้ำ)
      canCancel: a.status === 'allocated' && (isAdmin || minutesLeft > 0),
      minutesLeft,
    }
  })
  type Row = (typeof rows)[number]

  const quantity = (row: Row) => (
    <>
      {row.a.quantity_allocated} {row.unit}
      {row.receivedShort && (
        <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-400">
          {t.receivedShort} {row.received} {row.unit}
        </span>
      )}
    </>
  )

  const status = (row: Row) => (
    <>
      <span
        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[row.a.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
      >
        {STATUS_LABEL[row.a.status] ?? row.a.status}
      </span>
      {row.a.status === 'delivered' && (
        <div className="mt-1.5 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <p>
            {t.deliveredAt} {formatDate(row.a.delivered_at)}
          </p>
          {row.a.delivered_by_name && (
            <p>
              {t.deliveredBy}: {row.a.delivered_by_name}
            </p>
          )}
          {row.a.delivery_note && (
            <p className="max-w-[260px] whitespace-normal">
              {t.deliveryNote}: {row.a.delivery_note}
            </p>
          )}
        </div>
      )}
      {row.a.status === 'cancelled' && row.a.cancel_reason && (
        <p className="mt-1.5 max-w-[260px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
          {t.cancelReason}: {row.a.cancel_reason}
          {row.a.cancelled_by_name ? ` (${row.a.cancelled_by_name})` : ''}
        </p>
      )}
    </>
  )

  const actions = (row: Row) => (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {row.canDeliver && (
          <DeliverButton
            id={row.a.id}
            itemName={row.itemName}
            allocated={row.a.quantity_allocated}
            unit={row.unit}
            action={confirmDelivery}
            variant="compact"
            labels={deliverLabels}
          />
        )}
        <Link href={`/allocations/${row.a.id}`} className={smallBtn}>
          {t.viewDetail}
        </Link>
        {row.a.status !== 'cancelled' && (
          <Link href={`/allocations/${row.a.id}/slip`} className={smallBtn}>
            {t.printShort}
          </Link>
        )}
        {row.canCancel && (
          <CancelAllocationButton
            id={row.a.id}
            labels={cancelLabels}
            triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
          />
        )}
      </div>
      {row.minutesLeft > 0 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{fill(t.staffCancelLeft, { n: row.minutesLeft })}</p>
      )}
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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
          <div className="flex flex-wrap items-center justify-end gap-3">
            <a href={`/allocations/history/export${historySearch(filters)}`} className={pagerClass}>
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
      {notice && (
        <FlashNotice key={notice} message={notice} clearHref="/allocations/history" closeLabel={t.close} />
      )}

      <nav aria-label={dict.common.status} className="mb-4 flex flex-wrap gap-2">
        {summaryChips.map((chip) => {
          const active = filters.status === chip.value
          return (
            <Link
              key={chip.value || 'all'}
              href={`/allocations/history${historySearch({ ...filters, status: chip.value })}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                active
                  ? 'border-brand bg-brand text-white dark:border-sky-500 dark:bg-sky-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-2 text-xs tabular-nums ${active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}
              >
                {chip.count}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* key ตามตัวกรองปัจจุบัน — ให้ช่อง select/วันที่รีเซ็ตตาม URL เมื่อกดชิปสรุปหรือกลับมาหลังบันทึก
          (ถ้าไม่ remount ค่า defaultValue เดิมจะค้างในฟอร์มทั้งที่ตัวกรองจริงเปลี่ยนไปแล้ว) */}
      <form
        key={historySearch(filters) || 'all'}
        method="get"
        className={`${panel} mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}
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
            <Link href="/allocations/history" className={pagerClass}>
              {t.clearFilter}
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {t.noAllocations}
        </p>
      ) : (
        <>
          {/* จอเล็ก: การ์ด */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.a.id} className={`${panel} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/allocations/${row.a.id}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
                    >
                      {row.itemName}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(row.a.allocated_at)}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm text-slate-700 dark:text-slate-300">{quantity(row)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {row.a.donations?.centers?.name ?? '—'} → {row.a.requests?.centers?.name ?? '—'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.allocatedBy}: {row.a.allocated_by_name ?? '—'}
                </p>
                <div className="mt-3">{status(row)}</div>
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{actions(row)}</div>
              </li>
            ))}
          </ul>

          {/* จอใหญ่: ตาราง */}
          <div className={`${panel} hidden overflow-x-auto md:block`}>
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t.allocatedAt}</th>
                  <th className="px-4 py-2.5 font-medium">{t.item}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.form.quantity}</th>
                  <th className="px-4 py-2.5 font-medium">
                    {t.sourceCenter} → {t.receivingCenter}
                  </th>
                  <th className="px-4 py-2.5 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.a.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(row.a.allocated_at)}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {t.by} {row.a.allocated_by_name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/allocations/${row.a.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
                      >
                        {row.itemName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{quantity(row)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {row.a.donations?.centers?.name ?? '—'}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        → {row.a.requests?.centers?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{status(row)}</td>
                    <td className="px-4 py-3">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label={t.historyTitle}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300"
          >
            <p>{fill(t.pageInfo, { page, pages, total })}</p>
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
