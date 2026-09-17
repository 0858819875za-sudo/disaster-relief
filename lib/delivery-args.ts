import { withNotice } from '@/lib/notice'

// แปลงฟอร์มยืนยันรับของเป็นอาร์กิวเมนต์ของ mark_delivered (docs/sql/23_f5_improvements.sql)
// ใช้ร่วมกันระหว่างหน้าประวัติของ staff และหน้าอาสาสมัคร
// ช่องจำนวนว่าง = ได้รับครบตามที่จัดสรร / หมายเหตุว่าง = null
export function deliveryArgs(formData: FormData) {
  const received = String(formData.get('received') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()
  return {
    p_allocation_id: String(formData.get('id')),
    p_received: received === '' ? null : Number(received),
    p_note: note === '' ? null : note,
  }
}

// ลิงก์กลับหลังรับของสำเร็จ พร้อมข้อความยืนยันผล (จำนวนที่รับ + ส่วนที่ขาด)
export function deliveredNotice(path: string, formData: FormData, received: number | null) {
  const allocated = Number(formData.get('allocated')) || 0
  const got = received ?? allocated
  return withNotice(path, 'delivered', {
    received: got,
    short: Math.max(0, allocated - got),
    unit: String(formData.get('unit') ?? ''),
  })
}
