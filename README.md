# Seven Fincorp Loan Management Dashboard

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/fixr105/Seven-Render?utm_source=oss&utm_medium=github&utm_campaign=fixr105%2FSeven-Render&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

A comprehensive multi-role fintech dashboard for loan management, built with React, TypeScript, and Tailwind CSS following the Boltt design system specification.

## Overview

This application provides a sophisticated loan management system designed for multiple user roles:
- **DSA Clients (Partners)** - Submit and track loan applications
- **Key Account Managers (KAM)** - Review applications, manage clients, configure dashboards
- **Credit Team** - Review files, negotiate with NBFCs, approve payouts
- **NBFC Partners** - Review and approve/reject loan applications

## Design System

The application follows a comprehensive design system built on the Boltt framework:

### Color Palette
- **Brand Primary**: `#2A5DB0` (FinCorp Blue) - Used for primary actions and highlights
- **Brand Secondary**: `#20A070` (Accent Green) - Used for success states and positive indicators
- **Semantic Colors**:
  - Success: `#28A745`
  - Warning: `#FFC107`
  - Error: `#DC3545`
  - Info: `#17A2B8`

### Typography
- **Font Family**: Inter (sans-serif)
- **Font Sizes**: 0.75rem to 2rem (12px to 32px)
- **Font Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Spacing
- Based on 4px grid system
- Spacing scale: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px

### Components
All components are built with accessibility in mind, featuring:
- WCAG AA compliant color contrast
- Keyboard navigation support
- Screen reader friendly markup
- Focus indicators
- Responsive behavior across all breakpoints

## Features

### Core UI Components

#### Buttons
- **Variants**: Primary, Secondary, Tertiary, Danger
- **Sizes**: Small, Medium, Large
- **States**: Default, Hover, Active, Disabled, Loading
- **Icon Support**: Left or right icon positioning

#### Form Components
- **Input**: Text fields with label, error states, helper text, and icon support
- **Select**: Dropdown with custom styling
- **TextArea**: Multi-line text input
- **FileUpload**: Drag-and-drop file upload with validation and progress indicators

#### Data Display
- **DataTable**: Sortable, responsive table that converts to cards on mobile
- **Card**: Container for grouped content
- **Badge**: Status indicators with color variants
- **SearchBar**: Search input with clear functionality

#### Navigation
- **Sidebar**: Collapsible navigation with role-based menu items
- **TopBar**: Header with notifications and user profile
- **MainLayout**: Complete layout wrapper combining sidebar, topbar, and content area

#### Feedback
- **Modal**: Dialog system with header, body, and footer
- **Toast**: Temporary notifications (success, error, info, warning)

### Pages

#### Dashboard
- Key metrics cards (applications count, pending reviews, commission balance; commission is calculated as percentage from Client record, not ratio format)
- Quick actions panel
- Recent applications table
- Real-time statistics

#### Applications
- Comprehensive application list with search and filters
- Status-based filtering
- Sortable columns
- Quick action buttons (View, Query)
- Query modal for raising questions

#### Login
- Email/password authentication
- Password visibility toggle
- Remember me option
- Responsive layout
- **Password reset**: Admin-only. Users who forget their password must contact their administrator.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Airtable** - Database (via n8n webhooks)
- **n8n Webhooks** - Individual table webhooks for data synchronization
- **Express.js Backend** - TypeScript API server

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx    # Main application layout
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   └── TopBar.tsx         # Header with notifications
│   └── ui/
│       ├── Button.tsx         # Button component
│       ├── Input.tsx          # Text input
│       ├── Select.tsx         # Dropdown select
│       ├── TextArea.tsx       # Multi-line input
│       ├── Badge.tsx          # Status badges
│       ├── Card.tsx           # Content cards
│       ├── Modal.tsx          # Dialog modals
│       ├── DataTable.tsx      # Data table with sorting
│       ├── SearchBar.tsx      # Search input
│       ├── Toast.tsx          # Notifications
│       └── FileUpload.tsx     # File upload component
├── hooks/
│   ├── useApplications.ts     # Applications data hook
│   ├── useWebhookData.ts      # Webhook data fetching hooks
│   ├── useUnifiedApplications.ts # Unified webhook + DB data
│   ├── useAuthSafe.ts         # Safe authentication hook
│   ├── useLedger.ts           # Commission ledger hook
│   └── useNotifications.ts    # Notifications hook
├── lib/
│   ├── webhookConfig.ts       # Individual webhook URLs & field mappings
│   ├── webhookFetcher.ts      # Core webhook fetching logic
│   ├── webhookImporter.ts     # Webhook data importer
│   └── storage.ts             # Storage utilities
├── pages/
│   ├── Dashboard.tsx          # Main dashboard page
│   ├── Applications.tsx       # Applications list page
│   ├── Login.tsx             # Login page
│   └── dashboards/           # Role-specific dashboards
├── contexts/
│   ├── AuthContext.tsx        # Supabase auth context
│   └── ApiAuthContext.tsx    # API auth context
├── App.tsx                   # Root component
├── main.tsx                  # Application entry point
└── index.css                 # Global styles
```

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
npm run typecheck
```

## Responsive Design

The application is fully responsive with breakpoints:
- **xs**: 480px
- **sm**: 576px
- **md**: 768px (tablet)
- **lg**: 992px (desktop)
- **xl**: 1200px
- **2xl**: 1400px

### Mobile Optimizations
- Sidebar collapses to hamburger menu
- Tables convert to card layouts
- Touch-friendly button sizes (minimum 40px)
- Full-screen modals on small devices

## Accessibility Features

- Semantic HTML with proper heading hierarchy
- ARIA labels and roles throughout
- Keyboard navigation with visible focus states
- Screen reader friendly components
- Color contrast meeting WCAG AA standards
- No information conveyed by color alone

## Database Integration

The application works with Airtable via n8n webhooks:
- Data is fetched from Airtable through n8n webhook endpoints
- Backend API handles all data operations
- No direct database connection needed in frontend

### Environment Variables
```
VITE_API_BASE_URL=http://localhost:3001
```

## Webhook Integration

The application uses **individual table webhooks** from n8n for efficient data synchronization. Each table has its own dedicated GET webhook, reducing unnecessary data fetching.

### Webhook Architecture

- **Individual Table Webhooks**: Each of the 15 tables has its own webhook URL
- **Selective Fetching**: Functions only fetch the tables they need
- **Caching**: Per-table caching (5 minutes) prevents duplicate calls
- **No Auto-Execution**: Webhooks only execute on page reload or explicit refresh

### Available Tables

1. **Loan Application** - `/webhook/loanapplication`
2. **Clients** - `/webhook/client`
3. **Commission Ledger** - `/webhook/commisionledger`
4. **Loan Products** - `/webhook/loanproducts`
5. **User Accounts** - `/webhook/useraccount`
6. **Notifications** - `/webhook/notifications`
7. **KAM Users** - `/webhook/kamusers`
8. **Credit Team Users** - `/webhook/creditteamuser`
9. **NBFC Partners** - `/webhook/nbfcpartners`
10. **Form Categories** - `/webhook/formcategories`
11. **Form Fields** - `/webhook/formfields`
12. **Client Form Mapping** - `/webhook/clientformmapping`
13. **File Auditing Log** - `/webhook/fileauditinglog`
14. **Admin Activity Log** - `/webhook/Adminactivity`
15. **Daily Summary Report** - `/webhook/dailysummaryreport`

### Usage

```typescript
// Fetch specific tables
import { useWebhookTables } from '../hooks/useWebhookData';

const { data, loading, error, refetch } = useWebhookTables([
  'Loan Application',
  'Clients',
  'Loan Products'
]);

// Access data by table name
const applications = data['Loan Application'] || [];
const clients = data['Clients'] || [];
```

### Documentation

- `WEBHOOK_TABLE_MAPPING.md` - Function-to-table mapping
- `WEBHOOK_EXECUTION_GUIDE.md` - When and how webhooks execute
- `INDIVIDUAL_WEBHOOKS_IMPLEMENTATION.md` - Implementation details

## Next Steps

### Backend Integration
1. Create data fetching hooks (useApplications, useClients, etc.)
2. Implement authentication with Supabase Auth
3. Add real-time subscriptions for notifications
4. Connect forms to database APIs

### Additional Pages
1. Client management pages
2. Commission ledger page
3. Reports and analytics
4. User profile and settings
5. File detail view with document viewer
6. Form builder interface

### Features to Implement
1. Role-based routing and access control
2. Real-time notification system
3. Document upload to Supabase Storage
4. Audit log and conversation threads
5. Commission calculation and payout workflow
6. Master form builder for dynamic forms

## Design Principles

1. **Trust and Clarity** - Professional fintech aesthetic with clear information hierarchy
2. **Consistency** - Unified color palette and component patterns throughout
3. **Accessibility** - WCAG compliant with keyboard and screen reader support
4. **Responsiveness** - Seamless experience across all device sizes
5. **Feedback** - Clear user feedback for all actions (loading states, success/error messages)
6. **Security** - No sensitive data in frontend, prepared for row-level security

## Component Usage Examples

### Button
```tsx
<Button variant="primary" icon={Plus} loading={false}>
  New Application
</Button>
```

### Input
```tsx
<Input
  label="Email Address"
  type="email"
  icon={Mail}
  error="Invalid email"
  required
/>
```

### DataTable
```tsx
<DataTable
  columns={columns}
  data={data}
  keyExtractor={(row) => row.id}
  onRowClick={(row) => handleRowClick(row)}
  sortable
/>
```

### Modal
```tsx
<Modal isOpen={isOpen} onClose={handleClose} size="md">
  <ModalHeader onClose={handleClose}>Title</ModalHeader>
  <ModalBody>Content</ModalBody>
  <ModalFooter>
    <Button onClick={handleClose}>Cancel</Button>
    <Button variant="primary">Confirm</Button>
  </ModalFooter>
</Modal>
```

## License

Proprietary - Seven Fincorp

## Support

For questions or issues, contact the development team.
