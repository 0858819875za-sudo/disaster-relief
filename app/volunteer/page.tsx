// =====================================================================
// หน้าหลักของอาสาสมัคร — แยกจาก dashboard ของ staff/admin โดยเจตนา
//
// ขอบเขตสิทธิ์อาสาสมัคร (ตามที่ตกลงกันไว้):
//   - ดูข้อมูลศูนย์ตัวเอง: คำขอที่ยังไม่ปิด + รายการที่รอส่งมอบ (อ่านอย่างเดียว)
//   - ทำได้อย่างเดียว: กดยืนยันว่าของถึงศูนย์แล้ว (mark_delivered)
//   - ทำไม่ได้: บันทึกของเข้าคลัง, สร้าง/แก้คำขอ, จัดการผู้บริจาค, หน้า admin
//     (บังคับด้วย RLS ใน docs/sql/13_volunteer_role.sql อีกชั้นหนึ่ง
//     ไม่ได้พึ่งแค่การซ่อนปุ่มในหน้านี้)
// =====================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { confirmReceipt } from './actions'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { sortByUrgency } from '@/lib/urgency'

export default async function VolunteerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, role, center_id, centers(name, type)')
    .eq('id', user.id)
    .single()

  // หน้านี้เฉพาะอาสาสมัครเท่านั้น — staff/admin ใช้ dashboard ปกติที่ /
  if (profile?.role !== 'volunteer') {
    redirect('/')
  }

  const center = profile.centers as unknown as { name?: string; type?: string } | null

  const [{ data: requestRows }, { data: pending }] = await Promise.all([
    profile.center_id
      ? supabase
          .from('requests')
          .select('id, item_name, category, quantity_requested, quantity_fulfilled, urgency, status')
          .neq('status', 'fulfilled')
          .neq('status', 'cancelled')
      : Promise.resolve({ data: [] }),
    profile.center_id
      ? supabase
          .from('allocations')
          .select('id, quantity_allocated, requests!inner(item_name, center_id), donations(unit)')
          .eq('status', 'allocated')
          .eq('requests.center_id', profile.center_id)
      : Promise.resolve({ data: [] }),
  ])
  const requests = requestRows ? sortByUrgency([...requestRows]) : null

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {dict.volunteer.greeting} {profile.full_name || profile.username || dict.volunteer.defaultName}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {center?.name
            ? `${dict.volunteer.assignedAt} ${center.name} (${center.type === 'warehouse' ? dict.admin.centerTypeWarehouse : dict.admin.centerTypeShelter})`
            : dict.volunteer.noCenterAssigned}
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          {dict.volunteer.pendingDeliverySection}
        </h2>
        {!pending || pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            {dict.volunteer.noPendingDelivery}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full min-w-[480px] whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.item}</th>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.quantity}</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const req = p.requests as unknown as { item_name?: string } | null
                  const don = p.donations as unknown as { unit?: string } | null
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{req?.item_name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {p.quantity_allocated} {don?.unit}
                      </td>
                      <td className="px-4 py-2">
                        <form action={confirmReceipt}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            className="rounded-md bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800"
                          >
                            {dict.volunteer.confirmReceived}
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          {dict.volunteer.openRequestsSection}
        </h2>
        {!requests || requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            {dict.volunteer.noOpenRequests}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <table className="w-full min-w-[480px] whitespace-nowrap text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.item}</th>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.requested}</th>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.fulfilled}</th>
                  <th className="px-4 py-2 font-medium">{dict.volunteer.urgency}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
