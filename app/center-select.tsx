// ช่องเลือกศูนย์สำหรับ admin ที่ไม่ได้ผูกกับศูนย์ (ดู lib/center-choice.ts)
export function CenterSelect({
  centers,
  label,
  placeholder,
  compact = false,
}: {
  centers: { id: string; name: string }[]
  label: string
  placeholder: string
  compact?: boolean
}) {
  const select = (
    <select
      name="center_id"
      required
      aria-label={label}
      defaultValue=""
      className={
        compact
          ? 'rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
          : 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
      }
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {centers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )

  if (compact) return select

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {select}
    </div>
  )
}
