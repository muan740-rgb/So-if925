# สุกี้ผีน้อย — ระบบสั่งอาหารร้านบุฟเฟต์

โปรเจกต์ Next.js (App Router, JavaScript) สำหรับระบบสั่งอาหารร้านบุฟเฟต์ "สุกี้ผีน้อย"
เชื่อมต่อกับ Supabase และ deploy บน Vercel

> 📌 ดูบันทึกทางเทคนิคเพิ่มเติม (โครงสร้างฐานข้อมูล และข้อควรระวังเรื่อง Next.js เวอร์ชันล่าสุด)
> ได้ที่ [`CLAUDE.md`](./CLAUDE.md)

## เริ่มต้นใช้งาน (Local Development)

1. ติดตั้ง dependencies:
   ```bash
   npm install
   ```

2. คัดลอกไฟล์ env ตัวอย่างแล้วใส่ค่าจริงจาก Supabase:
   ```bash
   cp .env.local.example .env.local
   ```
   แล้วแก้ไข `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (หาได้จาก Supabase Dashboard → Project Settings → API)

3. รันเซิร์ฟเวอร์สำหรับพัฒนา:
   ```bash
   npm run dev
   ```
   เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

## Deploy บน Vercel

1. Push โค้ดขึ้น Git repository (GitHub/GitLab/Bitbucket)
2. Import repository เข้า Vercel
3. ตั้งค่า Environment Variables ใน Vercel Project Settings ให้ตรงกับ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel จะรัน `npm run build` และ `npm run start` ให้อัตโนมัติ

## โครงสร้างโปรเจกต์

```
sukee-phi-noi/
├── app/
│   ├── layout.js          # Root layout
│   ├── page.js            # หน้าแรก — แสดงชื่อร้าน + ลิงก์ทดสอบ
│   ├── generate-qr/
│   │   └── page.js        # placeholder หน้าสร้าง QR Code
│   └── kitchen/
│       └── page.js        # placeholder หน้าครัว
├── lib/
│   └── supabaseClient.js  # สร้าง Supabase client จาก env variables
├── .env.local.example     # ตัวอย่างค่า env (คัดลอกเป็น .env.local)
├── .gitignore
├── next.config.js
├── package.json
├── CLAUDE.md              # บันทึกอ้างอิง: schema ฐานข้อมูล + ข้อควรระวัง Next.js
└── README.md
```

## ฐานข้อมูล Supabase

โปรเจกต์นี้ใช้ตารางที่มีอยู่แล้วในฐานข้อมูล (ไม่ต้องสร้างใหม่): `sessions`, `menu_categories`,
`menu_items`, `orders` — รายละเอียดคอลัมน์แต่ละตารางดูได้ใน [`CLAUDE.md`](./CLAUDE.md)
