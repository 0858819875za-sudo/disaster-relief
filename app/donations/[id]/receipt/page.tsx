import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintButton } from './print-button'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { unitLabel } from '@/lib/units'

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = getDictionary(locale)

  const { data: donation } = await supabase
    .from('donations')
    .select(
      'item_name, category, unit, quantity_received, expiry_date, received_at, donors(name, phone), centers(name), profiles(full_name, username)',
    )
    .eq('id', id)
    .single()

  if (!donation) notFound()

  const donor = donation.donors as unknown as { name?: string; phone?: string } | null
  const center = donation.centers as unknown as { name?: string } | null
  const receiver = donation.profiles as unknown as { full_name?: string; username?: string } | null

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-12 print:py-0">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none dark:border-slate-700 dark:bg-slate-900">
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{dict.receipt.title}</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{center?.name ?? '—'}</p>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.table.donor}</dt>
            <dd className="text-slate-900 dark:text-slate-100">{donor?.name ?? dict.table.anonymousDonor}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.receipt.item}</dt>
            <dd className="text-slate-900 dark:text-slate-100">{donation.item_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.form.quantity}</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {donation.quantity_received} {unitLabel(donation.unit, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.table.expiryDate}</dt>
            <dd className="text-slate-900 dark:text-slate-100">{donation.expiry_date ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.receipt.receivedDate}</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {new Date(donation.received_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'th-TH', {
                dateStyle: 'medium',
                timeZone: 'Asia/Bangkok',
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">{dict.receipt.receivedBy}</dt>
            <dd className="text-slate-900 dark:text-slate-100">{receiver?.full_name || receiver?.username || '—'}</dd>
          </div>
        </dl>

        <p className="mt-8 text-center text-xs text-slate-400">{dict.receipt.thanks}</p>
      </div>

      <PrintButton label={dict.receipt.print} />
    </main>
  )
}
