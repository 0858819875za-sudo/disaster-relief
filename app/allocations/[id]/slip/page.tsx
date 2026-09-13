// =====================================================================
// ใบส่งมอบของ (F5) — หลักฐานตอนส่งของจากศูนย์ต้นทางถึงศูนย์ปลายทาง
// พิมพ์ได้ (ใช้ PrintButton ตัวเดียวกับใบรับของบริจาคของ F2)
// =====================================================================

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaffOrAdmin } from '@/lib/guard'
import { PrintButton } from '@/app/donations/[id]/receipt/print-button'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'

export default async function AllocationSlipPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  await requireStaffOrAdmin(supabase)
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const { data: allocation } = await supabase
    .from('allocations')
    .select(
      'id, quantity_allocated, status, allocated_at, delivered_at, allocated_by_name, requests(item_name, centers(name)), donations(item_name, unit, expiry_date, centers(name))',
    )
    .eq('id', id)
    .maybeSingle()

  if (!allocation || allocation.status === 'cancelled') notFound()

  const req = allocation.requests as unknown as { item_name?: string; centers?: { name?: string } } | null
  const don = allocation.donations as unknown as {
    item_name?: string
    unit?: string
    expiry_date?: string | null
    centers?: { name?: string }
  } | null

  const dateLocale = locale === 'th' ? 'th-TH' : 'en-GB'
  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
      : '—'

  const STATUS_LABEL: Record<string, string> = {
    allocated: dict.allocations.statusAllocated,
    delivered: dict.allocations.statusDelivered,
  }

  const rows: [string, string][] = [
    [dict.allocations.slipNo, allocation.id.slice(0, 8).toUpperCase()],
    [dict.allocations.allocatedAt, formatDate(allocation.allocated_at)],
    [dict.allocations.item, req?.item_name ?? don?.item_name ?? '—'],
    [dict.form.quantity, `${allocation.quantity_allocated} ${unitLabel(don?.unit, locale)}`],
    [dict.table.expiryDate, don?.expiry_date ?? '—'],
    [dict.allocations.sourceCenter, don?.centers?.name ?? '—'],
    [dict.allocations.receivingCenter, req?.centers?.name ?? '—'],
    [dict.allocations.allocatedBy, allocation.allocated_by_name ?? '—'],
    [dict.common.status, STATUS_LABEL[allocation.status] ?? allocation.status],
    [dict.allocations.deliveredAt, formatDate(allocation.delivered_at)],
  ]

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12 print:py-0">
      <Link
        href="/allocations/history"
        className="mb-4 inline-block text-sm font-medium text-slate-600 underline hover:text-slate-900 print:hidden dark:text-slate-300 dark:hover:text-white"
      >
        {dict.allocations.backToHistory}
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none dark:border-slate-700 dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{dict.allocations.slipTitle}</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">WalaiTrack</p>

        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="text-right text-slate-900 dark:text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <div>
            <div className="mb-2 border-b border-slate-400 pb-8" />
            {dict.allocations.slipSignDeliver}
          </div>
          <div>
            <div className="mb-2 border-b border-slate-400 pb-8" />
            {dict.allocations.slipSignReceive}
          </div>
        </div>
      </div>

      <PrintButton label={dict.allocations.printSlip} />
    </main>
  )
}
