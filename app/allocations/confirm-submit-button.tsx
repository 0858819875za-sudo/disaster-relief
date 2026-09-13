'use client'

import type { ReactNode } from 'react'

// ปุ่ม submit ที่ถามยืนยันก่อน — ใช้กับการกระทำที่ย้อนกลับไม่ได้ เช่นยกเลิกการจัดสรร
export function ConfirmSubmitButton({
  message,
  title,
  className,
  children,
}: {
  message: string
  title: string
  className: string
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
