import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmHelpRequest, dismissHelpRequest } from './actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'
import RequestFilter from './request-filter'

const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return ''
  const now = new Date()
  const created = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000)

  if (diffInSeconds < 60) return 'เมื่อสักครู่'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} ชม. ที่แล้ว`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} วันที่แล้ว`

  return created.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export default async function HelpRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    error?: string; 
    status?: string;
    search?: string;
    center?: string;
    urgency?: string;
  }>
}) {
  const { 
    error, 
    status: selectedStatus = '',
    search = '',
    center: selectedCenter = '',
    urgency: selectedUrgency = ''
  } = await searchParams

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
    pending: dict.queue.statusPending,
    contacted: dict.queue.statusContacted,
    confirmed: dict.queue.statusConfirmed,
    dismissed: dict.queue.statusDismissed,
  }

  const { data: centerRows } = await supabase.from('centers').select('id, name')
  const centers = centerRows || []

  const { data: pledgeRows } = await supabase
    .from('request_pledges')
    .select('*, centers(name)')
    .order('created_at', { ascending: false })
  
  const sortedPledges = pledgeRows ? sortByUrgency(pledgeRows) : []

  // คำนวณจำนวนรายการในแต่ละสถานะ (สำหรับ Badge Counter)
  const counts = {
    all: sortedPledges.length,
    pending: sortedPledges.filter((p) => p.status === 'pending').length,
    confirmed: sortedPledges.filter((p) => p.status === 'confirmed' || p.status === 'contacted').length,
    dismissed: sortedPledges.filter((p) => p.status === 'dismissed').length,
  }

  // กรองรายการตามสถานะ และการค้นหา
  const pledges = sortedPledges.filter((p) => {
    if (selectedStatus === 'pending' && p.status !== 'pending') return false
    if (selectedStatus === 'confirmed' && p.status !== 'confirmed' && p.status !== 'contacted') return false
    if (selectedStatus === 'dismissed' && p.status !== 'dismissed') return false
    if (selectedStatus && !['pending', 'confirmed', 'dismissed'].includes(selectedStatus) && p.status !== selectedStatus) return false

    if (search) {
      const query = search.toLowerCase()
      const nameMatch = p.requester_name?.toLowerCase().includes(query)
      const phoneMatch = p.requester_phone?.toLowerCase().includes(query)
      if (!nameMatch && !phoneMatch) return false
    }

    if (selectedCenter && p.center_id !== selectedCenter) return false

    if (selectedUrgency && p.urgency?.toLowerCase() !== selectedUrgency.toLowerCase()) return false

    return true
  })

  const filterTabs = [
    { label: 'ทั้งหมด', value: '', count: counts.all },
    { label: 'รอตรวจสอบ', value: 'pending', count: counts.pending },
    { label: 'ยืนยันแล้ว', value: 'confirmed', count: counts.confirmed },
    { label: 'ปฏิเสธ', value: 'dismissed', count: counts.dismissed },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.helpRequestQueue.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.helpRequestQueue.subtitle}</p>
      </header>

      {/* แถบปุ่มกรองสถานะพร้อม Badge Counter แสดงจำนวน */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filterTabs.map((filter) => {
          const isActive = selectedStatus === filter.value
          return (
            <a
              key={filter.value}
              href={filter.value ? `?status=${filter.value}` : '?'}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : filter.value === 'pending' && filter.count > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {filter.count}
              </span>
            </a>
          )
        })}
      </div>

      <RequestFilter centers={centers} />

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {!pledges || pledges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.helpRequestQueue.noRequests}
        </p>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {pledges.map((p) => (
              <li key={p.id} className={`${panel} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{p.requester_name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">📞 {p.requester_phone || '—'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatRelativeTime(p.created_at)}</p>
                  </div>
                  <span
                    className={
                      p.urgency === 'high'
                        ? 'rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400'
                        : p.urgency === 'medium'
                        ? 'rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }
                  >
                    {URGENCY_LABEL[p.urgency] ?? p.urgency}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 space-y-1">
                  <p><span className="font-medium text-slate-500">ศูนย์:</span> {(p.centers as unknown as { name?: string } | null)?.name ?? '—'}</p>
                  <p><span className="font-medium text-slate-500">รายการ:</span> {p.item_name} ({CATEGORY_LABEL[p.category] ?? p.category})</p>
                  <p><span className="font-medium text-slate-500">จำนวน:</span> {p.quantity}</p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>

                  {p.status === 'pending' && (
                    <div className="flex gap-2">
                      <form action={confirmHelpRequest}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 transition"
                        >
                          {dict.queue.confirm}
                        </button>
                      </form>
                      <form action={dismissHelpRequest}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 transition"
                        >
                          {dict.queue.dismiss}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className={`${panel} hidden overflow-hidden lg:block`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{dict.helpRequestQueue.requester}</th>
                  <th className="px-4 py-3 font-medium">{dict.helpRequestQueue.center}</th>
                  <th className="px-4 py-3 font-medium">{dict.helpRequestQueue.item}</th>
                  <th className="px-4 py-3 font-medium text-center">{dict.helpRequestQueue.quantity}</th>
                  <th className="px-4 py-3 font-medium text-center">{dict.requests.urgency}</th>
                  <th className="px-4 py-3 font-medium text-center">{dict.common.status}</th>
                  <th className="px-4 py-3 font-medium text-right">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pledges.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                      <div className="font-medium">{p.requester_name}</div>
                      <div className="text-xs text-slate-400">{p.requester_phone || '—'}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatRelativeTime(p.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {(p.centers as unknown as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{p.item_name}</span>{' '}
                      <span className="text-xs text-slate-400">
                        ({CATEGORY_LABEL[p.category] ?? p.category})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{p.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          p.urgency === 'high'
                            ? 'inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400'
                            : p.urgency === 'medium'
                              ? 'inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                              : 'inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }
                      >
                        {URGENCY_LABEL[p.urgency] ?? p.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{STATUS_LABEL[p.status] ?? p.status}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.status === 'pending' ? (
                        <div className="inline-flex items-center gap-2">
                          <form action={confirmHelpRequest}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-700 transition"
                            >
                              {dict.queue.confirm}
                            </button>
                          </form>
                          <form action={dismissHelpRequest}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 transition"
                            >
                              {dict.queue.dismiss}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
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