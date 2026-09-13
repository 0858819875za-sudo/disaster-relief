import type { Metadata } from "next";
import { Sarabun, Prompt } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "./nav";
import { PublicToggleBar } from "./public-toggle-bar";
import { getLocale } from "@/lib/i18n/locale";

// Sarabun เป็นฟอนต์มาตรฐานที่ใช้ในเอกสารราชการ/ทางการของไทย ใช้กับเนื้อหา/
// ฟอร์มที่ต้องอ่านยาวๆ เพื่อสื่อความน่าเชื่อถือกับผู้อ่าน โดยเฉพาะกลุ่ม
// ผู้ประสบภัยที่ต้องการความมั่นใจว่าระบบนี้เป็นทางการ
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

// Prompt เป็นฟอนต์ของแบรนด์ WalaiTrack (โลโก้/หัวข้อใหญ่เท่านั้น) — ทีม
// เลือกธีมนี้เองหลังดู mockup แล้ว ไม่ใช้แทน Sarabun ทั้งเว็บเพราะ Prompt
// อ่านยาวๆ ไม่สบายตาเท่า เก็บไว้เฉพาะจุดที่ต้องการความรู้สึกของแบรนด์
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

// ชื่อแท็บเบราว์เซอร์ต้องเปลี่ยนตามภาษาที่เลือกด้วย (อ่านจาก cookie เดียวกับเนื้อหา)
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return locale === "en"
    ? {
        title: "WalaiTrack — Disaster relief donation & distribution tracking",
        description: "Internal system for donation centers and shelter staff",
      }
    : {
        title: "WalaiTrack — ระบบติดตามการบริจาคและกระจายสิ่งของช่วยเหลือภัยพิบัติ",
        description: "ระบบภายในสำหรับเจ้าหน้าที่ศูนย์รับบริจาคและศูนย์พักพิง",
      };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // layout ครอบทุกหน้ารวมถึง /login กับ /pledge (สาธารณะ) ด้วย เลยต้องเช็ค
  // session เองตรงนี้ก่อนตัดสินใจว่าจะโชว์แถบเมนูไหม — ไม่งั้นคนที่ยังไม่
  // login จะเห็นแถบเมนูของหน้าที่ตัวเองเข้าไม่ได้อยู่ดี
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  const locale = await getLocale();

  // อ่านธีมจาก cookie ฝั่ง server แล้วใส่ class ตั้งแต่ HTML แรก — ไม่ต้องมี
  // สคริปต์กันจอกระพริบ (ไอเดียจาก PR #2 ของทีม) และทำงานแบบเดียวกับภาษา
  const isDark = (await cookies()).get("theme")?.value === "dark";

  return (
    <html
      lang={locale}
      className={`${sarabun.variable} ${prompt.variable} h-full antialiased${isDark ? " dark" : ""}`}
    >
      <body className="min-h-full flex flex-col bg-brand-cream dark:bg-slate-950">
        {user ? <Nav role={role} locale={locale} /> : <PublicToggleBar locale={locale} />}
        {children}
      </body>
    </html>
  );
}
