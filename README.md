# Tangible Nails & Art Studio — Booking System

Full-stack booking and studio management web application built for Tangible Nails & Art Studio, a nail salon based in Chihuahua, Mexico.

## Overview
Tangible is a mobile-first SaaS-style booking platform that allows clients to browse services, select appointment times based on real availability, and confirm bookings via WhatsApp. The studio owner manages appointments, schedules, blocked dates, and reminders through a secure admin dashboard.

## Features
- Service catalog with category accordion (nails, manicure, makeup, eyebrows).
- Real-time availability algorithm based on configurable weekly schedule and blocked dates.
- Client-side localStorage with 90-day expiry and input sanitization.
- WhatsApp-based booking confirmation flow.
- Secure admin dashboard with JWT authentication and bcrypt password hashing.
- Appointment management with cancellation modal and status tracking.
- One-tap WhatsApp confirmation on admin-created appointments, plus a next-day reminder panel (single or send-all), all timezone-correct for Chihuahua (UTC-6). Message templates are centralized in `src/lib/whatsapp.ts`.
- Admin-only registration of past appointments (for accurate history/revenue); past days render faded in the calendar while the public flow still blocks past dates.
- Revenue metrics dashboard with week/month selector.
- QR code generator for in-studio display.
- Anti-bot honeypot field on booking form.
- Security headers including CSP, HSTS, and X-Frame-Options.

## Tech Stack
- Framework: Next.js 16 (App Router)
- Language: TypeScript
- Database: MongoDB Atlas via Prisma ORM
- Auth: NextAuth.js with JWT sessions and bcrypt
- Styling: Tailwind CSS
- Validation: Zod
- Deployment: Vercel

## Project Structure

```text
.
├── prisma/
│   ├── schema.prisma           # MongoDB schema (Prisma)
│   └── seed.ts                 # Service catalog seed
├── src/
│   ├── app/
│   │   ├── admin/              # Dashboard, calendar, schedule, QR, revenue
│   │   ├── api/                # REST API routes (bookings, availability, admin)
│   │   ├── login/             # Admin login page
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Client-facing booking page
│   ├── components/
│   │   ├── admin/             # Calendar agenda, appointment modals, payments, metrics
│   │   ├── bookings/          # ServiceCard, BookingCalendar, ClientForm
│   │   ├── icons/             # WhatsAppIcon
│   │   └── layout/            # MuralDecorations background
│   ├── lib/
│   │   ├── config/            # business.ts — centralized business config
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── availability.ts    # Server-side slot availability rules
│   │   ├── timezone.ts        # Chihuahua (UTC-6) date/time helpers
│   │   └── whatsapp.ts        # Centralized WhatsApp message templates
│   └── types/                 # Shared TypeScript types
├── next.config.ts              # Security headers (CSP, HSTS, ...)
├── vercel.json                 # Vercel deployment config
└── tailwind.config.js          # Tailwind theme
```

## Local Development

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/iancorral/Nails_App
   cd Nails_App
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in the values (each variable is documented there):

   ```bash
   cp .env.example .env
   ```

3. Generate the Prisma client and seed the service catalog:

   ```bash
   npx prisma generate
   npx ts-node --project tsconfig.scripts.json prisma/seed.ts
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

## Security
- NextAuth JWT sessions with 8-hour expiry.
- bcrypt password hashing.
- Double-layer admin protection via middleware and layout.
- Zod validation with ObjectId format checks on all API routes.
- Honeypot anti-bot field on public booking form.
- Content Security Policy and additional security headers.
- Environment variables for all sensitive data.

## License
Copyright (c) 2026 Ian Corral. All rights reserved.
