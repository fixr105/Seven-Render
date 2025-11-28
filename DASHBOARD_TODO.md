# Dashboard Features TODO - Based on PRD

## Priority 1: Role-Specific Dashboards (Current Task)

### ✅ Client (DSA Partner) Dashboard
- [x] New Application button (prominent)
- [ ] Draft files list/count
- [ ] File status overview (cards showing counts per status)
- [ ] Commission Balance card with "Request Payout" button
- [ ] Pending queries alert/notification
- [ ] Recent applications table (own files only)
- [ ] Quick actions panel (Action Center M5)
- [ ] File status tracking visualization

### ✅ KAM Dashboard  
- [ ] Client management overview (how many clients, stats)
- [ ] Files pending review count
- [ ] Files awaiting client response
- [ ] Client onboarding action button
- [ ] Quick stats per managed client
- [ ] Activity summary (files reviewed today, forwarded, etc.)
- [ ] New files from clients highlight

### ✅ Credit Team Dashboard
- [ ] Global file view with filters
- [ ] Files pending review count
- [ ] Payout requests pending count
- [ ] Files in negotiation count
- [ ] SLA monitoring (files stuck too long)
- [ ] Overall pipeline metrics
- [ ] Daily activity summary
- [ ] NBFC response tracking

### ✅ NBFC Dashboard
- [ ] Assigned applications list
- [ ] Applications pending decision count
- [ ] Quick decision actions (Approve/Reject)
- [ ] Download documents interface
- [ ] Status update interface

## Priority 2: Action Center (Module M5)

### Client Actions
- [ ] "New Loan Application" button
- [ ] "View Drafts" link
- [ ] "Request Payout" (if balance > 0)
- [ ] "Respond to Queries" (if pending queries)

### KAM Actions
- [ ] "Onboard New Client" button
- [ ] "Configure Dashboard/Forms" link
- [ ] "Review New Files" link
- [ ] "Files Awaiting Client Response" link

### Credit Team Actions
- [ ] "Files to Review" link
- [ ] "Payout Requests Pending" link
- [ ] "Follow Up with NBFC" (for stuck files)
- [ ] "Record Outcome" button

### NBFC Actions
- [ ] "Review Application" button
- [ ] "Approve/Reject" buttons per file

## Priority 3: Dynamic Sidebar Menu

- [ ] Role-based menu items:
  - Client: Dashboard, Applications, Ledger
  - KAM: Dashboard, Applications, Clients, Reports
  - Credit: Dashboard, Applications, Clients, Ledger, Reports
  - NBFC: Dashboard, Applications

## Priority 4: Dashboard Data Hooks

- [ ] `useDashboardStats()` hook
  - Role-aware statistics fetching
  - Real-time updates
  - Caching for performance

- [ ] `useClientStats()` - Client-specific stats
- [ ] `useKAMStats()` - KAM-specific stats  
- [ ] `useCreditStats()` - Credit team stats
- [ ] `useNBFCStats()` - NBFC stats

## Priority 5: Modules Implementation

### M1: Pay In/Out Ledger
- [x] Basic ledger structure exists
- [ ] Query on ledger entries
- [ ] Payout request workflow
- [ ] Running balance calculation
- [ ] Commission rate display

### M2: Master Form Builder
- [ ] Form template management
- [ ] Field selection UI
- [ ] Per-client form configuration
- [ ] Dynamic form rendering
- [ ] Draft save functionality

### M3: File Status Tracking
- [x] Status field exists
- [ ] Status transition rules
- [ ] Status history timeline
- [ ] Visual status indicators

### M4: Audit Log & Query Dialog
- [x] Basic query system exists
- [ ] Threaded conversations
- [ ] Event logging
- [ ] Role-based visibility
- [ ] Query resolution workflow

### M6: Daily Summary Reports
- [ ] Report generation
- [ ] Email delivery
- [ ] KAM activity summary
- [ ] Credit team summary
- [ ] AI-enhanced insights

### M7: File Summary Insights
- [ ] AI-generated summaries
- [ ] Applicant profile extraction
- [ ] Loan details summary
- [ ] Strengths/risks identification
- [ ] Display in file detail view

## Priority 6: Additional Features

### Notifications System
- [ ] In-app notifications
- [ ] Email notifications
- [ ] Query alerts
- [ ] Status change alerts
- [ ] Payout notifications

### Search & Filters
- [ ] Global search
- [ ] Advanced filters
- [ ] Date range filters
- [ ] Status filters
- [ ] Client filters

### File Detail Enhancements
- [ ] Document viewer
- [ ] Status timeline
- [ ] Query thread
- [ ] Edit permissions
- [ ] AI summary display

## Priority 7: UI/UX Improvements

- [ ] Loading states for all data
- [ ] Empty states for each dashboard
- [ ] Error handling and messages
- [ ] Responsive design improvements
- [ ] Accessibility enhancements
- [ ] Keyboard shortcuts
- [ ] Tooltips and help text

## Priority 8: Performance & Optimization

- [ ] Data pagination
- [ ] Infinite scroll
- [ ] Real-time subscriptions optimization
- [ ] Caching strategy
- [ ] Bundle size optimization

---

**Current Focus:** Build role-specific dashboards (Priority 1)

