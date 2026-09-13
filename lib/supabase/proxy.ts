// =====================================================================
// ตัวรีเฟรช session + ตัวกันหน้าที่ต้อง login
// ถูกเรียกจาก proxy.ts ที่รากโปรเจกต์ ทุก request ก่อนหน้าจะถูก render
//
// ทำไมต้องมี: access token ของ Supabase อายุสั้น (ราว 1 ชม.)
//   Server Component เขียน cookie ไม่ได้ ถ้าไม่รีเฟรชตรงนี้
//   ผู้ใช้จะโดนเตะออกจากระบบเองระหว่างใช้งาน
//
// ไฟล์นี้เป็น "ของกลาง" — ห้ามแก้โดยไม่แจ้งทีม
// =====================================================================

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// หน้าที่เข้าได้โดยยังไม่ต้อง login
// / = Entry Hub ให้เลือกว่าจะเข้าเว็บในฐานะอะไร (app/page.tsx เช็ค user เอง
//     แล้ว render คนละแบบ — ถ้าไม่เปิดตรงนี้ด้วย proxy จะเด้งไป /login ก่อน
//     ถึง component เลย ไม่มีทางเห็น Entry Hub)
// /register = สมัครสมาชิกอาสาสมัคร (docs/sql/13_volunteer_role.sql)
// /pledge = ฟอร์มสาธารณะแจ้งความประสงค์บริจาค (role "ผู้ใช้ทั่วไป", docs/sql/10_public_pledges.sql)
// /help-request = ฟอร์มสาธารณะขอความช่วยเหลือ (docs/sql/12_public_help_requests.sql)
const PUBLIC_PATHS = ['/', '/login', '/register', '/pledge', '/help-request']

// หน้าที่ต้อง login — path ที่ไม่อยู่ทั้งสองรายการ (เช่นพิมพ์ URL ผิด) ปล่อยผ่าน
// ให้ Next แสดงหน้า 404 แทนการเด้งไป /login ที่ทำให้ผู้ใช้งงว่าหน้ามีอยู่จริง
// ⚠️ เพิ่มหน้าใหม่ที่ต้อง login ต้องเพิ่ม prefix ตรงนี้ด้วย
const PROTECTED_PATHS = [
  '/admin',
  '/allocations',
  '/donations',
  '/donors',
  '/help-requests',
  '/inventory',
  '/pledges',
  '/requests',
  '/volunteer',
]

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + '/'))

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // ต้องเขียน cookie ลง 2 ที่:
          // 1. request  — เพื่อให้โค้ดที่รันต่อจากนี้ในรอบเดียวกันเห็น token ใหม่
          // 2. response — เพื่อให้เบราว์เซอร์เก็บ token ใหม่ไว้ใช้รอบถัดไป
          // ถ้าเขียนแค่ที่เดียวจะเกิดอาการ "ล็อกอินแล้วแต่เด้งกลับหน้า login"
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // ใช้ getUser() ไม่ใช่ getSession()
  // getUser() ยิงไปถามเซิร์ฟเวอร์ Supabase ว่า token นี้จริงไหม
  // ส่วน getSession() แค่อ่านจาก cookie ซึ่งผู้ใช้แก้เองได้ จึงเชื่อไม่ได้
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = !matches(path, PUBLIC_PATHS) && matches(path, PROTECTED_PATHS)

  // ยังไม่ล็อกอิน แต่พยายามเข้าหน้าที่ต้องล็อกอิน → ส่งไปหน้า login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ล็อกอินแล้ว แต่ยังวนอยู่หน้า login → ส่งเข้าหน้าหลัก
  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // ต้อง return ตัว response ก้อนเดิมที่ setAll แก้ไว้เท่านั้น
  // ถ้าสร้าง NextResponse ใหม่ตรงนี้ cookie ที่เพิ่งรีเฟรชจะหายไป
  return response
}
