// =====================================================================
// หน้าคลังสินค้า + Dashboard (F3)
// =====================================================================

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/locale'
import { getDictionary } from '@/lib/i18n/dictionaries'
import InventoryTable from './InventoryTable'

type StockRow = {
  center_id: string
  category: string
  item_name: string
  unit: string
  total_remaining: number
  lot_count: number
  nearest_expiry: string | null
}

type ShortageRow = {
  category: string
  item_name: string
  shortage: number
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const CATEGORY_COLORS: Record<string, { bg: string; hex: string }> = {
  water: { bg: 'bg-blue-500 dark:bg-blue-600', hex: '#3b82f6' },
  food: { bg: 'bg-emerald-500 dark:bg-emerald-600', hex: '#10b981' },
  medicine: { bg: 'bg-amber-500 dark:bg-amber-600', hex: '#f59e0b' },
  clothing: { bg: 'bg-purple-500 dark:bg-purple-600', hex: '#a855f7' },
  hygiene: { bg: 'bg-pink-500 dark:bg-pink-600', hex: '#ec4899' },
  other: { bg: 'bg-slate-400 dark:bg-slate-500', hex: '#94a3b8' },
}
const DEFAULT_COLOR = { bg: 'bg-slate-400 dark:bg-slate-500', hex: '#94a3b8' }

export default async function InventoryPage() {
  const supabase = await createClient()
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const renderPlural = (count: number, word: string) => {
    if (locale === 'th') return word;
    if (count <= 1) return word;
    if (word === 'box') return 'boxes'; 
    if (word.endsWith('s')) return word; // <--- เพิ่มตัวดัก ป้องกัน s ซ้อน (itemss)
    return `${word}s`;
  }

  const CATEGORY_LABEL: Record<string, string> = {
    food: dict.form.categoryFood,
    water: dict.form.categoryWater,
    medicine: dict.form.categoryMedicine,
    clothing: dict.form.categoryClothing,
    hygiene: dict.form.categoryHygiene,
    other: dict.form.categoryOther,
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, center_id, centers(name)')
    .eq('id', user.id)
    .single()

  const [{ data: stock }, { data: shortage }, { data: centers }] = await Promise.all([
    supabase
      .from('v_stock_summary')
      .select('*')
      .order('nearest_expiry', { ascending: true, nullsFirst: false }),
    supabase.from('v_shortage_ranking').select('*').limit(5),
    supabase.from('centers').select('id, name'),
  ])

  const centerName = new Map((centers ?? []).map((c) => [c.id as string, c.name as string]))
  const stockRows = (stock ?? []) as StockRow[]
  const shortageRows = (shortage ?? []) as ShortageRow[]

  const isAdmin = profile?.role === 'admin'
  const centerLabel = (profile?.centers as unknown as { name?: string } | null)?.name

  const totalUniqueItems = stockRows.length
  const expiredCount = stockRows.filter((row) => row.nearest_expiry !== null && daysUntil(row.nearest_expiry) < 0).length
  const expiringSoonCount = stockRows.filter((row) => row.nearest_expiry !== null && daysUntil(row.nearest_expiry) >= 0 && daysUntil(row.nearest_expiry) <= 7).length

  const categoryCounts = stockRows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  let currentPercent = 0
  const conicStops = Object.entries(categoryCounts)
    .map(([cat, count]) => {
      const pct = (count / (totalUniqueItems || 1)) * 100
      const start = currentPercent
      const end = currentPercent + pct
      currentPercent = end
      const hex = (CATEGORY_COLORS[cat] || DEFAULT_COLOR).hex
      return `${hex} ${start}% ${end}%`
    })
    .join(', ')
  const donutGradient = totalUniqueItems > 0 ? `conic-gradient(${conicStops})` : 'conic-gradient(#e2e8f0 0% 100%)'

  const centerStats = stockRows.reduce((acc, row) => {
    if (!acc[row.center_id]) acc[row.center_id] = { totalItems: 0, categories: {} }
    acc[row.center_id].totalItems += 1
    acc[row.center_id].categories[row.category] = (acc[row.center_id].categories[row.category] || 0) + 1
    return acc
  }, {} as Record<string, { totalItems: number; categories: Record<string, number> }>)
  const maxCenterItems = Math.max(1, ...Object.values(centerStats).map((c) => c.totalItems))

  const shortageWithStock = shortageRows.map((row) => {
    const targetName = row.item_name.toLowerCase().trim()
    
    const matchingStock = stockRows.filter((s) => {
      const stockName = s.item_name.toLowerCase().trim()
      return s.category === row.category && (stockName === targetName || stockName.includes(targetName))
    })
    
    const validStock = matchingStock.filter(s => s.nearest_expiry === null || daysUntil(s.nearest_expiry) >= 0)
    
    const unitGroups: Record<string, number> = {}
    validStock.forEach(s => {
      const u = s.unit.trim()
      unitGroups[u] = (unitGroups[u] || 0) + s.total_remaining
    })

    let primaryUnit = ''
    let maxQty = -1
    Object.entries(unitGroups).forEach(([u, qty]) => {
      if (qty > maxQty) {
        maxQty = qty
        primaryUnit = u
      }
    })
    if (!primaryUnit) primaryUnit = dict.inventory.defaultUnit
    
    const primaryInStock = unitGroups[primaryUnit] || 0

    // ประกาศ Map ตรงนี้เพื่อความชัวร์ 100% ว่าจะอ่านค่าได้บน Server
    const unitThToEnMap: Record<string, string> = {
      'ชุด': 'set', 'ขวด': 'bottle', 'กระป๋อง': 'can', 
      'ถุง': 'bag', 'แพ็ค': 'pack', 'ชิ้น': 'piece', 
      'กล่อง': 'box', 'ลัง': 'crate', 'ผืน': 'piece', 'ห่อ': 'packet'
    }

    const otherUnitsArr: string[] = []
    Object.entries(unitGroups).forEach(([u, qty]) => {
      if (u !== primaryUnit) {
        const translatedU = locale === 'th' ? u : (unitThToEnMap[u] ?? u)
        otherUnitsArr.push(`+${qty} ${renderPlural(qty, translatedU)}`)
      }
    })
    const otherUnitsStr = otherUnitsArr.length > 0 ? ` (${otherUnitsArr.join(', ')})` : ''

    const translatedPrimaryUnit = locale === 'th' ? primaryUnit : (unitThToEnMap[primaryUnit] ?? primaryUnit)
    
    const missing = Math.max(0, row.shortage - primaryInStock)
    const isReady = missing === 0

    return { ...row, inStock: primaryInStock, unit: translatedPrimaryUnit, missing, isReady, otherUnitsStr }
  })

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm dark:text-slate-100">
          {dict.inventory.title}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {isAdmin ? dict.inventory.overviewAll : `${dict.inventory.yourCenter}: ${centerLabel ?? '—'}`}
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col justify-center rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{dict.inventory.totalStockItems}</span>
          <span className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {totalUniqueItems.toLocaleString()} <span className="text-base font-normal text-slate-500">{renderPlural(totalUniqueItems, dict.inventory.items)}</span>
          </span>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-slate-200/80 bg-amber-50 p-5 shadow-sm ring-1 ring-amber-500/20 dark:border-amber-900/30 dark:bg-amber-950/20">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{dict.inventory.expiringSoonTitle}</span>
          <span className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-500">
            {expiringSoonCount.toLocaleString()} <span className="text-base font-normal text-amber-700/60 dark:text-amber-500/60">{renderPlural(expiringSoonCount, dict.inventory.items)}</span>
          </span>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-slate-200/80 bg-red-50 p-5 shadow-sm ring-1 ring-red-500/20 dark:border-red-900/30 dark:bg-red-950/20">
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{dict.inventory.expiredTitle}</span>
          <span className="mt-2 text-3xl font-bold text-red-600 dark:text-red-500">
            {expiredCount.toLocaleString()} <span className="text-base font-normal text-red-700/60 dark:text-red-500/60">{renderPlural(expiredCount, dict.inventory.items)}</span>
          </span>
        </div>
        
        <div className="flex flex-col justify-center rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {dict.inventory.shortageAndReady}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-red-600 dark:text-red-500" title={dict.inventory.actualShortage}>
              {shortageWithStock.filter(r => !r.isReady).length}
            </span>
            <span className="text-xl font-light text-slate-300 dark:text-slate-600">/</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-500" title={dict.inventory.readyToAllocateTitle}>
              {shortageWithStock.filter(r => r.isReady).length}
            </span>
            <span className="text-sm font-normal text-slate-500">
               {renderPlural(shortageWithStock.length, dict.inventory.requests)}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-6 text-sm font-semibold text-slate-800 dark:text-slate-300">
            {dict.inventory.diversityChartTitle}
          </h2>
          {totalUniqueItems === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">{dict.inventory.emptyStock}</div>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full shadow-sm" style={{ background: donutGradient }}>
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-inner dark:bg-slate-900">
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {totalUniqueItems} <span className="text-sm">{renderPlural(totalUniqueItems, dict.inventory.items)}</span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-col">
                {Object.entries(categoryCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => {
                    const colorClass = (CATEGORY_COLORS[cat] || DEFAULT_COLOR).bg
                    const pct = Math.round((count / totalUniqueItems) * 100)
                    return (
                      <div key={cat} className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className={`h-3 w-3 rounded-full ${colorClass}`}></span>
                        <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                        <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-300">
            {dict.inventory.centerChartTitle}
          </h2>
          
          {Object.keys(centerStats).length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 pb-4 dark:border-slate-800">
              {Object.keys(categoryCounts).map((cat) => {
                const colorClass = (CATEGORY_COLORS[cat] || DEFAULT_COLOR).bg
                return (
                  <div key={cat} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`}></span>
                    <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                  </div>
                )
              })}
            </div>
          )}

          {Object.keys(centerStats).length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">{dict.inventory.emptyStock}</div>
          ) : (
            <div className="flex flex-col justify-center gap-5">
              {Object.entries(centerStats).map(([cid, stats]) => (
                <div key={cid} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="truncate">{centerName.get(cid) ?? dict.inventory.unknownCenter}</span>
                    <span className="text-slate-500">{stats.totalItems} {renderPlural(stats.totalItems, dict.inventory.items)}</span>
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                    {Object.entries(stats.categories).map(([cat, count]) => {
                      const colorClass = (CATEGORY_COLORS[cat] || DEFAULT_COLOR).bg
                      const widthPct = (count / maxCenterItems) * 100
                      return (
                        <div
                          key={cat}
                          title={`${CATEGORY_LABEL[cat] ?? cat}: ${count} ${dict.inventory.items}`}
                          className={`h-full ${colorClass} transition-all hover:brightness-110`}
                          style={{ width: `${widthPct}%` }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/5">
          <h2 className="mb-6 text-sm font-semibold text-slate-800 dark:text-slate-300">
            {dict.inventory.shortageStatusTitle} ({shortageWithStock.length} {renderPlural(shortageWithStock.length, dict.inventory.items)})
          </h2>
          {shortageWithStock.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-400">{dict.inventory.noShortage}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {shortageWithStock.map((row) => {
                const stockPct = (Math.min(row.inStock, row.shortage) / row.shortage) * 100
                const missingPct = (row.missing / row.shortage) * 100

                return (
                  <div key={`${row.category}-${row.item_name}`} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {row.item_name} <span className="ml-1 text-xs font-normal text-slate-500">({dict.inventory.target}: {row.shortage} {renderPlural(row.shortage, row.unit)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.isReady ? (
                          <>
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
                              ✅ {dict.inventory.readyToAllocate} ({row.inStock} {renderPlural(row.inStock, row.unit)}) <span className="text-emerald-600/70">{row.otherUnitsStr}</span>
                            </span>
                            <Link href="/allocations" className="inline-flex items-center justify-center rounded-md bg-brand px-3 py-1 text-xs font-medium text-white shadow-sm hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 dark:focus:ring-offset-slate-900 transition-colors">
                              {dict.inventory.allocateBtn}
                            </Link>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20">
                            ❌ {dict.inventory.missingMore} {row.missing} {renderPlural(row.missing, row.unit)} <span className="ml-1 font-normal text-red-500/70">({dict.inventory.alreadyHave} {row.inStock}){row.otherUnitsStr}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                      <div className="flex h-full w-full transition-all">
                        {stockPct > 0 && (
                          <div 
                            className={`h-full ${row.isReady ? 'bg-emerald-500' : 'bg-indigo-500'} hover:brightness-110`} 
                            style={{ width: `${stockPct}%` }}
                            title={`${dict.inventory.alreadyHave}: ${Math.min(row.inStock, row.shortage)} ${renderPlural(Math.min(row.inStock, row.shortage), row.unit)}`}
                          />
                        )}
                        {missingPct > 0 && (
                          <div 
                            className="h-full bg-red-500 hover:brightness-110" 
                            style={{ width: `${missingPct}%` }}
                            title={`${dict.inventory.missingMore}: ${row.missing} ${renderPlural(row.missing, row.unit)}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <InventoryTable 
        stockRows={stockRows} 
        isAdmin={isAdmin} 
        centers={(centers ?? []) as { id: string; name: string }[]} 
        categoryLabels={CATEGORY_LABEL}
        dict={dict} 
        locale={locale}
      />

    </main>
  )
}