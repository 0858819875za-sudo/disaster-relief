import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'
import { unitLabel } from '@/lib/units'
import { noticeMessage, type NoticeParams } from '@/lib/notice'
import { ErrorDialog } from '../allocations/error-dialog'
import { FlashNotice } from '../flash-notice'
import { CancelRequestButton } from './cancel-request-dialog'
import { RequestFilter } from './request-filter'

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
const URGENCY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''

  const now = new Date()
  const created = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000)

  if (diffInSeconds < 60) return 'สร้างเมื่อสักครู่'

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `สร้างเมื่อ ${diffInMinutes} นาทีที่แล้ว`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `สร้างเมื่อ ${diffInHours} ชม. ที่แล้ว`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `สร้างเมื่อ ${diffInDays} วันที่แล้ว`

  return created.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; category?: string; urgency?: string; center_id?: string } & NoticeParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const CATEGORY_LABEL: Record<string, string> = {
    food: dict.form.categoryFood,
    water: dict.form.categoryWater,
    medicine: dict.form.categoryMedicine,
    clothing: dict.form.categoryClothing,
    hygiene: dict.form.categoryHygiene,
    other: dict.form.categoryOther,
  }
  const URGENCY_LABEL: Record<string, string> = {
    low: dict.requests.urgencyLow,
    medium: dict.requests.urgencyMedium,
    high: dict.requests.urgencyHigh,
  }
  const STATUS_LABEL: Record<string, string> = {
    pending: dict.requests.statusPending,
    partial: dict.requests.statusPartial,
    fulfilled: dict.requests.statusFulfilled,
    cancelled: dict.requests.statusCancelled,
  }

  // 1. ดึงข้อมูลรายชื่อศูนย์พักพิงทั้งหมดเพื่อนำไปใช้ในตัวกรอง
  const { data: centersData } = await supabase
    .from('centers')
    .select('id, name')
    .order('name', { ascending: true })

  // 2. ดึงข้อมูลรายการคำขอ
  const { data: requestRows } = await supabase
    .from('requests')
    .select(
      'id, item_name, category, unit, quantity_requested, quantity_fulfilled, urgency, status, cancel_reason, created_at, center_id, centers(name)',
    )
    .order('created_at', { ascending: false })

  const requests = requestRows ? sortByUrgency(requestRows) : null
  const notice = noticeMessage(params, dict, locale)

  // คำนวณสถิติภาพรวม
  const totalCount = requests?.length ?? 0
  const pendingCount = requests?.filter((r) => r.status === 'pending' || r.status === 'partial').length ?? 0
  const highUrgencyCount = requests?.filter((r) => r.urgency === 'high' && (r.status === 'pending' || r.status === 'partial')).length ?? 0

  const cancelLabels = {
    button: dict.requests.cancelRequest,
    message: dict.requests.cancelRequestConfirm,
    reasonLabel: dict.allocations.cancelReasonLabel,
    reasonPlaceholder: dict.requests.cancelRequestReasonPlaceholder,
    back: dict.allocations.close,
    submit: dict.requests.cancelRequestSubmit,
    reasonTooShort: dict.allocations.reasonTooShort,
    saving: dict.common.saving,
  }

  // ดึงค่าการกรองจาก URL Parameters
  const searchQuery = (params.q ?? '').toLowerCase().trim()
  const selectedCategory = params.category ?? ''
  const selectedUrgency = params.urgency ?? ''
  const selectedCenter = params.center_id ?? ''

  const filteredRequests = (requests ?? []).filter((r) => {
    const centerName = ((r.centers as unknown as { name?: string } | null)?.name ?? '').toLowerCase()
    const itemName = (r.item_name ?? '').toLowerCase()

    const matchesSearch = !searchQuery || itemName.includes(searchQuery) || centerName.includes(searchQuery)
    const matchesCategory = !selectedCategory || r.category === selectedCategory
    const matchesUrgency = !selectedUrgency || r.urgency === selectedUrgency
    const matchesCenter = !selectedCenter || r.center_id === selectedCenter

    return matchesSearch && matchesCategory && matchesUrgency && matchesCenter
  })

  const rows = filteredRequests.map((r) => ({
    r,
    center: (r.centers as unknown as { name?: string } | null)?.name ?? '—',
    unit: r.unit ? unitLabel(r.unit, locale) : '',
    open: r.status === 'pending' || r.status === 'partial',
    percent: r.quantity_requested > 0 ? Math.min(100, Math.round((r.quantity_fulfilled / r.quantity_requested) * 100)) : 0,
  }))
  type Row = (typeof rows)[number]

  const progress = (row: Row) => (
    <div className="min-w-[120px]">
      <p className="tabular-nums text-slate-700 dark:text-slate-300">
        {row.r.quantity_fulfilled} / {row.r.quantity_requested} {row.unit}
      </p>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span className="block h-full rounded-full bg-sky-600 dark:bg-sky-400" style={{ width: `${row.percent}%` }} />
      </span>
    </div>
  )

  const statusCell = (row: Row) => (
    <>
      <span className="whitespace-nowrap text-slate-700 dark:text-slate-300">{STATUS_LABEL[row.r.status] ?? row.r.status}</span>
      {row.r.status === 'cancelled' && row.r.cancel_reason && (
        <span className="mt-1 block max-w-[240px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
          {dict.requests.cancelledReason}: {row.r.cancel_reason}
        </span>
      )}
    </>
  )

  const actions = (row: Row) =>
    row.open ? (
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href={`/allocations?request=${row.r.id}`}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-deep"
        >
          {dict.requests.allocateAction}
        </Link>
        <CancelRequestButton id={row.r.id} itemName={row.r.item_name} labels={cancelLabels} />
      </div>
    ) : null

  const urgencyPill = (row: Row) => (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[row.r.urgency] ?? URGENCY_STYLE.low}`}>
      {URGENCY_LABEL[row.r.urgency] ?? row.r.urgency}
    </span>
  )

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.requests.title}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.requests.subtitle}</p>
        </div>
        <Link
          href="/requests/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {dict.requests.addNew}
        </Link>
      </header>

      {/* สถิติภาพรวม */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${panel} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">คำขอทั้งหมด</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{totalCount}</p>
        </div>
        <div className={`${panel} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">รอการจัดสรร</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{pendingCount}</p>
        </div>
        <div className={`${panel} p-4`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">เคสด่วนมาก (เปิดอยู่)</p>
          <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{highUrgencyCount}</p>
        </div>
      </div>

      {/* ตัวกรอง (ส่งรายชื่อศูนย์พักพิงที่ดึงมาจาก Supabase ไปด้วย) */}
      <RequestFilter centers={centersData ?? []} />

      {params.error && (
        <ErrorDialog
          key={params.error}
          title={dict.allocations.errorTitle}
          message={params.error}
          closeLabel={dict.allocations.close}
          clearHref="/requests"
        />
      )}
      {notice && <FlashNotice key={notice} message={notice} clearHref="/requests" closeLabel={dict.allocations.close} />}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          ไม่พบรายการคำขอที่ตรงกับเงื่อนไขการค้นหา
        </p>
      ) : (
        <>
          {/* จอเล็ก: การ์ด */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li key={row.r.id} className={`${panel} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{row.r.item_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {row.center} · {CATEGORY_LABEL[row.r.category] ?? row.r.category}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(row.r.created_at)}
                    </p>
                  </div>
                  {urgencyPill(row)}
                </div>
                <div className="mt-3 text-sm">{progress(row)}</div>
                <div className="mt-2 text-sm">{statusCell(row)}</div>
                {row.open && <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">{actions(row)}</div>}
              </li>
            ))}
          </ul>

          {/* จอใหญ่: ตาราง */}
          <div className={`${panel} hidden overflow-x-auto md:block`}>
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{dict.requests.center}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.requests.item}</th>
                  <th className="px-4 py-2.5 font-medium">
                    {dict.requests.fulfilled} / {dict.requests.requested}
                  </th>
                  <th className="px-4 py-2.5 font-medium">{dict.requests.urgency}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.common.status}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.requests.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.r.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.center}</td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      {row.r.item_name}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {CATEGORY_LABEL[row.r.category] ?? row.r.category}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeTime(row.r.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{progress(row)}</td>
                    <td className="px-4 py-3">{urgencyPill(row)}</td>
                    <td className="px-4 py-3">{statusCell(row)}</td>
                    <td className="px-4 py-3">{actions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  )
}