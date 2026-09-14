// =====================================================================
// หน้ารายการคำขอ (F4) — เรียงตามความเร่งด่วน
// staff เห็นเฉพาะศูนย์ตัวเอง / admin เห็นทุกศูนย์ (บังคับด้วย RLS)
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'
import { RequestFilter } from './request-filter'

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; urgency?: string }>
}) {
  const { q, category, urgency } = await searchParams
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

  let requestQuery = supabase
    .from('requests')
    .select(
      'id, item_name, category, quantity_requested, quantity_fulfilled, urgency, status, created_at, centers(name)',
    )
    .order('created_at', { ascending: false })

  if (q) {
    requestQuery = requestQuery.ilike('item_name', `%${q}%`)
  }

  if (category) {
    requestQuery = requestQuery.eq('category', category)
  }

  if (urgency) {
    requestQuery = requestQuery.eq('urgency', urgency)
  }

  const { data: requestRows } = await requestQuery
  const requests = requestRows ? sortByUrgency(requestRows) : null

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
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

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">ตัวกรอง</h2>
          {q || category || urgency ? (
            <Link
              href="/requests"
              className="text-xs font-medium text-brand hover:text-brand-deep"
            >
              ล้างตัวกรอง
            </Link>
          ) : null}
        </div>
        <RequestFilter />
      </div>

      {!requests || requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.requests.noRequests}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.requests.center}</th>
                <th className="px-4 py-2 font-medium">{dict.requests.item}</th>
                <th className="px-4 py-2 font-medium">{dict.requests.requested}</th>
                <th className="px-4 py-2 font-medium">{dict.requests.fulfilled}</th>
                <th className="px-4 py-2 font-medium">{dict.requests.urgency}</th>
                <th className="px-4 py-2 font-medium">{dict.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {(r.centers as unknown as { name?: string } | null)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                    {r.item_name}{' '}
                    <span className="text-xs text-slate-400">
                      ({CATEGORY_LABEL[r.category] ?? r.category})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.quantity_requested}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.quantity_fulfilled}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.urgency === 'high'
                          ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400'
                          : r.urgency === 'medium'
                            ? 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }
                    >
                      {URGENCY_LABEL[r.urgency] ?? r.urgency}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
