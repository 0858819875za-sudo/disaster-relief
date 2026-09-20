'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Center {
  id: string
  name: string
}

export default function RequestFilter({ centers }: { centers: Center[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [center, setCenter] = useState(searchParams.get('center') || '')
  const [urgency, setUrgency] = useState(searchParams.get('urgency') || '')

  // อัปเดต URL searchParams แบบอัตโนมัติเมื่อมีการเปลี่ยนค่า
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (search) params.set('search', search)
    else params.delete('search')

    if (center) params.set('center', center)
    else params.delete('center')

    if (urgency) params.set('urgency', urgency)
    else params.delete('urgency')

    router.push(`?${params.toString()}`)
  }, [search, center, urgency, router, searchParams])

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* ช่องค้นหาชื่อ / เบอร์โทร */}
      <div>
        <input
          type="text"
          placeholder="ค้นหาชื่อผู้แจ้ง หรือเบอร์โทรศัพท์..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      {/* เลือกศูนย์พักพิง */}
      <div>
        <select
          value={center}
          onChange={(e) => setCenter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">ทุกศูนย์พักพิง</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* เลือกระดับความเร่งด่วน พร้อมใส่สัญลักษณ์สี */}
      <div>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">ทุกระดับความเร่งด่วน</option>
          <option value="high">🔴 ด่วนมาก (สูง)</option>
          <option value="medium">🟡 ปานกลาง</option>
          <option value="low">🟢 ปกติ</option>
        </select>
      </div>
    </div>
  )
}