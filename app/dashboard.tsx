import Link from 'next/link'
import type { createClient } from '@/lib/supabase/server'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locale'

type Props = {
  supabase: Awaited<ReturnType<typeof createClient>>
  dict: Dictionary
  locale: Locale
  name: string
  isAdmin: boolean
}

function Icon({ kind = 0 }: { kind?: number }) {
  const paths = ['M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10', 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6', 'm12 3 10 18H2L12 3Zm0 6v5m0 3v1', 'M3 6h12v12H3V6Zm12 5h4l3 4v3h-7M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4']
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind % paths.length]} /></svg>
}

export async function Dashboard({ supabase, dict, locale, name, isAdmin }: Props) {
  const t = dict.dashboard
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const dayStart = `${day}T00:00:00+07:00`
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString()
  const number = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US')
  const categories = [
    ['food', dict.form.categoryFood], ['water', dict.form.categoryWater],
    ['medicine', dict.form.categoryMedicine], ['clothing', dict.form.categoryClothing],
    ['hygiene', dict.form.categoryHygiene], ['other', dict.form.categoryOther],
  ]
  const [stock, pending, urgent, delivered, recent, pledges, expiring, activity, ...categoryCounts] = await Promise.all([
    supabase.from('donations').select('id', { count: 'exact', head: true }).gt('quantity_remaining', 0),
    supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partial']),
    supabase.from('requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'partial']).eq('urgency', 'high'),
    supabase.from('allocations').select('id', { count: 'exact', head: true }).eq('status', 'delivered').gte('delivered_at', dayStart).lt('delivered_at', dayEnd),
    supabase.from('requests').select('id, item_name, urgency, status, created_at, centers(name)').order('created_at', { ascending: false }).limit(5),
    supabase.from('donation_pledges').select('id', { count: 'exact', head: true }).in('status', ['pending', 'contacted']),
    supabase.from('donations').select('id', { count: 'exact', head: true }).gt('quantity_remaining', 0).gte('expiry_date', day).lte('expiry_date', new Date(new Date(dayStart).getTime() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })),
    supabase.from('allocations').select('id, allocated_at, requests(item_name)').order('allocated_at', { ascending: false }).limit(4),
    ...categories.map(([category]) => supabase.from('donations').select('id', { count: 'exact', head: true }).gt('quantity_remaining', 0).eq('category', category)),
  ])
  const count = (result: { count: number | null; error: unknown }) => result.error || result.count === null ? '—' : number.format(result.count)
  const panel = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const muted = 'text-sm text-slate-500 dark:text-slate-400'
  const tones = ['bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300', 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300', 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300']
  const stats = [
    { label: t.stock, hint: t.stockHint, result: stock, href: '/inventory' },
    { label: t.pending, hint: t.pendingHint, result: pending, href: '/requests' },
    { label: t.urgent, hint: t.urgentHint, result: urgent, href: '/requests' },
    { label: t.delivered, hint: t.deliveredHint, result: delivered, href: '/allocations/history?status=delivered&from=' + day + '&to=' + day },
  ]
  const menus = [
    ['/donations', dict.home.donationsLabel, dict.home.donationsDesc],
    ['/inventory', dict.home.inventoryLabel, dict.home.inventoryDesc],
    ['/requests', dict.home.requestsLabel, dict.home.requestsDesc],
    ['/allocations', dict.home.allocationsLabel, dict.home.allocationsDesc],
    ['/donors', dict.home.donorsLabel, dict.home.donorsDesc],
    ...(isAdmin ? [['/admin/centers', dict.home.adminLabel, dict.home.adminDesc]] : []),
    ['/pledges', dict.home.pledgesLabel, dict.home.pledgesDesc],
    ['/help-requests', dict.home.helpRequestsLabel, dict.home.helpRequestsDesc],
  ]
  const status: Record<string, string> = { pending: dict.requests.statusPending, partial: dict.requests.statusPartial, fulfilled: dict.requests.statusFulfilled, cancelled: dict.requests.statusCancelled }
  const urgency: Record<string, string> = { high: dict.requests.urgencyHigh, medium: dict.requests.urgencyMedium, low: dict.requests.urgencyLow }
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
  const hasError = [stock, pending, urgent, delivered, recent, pledges, expiring, activity, ...categoryCounts].some(result => result.error)

  return <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-7 text-brand sm:px-6 dark:text-slate-100">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
      <div><h1 className="text-2xl font-semibold sm:text-3xl">{t.greeting}, {name}</h1><p className={`mt-2 ${muted}`}>{t.subtitle}</p></div>
      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-white hover:bg-brand-deep" href="/donations/new"><span aria-hidden="true">＋</span>{dict.home.donationsLabel}</Link>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" href="/allocations"><Icon />{dict.home.allocationsLabel}</Link>
      </div>
    </header>
    {hasError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.loadError}</p>}
    <section aria-label={t.overview} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat, i) => <Link key={stat.label} href={stat.href} className={`${panel} flex items-center gap-4 transition hover:border-slate-400`}><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tones[i]}`}><Icon kind={i} /></span><div><h2 className="text-sm font-semibold">{stat.label}</h2><p className={`my-1 text-3xl font-bold tabular-nums ${i === 2 ? 'text-red-600 dark:text-red-400' : ''}`}>{count(stat.result)} <span className="text-sm font-medium">{i === 0 ? t.lots : t.records}</span></p><p className="text-xs text-slate-500 dark:text-slate-400">{stat.hint}</p></div></Link>)}
    </section>
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <section className={`${panel} min-w-0 lg:col-span-2`}><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">{t.recentRequests}</h2><Link className="text-sm text-sky-700 hover:underline dark:text-sky-400" href="/requests">{t.viewAll} →</Link></div>
        {recent.error ? <p className={muted}>{t.loadError}</p> : !recent.data?.length ? <p className={`${muted} py-10 text-center`}>{dict.requests.noRequests}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>{[dict.requests.center, dict.requests.item, dict.requests.urgency, dict.common.status, t.date].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{recent.data.map(row => <tr key={row.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-3 py-4">{(row.centers as unknown as { name: string } | null)?.name ?? '—'}</td><td className="px-3 py-4">{row.item_name}</td><td className="px-3 py-4"><span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${row.urgency === 'high' ? tones[2] : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{urgency[row.urgency] ?? row.urgency}</span></td><td className="px-3 py-4">{status[row.status] ?? row.status}</td><td className="whitespace-nowrap px-3 py-4 text-slate-500 dark:text-slate-400">{formatDate(row.created_at)}</td></tr>)}</tbody></table></div>}
      </section>
      <section className={panel}><h2 className="mb-4 font-semibold">{t.todo}</h2><div className="space-y-2">{[[t.pending, pending, '/requests'], [dict.home.pledgesLabel, pledges, '/pledges'], [t.expiring, expiring, '/inventory']] .map(([label, result, href], i) => <Link key={String(href)} href={String(href)} className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><Icon kind={i + 1} /><span className="flex-1 text-sm font-medium">{String(label)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm tabular-nums dark:bg-slate-800">{count(result as typeof pending)}</span><span aria-hidden="true" className="text-slate-400">›</span></Link>)}</div><p className={`mt-3 text-xs ${muted}`}>{t.expiryHint}</p></section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={panel}><h2 className="font-semibold">{t.inventory}</h2><p className={`mb-4 mt-1 ${muted}`}>{t.inventoryHint}</p><div className="space-y-3">{categories.map(([key, label], i) => {
        const result = categoryCounts[i]
        const percent = !stock.error && !result.error && stock.count ? Math.min(100, (result.count ?? 0) / stock.count * 100) : 0
        return <div key={key} className="grid grid-cols-[90px_1fr_64px] items-center gap-3 text-sm"><span>{label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-sky-600 dark:bg-sky-400" style={{ width: `${percent}%` }} /></div><span className="text-right tabular-nums">{count(result)} {t.lots}</span></div>
      })}</div></section>
      <section className={panel}><div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold">{t.activity}</h2><Link href="/allocations/history" className="text-sm text-sky-700 hover:underline dark:text-sky-400">{t.viewAll} →</Link></div>{activity.error ? <p className={muted}>{t.loadError}</p> : !activity.data?.length ? <p className={`${muted} py-8 text-center`}>{t.noActivity}</p> : <ol className="space-y-5">{activity.data.map(row => <li key={row.id} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" /><time className="w-16 shrink-0 text-slate-500 dark:text-slate-400" dateTime={row.allocated_at}>{formatDate(row.allocated_at)}</time><span><span className="font-medium">{t.allocated}</span><span className="ml-2 text-slate-500 dark:text-slate-400">{(row.requests as unknown as { item_name: string } | null)?.item_name ?? '—'}</span></span></li>)}</ol>}</section>
    </div>
    <section className={panel}><h2 className="mb-4 font-semibold">{t.menus}</h2><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{menus.map(([href, label, desc], i) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><span className="shrink-0"><Icon kind={i} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p></div><span aria-hidden="true" className="text-slate-400">›</span></Link>)}</div></section>
  </main>
}
