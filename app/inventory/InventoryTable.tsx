'use client'

import { useState, useMemo } from 'react'

type StockRow = {
  center_id: string
  category: string
  item_name: string
  unit: string
  total_remaining: number
  lot_count: number
  nearest_expiry: string | null
}

type Props = {
  stockRows: StockRow[]
  isAdmin: boolean
  centers: { id: string; name: string }[]
  categoryLabels: Record<string, string>
  dict: any
  locale: string 
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function InventoryTable({ stockRows, isAdmin, centers, categoryLabels, dict, locale }: Props) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

  const centerName = new Map(centers.map((c) => [c.id, c.name]))

  const renderPlural = (count: number, word: string) => {
    if (locale === 'th') return word;
    if (count <= 1) return word;
    if (word === 'box') return 'boxes'; 
    return `${word}s`;
  }

  const filteredRows = useMemo(() => {
    return stockRows.filter((row) => {
      const matchSearch = row.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchCategory = selectedCategory === 'all' || row.category === selectedCategory
      return matchSearch && matchCategory
    })
  }, [stockRows, searchTerm, selectedCategory])

  const sortedRows = useMemo(() => {
    let sortableItems = [...filteredRows]
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (sortConfig.key === 'total_remaining') {
           return sortConfig.direction === 'asc' ? a.total_remaining - b.total_remaining : b.total_remaining - a.total_remaining
        }
        if (sortConfig.key === 'lot_count') {
           return sortConfig.direction === 'asc' ? a.lot_count - b.lot_count : b.lot_count - a.lot_count
        }
        if (sortConfig.key === 'nearest_expiry') {
           if (!a.nearest_expiry) return 1
           if (!b.nearest_expiry) return -1
           const dateA = new Date(a.nearest_expiry).getTime()
           const dateB = new Date(b.nearest_expiry).getTime()
           return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA
        }
        return 0
      })
    }
    return sortableItems
  }, [filteredRows, sortConfig])

  const getFallbackText = (textTh: string, textEn: string) => locale === 'th' ? textTh : textEn

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1 text-brand font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
  }

  const exportToCSV = () => {
    const headers = []
    if (isAdmin) headers.push(dict.requests?.center ?? getFallbackText('ศูนย์', 'Center'))
    headers.push(dict.form?.category ?? getFallbackText('หมวดหมู่', 'Category'))
    headers.push(dict.table?.itemName ?? getFallbackText('ชื่อของ', 'Item'))
    headers.push(dict.table?.remainingQty ?? getFallbackText('คงเหลือ', 'Remaining'))
    headers.push(getFallbackText('หน่วย', 'Unit'))
    headers.push(dict.inventory?.lotCount ?? getFallbackText('จำนวนล็อต', 'Lot count'))
    headers.push(dict.inventory?.nearestExpiry ?? getFallbackText('ใกล้หมดอายุสุด', 'Nearest expiry'))

    const csvRows = sortedRows.map(row => {
      const center = centerName.get(row.center_id) ?? ''
      const cat = categoryLabels[row.category] ?? row.category
      
      const unitThToEnMap: Record<string, string> = {
          'ชุด': 'set', 'ขวด': 'bottle', 'กระป๋อง': 'can', 
          'ถุง': 'bag', 'แพ็ค': 'pack', 'ชิ้น': 'piece', 
          'กล่อง': 'box', 'ลัง': 'crate', 'ผืน': 'piece', 'ห่อ': 'packet'
      }
      
      const cleanUnit = row.unit.trim()
      const rawUnit = locale === 'th' ? cleanUnit : (unitThToEnMap[cleanUnit] ?? cleanUnit)
      const displayUnit = renderPlural(row.total_remaining, rawUnit)

      const rowData = []
      if (isAdmin) rowData.push(`"${center}"`)
      rowData.push(`"${cat}"`, `"${row.item_name}"`, row.total_remaining, `"${displayUnit}"`, row.lot_count, `"${row.nearest_expiry ?? ''}"`)

      return rowData.join(',')
    })
    
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <section>
      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-300">
          {dict.inventory.nearExpirySection ?? getFallbackText('ของใกล้หมดอายุ / ยอดคงเหลือ', 'Nearing expiry / stock levels')}
        </h2>
        
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{dict.inventory.allCategories ?? getFallbackText('ทุกหมวดหมู่', 'All categories')}</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder={dict.inventory.searchPlaceholder ?? getFallbackText('ค้นหาชื่อสิ่งของ...', 'Search item name...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:w-64 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-400">{dict.inventory.notFound ?? getFallbackText('ไม่พบข้อมูลที่ค้นหา', 'No data found')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-md ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/5">
          <table className="w-full min-w-[640px] whitespace-nowrap text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                {isAdmin && <th className="px-5 py-3 font-semibold">{dict.requests?.center ?? getFallbackText('ศูนย์', 'Center')}</th>}
                <th className="px-5 py-3 font-semibold">{dict.form?.category ?? getFallbackText('หมวดหมู่', 'Category')}</th>
                <th className="px-5 py-3 font-semibold">{dict.table?.itemName ?? getFallbackText('ชื่อของ', 'Item')}</th>
                <th 
                  className="px-5 py-3 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => handleSort('total_remaining')}
                >
                  {dict.table?.remainingQty ?? getFallbackText('คงเหลือ', 'Remaining')} <SortIcon columnKey="total_remaining" />
                </th>
                <th 
                  className="px-5 py-3 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => handleSort('lot_count')}
                >
                  {dict.inventory?.lotCount ?? getFallbackText('จำนวนล็อต', 'Lot count')} <SortIcon columnKey="lot_count" />
                </th>
                <th 
                  className="px-5 py-3 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => handleSort('nearest_expiry')}
                >
                  {dict.inventory?.nearestExpiry ?? getFallbackText('ใกล้หมดอายุสุด', 'Nearest expiry')} <SortIcon columnKey="nearest_expiry" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedRows.map((row) => {
                const days = row.nearest_expiry !== null ? daysUntil(row.nearest_expiry) : null
                const isExpired = days !== null && days < 0
                const isSoon = days !== null && days >= 0 && days <= 7

                const unitThToEnMap: Record<string, string> = {
                    'ชุด': 'set', 'ขวด': 'bottle', 'กระป๋อง': 'can', 
                    'ถุง': 'bag', 'แพ็ค': 'pack', 'ชิ้น': 'piece', 
                    'กล่อง': 'box', 'ลัง': 'crate', 'ผืน': 'piece', 'ห่อ': 'packet'
                }
                
                const cleanUnit = row.unit.trim()
                const rawUnit = locale === 'th' ? cleanUnit : (unitThToEnMap[cleanUnit] ?? cleanUnit)
                const displayUnit = renderPlural(row.total_remaining, rawUnit)

                const rowBgClass = isExpired 
                  ? 'bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/20 dark:hover:bg-red-900/30' 
                  : isSoon
                  ? 'bg-amber-50/80 hover:bg-amber-100/80 dark:bg-amber-950/20 dark:hover:bg-amber-900/30'
                  : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/50'

                return (
                  <tr
                    key={`${row.center_id}-${row.category}-${row.item_name}-${row.unit}`}
                    className={`group transition-colors duration-200 ${rowBgClass}`}
                  >
                    {isAdmin && (
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                        {centerName.get(row.center_id) ?? '—'}
                      </td>
                    )}
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20">
                        {categoryLabels[row.category] ?? row.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900 group-hover:text-brand dark:text-slate-100 dark:group-hover:text-blue-400">
                      {row.item_name}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {row.total_remaining} <span className="font-normal text-slate-500 dark:text-slate-400">{displayUnit}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{row.lot_count}</td>
                    
                    <td className="px-5 py-3">
                      {isExpired ? (
                        <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 font-bold text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-500/30">
                          {row.nearest_expiry} {dict.inventory?.expiredBadge ?? getFallbackText('(หมดอายุ)', '(Expired)')}
                        </span>
                      ) : isSoon ? (
                        <span className="font-semibold text-amber-600 dark:text-amber-500">
                          {row.nearest_expiry} {dict.inventory?.expiringSoonBadge ?? getFallbackText('(ใกล้หมดอายุ)', '(Near expiry)')}
                        </span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">
                          {row.nearest_expiry ?? '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}