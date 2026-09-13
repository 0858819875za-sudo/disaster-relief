-- =====================================================================
-- 17_f5_hardening.sql — ปิดช่องโหว่สิทธิ์ของ F5 (จัดสรร/ตัดจ่าย)
--
-- ต้องรันหลัง 05_functions.sql และ 13_volunteer_role.sql
-- (ใช้ is_staff_or_admin() ที่ประกาศไว้ใน 13)
--
-- สิ่งที่แก้:
--   1. allocate_items — เดิมเช็กแค่ "ล็อกอินแล้ว" ทั้งที่เป็น security definer
--      (ข้าม RLS) อาสาสมัครจึงเรียก rpc ตัดสต๊อกตรงๆ ได้
--      → ต้องเป็น staff/admin และ "จัดสรรข้ามศูนย์ทำได้เฉพาะ admin"
--        staff จัดสรรได้เฉพาะเมื่อคำขอกับล็อตอยู่ศูนย์ตัวเอง
--   2. mark_delivered — เดิมใครก็ได้ที่ล็อกอินยืนยันส่งมอบของได้ทุกศูนย์
--      → ต้องเป็น admin หรือคนของศูนย์ปลายทาง (ศูนย์ของคำขอ)
--   3. cancel_allocation — ยกเลิก allocation ของคำขอที่ถูกยกเลิกไปแล้ว
--      เคยเปิดคำขอกลับเป็น pending → คงสถานะ cancelled ไว้
--   4. allocations_select — เดิม using (true) ทุกคนเห็นประวัติทุกศูนย์
--      → เห็นเฉพาะรายการที่ศูนย์ตัวเองเป็นต้นทางหรือปลายทาง (admin เห็นหมด)
--
-- ข้อความ error ขึ้นต้นด้วย 'F5:<key>' เพื่อให้หน้าเว็บแปลเป็น TH/EN ได้
-- (lib/allocation-errors.ts + dict.allocations.errors)
-- =====================================================================

create or replace function public.allocate_items(
  p_request_id  uuid,
  p_donation_id uuid,
  p_quantity    int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request       public.requests%rowtype;
  v_donation      public.donations%rowtype;
  v_allocation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'F5:not_logged_in';
  end if;

  if not public.is_staff_or_admin() then
    raise exception 'F5:not_staff';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'F5:invalid_quantity';
  end if;

  -- ล็อกแถวไว้กัน race condition กรณีสองคนกดจ่ายพร้อมกัน
  select * into v_request
    from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'F5:request_not_found';
  end if;

  select * into v_donation
    from public.donations where id = p_donation_id for update;
  if not found then
    raise exception 'F5:donation_not_found';
  end if;

  -- จัดสรรข้ามศูนย์ = งานของ admin เท่านั้น
  if not public.is_admin() then
    if v_request.center_id <> v_donation.center_id then
      raise exception 'F5:cross_center_admin_only';
    end if;
    if v_donation.center_id is distinct from public.my_center_id() then
      raise exception 'F5:not_your_center';
    end if;
  end if;

  if v_request.status in ('fulfilled', 'cancelled') then
    raise exception 'F5:request_closed';
  end if;

  if v_donation.category <> v_request.category then
    raise exception 'F5:category_mismatch';
  end if;

  if v_donation.expiry_date is not null and v_donation.expiry_date < current_date then
    raise exception 'F5:expired';
  end if;

  if p_quantity > v_donation.quantity_remaining then
    raise exception 'F5:over_remaining';
  end if;

  if v_request.quantity_fulfilled + p_quantity > v_request.quantity_requested then
    raise exception 'F5:over_requested';
  end if;

  update public.donations
     set quantity_remaining = quantity_remaining - p_quantity
   where id = p_donation_id;

  update public.requests
     set quantity_fulfilled = quantity_fulfilled + p_quantity,
         status = case
                    when quantity_fulfilled + p_quantity >= quantity_requested
                    then 'fulfilled'
                    else 'partial'
                  end
   where id = p_request_id;

  insert into public.allocations
    (request_id, donation_id, quantity_allocated, allocated_by)
  values
    (p_request_id, p_donation_id, p_quantity, auth.uid())
  returning id into v_allocation_id;

  return v_allocation_id;
end;
$$;


create or replace function public.cancel_allocation(p_allocation_id uuid)
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

  -- คำขอที่ถูกยกเลิกไปแล้วต้องคงสถานะ cancelled ไม่เปิดกลับมาเป็น pending
  update public.requests
     set quantity_fulfilled = quantity_fulfilled - v_alloc.quantity_allocated,
         status = case
                    when status = 'cancelled' then 'cancelled'
                    when quantity_fulfilled - v_alloc.quantity_allocated <= 0 then 'pending'
                    else 'partial'
                  end
   where id = v_alloc.request_id;

  update public.allocations
     set status = 'cancelled'
   where id = p_allocation_id;
end;
$$;


create or replace function public.mark_delivered(p_allocation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status        text;
  v_target_center uuid;
begin
  if auth.uid() is null then
    raise exception 'F5:not_logged_in';
  end if;

  select a.status, r.center_id
    into v_status, v_target_center
    from public.allocations a
    join public.requests r on r.id = a.request_id
   where a.id = p_allocation_id
     for update of a;
  if not found then
    raise exception 'F5:allocation_not_found';
  end if;

  -- ยืนยันได้เฉพาะ admin หรือคนของศูนย์ปลายทาง (staff/อาสาสมัครของศูนย์นั้น)
  if not (public.is_admin() or v_target_center = public.my_center_id()) then
    raise exception 'F5:not_your_center';
  end if;

  if v_status <> 'allocated' then
    raise exception 'F5:not_pending_delivery';
  end if;

  update public.allocations
     set status = 'delivered',
         delivered_at = now()
   where id = p_allocation_id;
end;
$$;


drop policy if exists allocations_select on public.allocations;
create policy allocations_select on public.allocations
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.requests r
       where r.id = request_id and r.center_id = public.my_center_id()
    )
    or exists (
      select 1 from public.donations d
       where d.id = donation_id and d.center_id = public.my_center_id()
    )
  );
