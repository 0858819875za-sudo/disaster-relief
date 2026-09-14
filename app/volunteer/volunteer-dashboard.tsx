import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'
import { ErrorDialog } from '../allocations/error-dialog'
import { DeliverButton } from '../allocations/deliver-dialog'
import { confirmReceipt } from './actions'

type RequestRow = {
  id: string; item_name: string; category: string; quantity_requested: number
  quantity_fulfilled: number; urgency: string
}
type Delivery = {
  id: string; quantity_allocated: number; delivered_at?: string | null
  received_quantity?: number | null
  requests: unknown; donations: unknown
}
type Props = {
  dict: Dictionary; locale: Locale; name: string; error?: string
  center: { name: string; type: string; address: string | null; contact_phone: string | null } | null
  requests: RequestRow[]; pending: Delivery[]; history: Delivery[]
  counts: (number | null)[]; loadError: boolean
  failed: { requests: boolean; pending: boolean; history: boolean }
}

function Icon({ kind = 0 }: { kind?: number }) {
  const paths = [
    'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10',
    'm12 3 10 18H2L12 3Zm0 6v5m0 3v1',
    'M8 5H5v16h14V5h-3M9 3h6v4H9V3Zm0 9h6m-6 4h4',
    'm8 12 3 3 6-7M21 12a9 9 0 1 1-4-7.5',
    'M4 21V5h10v16M14 10h6v11M2 21h20M8 8h2m-2 4h2m-2 4h2',
  ]
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}

export function VolunteerDashboard({ dict, locale, name, center, requests, pending, history, counts, error, failed, loadError }: Props) {
  const t = dict.volunteerDashboard
  const v = dict.volunteer
  const number = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US')
  const format = (value: number | null) => value === null ? '—' : number.format(value)
  const panel = 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const heading = 'flex items-center gap-3 border-b border-slate-100 px-5 py-4 font-semibold dark:border-slate-800'
  const muted = 'text-sm text-slate-500 dark:text-slate-400'
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand px-4 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 dark:border-slate-600 dark:hover:bg-slate-800'
  const tones = [
    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
    'bg-sky-50 text-blue-700 dark:bg-sky-950 dark:text-sky-300',
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ]
  const categories: Record<string, string> = {
    food: dict.form.categoryFood, water: dict.form.categoryWater,
    medicine: dict.form.categoryMedicine, clothing: dict.form.categoryClothing,
    hygiene: dict.form.categoryHygiene, other: dict.form.categoryOther,
  }
  const urgency: Record<string, string> = { high: dict.requests.urgencyHigh, medium: dict.requests.urgencyMedium, low: dict.requests.urgencyLow }
  const itemName = (row: Delivery) => (row.requests as { item_name?: string } | null)?.item_name ?? '—'
  const unit = (row: Delivery) => (row.donations as { unit?: string } | null)?.unit ?? ''
  const next = pending[0]
  const phone = center?.contact_phone?.replace(/[^\d+]/g, '')
  const a = dict.allocations
  // กรอกจำนวนที่ได้รับจริงก่อนยืนยัน — ได้รับไม่ครบต้องมีหมายเหตุ (mark_delivered)
  const receiptForm = (row: Delivery) => <DeliverButton
    id={row.id} itemName={itemName(row)} allocated={row.quantity_allocated} unit={unit(row)}
    action={confirmReceipt} variant="button"
    labels={{
      button: v.confirmReceived, title: a.deliverTitle, message: a.deliverMessage,
      allocated: a.allocatedQuantity, received: a.receivedQuantity, note: a.deliveryNote,
      notePlaceholder: a.deliveryNotePlaceholder, noteRequired: a.deliveryNoteRequired,
      back: a.close, submit: a.deliverSubmit,
    }}
  />

  return <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-7 text-brand sm:px-6 dark:text-slate-100">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold leading-relaxed sm:text-3xl">{v.greeting} {name} <span aria-hidden="true">👋</span></h1>
        <p className={`mt-2 ${muted}`}>{center?.name ? `${v.assignedAt} ${center.name} (${center.type === 'warehouse' ? dict.admin.centerTypeWarehouse : dict.admin.centerTypeShelter})` : v.noCenterAssigned}</p>
      </div>
      <a href="#delivery-history" className={button}><Icon kind={2} />{t.viewHistory}</a>
    </header>

    {error && <ErrorDialog key={error} title={dict.allocations.errorTitle} message={error} closeLabel={dict.allocations.close} clearHref="/volunteer" />}
    {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.loadError}</p>}

    <section aria-label={t.overview} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[t.waiting, t.urgent, t.open, t.delivered].map((label, i) => <div key={label} className={`${panel} flex items-center gap-4 p-5`}>
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${tones[i]}`}><Icon kind={i} /></span>
        <div><h2 className="text-sm font-semibold">{label}</h2><p className="mt-1 text-3xl font-bold tabular-nums">{format(counts[i])} <span className={`text-sm font-normal ${muted}`}>{t.records}</span></p></div>
      </div>)}
    </section>

    <div className="grid items-start gap-4 lg:grid-cols-3">
      <section className={`${panel} lg:col-span-2`}>
        <h2 className={heading}><Icon kind={2} />{t.next}</h2>
        {failed.pending ? <p className={`p-6 ${muted}`}>{t.loadError}</p> : !next ? <p className={`p-10 text-center ${muted}`}>{v.noPendingDelivery}</p> : <div className="space-y-5 p-5">
          <div className="flex items-center gap-4"><span className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><Icon /></span><div><h3 className="text-xl font-semibold">{itemName(next)}</h3><p className="mt-1 text-lg">{format(next.quantity_allocated)} {unit(next)}</p></div></div>
          <p className={muted}>{t.destination}: <span className="font-medium text-brand dark:text-slate-200">{center?.name ?? '—'}</span></p>
          <ol aria-label={dict.common.status} className="grid grid-cols-3 py-2 text-center text-xs sm:text-sm">
            {[t.allocated, t.awaiting, t.completed].map((label, i) => <li key={label} aria-current={i === 1 ? 'step' : undefined} className={`border-t-2 pt-3 ${i < 2 ? 'border-blue-600 text-blue-700 dark:border-sky-400 dark:text-sky-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}><span className={`mx-auto -mt-6 mb-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${i < 2 ? 'border-blue-600 bg-white dark:border-sky-400 dark:bg-slate-900' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`} aria-hidden="true">{i === 0 ? '✓' : i === 1 ? '•' : ''}</span>{label}</li>)}
          </ol>
          <div className="flex flex-wrap gap-3">{receiptForm(next)}<a href="#pending-deliveries" className={button}>{t.viewPending}</a></div>
        </div>}
      </section>
      <section className={panel}>
        <h2 className={heading}><Icon kind={4} />{t.center}</h2>
        <div className="space-y-4 p-5">
          <div><h3 className="font-semibold">{center?.name ?? v.noCenterAssigned}</h3>{center && <p className={`mt-1 ${muted}`}>{center.type === 'warehouse' ? dict.admin.centerTypeWarehouse : dict.admin.centerTypeShelter}</p>}</div>
          {center?.address && <p className={`border-t border-slate-100 pt-4 dark:border-slate-800 ${muted}`}>{center.address}</p>}
          {center?.contact_phone && <p className={muted}>{dict.admin.contactPhone}: {center.contact_phone}</p>}
          {!center?.address && !center?.contact_phone && <p className={muted}>{t.noContact}</p>}
          <div className="flex flex-wrap gap-2">
            {center?.address && <a className={button} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${center.name} ${center.address}`)}`} target="_blank" rel="noopener noreferrer">{t.map}</a>}
            {phone && <a className={button} href={`tel:${phone}`}>{t.call}</a>}
          </div>
        </div>
      </section>
    </div>

    <section className={panel}>
      <h2 className={heading}><Icon kind={2} />{v.openRequestsSection}</h2>
      {failed.requests ? <p className={`p-6 ${muted}`}>{t.loadError}</p> : !requests.length ? <p className={`p-8 text-center ${muted}`}>{v.noOpenRequests}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr>{[v.item, v.requested, v.fulfilled, t.remaining, t.progress, v.urgency].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{requests.map(row => {
          const progress = row.quantity_requested > 0 ? Math.max(0, Math.min(100, Math.round(row.quantity_fulfilled / row.quantity_requested * 100))) : 0
          return <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-5 py-4 font-medium">{row.item_name} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({categories[row.category] ?? row.category})</span></td>
            <td className="px-5 py-4 tabular-nums">{format(row.quantity_requested)}</td><td className="px-5 py-4 tabular-nums">{format(row.quantity_fulfilled)}</td><td className="px-5 py-4 tabular-nums">{format(Math.max(0, row.quantity_requested - row.quantity_fulfilled))}</td>
            <td className="px-5 py-4"><div className="flex items-center gap-3"><progress className="h-2 w-28 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-500 [&::-moz-progress-bar]:bg-blue-500 dark:[&::-webkit-progress-bar]:bg-slate-800" max={100} value={progress} aria-label={`${t.progress}: ${row.item_name}`} /><span className="text-xs tabular-nums">{progress}%</span></div></td>
            <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${row.urgency === 'high' ? tones[1] : row.urgency === 'medium' ? tones[0] : tones[3]}`}>{urgency[row.urgency] ?? row.urgency}</span></td>
          </tr>
        })}</tbody>
      </table></div>}
    </section>

    <section id="pending-deliveries" className={`${panel} scroll-mt-6`}>
      <h2 className={heading}><Icon />{v.pendingDeliverySection}</h2>
      {failed.pending ? <p className={`p-6 ${muted}`}>{t.loadError}</p> : !pending.length ? <p className={`p-6 ${muted}`}>{v.noPendingDelivery}</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{pending.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><h3 className="font-medium">{itemName(row)}</h3><p className={`mt-1 ${muted}`}>{format(row.quantity_allocated)} {unit(row)}</p></div>{receiptForm(row)}</li>)}</ul>}
    </section>

    <div className="grid items-start gap-4 lg:grid-cols-3">
      <aside className={panel}><h2 className={heading}><Icon kind={1} />{t.guidance}</h2><p className={`p-5 leading-relaxed ${muted}`}>{t.guidanceText}</p></aside>
      <section id="delivery-history" className={`${panel} scroll-mt-6 lg:col-span-2`}>
        <h2 className={heading}><Icon kind={3} />{t.history}</h2>
        {failed.history ? <p className={`p-6 ${muted}`}>{t.loadError}</p> : !history.length ? <p className={`p-6 ${muted}`}>{t.noHistory}</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{history.map(row => <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
          <span className="h-2 w-2 rounded-full bg-brand dark:bg-sky-400" aria-hidden="true" />
          <time className="text-xs text-slate-500 dark:text-slate-400" dateTime={row.delivered_at ?? undefined}>{row.delivered_at ? new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(row.delivered_at)) : '—'}</time>
          <span className="flex-1 font-medium">{itemName(row)}</span><span>{format(row.quantity_allocated)} {unit(row)}{row.received_quantity != null && row.received_quantity < row.quantity_allocated && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">({a.receivedShort} {format(row.received_quantity)})</span>}</span><span className={`rounded-full px-3 py-1 text-xs ${tones[3]}`}>{t.completed}</span>
        </li>)}</ul>}
      </section>
    </div>
    <p className={`text-center text-xs ${muted}`}>{t.scope}</p>
  </main>
}
