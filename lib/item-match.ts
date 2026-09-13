// จับคู่ "ชื่อของ" ระหว่างคำขอกับล็อตในคลัง — ตัดขนาด/น้ำหนักและช่องว่างออกก่อน
// แล้วถือว่าตรงกันถ้าชื่อหนึ่งอยู่ในอีกชื่อ เช่น "นมผงเด็ก" ↔ "นมผงเด็ก 900 กรัม",
// "ข้าวสาร 5 กก." ↔ "ข้าวสารหอมมะลิ 5 กก." แต่ "นมผงเด็ก" ≠ "ข้าวสาร"
const SIZE_RE = /\d+(?:[.,]\d+)?\s*(?:กิโลกรัม|กก\.?|กรัม|ก\.|มิลลิลิตร|มล\.?|ลิตร|ล\.|kg|g|ml|l)?/gi

export function itemCore(name: string) {
  return name
    .toLowerCase()
    .replace(SIZE_RE, '')
    .replace(/[\s().,\-–—/]+/g, '')
}

export function itemsMatch(requestName: string, lotName: string) {
  const a = itemCore(requestName)
  const b = itemCore(lotName)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}
