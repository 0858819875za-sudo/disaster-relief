-- =====================================================================
-- 24_f5_tests.sql — ทดสอบกฎของ F5 ที่ระดับฐานข้อมูล (รันหลัง 23_f5_improvements.sql)
--
-- สวมสิทธิ์ผู้ใช้จริงในระบบ (admin / staff / อาสาสมัคร) แล้วเรียกฟังก์ชันตรง
-- เหมือนคนที่ข้ามหน้าเว็บมายิง API เอง ทุกเคสอยู่ใน sub-transaction ที่ถูกย้อนกลับ
-- ข้อมูลทดสอบและการย้ายศูนย์ชั่วคราวของบัญชีทดสอบถูกย้อนกลับทั้งหมดตอนจบ
-- → รันกี่ครั้งก็ได้ ไม่ทิ้งข้อมูลค้าง
--
-- ต้องมี: บัญชี admin 1, staff 1 (อาสาสมัคร 1 ถ้ามี — ไม่มีจะขึ้น SKIP)
--         ศูนย์รับบริจาคหาดใหญ่, ศูนย์รับบริจาคเทศบาลนครสงขลา, ศูนย์พักพิงวัดคลองแห
--
-- วิธีใช้: รันทั้งไฟล์ใน SQL Editor ผลลัพธ์เป็นตาราง — คอลัมน์ result ต้องเป็น ✅ ทุกแถว
-- =====================================================================

create temp table if not exists f5_test_results (
  n         int,
  case_name text,
  expected  text,
  actual    text,
  pass      boolean
);
truncate f5_test_results;

create or replace function pg_temp.act_as(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
end;
$$;

do $$
declare
  v_admin uuid;
  v_staff uuid;
  v_vol   uuid;
  v_wh    uuid;
  v_wh2   uuid;
  v_sh    uuid;
  v_lot_a    uuid;
  v_lot_exp  uuid;
  v_lot_unit uuid;
  v_lot_wh2  uuid;
  v_req      uuid;
  v_req_wh   uuid;
  v_alloc    uuid;
  v_rows     int;
  v_actual   text;
  r          text[] := '{}';
  c_skip constant text := 'SKIP (ไม่มีบัญชีอาสาสมัคร)';
begin
  select id into v_admin from public.profiles where role = 'admin' order by id limit 1;
  select id into v_staff from public.profiles where role = 'staff' order by id limit 1;
  select id into v_vol   from public.profiles where role = 'volunteer' order by id limit 1;
  select id into v_wh  from public.centers where name = 'ศูนย์รับบริจาคหาดใหญ่';
  select id into v_wh2 from public.centers where name = 'ศูนย์รับบริจาคเทศบาลนครสงขลา';
  select id into v_sh  from public.centers where name = 'ศูนย์พักพิงวัดคลองแห';

  if v_admin is null or v_staff is null or v_wh is null or v_wh2 is null or v_sh is null then
    raise exception 'ต้องมีบัญชี admin + staff และศูนย์ทั้ง 3 แห่งก่อนรันไฟล์นี้';
  end if;

  begin
    -- ---------- เตรียมข้อมูล (ย้อนกลับทั้งหมดตอนจบ) ----------
    perform pg_temp.act_as(v_admin);
    update public.profiles set center_id = v_wh where id = v_staff;
    if v_vol is not null then
      update public.profiles set center_id = v_sh where id = v_vol;
    end if;

    insert into public.donations (center_id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date)
    values (v_wh, '[TEST] F5T ข้าวสาร A', 'food', 'ถุง', 100, 100, current_date + 180)
    returning id into v_lot_a;
    insert into public.donations (center_id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date)
    values (v_wh, '[TEST] F5T ข้าวสาร หมดอายุ', 'food', 'ถุง', 40, 40, (now() at time zone 'Asia/Bangkok')::date - 3)
    returning id into v_lot_exp;
    insert into public.donations (center_id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date)
    values (v_wh, '[TEST] F5T ข้าวสาร ลัง', 'food', 'ลัง', 10, 10, current_date + 180)
    returning id into v_lot_unit;
    insert into public.donations (center_id, item_name, category, unit, quantity_received, quantity_remaining, expiry_date)
    values (v_wh2, '[TEST] F5T ข้าวสาร สงขลา', 'food', 'ถุง', 50, 50, current_date + 180)
    returning id into v_lot_wh2;

    insert into public.requests (center_id, item_name, category, unit, quantity_requested, urgency)
    values (v_sh, '[TEST] F5T ข้าวสาร', 'food', 'ถุง', 50, 'high')
    returning id into v_req;
    insert into public.requests (center_id, item_name, category, unit, quantity_requested, urgency)
    values (v_wh, '[TEST] F5T ข้าวสาร (ศูนย์เดียวกับ staff)', 'food', 'ถุง', 20, 'medium')
    returning id into v_req_wh;

    -- ---------- 1 ----------
    if v_vol is null then v_actual := c_skip; else
    begin
      perform pg_temp.act_as(v_vol);
      perform public.allocate_items(v_req, v_lot_a, 10);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end; end if;
    r := r || format('1|อาสาสมัครเรียก allocate_items ตรง|F5:not_staff|%s', v_actual);

    -- ---------- 2 ----------
    begin
      perform pg_temp.act_as(v_staff);
      perform public.allocate_items(v_req, v_lot_a, 10);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('2|staff จัดสรรข้ามศูนย์|F5:cross_center_admin_only|%s', v_actual);

    -- ---------- 3 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items(v_req, v_lot_wh2, 60);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('3|จ่ายเกินยอดคงเหลือ (TC08)|F5:over_remaining|%s', v_actual);

    -- ---------- 4 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items(v_req, v_lot_exp, 5);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('4|จ่ายของหมดอายุ (TC09)|F5:expired|%s', v_actual);

    -- ---------- 5 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items(v_req, v_lot_unit, 5);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('5|หน่วยล็อตไม่ตรงกับคำขอ|F5:unit_mismatch|%s', v_actual);

    -- ---------- 6 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items(v_req, v_lot_a, 60);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('6|จ่ายเกินที่คำขอต้องการ|F5:over_requested|%s', v_actual);

    -- ---------- 7 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items(v_req, v_lot_a, 30);
      select format('OK remaining=%s status=%s',
                    (select quantity_remaining from public.donations where id = v_lot_a),
                    (select status from public.requests where id = v_req))
        into v_actual;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('7|จัดสรรบางส่วน (TC07)|OK remaining=70 status=partial|%s', v_actual);

    -- ---------- 8 ----------
    begin
      perform pg_temp.act_as(v_admin);
      perform public.allocate_items_multi(v_req, jsonb_build_array(
        jsonb_build_object('donation_id', v_lot_a, 'quantity', 20),
        jsonb_build_object('donation_id', v_lot_exp, 'quantity', 5)));
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    v_actual := v_actual || ' remaining=' || (select quantity_remaining from public.donations where id = v_lot_a);
    r := r || format('8|หลายล็อต ล็อตที่ 2 ไม่ผ่าน → ย้อนทั้งชุด|F5:expired remaining=100|%s', v_actual);

    -- ---------- 9 ----------
    begin
      perform pg_temp.act_as(v_staff);
      execute 'set local role authenticated';
      update public.donations set quantity_remaining = 999 where id = v_lot_a;
      get diagnostics v_rows = row_count;
      execute 'reset role';
      v_actual := 'OK rows=' || v_rows;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('9|staff แก้ยอดคงเหลือของล็อตตรง|F5:stock_locked|%s', v_actual);

    -- ---------- 10 ----------
    begin
      perform pg_temp.act_as(v_staff);
      execute 'set local role authenticated';
      update public.requests set quantity_fulfilled = 20, status = 'fulfilled' where id = v_req_wh;
      get diagnostics v_rows = row_count;
      execute 'reset role';
      v_actual := 'OK rows=' || v_rows;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('10|staff แก้ยอด/สถานะคำขอตรง|F5:stock_locked|%s', v_actual);

    -- ---------- 11 ----------
    if v_vol is null then v_actual := c_skip; else
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 30);
      perform pg_temp.act_as(v_vol);
      perform public.mark_delivered(v_alloc, 25, null);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end; end if;
    r := r || format('11|รับของไม่ครบแต่ไม่มีหมายเหตุ|F5:note_required|%s', v_actual);

    -- ---------- 12 ----------
    if v_vol is null then v_actual := c_skip; else
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 30);
      perform pg_temp.act_as(v_vol);
      perform public.mark_delivered(v_alloc, 25, 'ถุงขาด 5 ถุง');
      select format('OK fulfilled=%s status=%s received=%s by_volunteer=%s lot=%s',
                    r2.quantity_fulfilled, r2.status, a.received_quantity, (a.delivered_by = v_vol)::text,
                    (select quantity_remaining from public.donations where id = v_lot_a))
        into v_actual
        from public.allocations a join public.requests r2 on r2.id = a.request_id
       where a.id = v_alloc;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end; end if;
    r := r || format('12|อาสาสมัครรับของไม่ครบ (มีหมายเหตุ)|OK fulfilled=25 status=partial received=25 by_volunteer=true lot=70|%s', v_actual);

    -- ---------- 13 ----------
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 10);
      perform pg_temp.act_as(v_staff);
      perform public.mark_delivered(v_alloc, null, null);
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('13|staff ศูนย์อื่นยืนยันส่งมอบ|F5:not_your_center|%s', v_actual);

    -- ---------- 14 ----------
    begin
      perform pg_temp.act_as(v_staff);
      v_alloc := public.allocate_items(v_req_wh, v_lot_a, 10);
      perform public.cancel_allocation(v_alloc, 'staff กดผิด');
      select format('OK remaining=%s status=%s',
                    (select quantity_remaining from public.donations where id = v_lot_a),
                    (select status from public.requests where id = v_req_wh))
        into v_actual;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('14|staff ยกเลิกรายการของตัวเองภายใน 30 นาที|OK remaining=100 status=pending|%s', v_actual);

    -- ---------- 15 ----------
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req_wh, v_lot_a, 10);
      perform pg_temp.act_as(v_staff);
      perform public.cancel_allocation(v_alloc, 'ไม่ใช่ของตัวเอง');
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('15|staff ยกเลิกรายการที่คนอื่นจัดสรร|F5:admin_only|%s', v_actual);

    -- ---------- 16 ----------
    begin
      perform pg_temp.act_as(v_staff);
      v_alloc := public.allocate_items(v_req_wh, v_lot_a, 10);
      update public.allocations set allocated_at = now() - interval '31 minutes' where id = v_alloc;
      perform public.cancel_allocation(v_alloc, 'เกินเวลาแล้ว');
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('16|staff ยกเลิกของตัวเองหลัง 30 นาที|F5:admin_only|%s', v_actual);

    -- ---------- 17 ----------
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 10);
      perform public.mark_delivered(v_alloc, null, null);
      perform public.cancel_allocation(v_alloc, 'ยกเลิกหลังส่งมอบ');
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('17|ยกเลิกรายการที่ส่งมอบแล้ว|F5:already_delivered|%s', v_actual);

    -- ---------- 18 ----------
    begin
      perform pg_temp.act_as(v_staff);
      perform public.cancel_request(v_req, 'ไม่ใช่ศูนย์ตัวเอง');
      raise exception 'F5T:rollback';
    exception when others then
      v_actual := case when sqlerrm = 'F5T:rollback' then 'OK' else sqlerrm end;
    end;
    r := r || format('18|staff ยกเลิกคำขอของศูนย์อื่น|F5:not_your_center|%s', v_actual);

    -- ---------- 19 ----------
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 30);
      perform public.cancel_request(v_req, 'ศูนย์ได้รับของจากแหล่งอื่นแล้ว');
      select format('OK remaining=%s request=%s fulfilled=%s allocation=%s',
                    (select quantity_remaining from public.donations where id = v_lot_a),
                    (select status from public.requests where id = v_req),
                    (select quantity_fulfilled from public.requests where id = v_req),
                    (select status from public.allocations where id = v_alloc))
        into v_actual;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('19|admin ยกเลิกคำขอ → คืนยอดรายการที่ยังไม่ส่งมอบ|OK remaining=100 request=cancelled fulfilled=0 allocation=cancelled|%s', v_actual);

    -- ---------- 20 ----------
    begin
      perform pg_temp.act_as(v_admin);
      v_alloc := public.allocate_items(v_req, v_lot_a, 10);
      execute 'set local role authenticated';
      update public.allocations set status = 'cancelled' where id = v_alloc;
      get diagnostics v_rows = row_count;
      execute 'reset role';
      v_actual := 'OK rows=' || v_rows;
      raise exception 'F5T:rollback';
    exception when others then
      if sqlerrm <> 'F5T:rollback' then v_actual := sqlerrm; end if;
    end;
    r := r || format('20|admin แก้ตาราง allocations ตรง|OK rows=0|%s', v_actual);

    raise exception 'F5T:cleanup';
  exception when others then
    if sqlerrm <> 'F5T:cleanup' then
      r := r || format('0|เตรียมข้อมูลไม่สำเร็จ|OK|%s', sqlerrm);
    end if;
  end;

  insert into f5_test_results (n, case_name, expected, actual, pass)
  select split_part(x, '|', 1)::int,
         split_part(x, '|', 2),
         split_part(x, '|', 3),
         split_part(x, '|', 4),
         split_part(x, '|', 3) = split_part(x, '|', 4)
    from unnest(r) as x;
end $$;

select n,
       case_name,
       expected,
       actual,
       case when pass then '✅' when actual like 'SKIP%' then '⏭' else '❌' end as result
  from f5_test_results
 order by n;
