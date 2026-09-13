// =====================================================================
// ประวัติการจัดสรร (F5) — หลักฐานตรวจสอบย้อนหลังว่าของแต่ละล็อตถูกส่งไปที่ไหน
// แสดงศูนย์ต้นทาง/ปลายทาง วันที่ คนจัดสรร เหตุผลการยกเลิก + ใบส่งมอบพิมพ์ได้
// กรองตามสถานะ / ศูนย์ที่รับ (admin) / ช่วงวันที่ ผ่าน query string (GET form)
// เห็นเฉพาะรายการที่ศูนย์ตัวเองเกี่ยวข้อง / admin เห็นทั้งหมด (allocations_select)
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmDelivery } from '../actions'
import { CancelAllocationButton } from '../cancel-dialog'
import { ErrorDialog } from '../error-dialog'
import { PageHeader } from '../../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'

// สีป้ายสถานะ — ให้ความหมายตรงกันทั้งเว็บ: ฟ้า=กำลังดำเนินการ,
// เขียว=จบสมบูรณ์, แดง=ยกเลิก (ชุดสีเดียวกับที่ F2 ใช้ในตารางของบริจาค)
const STATUS_PILL: Record<string, string> = {
  allocated: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}
const STATUSES = ['allocated', 'delivered', 'cancelled']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400'

export default async function AllocationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; center?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const status = STATUSES.includes(params.status ?? '') ? params.status! : ''
  const from = DATE_RE.test(params.from ?? '') ? params.from! : ''
  const to = DATE_RE.test(params.to ?? '') ? params.to! : ''

  const supabase = await createClient()
  const user = await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const STATUS_LABEL: Record<string, string> = {
    allocated: dict.allocations.statusAllocated,
    delivered: dict.allocations.statusDelivered,
    cancelled: dict.allocations.statusCancelled,
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
  // ตัวกรองศูนย์มีเฉพาะ admin — staff เห็นแค่ศูนย์ตัวเองตาม RLS อยู่แล้ว
  const center = isAdmin && UUID_RE.test(params.center ?? '') ? params.center! : ''

  // ใช้ !inner เฉพาะตอนกรองศูนย์ — ถ้าใช้ตลอด staff ศูนย์ต้นทางจะมองไม่เห็นรายการ
  // ที่ส่งไปศูนย์อื่น (RLS ของ requests ซ่อนคำขอศูนย์อื่น แล้ว inner join ตัดแถวทิ้ง)
  const requestEmbed = center ? 'requests!inner' : 'requests'
  let query = supabase
    .from('allocations')
    .select(
      `id, quantity_allocated, status, allocated_at, delivered_at, cancel_reason, allocated_by_name, cancelled_by_name, ${requestEmbed}(item_name, center_id, centers(name)), donations(item_name, unit, centers(name))`,
    )
    .order('allocated_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (center) query = query.eq('requests.center_id', center)
  // วันที่ในตัวกรองเป็นวันตามเวลาไทย
  if (from) query = query.gte('allocated_at', `${from}T00:00:00+07:00`)
  if (to) query = query.lte('allocated_at', `${to}T23:59:59.999+07:00`)

  const [{ data: allocations }, { data: centers }] = await Promise.all([
    query,
    isAdmin
      ? supabase.from('centers').select('id, name').order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const hasFilter = !!(status || center || from || to)

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
        title={dict.allocations.historyTitle}
        subtitle={dict.allocations.historySubtitle}
        action={
          <Link
            href="/allocations"
            className="whitespace-nowrap text-sm font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            {dict.allocations.backToAllocate}
          </Link>
        }
      />

      {params.error && (
        <ErrorDialog
          key={params.error}
          title={dict.allocations.errorTitle}
          message={params.error}
          closeLabel={dict.allocations.close}
          clearHref="/allocations/history"
        />
      )}

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div>
          <label htmlFor="filter-status" className={labelClass}>{dict.common.status}</label>
          <select id="filter-status" name="status" defaultValue={status} className={inputClass}>
            <option value="">{dict.allocations.filterAll}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label htmlFor="filter-center" className={labelClass}>{dict.allocations.receivingCenter}</label>
            <select id="filter-center" name="center" defaultValue={center} className={inputClass}>
              <option value="">{dict.allocations.filterAll}</option>
              {(centers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="filter-from" className={labelClass}>{dict.allocations.filterFrom}</label>
          <input id="filter-from" type="date" name="from" defaultValue={from} className={inputClass} />
        </div>
        <div>
          <label htmlFor="filter-to" className={labelClass}>{dict.allocations.filterTo}</label>
          <input id="filter-to" type="date" name="to" defaultValue={to} className={inputClass} />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
          >
            {dict.allocations.applyFilter}
          </button>
          {hasFilter && (
            <Link
              href="/allocations/history"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dict.allocations.clearFilter}
            </Link>
          )}
        </div>
      </form>

      {!allocations || allocations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.allocations.noAllocations}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[980px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.allocations.allocatedAt}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.item}</th>
                <th className="px-4 py-2 font-medium">{dict.form.quantity}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.sourceCenter}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.receivingCenter}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.allocatedBy}</th>
                <th className="px-4 py-2 font-medium">{dict.common.status}</th>
                <th className="px-4 py-2 font-medium">{dict.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => {
                const req = a.requests as unknown as {
                  item_name?: string
                  center_id?: string
                  centers?: { name?: string }
                } | null
                const don = a.donations as unknown as {
                  item_name?: string
                  unit?: string
                  centers?: { name?: string }
                } | null
                // ปุ่มยืนยันส่งมอบโชว์เฉพาะคนที่ mark_delivered จะยอม: admin หรือศูนย์ปลายทาง
                const canDeliver = isAdmin || (!!me?.center_id && req?.center_id === me.center_id)
                return (
                  <tr key={a.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(a.allocated_at)}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                      {req?.item_name ?? don?.item_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {a.quantity_allocated} {unitLabel(don?.unit, locale)}
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
                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                          {dict.allocations.deliveredAt} {formatDate(a.delivered_at)}
                        </span>
                      )}
                      {a.status === 'cancelled' && a.cancel_reason && (
                        <span className="mt-1 block max-w-[220px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
                          {dict.allocations.cancelReason}: {a.cancel_reason}
                          {a.cancelled_by_name ? ` (${a.cancelled_by_name})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {a.status === 'allocated' && canDeliver && (
                          <form action={confirmDelivery}>
                            <input type="hidden" name="id" value={a.id} />
                            <button
                              type="submit"
                              title={dict.allocations.confirmDelivery}
                              aria-label={dict.allocations.confirmDelivery}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </form>
                        )}
                        {a.status === 'allocated' && isAdmin && (
                          <CancelAllocationButton
                            id={a.id}
                            labels={{
                              button: dict.allocations.cancelAllocation,
                              title: dict.allocations.cancelAllocation,
                              message: dict.allocations.cancelConfirm,
                              reasonLabel: dict.allocations.cancelReasonLabel,
                              reasonPlaceholder: dict.allocations.cancelReasonPlaceholder,
                              back: dict.allocations.close,
                              submit: dict.allocations.cancelSubmit,
                            }}
                          />
                        )}
                        {a.status !== 'cancelled' && (
                          <Link
                            href={`/allocations/${a.id}/slip`}
                            title={dict.allocations.printSlip}
                            aria-label={dict.allocations.printSlip}
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
      )}
    </main>
  )
}
