import type { createClient } from '@/lib/supabase/server'

// ตัวกรอง + query ของประวัติการจัดสรร ใช้ร่วมกันระหว่างหน้าประวัติและไฟล์ CSV
// ให้สองที่แสดงรายการชุดเดียวกันเสมอ

export const HISTORY_STATUSES = ['allocated', 'delivered', 'cancelled']
export const HISTORY_PAGE_SIZE = 25
// staff ยกเลิกรายการที่ตัวเองจัดสรรได้ภายในเวลานี้ (ตรงกับ cancel_allocation ใน 23_f5_improvements.sql)
export const STAFF_CANCEL_WINDOW_MS = 30 * 60 * 1000

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type HistoryFilters = { status: string; center: string; from: string; to: string }

export function parseHistoryFilters(
  params: { status?: string; center?: string; from?: string; to?: string },
  isAdmin: boolean,
): HistoryFilters {
  return {
    status: HISTORY_STATUSES.includes(params.status ?? '') ? params.status! : '',
    // ตัวกรองศูนย์มีเฉพาะ admin — staff เห็นแค่ศูนย์ตัวเองตาม RLS อยู่แล้ว
    center: isAdmin && UUID_RE.test(params.center ?? '') ? params.center! : '',
    from: DATE_RE.test(params.from ?? '') ? params.from! : '',
    to: DATE_RE.test(params.to ?? '') ? params.to! : '',
  }
}

export function historySearch(filters: HistoryFilters, page?: number) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value)
  }
  if (page && page > 1) search.set('page', String(page))
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function historyQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: HistoryFilters,
  withCount: boolean,
) {
  // ใช้ !inner เฉพาะตอนกรองศูนย์ — ถ้าใช้ตลอด staff ศูนย์ต้นทางจะมองไม่เห็นรายการ
  // ที่ส่งไปศูนย์อื่น (RLS ของ requests ซ่อนคำขอศูนย์อื่น แล้ว inner join ตัดแถวทิ้ง)
  const requestEmbed = filters.center ? 'requests!inner' : 'requests'
  let query = supabase
    .from('allocations')
    .select(
      `id, quantity_allocated, received_quantity, delivery_note, status, allocated_at, allocated_by, delivered_at, cancel_reason, allocated_by_name, delivered_by_name, cancelled_by_name, ${requestEmbed}(item_name, center_id, centers(name)), donations(item_name, unit, centers(name))`,
      withCount ? { count: 'exact' } : undefined,
    )
    .order('allocated_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.center) query = query.eq('requests.center_id', filters.center)
  // วันที่ในตัวกรองเป็นวันตามเวลาไทย
  if (filters.from) query = query.gte('allocated_at', `${filters.from}T00:00:00+07:00`)
  if (filters.to) query = query.lte('allocated_at', `${filters.to}T23:59:59.999+07:00`)
  return query
}

export type HistoryRow = {
  id: string
  quantity_allocated: number
  received_quantity: number | null
  delivery_note: string | null
  status: string
  allocated_at: string
  allocated_by: string | null
  delivered_at: string | null
  cancel_reason: string | null
  allocated_by_name: string | null
  delivered_by_name: string | null
  cancelled_by_name: string | null
  requests: { item_name?: string; center_id?: string; centers?: { name?: string } | null } | null
  donations: { item_name?: string; unit?: string; centers?: { name?: string } | null } | null
}
