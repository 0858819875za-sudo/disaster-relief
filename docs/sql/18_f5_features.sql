-- =====================================================================
-- 18_f5_features.sql — ฟีเจอร์เพิ่มของ F5 (รันหลัง 17_f5_hardening.sql)
--
--   1. allocate_items_multi — จัดสรรคำขอเดียวจากหลายล็อตในครั้งเดียว
--      วนเรียก allocate_items ทีละล็อต ทั้งหมดอยู่ใน transaction เดียว
--      ถ้าล็อตไหนไม่ผ่านกฎ จะ rollback ทุกล็อต ยอดไม่เพี้ยนครึ่งๆ กลางๆ
--   2. เหตุผลการยกเลิก — เพิ่มคอลัมน์ cancel_reason / cancelled_at / cancelled_by
--      และ cancel_allocation บังคับให้ระบุเหตุผล
--   3. allocated_by_name / cancelled_by_name — computed column ของ PostgREST
--      (select ได้เหมือนคอลัมน์ปกติ) ใช้แสดงชื่อคนจัดสรร/ยกเลิกในหน้าประวัติ
--      เป็น security definer เพราะ RLS ของ profiles ให้เห็นแค่คนในศูนย์เดียวกัน
--      แต่การจัดสรรข้ามศูนย์ต้องเห็นชื่อ admin ที่ทำรายการด้วย
--      คืนเฉพาะชื่อ ไม่เปิดข้อมูลอื่นของ profile
-- =====================================================================

-- ---------- 1. จัดสรรหลายล็อต ----------
create or replace function public.allocate_items_multi(
  p_request_id uuid,
  p_items      jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_ids  uuid[] := '{}';
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'F5:no_items';
  end if;

  -- allocate_items ตรวจสิทธิ์และกฎทุกข้อให้ทีละล็อตอยู่แล้ว
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_ids := v_ids || public.allocate_items(
      p_request_id,
      (v_item ->> 'donation_id')::uuid,
      (v_item ->> 'quantity')::int
    );
  end loop;

  return v_ids;
end;
$$;


-- ---------- 2. เหตุผลการยกเลิก ----------
alter table public.allocations
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancelled_by  uuid references public.profiles(id) on delete set null;

-- เปลี่ยน signature (เพิ่ม p_reason) ต้อง drop ตัวเดิมก่อน ไม่งั้นจะมีสองเวอร์ชันซ้อนกัน
drop function if exists public.cancel_allocation(uuid);

create or replace function public.cancel_allocation(
  p_allocation_id uuid,
  p_reason        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alloc public.allocations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'F5:admin_only';
  end if;

  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'F5:reason_required';
  end if;

  select * into v_alloc
    from public.allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'F5:allocation_not_found';
  end if;

  if v_alloc.status = 'cancelled' then
    raise exception 'F5:already_cancelled';
  end if;

  if v_alloc.status = 'delivered' then
    raise exception 'F5:already_delivered';
  end if;

  update public.donations
     set quantity_remaining = quantity_remaining + v_alloc.quantity_allocated
   where id = v_alloc.donation_id;

  update public.requests
     set quantity_fulfilled = quantity_fulfilled - v_alloc.quantity_allocated,
         status = case
                    when status = 'cancelled' then 'cancelled'
                    when quantity_fulfilled - v_alloc.quantity_allocated <= 0 then 'pending'
                    else 'partial'
                  end
   where id = v_alloc.request_id;

  update public.allocations
     set status        = 'cancelled',
         cancel_reason = trim(p_reason),
         cancelled_at  = now(),
         cancelled_by  = auth.uid()
   where id = p_allocation_id;
end;
$$;


-- ---------- 3. ชื่อคนจัดสรร / ยกเลิก (computed column) ----------
create or replace function public.allocated_by_name(a public.allocations)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.full_name, ''), p.username)
    from public.profiles p
   where p.id = a.allocated_by;
$$;

create or replace function public.cancelled_by_name(a public.allocations)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.full_name, ''), p.username)
    from public.profiles p
   where p.id = a.cancelled_by;
$$;
