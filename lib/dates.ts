// วันที่ของระบบยึดเวลาไทย — วันหมดอายุเก็บเป็น YYYY-MM-DD (ไม่มีเวลา)
const BANGKOK = 'Asia/Bangkok'

export function bangkokToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: BANGKOK })
}

// จำนวนวันจากวันนี้ (เวลาไทย) ถึงวันที่ YYYY-MM-DD — 0 = วันนี้, ติดลบ = เลยมาแล้ว
export function daysFromToday(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [ty, tm, td] = bangkokToday().split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000)
}

// แสดงวันที่แบบ "14 มี.ค. 2570" / "14 Mar 2027" ให้ตรงกับหน้าอื่นของเว็บ
export function formatDateOnly(date: string | null | undefined, locale: string) {
  if (!date) return '—'
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
