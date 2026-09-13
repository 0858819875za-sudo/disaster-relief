-- =====================================================================
-- 19_dedupe_test_data.sql — ลบข้อมูลทดสอบที่ซ้ำกัน (เช่น seed ถูกรันสองรอบ)
--
-- ลบเฉพาะแถวที่ "เหมือนกันทุกช่องที่มีความหมาย" และเก็บแถวที่เก่าที่สุดไว้
-- ไม่ลบแถวที่ถูกอ้างอิงโดยการจัดสรร (allocations) — ประวัติการจัดสรรยังครบ
-- ทั้งหมดอยู่ใน transaction เดียว: ขั้นไหนพังจะย้อนกลับทั้งหมด
--
-- วิธีใช้: รันส่วน PREVIEW ก่อนเพื่อดูว่าจะลบอะไร แล้วค่อยรันทั้งไฟล์
-- =====================================================================

-- ---------- PREVIEW (รันแยกได้ ไม่แก้ข้อมูล) ----------
-- select 'requests' t, center_id::text, item_name, quantity_requested::text, count(*)
--   from public.requests group by 1,2,3,4, category, urgency, status, quantity_fulfilled having count(*) > 1
-- union all
-- select 'donations', center_id::text, item_name, quantity_remaining::text, count(*)
--   from public.donations group by 1,2,3,4, donor_id, category, unit, quantity_received, expiry_date having count(*) > 1
-- union all
-- select 'donation_pledges', donor_phone, item_name, quantity::text, count(*)
--   from public.donation_pledges group by 1,2,3,4, donor_name, category, status having count(*) > 1
-- union all
-- select 'donors', coalesce(phone, '-'), name, donor_type, count(*)
--   from public.donors group by 1,2,3,4, is_anonymous having count(*) > 1;

begin;

-- ---------- 1. requests ----------
create temp table dup_requests on commit drop as
select id, keep_id from (
  select id,
         first_value(id) over w as keep_id,
         row_number()    over w as rn
  from public.requests
  window w as (partition by center_id, item_name, category, quantity_requested,
                            quantity_fulfilled, urgency, status
               order by created_at, id)
) x
where rn > 1
  and not exists (select 1 from public.allocations a where a.request_id = x.id);

-- คำร้องจากประชาชนที่ผูกกับแถวซ้ำ → ย้ายไปผูกกับแถวที่เก็บไว้
update public.request_pledges rp
   set converted_request_id = d.keep_id
  from dup_requests d
 where rp.converted_request_id = d.id;

delete from public.requests r using dup_requests d where r.id = d.id;

-- ---------- 2. donations ----------
create temp table dup_donations on commit drop as
select id, keep_id from (
  select id,
         first_value(id) over w as keep_id,
         row_number()    over w as rn
  from public.donations
  window w as (partition by center_id, donor_id, item_name, category, unit,
                            quantity_received, quantity_remaining, expiry_date
               order by received_at, id)
) x
where rn > 1
  and not exists (select 1 from public.allocations a where a.donation_id = x.id);

update public.donation_pledges dp
   set converted_donation_id = d.keep_id
  from dup_donations d
 where dp.converted_donation_id = d.id;

delete from public.donations o using dup_donations d where o.id = d.id;

-- ---------- 3. donation_pledges ----------
delete from public.donation_pledges p
using (
  select id, row_number() over (
           partition by donor_name, donor_phone, item_name, category, quantity, status
           order by created_at, id) as rn
  from public.donation_pledges
) x
where p.id = x.id and x.rn > 1;

-- ---------- 4. donors ----------
-- ของบริจาคที่อ้างถึงผู้บริจาคซ้ำ → ย้ายไปผู้บริจาคที่เก็บไว้ก่อนลบ
-- (trigger กันลบผู้บริจาคที่มีประวัติจาก 05 จึงไม่ติด)
create temp table dup_donors on commit drop as
select id, keep_id from (
  select id,
         first_value(id) over w as keep_id,
         row_number()    over w as rn
  from public.donors
  window w as (partition by name, donor_type, coalesce(phone, ''), is_anonymous
               order by created_at, id)
) x
where rn > 1;

update public.donations o
   set donor_id = d.keep_id
  from dup_donors d
 where o.donor_id = d.id;

delete from public.donors r using dup_donors d where r.id = d.id;

commit;
