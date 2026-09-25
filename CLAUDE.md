# CLAUDE.md — บันทึกอ้างอิงสำหรับโปรเจกต์ "สุกี้ผีน้อย"

ไฟล์นี้มีไว้ให้ Claude (หรือผู้พัฒนา) อ่านอ้างอิงตลอดโปรเจกต์นี้ ไม่ต้องรันหรือ deploy อะไรจากไฟล์นี้

## ภาพรวมโปรเจกต์
ระบบสั่งอาหารร้านบุฟเฟต์ "สุกี้ผีน้อย"
- Frontend/Backend: Next.js (App Router, JavaScript — **ไม่ใช้ TypeScript**)
- Database/Backend-as-a-Service: Supabase
- Deploy: Vercel

## ⚠️ ข้อควรระวังสำคัญ: Next.js เวอร์ชันล่าสุด — `params` เป็น Promise

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด (15+) ซึ่ง **`params` และ `searchParams` ใน Dynamic Route
เป็น Promise แล้ว ไม่ใช่ object ธรรมดา**

เวลาสร้างหน้าใน Dynamic Route (เช่น `/order/[tableNumber]/page.js`) **ห้าม** เขียนแบบเก่า:

```js
// ❌ วิธีเก่า ใช้ไม่ได้แล้วใน Next.js เวอร์ชันล่าสุด
export default function Page({ params }) {
  const tableNumber = params.tableNumber; // params เป็น Promise ไม่ใช่ object
  ...
}
```

ต้อง unwrap ด้วย `use()` จาก React เสมอ (สำหรับ Client Component) หรือ `await` (สำหรับ Server Component async function):

```js
// ✅ Client Component — ต้อง unwrap ด้วย use()
'use client';
import { use } from 'react';

export default function Page({ params }) {
  const { tableNumber } = use(params);
  ...
}
```

```js
// ✅ Server Component — ใช้ await ได้เลยเพราะ component เป็น async function
export default async function Page({ params }) {
  const { tableNumber } = await params;
  ...
}
```

กฎนี้ใช้กับทุกหน้าที่จะสร้างในขั้นตอนถัดไป โดยเฉพาะหน้าสั่งอาหารที่คาดว่าจะมี route
ลักษณะ `/order/[tableNumber]` หรือคล้ายกัน

## โครงสร้างฐานข้อมูล Supabase (มีอยู่แล้ว — ไม่ต้องสร้างใหม่)

ตารางเหล่านี้ถูกสร้างไว้แล้วใน Supabase project จริง ใช้เป็นข้อมูลอ้างอิงเวลาเขียน query เท่านั้น

### `sessions`
| คอลัมน์ | ชนิดข้อมูล (สันนิษฐาน) | หมายเหตุ |
|---|---|---|
| id | uuid / bigint (PK) | รหัส session การกินบุฟเฟต์ต่อโต๊ะ |
| table_number | text/int | หมายเลขโต๊ะ |
| adult_count | int | จำนวนผู้ใหญ่ |
| child_count | int | จำนวนเด็ก |
| status | text | สถานะ session เช่น active, closed |
| created_at | timestamp | เวลาที่สร้าง session |

### `menu_categories`
| คอลัมน์ | ชนิดข้อมูล (สันนิษฐาน) | หมายเหตุ |
|---|---|---|
| id | uuid / bigint (PK) | รหัสหมวดหมู่เมนู |
| name | text | ชื่อหมวดหมู่ เช่น "เนื้อสัตว์", "ผัก", "เครื่องดื่ม" |
| sort_order | int | ลำดับการแสดงผล |

### `menu_items`
| คอลัมน์ | ชนิดข้อมูล (สันนิษฐาน) | หมายเหตุ |
|---|---|---|
| id | uuid / bigint (PK) | รหัสเมนู |
| category_id | uuid / bigint (FK → menu_categories.id) | หมวดหมู่ของเมนูนี้ |
| name | text | ชื่อเมนู |

### `orders`
| คอลัมน์ | ชนิดข้อมูล (สันนิษฐาน) | หมายเหตุ |
|---|---|---|
| id | uuid / bigint (PK) | รหัสออเดอร์ |
| session_id | uuid / bigint (FK → sessions.id) | อ้างอิง session ที่สั่ง |
| table_number | text/int | หมายเลขโต๊ะ (denormalized ไว้เพื่อ query ง่าย) |
| items | jsonb | รายการอาหารที่สั่ง เก็บเป็น array ของ object เช่น `[{ "menu_item_id": ..., "name": ..., "qty": ... }]` |
| status | text | สถานะออเดอร์ เช่น pending, cooking, served |
| created_at | timestamp | เวลาที่สั่ง |

> หมายเหตุ: ชนิดข้อมูลจริงให้ตรวจสอบกับ Supabase Table Editor ก่อนเขียนโค้ดที่พึ่งพา type
> อย่างเคร่งครัด (เช่น การ cast หรือ validate) เนื่องจากไฟล์นี้บันทึกจากคำอธิบายของผู้ใช้เท่านั้น

## การตั้งค่า Environment Variables

ไฟล์ `.env.local` (ไม่ commit ขึ้น git — ดู `.gitignore`) ต้องมี:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

ดูตัวอย่างได้ที่ `.env.local.example` และต้องตั้งค่าเดียวกันนี้ใน
**Vercel Project Settings → Environment Variables** ด้วยก่อน deploy

## สถานะปัจจุบันของโปรเจกต์

- [x] โครงโปรเจกต์ Next.js App Router (JavaScript)
- [x] เชื่อมต่อ Supabase client (`lib/supabaseClient.js`)
- [x] หน้าแรก `/` แสดงชื่อร้านและลิงก์ทดสอบ
- [x] หน้า placeholder `/generate-qr` และ `/kitchen` (กัน 404 ตอนทดสอบ deploy)
- [ ] หน้าสร้าง QR Code จริง (ขั้นตอนถัดไป)
- [ ] หน้าสั่งอาหารสำหรับลูกค้า (Dynamic Route ตามโต๊ะ — **ต้องใช้ `use()` unwrap params ตามหัวข้อด้านบน**)
- [ ] หน้าครัวสำหรับดูออเดอร์แบบ real-time (ขั้นตอนถัดไป)
