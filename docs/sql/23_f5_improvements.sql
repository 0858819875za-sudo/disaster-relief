-- =====================================================================
-- 23_f5_improvements.sql — ปรับปรุง F5 (รันหลัง 18_f5_features.sql)
--
--   1. ยืนยันรับของ: บันทึกผู้ยืนยัน (delivered_by) + จำนวนที่ได้รับจริง
--      ถ้าได้รับไม่ครบต้องมีหมายเหตุ และส่วนที่ขาดถูกเปิดกลับเป็นยอดที่คำขอยังต้องการ
--      (ของที่หาย/ชำรุดระหว่างทางไม่คืนเข้าคลัง เพราะไม่มีของจริงแล้ว)
--   2. กันแก้ยอดตรง: ผู้ใช้หน้าเว็บ (role authenticated/anon) แก้
--      donations.quantity_remaining/quantity_received และ
--      requests.quantity_requested/quantity_fulfilled/status โดยตรงไม่ได้
--      ต้องผ่านฟังก์ชัน F5 เท่านั้น (ฟังก์ชันเป็น security definer จึงผ่าน trigger)
--   3. คำขอมีหน่วย (requests.unit) — ถ้าระบุ ต้องจ่ายจากล็อตหน่วยเดียวกัน
--   4. ยกเลิกคำขอ (cancel_request) — คืนยอดรายการจัดสรรที่ยังไม่ส่งมอบให้อัตโนมัติ
--   5. staff ยกเลิกรายการที่ตัวเองจัดสรรได้ภายใน 30 นาที (หลังจากนั้นเฉพาะ admin)
--   6. วันหมดอายุเทียบกับ "วันนี้ตามเวลาไทย" แทน UTC
--   7. ยกเลิก policy ที่ให้ admin แก้ตาราง allocations ตรง — แก้ได้ผ่านฟังก์ชันเท่านั้น
--
-- ข้อความ error ใหม่: F5:unit_mismatch, F5:stock_locked, F5:note_required, F5:invalid_received
-- ทดสอบทุกกฎด้วย 24_f5_tests.sql
-- =====================================================================

-- ---------- คอลัมน์ใหม่ ----------
alter table public.allocations
  add column if not exists delivered_by      uuid references public.profiles(id) on delete set null,
  add column if not exists received_quantity int check (received_quantity >= 0),
  add column if not exists delivery_note     text;

alter table public.requests
  add column if not exists unit          text,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancelled_by  uuid references public.profiles(id) on delete set null;


-- ---------- 2. กันแก้ยอดคงเหลือ/ยอดคำขอโดยตรง ----------
-- ไม่เป็น security definer โดยเจตนา: current_user จึงเป็น role ของผู้เรียกจริง
-- ถ้าเรียกจากฟังก์ชัน F5 (security definer) current_user จะเป็นเจ้าของฟังก์ชัน → ผ่าน
-- แยกฟังก์ชันต่อตาราง เพราะ plpgsql อ้างคอลัมน์ที่อีกตารางไม่มีใน NEW ไม่ได้
create or replace function public.guard_donation_stock()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.quantity_remaining is distinct from old.quantity_remaining
    or new.quantity_received  is distinct from old.quantity_received
  ) then
    raise exception 'F5:stock_locked';
  end if;
  return new;
end;
$$;

create or replace function public.guard_request_progress()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.quantity_requested is distinct from old.quantity_requested
    or new.quantity_fulfilled is distinct from old.quantity_fulfilled
    or new.status             is distinct from old.status
  ) then
    raise exception 'F5:stock_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_stock_donations on public.donations;
create trigger trg_guard_stock_donations
  before update on public.donations
  for each row execute function public.guard_donation_stock();

drop trigger if exists trg_guard_stock_requests on public.requests;
create trigger trg_guard_stock_requests
  before update on public.requests
  for each row execute function public.guard_request_progress();


-- ---------- 3 + 6. allocate_items: เช็กหน่วย + วันหมดอายุตามเวลาไทย ----------
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

  if nullif(btrim(v_request.unit), '') is not null
     and btrim(v_donation.unit) <> btrim(v_request.unit) then
    raise exception 'F5:unit_mismatch';
  end if;

  if v_donation.expiry_date is not null
     and v_donation.expiry_date < (now() at time zone 'Asia/Bangkok')::date then
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


-- ---------- 5. cancel_allocation: staff ยกเลิกของตัวเองได้ภายใน 30 นาที ----------
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
  if auth.uid() is null then
    raise exception 'F5:not_logged_in';
  end if;

  select * into v_alloc
    from public.allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'F5:allocation_not_found';
  end if;

  if not (
    public.is_admin()
    or (public.is_staff_or_admin()
        and v_alloc.allocated_by = auth.uid()
        and v_alloc.allocated_at >= now() - interval '30 minutes')
  ) then
    raise exception 'F5:admin_only';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'F5:reason_required';
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
     set status        = 'cancelled',
         cancel_reason = btrim(p_reason),
         cancelled_at  = now(),
         cancelled_by  = auth.uid()
   where id = p_allocation_id;
end;
$$;


-- ---------- 1. mark_delivered: ผู้ยืนยัน + จำนวนที่ได้รับจริง ----------
-- เปลี่ยน signature ต้อง drop ตัวเดิมก่อน ไม่งั้นจะมีสองเวอร์ชันซ้อนกัน
drop function if exists public.mark_delivered(uuid);

create or replace function public.mark_delivered(
  p_allocation_id uuid,
  p_received      int  default null,
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alloc         public.allocations%rowtype;
  v_target_center uuid;
  v_received      int;
  v_short         int;
begin
  if auth.uid() is null then
    raise exception 'F5:not_logged_in';
  end if;

  select * into v_alloc
    from public.allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'F5:allocation_not_found';
  end if;

  select center_id into v_target_center
    from public.requests where id = v_alloc.request_id for update;

  -- ยืนยันได้เฉพาะ admin หรือคนของศูนย์ปลายทาง (staff/อาสาสมัครของศูนย์นั้น)
  if not (public.is_admin() or v_target_center = public.my_center_id()) then
    raise exception 'F5:not_your_center';
  end if;

  if v_alloc.status <> 'allocated' then
    raise exception 'F5:not_pending_delivery';
  end if;

  v_received := coalesce(p_received, v_alloc.quantity_allocated);
  if v_received < 0 or v_received > v_alloc.quantity_allocated then
    raise exception 'F5:invalid_received';
  end if;

  v_short := v_alloc.quantity_allocated - v_received;
  if v_short > 0 and (p_note is null or length(btrim(p_note)) < 3) then
    raise exception 'F5:note_required';
  end if;

  -- ส่วนที่ไม่ถึงมือ → คำขอยังต้องการของส่วนนั้นอยู่
  if v_short > 0 then
    update public.requests
       set quantity_fulfilled = quantity_fulfilled - v_short,
           status = case
                      when status = 'cancelled' then 'cancelled'
                      when quantity_fulfilled - v_short <= 0 then 'pending'
                      else 'partial'
                    end
     where id = v_alloc.request_id;
  end if;

  update public.allocations
     set status            = 'delivered',
         delivered_at      = now(),
         delivered_by      = auth.uid(),
         received_quantity = v_received,
         delivery_note     = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_allocation_id;
end;
$$;


-- ---------- 4. ยกเลิกคำขอ ----------
create or replace function public.cancel_request(
  p_request_id uuid,
  p_reason     text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request  public.requests%rowtype;
  v_alloc    public.allocations%rowtype;
  v_count    int := 0;
  v_returned int := 0;
begin
  if auth.uid() is null then
    raise exception 'F5:not_logged_in';
  end if;

  if not public.is_staff_or_admin() then
    raise exception 'F5:not_staff';
  end if;

  select * into v_request
    from public.requests where id = p_request_id for update;
  if not found then
    raise exception 'F5:request_not_found';
  end if;

  if not public.is_admin() and v_request.center_id is distinct from public.my_center_id() then
    raise exception 'F5:not_your_center';
  end if;

  if v_request.status in ('fulfilled', 'cancelled') then
    raise exception 'F5:request_closed';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'F5:reason_required';
  end if;

  -- รายการที่ยังไม่ส่งมอบ → คืนยอดเข้าคลัง / รายการที่ส่งมอบแล้วคงไว้เป็นประวัติ
  for v_alloc in
    select * from public.allocations
     where request_id = p_request_id and status = 'allocated'
     for update
  loop
    update public.donations
       set quantity_remaining = quantity_remaining + v_alloc.quantity_allocated
     where id = v_alloc.donation_id;

    update public.allocations
       set status        = 'cancelled',
           cancel_reason = 'คำขอถูกยกเลิก: ' || btrim(p_reason),
           cancelled_at  = now(),
           cancelled_by  = auth.uid()
     where id = v_alloc.id;

    v_count    := v_count + 1;
    v_returned := v_returned + v_alloc.quantity_allocated;
  end loop;

  update public.requests
     set status             = 'cancelled',
         quantity_fulfilled = quantity_fulfilled - v_returned,
         cancel_reason      = btrim(p_reason),
         cancelled_at       = now(),
         cancelled_by       = auth.uid()
   where id = p_request_id;

  return v_count;
end;
$$;


-- ---------- ชื่อผู้ยืนยันส่งมอบ (computed column) ----------
create or replace function public.delivered_by_name(a public.allocations)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.full_name, ''), p.username)
    from public.profiles p
   where p.id = a.delivered_by;
$$;


-- ---------- 7. allocations แก้ได้ผ่านฟังก์ชันเท่านั้น ----------
drop policy if exists allocations_update on public.allocations;
