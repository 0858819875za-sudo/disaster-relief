// =====================================================================
// หน้ารายการของบริจาคที่บันทึกไว้ (F2)
// staff เห็นเฉพาะศูนย์ตัวเอง / admin เห็นทุกศูนย์ (บังคับด้วย RLS)
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'

export default async function DonationsPage() {
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

  const { data: donations } = await supabase
    .from('donations')
    .select(
      'id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date, received_at, donors(name)',
    )
    .order('received_at', { ascending: false })

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.donationsPage.title}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.donationsPage.subtitle}</p>
        </div>
        <Link
          href="/donations/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
        >
          {dict.donationsPage.addNew}
        </Link>
      </header>

      {!donations || donations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.table.noRecords}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.table.itemName}</th>
                <th className="px-4 py-2 font-medium">{dict.form.category}</th>
                <th className="px-4 py-2 font-medium">{dict.table.receivedQty}</th>
                <th className="px-4 py-2 font-medium">{dict.table.remainingQty}</th>
                <th className="px-4 py-2 font-medium">{dict.table.expiryDate}</th>
                <th className="px-4 py-2 font-medium">{dict.table.donor}</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{d.item_name}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {CATEGORY_LABEL[d.category] ?? d.category}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {d.quantity_received} {unitLabel(d.unit, locale)}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {d.quantity_remaining} {unitLabel(d.unit, locale)}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{d.expiry_date ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {(d.donors as unknown as { name?: string } | null)?.name ?? dict.table.anonymousDonor}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/donations/${d.id}/receipt`}
                      className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      {dict.table.receiptLink}
                    </Link>
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
