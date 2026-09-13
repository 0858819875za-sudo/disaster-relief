// =====================================================================
// ประวัติการจัดสรร (F5) — หลักฐานตรวจสอบย้อนหลังว่าของแต่ละล็อตถูกส่งไปที่ไหน
// แสดงศูนย์ต้นทาง/ปลายทาง วันที่จัดสรร และวันที่ส่งมอบ
// เห็นเฉพาะรายการที่ศูนย์ตัวเองเกี่ยวข้อง / admin เห็นทั้งหมด (allocations_select)
// =====================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { confirmDelivery, cancelAllocation } from '../actions'
import { ConfirmSubmitButton } from '../confirm-submit-button'
import { PageHeader } from '../../page-header'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'

// สีป้ายสถานะ — ให้ความหมายตรงกันทั้งเว็บ: ฟ้า=กำลังดำเนินการ,
// เขียว=จบสมบูรณ์, แดง=ยกเลิก (ชุดสีเดียวกับที่ F2 ใช้ในตารางของบริจาค)
const STATUS_PILL: Record<string, string> = {
  allocated: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  delivered: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

export default async function AllocationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
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
        })
      : '—'

  // ยกเลิกการจัดสรรเป็นสิทธิ์ admin เท่านั้น (บังคับซ้ำใน cancel_allocation
  // เองอยู่แล้ว) เช็คตรงนี้แค่เพื่อไม่โชว์ปุ่มที่กดแล้วจะโดนปฏิเสธเปล่าๆ
  const [{ data: me }, { data: allocations }] = await Promise.all([
    supabase.from('profiles').select('role, center_id').eq('id', user.id).single(),
    supabase
      .from('allocations')
      .select(
        'id, quantity_allocated, status, allocated_at, delivered_at, requests(item_name, center_id, centers(name)), donations(item_name, unit, centers(name))',
      )
      .order('allocated_at', { ascending: false }),
  ])
  const isAdmin = me?.role === 'admin'

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

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {!allocations || allocations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
          {dict.allocations.noAllocations}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[880px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">{dict.allocations.allocatedAt}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.item}</th>
                <th className="px-4 py-2 font-medium">{dict.form.quantity}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.sourceCenter}</th>
                <th className="px-4 py-2 font-medium">{dict.allocations.receivingCenter}</th>
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
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(a.allocated_at)}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-100">
                      {req?.item_name ?? don?.item_name ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {a.quantity_allocated} {don?.unit}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{don?.centers?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{req?.centers?.name ?? '—'}</td>
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
                    </td>
                    <td className="px-4 py-2">
                      {a.status === 'allocated' && (
                        <div className="flex items-center gap-2">
                          {canDeliver && (
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
                          {isAdmin && (
                            <form action={cancelAllocation}>
                              <input type="hidden" name="id" value={a.id} />
                              <ConfirmSubmitButton
                                message={dict.allocations.cancelConfirm}
                                title={dict.allocations.cancelAllocation}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </ConfirmSubmitButton>
                            </form>
                          )}
                        </div>
                      )}
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
