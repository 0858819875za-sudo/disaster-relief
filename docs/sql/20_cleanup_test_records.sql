-- =====================================================================
-- 20_cleanup_test_records.sql — ลบข้อมูลทดสอบที่ขึ้นต้นด้วย "[TEST]"
--
-- ลบตามลำดับที่ foreign key ต้องการ:
--   allocations → donation_pledges / request_pledges → donations / requests → donors
-- ไม่ต้องคืนยอดคลัง เพราะล็อตและคำขอที่ถูกจัดสรรเป็นของทดสอบทั้งคู่ และถูกลบไปด้วย
--
-- กันพลาด: ถ้ามีการจัดสรรที่ผูก "ของทดสอบ" กับ "ของจริง" (ล็อตจริงให้คำขอทดสอบ
-- หรือกลับกัน) สคริปต์จะหยุดและย้อนกลับทั้งหมด — ต้องยกเลิกรายการนั้นในหน้าเว็บก่อน
--
-- วิธีใช้: รันส่วน PREVIEW ดูก่อน แล้วค่อยรันทั้งไฟล์ (SQL Editor role = postgres)
-- =====================================================================

-- ---------- PREVIEW (รันแยกได้ ไม่แก้ข้อมูล) ----------
-- select 'donors' t, count(*) from public.donors where name like '[TEST]%'
-- union all select 'donations', count(*) from public.donations where item_name like '[TEST]%'
-- union all select 'requests', count(*) from public.requests where item_name like '[TEST]%'
-- union all select 'allocations', count(*) from public.allocations a
--   join public.requests r on r.id = a.request_id
--   join public.donations d on d.id = a.donation_id
--   where r.item_name like '[TEST]%' or d.item_name like '[TEST]%'
-- union all select 'donation_pledges', count(*) from public.donation_pledges where donor_name like '[TEST]%' or item_name like '[TEST]%'
-- union all select 'request_pledges', count(*) from public.request_pledges where requester_name like '[TEST]%' or item_name like '[TEST]%';

begin;

-- ---------- กันพลาด: การจัดสรรที่ข้ามระหว่างของทดสอบกับของจริง ----------
do $$
declare
  mixed int;
begin
  select count(*) into mixed
  from public.allocations a
  join public.requests  r on r.id = a.request_id
  join public.donations d on d.id = a.donation_id
  where (r.item_name like '[TEST]%') <> (d.item_name like '[TEST]%')
    and a.status <> 'cancelled';

  if mixed > 0 then
    raise exception 'พบการจัดสรร % รายการที่ผูกของทดสอบกับของจริง — ยกเลิกในหน้าประวัติก่อน แล้วค่อยรันใหม่', mixed;
  end if;
end $$;

-- ---------- 1. allocations ----------
delete from public.allocations a
using public.requests r, public.donations d
where r.id = a.request_id
  and d.id = a.donation_id
  and (r.item_name like '[TEST]%' or d.item_name like '[TEST]%');

-- ---------- 2. คำร้องสาธารณะ ----------
delete from public.donation_pledges
where donor_name like '[TEST]%' or item_name like '[TEST]%';

delete from public.request_pledges
where requester_name like '[TEST]%' or item_name like '[TEST]%';

-- ---------- 3. ล็อตและคำขอ ----------
delete from public.donations where item_name like '[TEST]%';
delete from public.requests  where item_name like '[TEST]%';

-- ---------- 4. ผู้บริจาค ----------
-- ของบริจาคจริงที่บังเอิญผูกผู้บริจาคทดสอบ (ถ้ามี) จะกลายเป็นไม่ระบุผู้บริจาค
update public.donations set donor_id = null
where donor_id in (select id from public.donors where name like '[TEST]%');

delete from public.donors where name like '[TEST]%';

-- ---------- ตรวจผล: ทุกแถวต้องเป็น 0 ----------
select 'donors' t, count(*) from public.donors where name like '[TEST]%'
union all select 'donations', count(*) from public.donations where item_name like '[TEST]%'
union all select 'requests', count(*) from public.requests where item_name like '[TEST]%'
union all select 'donation_pledges', count(*) from public.donation_pledges where donor_name like '[TEST]%' or item_name like '[TEST]%'
union all select 'request_pledges', count(*) from public.request_pledges where requester_name like '[TEST]%' or item_name like '[TEST]%';

commit;
