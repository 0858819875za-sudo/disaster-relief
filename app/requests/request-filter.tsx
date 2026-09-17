"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const FILTERS = [
  { label: "ทั้งหมด", value: "" },
  { label: "อาหาร", value: "food" },
  { label: "น้ำ", value: "water" },
  { label: "ยา", value: "medicine" },
  { label: "เสื้อผ้า", value: "clothing" },
  { label: "สุขอนามัย", value: "hygiene" },
  { label: "อื่น ๆ", value: "other" },
];

export function RequestFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* ส่วนที่เพิ่มใหม่: ช่องค้นหาด้วยข้อความ (Search Query 'q') */}
      <div className="relative w-full sm:w-72">
        <input
          type="text"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => handleFilter("q", e.target.value)}
          placeholder="ค้นหาชื่อสิ่งของ หรือศูนย์พักพิง..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
        />
      </div>

      {/* ปุ่มกรองหมวดหมู่เดิมของเพื่อน */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = (searchParams.get("category") ?? "") === filter.value;

          return (
            <button
              key={filter.value || "all"}
              type="button"
              onClick={() => handleFilter("category", filter.value)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
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