// =====================================================================
// หน้ารายการคำขอความช่วยเหลือ (staff ตรวจสอบ) — มาจากฟอร์มสาธารณะ /help-request
// เห็นเฉพาะคำขอของศูนย์ตัวเอง (RLS) / admin เห็นทุกศูนย์
// =====================================================================

import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmHelpRequest, dismissHelpRequest } from './actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'

export default async function HelpRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
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

  const { data: pledgeRows } = await supabase
    .from('request_pledges')
    .select('*, centers(name)')
    .order('created_at', { ascending: false })
  const pledges = pledgeRows ? sortByUrgency(pledgeRows) : null

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.helpRequestQueue.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.helpRequestQueue.subtitle}</p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {!pledges || pledges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.helpRequestQueue.noRequests}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.helpRequestQueue.requester}</th>
                <th className="px-4 py-2 font-medium">{dict.helpRequestQueue.center}</th>
                <th className="px-4 py-2 font-medium">{dict.helpRequestQueue.item}</th>
                <th className="px-4 py-2 font-medium">{dict.helpRequestQueue.quantity}</th>
                <th className="px-4 py-2 font-medium">{dict.requests.urgency}</th>
                <th className="px-4 py-2 font-medium">{dict.common.status}</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                    {p.requester_name}
                    <div className="text-xs text-slate-400">{p.requester_phone}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {(p.centers as unknown as { name?: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {p.item_name}{' '}
                    <span className="text-xs text-slate-400">
                      ({CATEGORY_LABEL[p.category] ?? p.category})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.quantity}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        p.urgency === 'high'
                          ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400'
                          : p.urgency === 'medium'
                            ? 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }
                    >
                      {URGENCY_LABEL[p.urgency] ?? p.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="px-4 py-2">
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <form action={confirmHelpRequest}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            {dict.queue.confirm}
                          </button>
                        </form>
                        <form action={dismissHelpRequest}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            {dict.queue.dismiss}
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
