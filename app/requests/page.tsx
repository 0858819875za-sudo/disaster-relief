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
import { RequestFilter } from './request-filter'
import { RequestList } from './request-list'

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
const URGENCY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
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

  // 1. ดึงข้อมูลรายชื่อศูนย์พักพิงทั้งหมด
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

      {/* ตัวกรอง */}
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
        <RequestList
          rows={rows}
          dict={dict}
          categoryLabel={CATEGORY_LABEL}
          urgencyLabel={URGENCY_LABEL}
          urgencyStyle={URGENCY_STYLE}
          statusLabel={STATUS_LABEL}
          cancelLabels={cancelLabels}
        />
      )}
    </main>
  )
}