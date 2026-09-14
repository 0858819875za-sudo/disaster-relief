-- =====================================================================
-- 21_merge_anonymous_donors.sql — รวมผู้บริจาค "ไม่ประสงค์ออกนาม" ให้เหลือแถวเดียว
--
-- หน้าทะเบียนผู้บริจาคแสดงทุกแถวที่ is_anonymous = true เป็น "ไม่ประสงค์ออกนาม"
-- เหมือนกันหมด ถ้ามีหลายแถวจึงดูเหมือนข้อมูลซ้ำ และประวัติการบริจาคกระจายกัน
--
-- เก็บแถวที่เก่าที่สุดไว้ ย้ายของบริจาคของแถวอื่นมาผูกกับแถวนั้น แล้วลบแถวที่เหลือ
-- ทั้งหมดอยู่ใน transaction เดียว: ขั้นไหนพังจะย้อนกลับทั้งหมด
--
-- วิธีใช้: รันส่วน PREVIEW ดูก่อน แล้วค่อยรันทั้งไฟล์ (SQL Editor role = postgres)
-- =====================================================================

-- ---------- PREVIEW (รันแยกได้ ไม่แก้ข้อมูล) ----------
-- select dn.id, dn.name, dn.phone, dn.created_at, count(d.id) as donations
--   from public.donors dn
--   left join public.donations d on d.donor_id = dn.id
--  where dn.is_anonymous
--  group by dn.id
--  order by dn.created_at, dn.id;

begin;

create temp table anon_donors on commit drop as
select id, first_value(id) over (order by created_at, id) as keep_id
from public.donors
where is_anonymous;

update public.donations o
   set donor_id = a.keep_id
  from anon_donors a
 where o.donor_id = a.id
   and a.id <> a.keep_id;

delete from public.donors dn
 using anon_donors a
 where dn.id = a.id
   and a.id <> a.keep_id;

-- ---------- ตรวจผล: ต้องเหลือ 0 หรือ 1 ----------
select count(*) as anonymous_donors from public.donors where is_anonymous;

commit;
