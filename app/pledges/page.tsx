// =====================================================================
// หน้ารายการคำร้องขอบริจาค (staff ตรวจสอบ) — มาจากฟอร์มสาธารณะ /pledge
// =====================================================================

import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmPledge, dismissPledge } from './actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCenterPicker } from '@/lib/center-choice'
import { CenterSelect } from '@/app/center-select'

export default async function PledgesPage({
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
  const STATUS_LABEL: Record<string, string> = {
    pending: dict.queue.statusPending,
    contacted: dict.queue.statusContacted,
    confirmed: dict.queue.statusConfirmed,
    dismissed: dict.queue.statusDismissed,
  }

  const { data: pledges } = await supabase
    .from('donation_pledges')
    .select('*')
    .order('created_at', { ascending: false })

  // admin ที่ไม่มีศูนย์ต้องเลือกศูนย์รับบริจาคก่อนยืนยัน (ของจะเข้าคลังศูนย์นั้น)
  const centers = await getCenterPicker(supabase, 'warehouse')

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{dict.pledgeQueue.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dict.pledgeQueue.subtitle}</p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {!pledges || pledges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.pledgeQueue.noPledges}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.pledgeQueue.reporter}</th>
                <th className="px-4 py-2 font-medium">{dict.pledgeQueue.item}</th>
                <th className="px-4 py-2 font-medium">{dict.pledgeQueue.quantity}</th>
                <th className="px-4 py-2 font-medium">{dict.common.status}</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                    {p.donor_name}
                    <div className="text-xs text-slate-400">{p.donor_phone ?? p.donor_email ?? '—'}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                    {p.item_name}{' '}
                    <span className="text-xs text-slate-400">
                      ({CATEGORY_LABEL[p.category] ?? p.category})
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.quantity}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="px-4 py-2">
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <form action={confirmPledge} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={p.id} />
                          {centers && (
                            <CenterSelect
                              centers={centers}
                              label={dict.common.center}
                              placeholder={dict.common.selectCenter}
                              compact
                            />
                          )}
                          {/* ฟอร์มสาธารณะไม่มีช่องหน่วย — เจ้าหน้าที่ระบุตอนรับของจริง */}
                          <input
                            name="unit"
                            required
                            defaultValue="ชิ้น"
                            aria-label={dict.donationNew.unit}
                            title={dict.donationNew.unit}
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <button
                            type="submit"
                            className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            {dict.queue.confirm}
                          </button>
                        </form>
                        <form action={dismissPledge}>
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
