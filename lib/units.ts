// หน่วยถูกบันทึกเป็นภาษาไทยในฐานข้อมูล — ตอนเลือกภาษาอังกฤษให้แปลงหน่วยที่รู้จัก
// หน่วยที่ไม่อยู่ในรายการแสดงตามที่บันทึกไว้
// ใช้คำเดียวกับหน้าคลัง (app/inventory/InventoryTable.tsx) ให้ทั้งเว็บเรียกหน่วยตรงกัน
const UNIT_EN: Record<string, string> = {
  'ชิ้น': 'pieces',
  'กล่อง': 'boxes',
  'ถุง': 'bags',
  'แพ็ค': 'packs',
  'ขวด': 'bottles',
  'กระป๋อง': 'cans',
  'ลัง': 'crates',
  'ชุด': 'sets',
  'ห่อ': 'packets',
  'ผืน': 'pieces',
  'แผง': 'strips',
  'หลอด': 'tubes',
  'ซอง': 'sachets',
  'กิโลกรัม': 'kg',
  'กก.': 'kg',
  'ลิตร': 'L',
}

export function unitLabel(unit: string | null | undefined, locale: string) {
  const u = (unit ?? '').trim()
  return locale === 'en' ? (UNIT_EN[u] ?? u) : u
}
