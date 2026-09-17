-- =====================================================================
-- 22_tc_f5_setup.sql — เตรียมข้อมูลสำหรับเก็บหลักฐาน TC07–TC11 (F5)
--
-- สร้างของทดสอบที่ขึ้นต้นด้วย "[TEST]" ทั้งหมด ลบทิ้งได้ด้วย 20_cleanup_test_records.sql
--   ล็อต A  100 ถุง  หมดอายุอีก 6 เดือน  → TC07, TC10, TC11
--   ล็อต B   20 ถุง  หมดอายุอีก 6 เดือน  → TC08 (สั่งจ่ายเกินยอด)
--   ล็อต C   40 ถุง  หมดอายุไปแล้ว       → TC09 (ต้องไม่ขึ้นให้เลือก)
--   คำขอ    50 ถุง  ศูนย์พักพิงวัดคลองแห → ใช้ร่วมกันทุกเคส
-- ทุกล็อตอยู่ที่ศูนย์รับบริจาคหาดใหญ่ หมวดอาหาร ชื่อสินค้าเดียวกับคำขอ
--
-- วิธีใช้: รันทั้งไฟล์ครั้งเดียวก่อนเริ่มทดสอบ (SQL Editor role = postgres)
-- =====================================================================

do $$
declare
  v_wh uuid;
  v_sh uuid;
begin
  select id into v_wh from public.centers where name = 'ศูนย์รับบริจาคหาดใหญ่';
  select id into v_sh from public.centers where name = 'ศูนย์พักพิงวัดคลองแห';
  if v_wh is null or v_sh is null then
    raise exception 'ไม่พบศูนย์รับบริจาคหาดใหญ่ หรือศูนย์พักพิงวัดคลองแห';
  end if;

  if exists (select 1 from public.requests where item_name like '[TEST] TC%') then
    raise exception 'มีข้อมูล [TEST] TC อยู่แล้ว — รัน 20_cleanup_test_records.sql ก่อน';
  end if;

  insert into public.donations
    (center_id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date)
  values
    (v_wh, '[TEST] TC ข้าวสาร 5 กก. (ล็อต A)', 'food', 'ถุง', 100, 100, current_date + interval '6 months'),
    (v_wh, '[TEST] TC ข้าวสาร 5 กก. (ล็อต B)', 'food', 'ถุง', 20, 20, current_date + interval '6 months'),
    (v_wh, '[TEST] TC ข้าวสาร 5 กก. (ล็อต C หมดอายุ)', 'food', 'ถุง', 40, 40, current_date - 3);

  insert into public.requests (center_id, item_name, category, quantity_requested, urgency)
  values (v_sh, '[TEST] TC ข้าวสาร 5 กก.', 'food', 50, 'high');
end $$;

-- ---------- ตรวจผล ----------
select item_name, quantity_remaining as qty, expiry_date, 'donation' as t
  from public.donations where item_name like '[TEST] TC%'
union all
select item_name, quantity_requested, null, 'request (' || status || ')'
  from public.requests where item_name like '[TEST] TC%'
order by t, item_name;
