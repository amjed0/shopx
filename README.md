
# ShopX Elite - Intelligent Shop Management

This is a modern, high-performance shop management application built with Next.js 15, Tailwind CSS, and Firebase.

## Features
- **Real-time Inventory**: Track stock levels with automatic low-stock alerts.
- **Billing Terminal**: Generate invoices instantly with UPI, Cash, Card, or Credit support.
- **Customer Directory**: Manage customer relationships and track outstanding balances.
- **Sales History**: Complete registry of all historical transactions.
- **Secure Access**: Profile-based management with hardware-grade security aesthetics.

## Local Setup

1. **Clone the project** (or extract the downloaded zip).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Setup Environment Variables**:
   Create a `.env.local` file with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure
- `src/app`: Next.js App Router pages and layouts.
- `src/components`: Reusable UI components (Shadcn UI).
- `src/firebase`: Firebase configuration and custom hooks for Firestore.
- `src/lib`: Utility functions and mock data for initial setup.
