'use client'

import { useEffect, useState } from 'react'

// แถบยืนยันผลสีเขียวหลังทำรายการสำเร็จ (ข้อความมาจาก ?notice=... ของ URL)
// ล้าง query ด้วย history.replaceState แทน router.replace เพื่อไม่ให้หน้าโหลดใหม่
// จนแถบหายไปก่อนผู้ใช้อ่าน และกดรีเฟรชแล้วไม่เด้งซ้ำ
export function FlashNotice({
  message,
  clearHref,
  closeLabel,
}: {
  message: string
  clearHref: string
  closeLabel: string
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    window.history.replaceState(null, '', clearHref)
  }, [clearHref])

  if (!visible) return null

  return (
    <div
      role="status"
      className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true">✓</span>
        {message}
      </span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label={closeLabel}
        className="shrink-0 rounded px-1.5 text-base leading-none hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
      >
        ×
      </button>
    </div>
  )
}
