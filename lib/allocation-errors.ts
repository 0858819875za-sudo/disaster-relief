import type { Dictionary } from '@/lib/i18n/dictionaries'

// ฟังก์ชัน F5 ใน docs/sql/17_f5_hardening.sql raise error เป็นรหัส 'F5:<key>'
// แปลงเป็นข้อความตามภาษาที่เลือก — ถ้าไม่ใช่รหัสที่รู้จักให้คืนข้อความเดิม
export function translateAllocationError(message: string, dict: Dictionary): string {
  const match = message.match(/F5:([a-z_]+)/)
  if (!match) return message
  const errors: Record<string, string> = dict.allocations.errors
  return errors[match[1]] ?? message
}
