'use client'

import { useFormStatus } from 'react-dom'

// ปุ่มส่งฟอร์มที่บอกสถานะ "กำลังบันทึก…" และกดซ้ำไม่ได้ระหว่างรอ server action
// ต้องอยู่ข้างใน <form> เพราะอ่านสถานะจาก useFormStatus
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: {
  children: React.ReactNode
  pendingLabel: string
  className: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  )
}
