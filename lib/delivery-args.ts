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
