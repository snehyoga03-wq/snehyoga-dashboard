# Sneha Yoga Dashboard - Developer Guide & Project Structure

Welcome to the Sneha Yoga Dashboard project! This document provides a comprehensive overview of the code structure, the technology stack, and the database schema to help new developers quickly get up to speed.

## 🚀 Tech Stack

- **Frontend Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS + `shadcn-ui` (Radix UI primitives)
- **Backend & Database**: Supabase (PostgreSQL)
- **State Management**: React Query (`@tanstack/react-query`) + React Context/Local State
- **Routing**: React Router (`react-router-dom`)
- **Animations**: Framer Motion

---

## 📁 Repository Structure

The most important directory is `src/`, where all the frontend logic resides.

```
dashboard-sneha/
├── public/                 # Static assets (favicons, etc.)
├── src/
│   ├── assets/             # Images, icons, and other static files
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # Generic, reusable shadcn-ui components (Buttons, Inputs, etc.)
│   │   └── ...             # Feature-specific components (e.g., AttendanceTracker, PricingPlans)
│   ├── hooks/              # Custom React hooks (e.g., useMobile, useToast)
│   ├── integrations/       # External service integrations
│   │   └── supabase/       # Supabase client (`client.ts`) and typescript definitions (`types.ts`)
│   ├── lib/                # Utility functions (e.g., tailwind merge utility `utils.ts`)
│   ├── pages/              # Top-level route components (Pages)
│   │   ├── crm/            # Sub-components specific to the Admin CRM page
│   │   └── ...             # Individual page components (Dashboard, Login, Signup)
│   ├── App.tsx             # Main application component & Router definition
│   ├── index.css           # Global Tailwind CSS and general styling
│   └── main.tsx            # React application entry point
├── supabase/
│   ├── functions/          # Supabase Edge Functions
│   └── migrations/         # Database SQL migration files
├── package.json            # NPM dependencies and scripts
└── vite.config.ts          # Vite bundler configuration
```

---

## 🗺️ Application Routing (Pages)

The routing is defined in `src/App.tsx`. Most pages are wrapped in a `<MobileLayout>` component that enforces a maximum width to ensure a mobile-first appearance on desktop screens, mimicking a mobile app experience.

Key Pages include:
- **`/` (`Index.tsx`)**: The main landing page showcasing the product (features, pricing, testimonials).
- **`/login` & `/signup`**: User authentication flows.
- **`/dashboard`**: The user's personal space showing subscription details, attendance, and quick actions.
- **`/crm`**: The Administrator Dashboard. **Crucial for business operations.** Contains user management, attendance tracking, and content settings. It does NOT use `MobileLayout` to utilize full desktop width.
- **`/followup`**: Daily habit & health tracking for the users.
- **`/referral`**: The referral program dashboard where users can invite others to earn rewards.
- **`/live` (`SessionRedirect.tsx`)**: Redirects users to the live session link.

---

## 🗄️ Database Schema (Supabase)

The project leverages a PostgreSQL database hosted on Supabase. Below is an overview of the most critical tables (referenced from `src/integrations/supabase/types.ts`).

### Core Tables

#### `main_data_registration` (Users/Subscriptions)
The central table that holds user profiles and subscription status.
- `id` (UUID): Unique identifier.
- `mobile_number` (String): The primary key/identifier used for login and linking.
- `name` (String): User's full name.
- `subscription_plan`: e.g., "1 month plan", "Free plan".
- `days_left` (Integer): The amount of subscription days remaining for the user.
- `batch_timing`: User's preferred class time.
- `last_attendance_date`, `last_deduction_date`: Used to track when attendance/days were last deducted.

#### `attendance`
Tracks daily attendance logs.
- `id` (Integer): Primary key.
- `created_at` (Timestamp): When the attendance was logged.
- `mobile_number` (String): Links to the user.

#### `session_settings`
Used by admins to modify the daily/live session URLs without codebase changes.
- `id` (String).
- `session_link` (String): The base/free session link.
- `premium_session_link` (String): Link specifically for premium users.
- `pabbly_reminder_url` (String): Webhook URL for reminders.

### Secondary / Feature Tables

#### Follow-up System
Used for tracking the health metrics of the users over time.
- **`followup_reports`**: Initial health/weight report including admission date, starting weight, and goal.
- **`followup_daily_entries`**: Daily logs input by the user tracking meals, outside food usage, and weight changes. Contains a `report_id` linking back to `followup_reports`.

#### Gamification & Rewards
- **`gift_boxes`**: Tracks unlocked rewards/gamification elements for users based on streaks or actions.
- **`referrals`**: Records who referred who (`referrer_mobile`, `referred_mobile`) and how many `reward_days` were granted.

#### Communication
- **`chat_messages`**: Basic chat persistence for user-to-admin communication. Keeps messages, sender_type (user/admin), and read status.
- **`link_clicks`**: Analytics logging for tracking user engagement on specific links (like session links).

---

## ⚙️ Custom Database Functions (RPC)

Supabase employs Postgres functions that can be called directly via the `rpc` method in the client:
- **`add_subscription_days`**: Programmatically adds days to a user's subscription.
- **`decrement_subscription_days`**: A chron task / bulk operation that decrements days for active users.
- **`generate_referral_code`** & **`process_referral`**: Handlers for creating unique referral codes and securely processing the reward logic upon a fresh signup.

---

## 🏃‍♂️ Getting Started Locally

1. **Install dependencies:**
   ```bash
   npm i
   # or
   pnpm install
   ```
2. **Setup Environment Variables:**
   Make sure you have a `.env` file at the root containing your Supabase credentials.
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The app will start at `http://localhost:8080` (or another port output by Vite).

### Important Commands
- `npm run dev`: Starts the local dev server.
- `npm run build`: Bundles the app for production (into the `dist` folder).
- `npm run lint`: Runs ESLint to find code issues.

## 🎨 Best Practices to Follow

1. **Styling**: Always use tailwind classes. When needing custom UI, try to leverage or build upon the existing `shadcn-ui` components found in `src/components/ui`.
2. **Data Fetching**: Use `React Query` (`@tanstack/react-query`) rather than bare `useEffect` fetches for catching, caching, and loading state management.
3. **Icons**: Use `lucide-react` for all iconography to maintain consistency.
4. **Modifying Schema**: If you change the Supabase database schema, you must update the Typescript definitions inside `src/integrations/supabase/types.ts`.
