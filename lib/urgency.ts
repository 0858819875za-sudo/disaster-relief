// เรียงความเร่งด่วนต้องทำฝั่งแอป — urgency เก็บเป็น text ถ้าให้ Postgres
// order ตรงๆ จะเรียงตามตัวอักษร (medium → low → high) คำขอด่วนสุดตกไปท้าย
const URGENCY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

// Array.prototype.sort เป็น stable sort ลำดับรองที่ query มา (เช่น created_at)
// จึงยังคงอยู่ภายในกลุ่มความเร่งด่วนเดียวกัน
export function sortByUrgency<T extends { urgency: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (URGENCY_RANK[a.urgency] ?? 3) - (URGENCY_RANK[b.urgency] ?? 3))
}
