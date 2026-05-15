# 🏆 AtomQuest Hackathon 1.0 Submission: Enterprise Goal Tracker

## 1. Working Portal Link
👉 **[https://atomquest-portal.web.app](https://atomquest-portal.web.app)**

## 2. Source Code Repository
👉 **[https://github.com/deveshreddyp/atomquest-portal](https://github.com/deveshreddyp/atomquest-portal)**

---

## 3. Architecture Flow Diagram
```mermaid
graph TD
    A[Employee / Manager] -->|Auth via Firebase| B(React Frontend)
    B -->|State Mgmt| C{Zustand Store}
    C -->|Goal Submission & Validation| D[(Firestore NoSQL DB)]
    B -->|Click 'Generate AI'| E[OpenRouter API]
    E -->|Anthropic Claude-3| B
    D -->|Real-time sync| F[Admin Dashboard Analytics]
    F -->|Export Data| G[SheetJS .xlsx]
```

---

## 🏗️ Technology Stack & Backend Approach
- **Frontend Layer:** React 18 with Vite for blazing-fast local development and HMR. We utilized **Tailwind CSS V4** and **Lucide React** to build a strict, monochromatic, "Enterprise-Grade" minimalist user interface that remains highly legible and performant. State is managed globally via **Zustand**, allowing seamless role-based routing (`/employee`, `/manager`, `/admin`).
- **Backend Infrastructure (BaaS):** We adopted a fully serverless approach using **Firebase**.
  - **Firebase Auth:** Handles secure session creation.
  - **Firestore Database (NoSQL):** Powers the core logic. We utilized *Firestore Batch Writes* (`writeBatch`) to ensure atomicity when submitting up to 8 goals at once. Global system states (e.g., active Quarterly Check-In phases) are handled via centralized Firestore documents to lock/unlock UI interactions in real-time.
  - **Firebase Hosting:** Provides a global CDN ensuring lightning-fast load times for the portal, with an automated CI/CD-style build script for updates.
- **Progressive Web App (PWA) Support:** Configured with a complete `manifest.json` and Apple web-app meta tags. The portal is fully installable as a standalone native app on mobile devices (iOS/Android), bypassing the browser URL bar for a truly immersive enterprise experience.
- **Enterprise Governance & Computation:** Strict adherence to BRD requirements. The system automatically computes mathematical progress scores based on UoM (Max vs Min targets). Furthermore, the Admin can toggle "Quarterly Windows" (e.g., Q1, Q2) to physically lock or unlock employee progress updates, preventing out-of-cycle tampering.
- **AI Integration:** Instead of standard hardcoded placeholders, we integrated **OpenRouter** securely into the frontend. By passing the Thrust Area and Goal Title to the `anthropic/claude-3-haiku` model with a strict system prompt, the AI acts as a digital HR coach, instantly generating concise SMART goals for the employee.
- **Premium Polish:** Replaced all native browser alerts with custom, animated `SweetAlert2` modals. Added an interactive Architecture & User Flow Guide directly to the landing page for judges.

---

## 🔑 Test Credentials & Testing Flow
Please use the following credentials to evaluate the role-based dashboards:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@test.com` | `AtomQuest2026!` |
| **Manager** | `manager@test.com` | `AtomQuest2026!` |
| **Employee** | `employee@test.com` | `AtomQuest2026!` |

*(Note: Ensure you test the dynamic "Roster Allocation" feature by creating a link between an employee and manager using the Admin Dashboard first!)*
