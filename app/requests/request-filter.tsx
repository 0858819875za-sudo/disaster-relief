"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const CATEGORY_FILTERS = [
  { label: "ทั้งหมด", value: "" },
  { label: "อาหาร", value: "food" },
  { label: "น้ำ", value: "water" },
  { label: "ยา", value: "medicine" },
  { label: "เสื้อผ้า", value: "clothing" },
  { label: "สุขอนามัย", value: "hygiene" },
  { label: "อื่น ๆ", value: "other" },
];

const URGENCY_FILTERS = [
  { label: "ทุกระดับความเร่งด่วน", value: "" },
  { label: "🔴 ด่วนมาก", value: "high" },
  { label: "🟡 ปานกลาง", value: "medium" },
  { label: "🟢 ปกติ", value: "low" },
];

interface RequestFilterProps {
  centers?: { id: string; name: string }[];
}

export function RequestFilter({ centers = [] }: RequestFilterProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const currentSearch = searchParams.get("q") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentUrgency = searchParams.get("urgency") ?? "";
  const currentCenter = searchParams.get("center_id") ?? "";

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="mb-6 space-y-3">
      {/* แถบค้นหา + ตัวกรองศูนย์พักพิง + ตัวกรองความเร่งด่วน */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={currentSearch}
          onChange={(e) => handleFilter("q", e.target.value)}
          placeholder="ค้นหาชื่อสิ่งของ..."
          className="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />

        {/* ตัวกรองศูนย์พักพิง */}
        <select
          value={currentCenter}
          onChange={(e) => handleFilter("center_id", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition focus:border-brand focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">ทุกศูนย์พักพิง</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* ตัวกรองความเร่งด่วน */}
        <select
          value={currentUrgency}
          onChange={(e) => handleFilter("urgency", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition focus:border-brand focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {URGENCY_FILTERS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      {/* ปุ่มเลือกหมวดหมู่ */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((filter) => {
          const isActive = currentCategory === filter.value;

          return (
            <button
              key={filter.value || "all"}
              type="button"
              onClick={() => handleFilter("category", filter.value)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "border-brand bg-brand text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
              ].join(" ")}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}