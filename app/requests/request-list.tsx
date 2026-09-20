"use client";

import { useState } from "react";
import Link from "next/link";
import { CancelRequestButton, type CancelRequestButtonLabels } from "./cancel-request-dialog";

interface RowData {
  r: {
    id: string;
    item_name: string;
    category: string;
    quantity_requested: number;
    quantity_fulfilled: number;
    urgency: string;
    status: string;
    cancel_reason?: string | null;
    created_at: string;
  };
  center: string;
  unit: string;
  open: boolean;
  percent: number;
}

// ระบุโครงสร้างของ dict ให้ชัดเจนเพื่อหลีกเลี่ยงการใช้ any และ Type Assertion (as)
interface DictType {
  requests?: Record<string, string>;
  common?: Record<string, string>;
  [key: string]: unknown;
}

interface RequestListProps {
  rows: RowData[];
  dict: DictType;
  categoryLabel: Record<string, string>;
  urgencyLabel: Record<string, string>;
  urgencyStyle: Record<string, string>;
  statusLabel: Record<string, string>;
  cancelLabels: CancelRequestButtonLabels;
}

const panel = "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";

  const now = new Date();
  const created = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);

  if (diffInSeconds < 60) return "สร้างเมื่อสักครู่";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `สร้างเมื่อ ${diffInMinutes} นาทีที่แล้ว`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `สร้างเมื่อ ${diffInHours} ชม. ที่แล้ว`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `สร้างเมื่อ ${diffInDays} วันที่แล้ว`;

  return created.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
}

export function RequestList({
  rows,
  dict,
  categoryLabel,
  urgencyLabel,
  urgencyStyle,
  statusLabel,
  cancelLabels,
}: RequestListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(rows.map((row) => row.r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((itemId) => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBatchAllocate = () => {
    alert(`กำลังดำเนินการจัดสรรรายการที่เลือกจำนวน ${selectedIds.length} รายการ`);
  };

  const progress = (row: RowData) => (
    <div className="min-w-[120px]">
      <p className="tabular-nums text-slate-700 dark:text-slate-300">
        {row.r.quantity_fulfilled} / {row.r.quantity_requested} {row.unit}
      </p>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <span
          className="block h-full rounded-full bg-sky-600 dark:bg-sky-400"
          style={{ width: `${row.percent}%` }}
        />
      </span>
    </div>
  );

  const statusCell = (row: RowData) => (
    <>
      <span className="whitespace-nowrap text-slate-700 dark:text-slate-300">
        {statusLabel[row.r.status] ?? row.r.status}
      </span>
      {row.r.status === "cancelled" && row.r.cancel_reason && (
        <span className="mt-1 block max-w-[240px] whitespace-normal text-xs text-slate-500 dark:text-slate-400">
          {dict.requests?.cancelledReason}: {row.r.cancel_reason}
        </span>
      )}
    </>
  );

  const actions = (row: RowData) =>
    row.open ? (
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href={`/allocations?request=${row.r.id}`}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-deep"
        >
          {dict.requests?.allocateAction}
        </Link>
        <CancelRequestButton id={row.r.id} itemName={row.r.item_name} labels={cancelLabels} />
      </div>
    ) : null;

  const urgencyPill = (row: RowData) => (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        urgencyStyle[row.r.urgency] ?? urgencyStyle.low
      }`}
    >
      {urgencyLabel[row.r.urgency] ?? row.r.urgency}
    </span>
  );

  return (
    <div className="space-y-4">
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-10 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white shadow-xl dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              เลือกอยู่ <span className="font-bold text-amber-400">{selectedIds.length}</span> รายการ
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 transition"
            >
              📄 พิมพ์ใบเบิกสิ่งของ
            </button>
            <button
              type="button"
              onClick={handleBatchAllocate}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition"
            >
              ⚡ จัดสรรพร้อมกัน
            </button>
          </div>
        </div>
      )}

      {/* จอเล็ก: การ์ด */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const isSelected = selectedIds.includes(row.r.id);
          return (
            <li
              key={row.r.id}
              className={`${panel} p-4 transition ${
                isSelected ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelectOne(row.r.id)}
                  className="mt-1 rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-600 dark:bg-slate-700"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{row.r.item_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.center} · {categoryLabel[row.r.category] ?? row.r.category}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeTime(row.r.created_at)}
                      </p>
                    </div>
                    {urgencyPill(row)}
                  </div>
                  <div className="mt-3 text-sm">{progress(row)}</div>
                  <div className="mt-2 text-sm">{statusCell(row)}</div>
                  {row.open && (
                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {actions(row)}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* จอใหญ่: ตาราง */}
      <div className={`${panel} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selectedIds.length === rows.length && rows.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-600 dark:bg-slate-700"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">{dict.requests?.center}</th>
              <th className="px-4 py-2.5 font-medium">{dict.requests?.item}</th>
              <th className="px-4 py-2.5 font-medium">
                {dict.requests?.fulfilled} / {dict.requests?.requested}
              </th>
              <th className="px-4 py-2.5 font-medium">{dict.requests?.urgency}</th>
              <th className="px-4 py-2.5 font-medium">{dict.common?.status}</th>
              <th className="px-4 py-2.5 font-medium">{dict.requests?.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedIds.includes(row.r.id);
              return (
                <tr
                  key={row.r.id}
                  className={`border-b border-slate-100 align-top last:border-0 dark:border-slate-800 transition-colors ${
                    isSelected
                      ? "bg-amber-50/60 dark:bg-amber-950/20"
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(row.r.id)}
                      className="rounded border-slate-300 text-brand focus:ring-brand dark:border-slate-600 dark:bg-slate-700"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.center}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                    {row.r.item_name}
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {categoryLabel[row.r.category] ?? row.r.category}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(row.r.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{progress(row)}</td>
                  <td className="px-4 py-3">{urgencyPill(row)}</td>
                  <td className="px-4 py-3">{statusCell(row)}</td>
                  <td className="px-4 py-3">{actions(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}