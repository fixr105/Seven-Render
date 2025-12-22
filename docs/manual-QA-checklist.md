# Manual QA Checklist - P0 Critical Features

**Version:** 1.0.0  
**Last Updated:** 2025-01-27  
**Purpose:** Step-by-step manual testing checklist for non-technical users to verify P0 critical features work correctly

---

## How to Use This Checklist

1. **Login as the specified role** using test credentials (see TEST_USERS.md)
2. **Follow each step** in order, clicking through the UI
3. **Check the expected result** for each step
4. **Mark as ✅ Pass** or ❌ **Fail** with notes if something doesn't work

---

## Test User Credentials

- **Client**: `client@test.com` / `Test@123456`
- **KAM**: `kam@test.com` / `Test@123456`
- **Credit Team**: `credit@test.com` / `Test@123456`
- **NBFC**: `nbfc@test.com` / `Test@123456`

---

## M1: Pay In/Out Ledger

### M1.1: CLIENT - View Commission Ledger

**Role:** CLIENT  
**Requirement:** P0.1

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Ledger"** (icon: Dollar Sign)
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of ledger entries with columns:
   - Date
   - Description (e.g., "Commission from Application SF001")
   - Payout Amount (e.g., "₹10,000")
   - Running Balance
5. ✅ Verify entries are sorted by date (newest first)
6. ✅ Verify a **"Current Balance"** or **"Total Balance"** is displayed at the top or bottom of the page
7. ✅ Verify the balance matches the sum of all Payout Amount values

#### Expected Result:
- ✅ Ledger page displays all commission entries
- ✅ Balance is calculated correctly (sum of all Payout Amounts)
- ✅ Entries are sorted by date (newest first)

---

### M1.2: CREDIT - View Commission Ledger with Filters

**Role:** CREDIT TEAM  
**Requirement:** P0.1

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Ledger"** (icon: Dollar Sign)
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of ledger entries from ALL clients
5. ✅ Look for filter options (dropdowns or input fields):
   - Client filter (if available)
   - Date From / Date To filters (if available)
6. ✅ If filters exist:
   - Select a specific client from the Client dropdown
   - Verify the table shows only entries for that client
   - Clear the filter or select "All Clients"
   - Verify all entries appear again
   - Enter a date range in Date From/To fields
   - Verify the table shows only entries within that date range

#### Expected Result:
- ✅ CREDIT can see ledger entries from all clients
- ✅ Filters work correctly (if implemented)
- ✅ Table updates when filters are applied

---

### M1.3: CLIENT - Request Payout

**Role:** CLIENT  
**Requirement:** P0.3

#### Prerequisites:
- CLIENT must have a positive balance in the ledger

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Ledger"**
3. ✅ Verify your balance is greater than ₹0
4. ✅ Look for a **"Request Payout"** button (usually at the top of the page or near the balance)
5. ✅ Click **"Request Payout"**
6. ✅ A modal or form should appear
7. ✅ If there's an amount input field:
   - Enter an amount less than your balance (e.g., ₹5,000)
   - Click **"Submit"** or **"Request"**
8. ✅ If there's a "Full Balance" checkbox:
   - Check the box
   - Click **"Submit"** or **"Request"**
9. ✅ Verify a success message appears (e.g., "Payout request created successfully")
10. ✅ Verify the modal/form closes
11. ✅ Refresh the ledger page
12. ✅ Verify a new entry appears with:
    - Description mentioning "Payout Request"
    - Status showing "Requested" or "Pending"
    - Amount matching your request

#### Expected Result:
- ✅ Payout request button is visible when balance > 0
- ✅ Modal/form opens when clicked
- ✅ Request can be submitted successfully
- ✅ New ledger entry created with "Requested" status

---

### M1.4: CREDIT - Approve Payout Request

**Role:** CREDIT TEAM  
**Requirement:** P0.3

#### Prerequisites:
- A CLIENT must have submitted a payout request (complete M1.3 first)

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Ledger"**
3. ✅ Look for a **"Payout Requests"** section or tab
4. ✅ If there's a tab, click **"Payout Requests"**
5. ✅ Verify you see a list of pending payout requests
6. ✅ Find the request from the CLIENT (from step M1.3)
7. ✅ Look for an **"Approve"** button next to the request
8. ✅ Click **"Approve"**
9. ✅ If a modal appears:
   - Verify the amount is displayed
   - Add optional notes if there's a notes field
   - Click **"Confirm"** or **"Approve"**
10. ✅ Verify a success message appears
11. ✅ Verify the request status changes to **"Approved"** or **"Paid"**
12. ✅ Go back to the main ledger view
13. ✅ Verify a new negative entry appears (deducting the payout amount)
14. ✅ Verify the CLIENT's balance decreased by the payout amount

#### Expected Result:
- ✅ CREDIT can see pending payout requests
- ✅ Approve button works
- ✅ Negative ledger entry created on approval
- ✅ Original request entry updated to "Paid" status

---

### M1.5: Automatic Commission Entry on Disbursement

**Role:** CREDIT TEAM  
**Requirement:** P0.2

#### Prerequisites:
- An application must be in "Approved" or "NBFC Approved" status

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Find an application with status **"Approved"** or **"NBFC Approved"**
4. ✅ Click on the application to open the detail page
5. ✅ Look for a **"Mark Disbursed"** or **"Disburse"** button
6. ✅ Click the button
7. ✅ If a modal/form appears:
   - Enter the disbursed amount (e.g., ₹5,00,000)
   - Enter disbursement date (if required)
   - Click **"Submit"** or **"Mark Disbursed"**
8. ✅ Verify the application status changes to **"Disbursed"**
9. ✅ In the left sidebar, click **"Ledger"**
10. ✅ Verify a new commission entry appears with:
    - Description mentioning the application file number
    - Positive Payout Amount (calculated as: disbursed amount × commission rate)
    - Date matching today's date
    - Link to the correct loan file

#### Expected Result:
- ✅ Commission entry automatically created when loan is disbursed
- ✅ Payout Amount = (Disbursed Amount × Commission Rate) / 100
- ✅ Entry links to the correct application

---

## M2: Master Form Builder + New Application

### M2.1: KAM - Configure Form Templates

**Role:** KAM  
**Requirement:** P0.4

#### Steps:
1. ✅ Login as KAM (`kam@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Clients"** (icon: Users)
3. ✅ Find a client in the list (e.g., "Test Corporation")
4. ✅ Click on the client to open their detail page
5. ✅ Look for a **"Form Configuration"** tab or button
6. ✅ If not on client detail page, look for a **"Form Builder"** or **"Form Configuration"** option in the sidebar or Settings
7. ✅ If a form configuration page exists:
   - Select the client from a dropdown (if applicable)
   - You should see a list of form modules/categories (e.g., "Personal Information", "Company KYC", "Loan Details")
   - Check the boxes for modules you want to enable for this client
   - Click **"Save Form Configuration"** or **"Save"**
8. ✅ Verify a success message appears (e.g., "Form configuration saved successfully")

#### Expected Result:
- ✅ KAM can access form configuration interface
- ✅ Can select modules/categories for a client
- ✅ Configuration saves successfully

**Note:** If form configuration UI is not available, this feature may be configured via backend API only.

---

### M2.2: CLIENT - View Dynamic Form

**Role:** CLIENT  
**Requirement:** P0.5

#### Prerequisites:
- KAM should have configured form mappings for this client (M2.1)

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Click the **"New Application"** or **"+"** button (usually at the top right)
4. ✅ Wait for the form to load
5. ✅ Verify you see form fields organized by categories/sections (e.g., "Personal Information", "Loan Details")
6. ✅ Verify fields are in a logical order (not random)
7. ✅ Verify some fields are marked as required (with asterisk * or "Required" label)
8. ✅ Verify the form matches the configuration set by KAM (if M2.1 was completed)

#### Expected Result:
- ✅ Form loads with dynamic fields based on client configuration
- ✅ Fields are organized by categories
- ✅ Required fields are clearly marked
- ✅ Form structure matches KAM's configuration

---

### M2.3: CLIENT - Create Application with Mandatory Validation

**Role:** CLIENT  
**Requirement:** P0.6

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Click **"New Application"** or **"+"** button
4. ✅ Fill in the form:
   - **Applicant Name**: Enter a name (e.g., "John Doe")
   - **Loan Product**: Select a product from the dropdown
   - **Requested Loan Amount**: Enter an amount (e.g., "500000")
5. ✅ **DO NOT** fill in a mandatory field (one marked with * or "Required")
6. ✅ Scroll to the bottom of the form
7. ✅ Click **"Submit"** or **"Create Application"** button
8. ✅ Verify an error message appears:
   - Either inline error next to the empty mandatory field
   - Or an alert/notification listing missing required fields
9. ✅ Verify the form does NOT submit (you stay on the same page)
10. ✅ Now fill in ALL mandatory fields
11. ✅ Click **"Submit"** again
12. ✅ Verify a success message appears (e.g., "Application created successfully")
13. ✅ Verify you are redirected to:
    - The application detail page, OR
    - The applications list page
14. ✅ If redirected to list, verify your new application appears in the list

#### Expected Result:
- ✅ Form prevents submission when mandatory fields are empty
- ✅ Error messages clearly indicate which fields are missing
- ✅ Form submits successfully when all mandatory fields are filled
- ✅ Application is created and visible in the list

---

### M2.4: CLIENT - Document Upload

**Role:** CLIENT  
**Requirement:** P0.7

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Click **"New Application"** or **"+"** button
4. ✅ Fill in required fields (Applicant Name, Loan Product, Amount)
5. ✅ Find a document upload field (usually labeled "PAN Card", "Aadhar Card", "Bank Statement", etc.)
6. ✅ Click the upload area or **"Choose File"** button
7. ✅ Select a file from your computer (PDF, image, etc.)
8. ✅ Verify the file name appears in the upload area
9. ✅ Wait for upload to complete (you may see a progress indicator)
10. ✅ Verify the file is listed in a document list or shown as uploaded
11. ✅ Complete filling the form
12. ✅ Click **"Submit"**
13. ✅ After submission, navigate to the application detail page
14. ✅ Look for a **"Documents"** section
15. ✅ Verify the uploaded document appears in the documents list
16. ✅ Click on the document link (if available)
17. ✅ Verify the document opens or downloads correctly

#### Expected Result:
- ✅ File upload field accepts files
- ✅ Upload progress is shown (if implemented)
- ✅ Document appears in the application after submission
- ✅ Document link is accessible

---

## M3: Status Tracking + Listings

### M3.1: CLIENT - View Own Applications

**Role:** CLIENT  
**Requirement:** P0.9

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"** (icon: File Text)
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of applications
5. ✅ Verify the table shows only YOUR applications (not other clients' applications)
6. ✅ Verify each application shows:
   - File Number (e.g., "SF001")
   - Applicant Name
   - Loan Product
   - Requested Amount
   - Status (e.g., "Draft", "Pending KAM Review")
   - Created Date
7. ✅ Verify you can click on an application to view details

#### Expected Result:
- ✅ Applications page displays only CLIENT's own applications
- ✅ Table shows all relevant application information
- ✅ Applications are clickable to view details

---

### M3.2: KAM - View Managed Clients' Applications

**Role:** KAM  
**Requirement:** P0.9

#### Steps:
1. ✅ Login as KAM (`kam@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of applications
5. ✅ Verify the table shows only applications from clients you manage
6. ✅ Verify you do NOT see applications from clients not assigned to you
7. ✅ Verify each application shows:
   - File Number
   - Client Name
   - Applicant Name
   - Status
   - Other relevant details

#### Expected Result:
- ✅ KAM sees only applications from managed clients
- ✅ Applications from other clients are not visible

---

### M3.3: CREDIT - View All Applications

**Role:** CREDIT TEAM  
**Requirement:** P0.9

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of applications
5. ✅ Verify the table shows applications from ALL clients (not filtered)
6. ✅ Verify you can see applications from different clients
7. ✅ If there are filters available:
   - Test filtering by client
   - Test filtering by status
   - Verify filters work correctly

#### Expected Result:
- ✅ CREDIT sees all applications regardless of client
- ✅ Filters work if implemented

---

### M3.4: NBFC - View Assigned Applications

**Role:** NBFC  
**Requirement:** P0.9

#### Steps:
1. ✅ Login as NBFC (`nbfc@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Wait for the page to load
4. ✅ Verify you see a table/list of applications
5. ✅ Verify the table shows only applications assigned to your NBFC
6. ✅ Verify you do NOT see applications assigned to other NBFCs
7. ✅ Verify each application shows:
   - File Number
   - Client Name
   - Status (should be "Sent to NBFC" or similar)
   - Other relevant details

#### Expected Result:
- ✅ NBFC sees only applications assigned to them
- ✅ Applications assigned to other NBFCs are not visible

---

### M3.5: Status State Machine - Valid Transitions

**Role:** CLIENT, KAM, CREDIT  
**Requirement:** P0.8

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Find an application with status **"Draft"**
4. ✅ Click on the application to open detail page
5. ✅ Look for a **"Submit"** button
6. ✅ Click **"Submit"**
7. ✅ Verify the status changes to **"Pending KAM Review"** or **"Under KAM Review"**
8. ✅ Logout and login as KAM (`kam@test.com` / `Test@123456`)
9. ✅ Navigate to the same application
10. ✅ Look for **"Forward to Credit"** or **"Approve"** button
11. ✅ Click the button
12. ✅ Verify the status changes to **"Forwarded to Credit"** or **"Pending Credit Review"**
13. ✅ Logout and login as CREDIT (`credit@test.com` / `Test@123456`)
14. ✅ Navigate to the same application
15. ✅ Look for **"Send to NBFC"** or **"Assign NBFC"** button
16. ✅ Click the button and assign an NBFC
17. ✅ Verify the status changes to **"Sent to NBFC"**

#### Expected Result:
- ✅ Status transitions follow the correct flow: Draft → Pending KAM Review → Forwarded to Credit → Sent to NBFC
- ✅ Only valid status transitions are allowed
- ✅ Invalid transitions are prevented

---

### M3.6: Status History Timeline

**Role:** All  
**Requirement:** P0.10

#### Steps:
1. ✅ Login as any role (e.g., CLIENT)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Click on any application to open detail page
4. ✅ Scroll down to find a **"Status History"** or **"Timeline"** section (usually in the sidebar or below the main content)
5. ✅ Verify you see a timeline/list of status changes showing:
   - Previous status → New status
   - Date and time of change
   - User who made the change (if available)
   - Notes (if any)
6. ✅ Verify status changes are in chronological order (oldest to newest or newest to oldest)
7. ✅ Verify the timeline shows all status transitions the application has gone through

#### Expected Result:
- ✅ Status history is displayed for each application
- ✅ Timeline shows all status changes with dates and actors
- ✅ Changes are in chronological order

---

## M4: Audit Log/Queries

### M4.1: KAM - Raise Query to Client

**Role:** KAM  
**Requirement:** P0.11

#### Prerequisites:
- An application in "Pending KAM Review" or "Under KAM Review" status

#### Steps:
1. ✅ Login as KAM (`kam@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Find an application with status **"Pending KAM Review"** or **"Under KAM Review"**
4. ✅ Click on the application to open detail page
5. ✅ Look for a **"Raise Query"** button (usually near the top with other action buttons)
6. ✅ Click **"Raise Query"**
7. ✅ A modal or form should appear
8. ✅ Enter a query message (e.g., "Please provide more details for field X")
9. ✅ If there's a field selection, select which fields need clarification
10. ✅ Click **"Submit"** or **"Raise Query"**
11. ✅ Verify a success message appears
12. ✅ Verify the application status changes to **"Query with Client"** or **"KAM Query Raised"**
13. ✅ Scroll down to the **"Queries"** or **"Communication"** section
14. ✅ Verify your query appears in the queries list with:
    - Your name/email as the sender
    - The query message
    - Timestamp
    - Status showing "Open" or "Unresolved"

#### Expected Result:
- ✅ Query can be raised successfully
- ✅ Application status changes to indicate query is pending
- ✅ Query appears in the queries section

---

### M4.2: CLIENT - Respond to Query

**Role:** CLIENT  
**Requirement:** P0.11

#### Prerequisites:
- KAM must have raised a query (complete M4.1 first)

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Find the application with the query (status should be "Query with Client")
4. ✅ Click on the application to open detail page
5. ✅ Scroll down to the **"Queries"** or **"Communication"** section
6. ✅ Verify you see the query raised by KAM
7. ✅ Look for a **"Reply"** button next to the query
8. ✅ Click **"Reply"**
9. ✅ A text area or form should appear
10. ✅ Enter your response (e.g., "Here are the additional details you requested...")
11. ✅ Click **"Submit"** or **"Send Reply"**
12. ✅ Verify a success message appears
13. ✅ Verify your reply appears below the original query in the queries section
14. ✅ Verify the query status may change to "Resolved" or remain "Open" (depending on implementation)

#### Expected Result:
- ✅ CLIENT can see queries raised by KAM
- ✅ Reply functionality works
- ✅ Response appears in the queries thread

---

### M4.3: Notifications Display

**Role:** All  
**Requirement:** P0.13

#### Prerequisites:
- A query should be raised or status changed (complete M4.1 or M3.5)

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ Look at the top right of the page for a **notification bell icon** 🔔
3. ✅ Verify the bell shows a number badge (e.g., "3") indicating unread notifications
4. ✅ Click on the notification bell
5. ✅ A dropdown or panel should open showing notifications
6. ✅ Verify you see notifications for:
   - Queries raised
   - Status changes
   - Other relevant actions
7. ✅ Click on a notification
8. ✅ Verify you are navigated to the relevant page (e.g., application detail)
9. ✅ Go back and check the notification bell again
10. ✅ Verify the unread count decreased
11. ✅ Verify the clicked notification is marked as read (different styling or moved to "Read" section)

#### Expected Result:
- ✅ Notification bell shows unread count
- ✅ Clicking bell opens notification list
- ✅ Notifications are clickable and navigate to relevant pages
- ✅ Unread count updates when notifications are read

---

## M5: Action Center (Dashboard)

### M5.1: CLIENT - Dashboard

**Role:** CLIENT  
**Requirement:** P0.14

#### Steps:
1. ✅ Login as CLIENT (`client@test.com` / `Test@123456`)
2. ✅ After login, you should land on the **Dashboard** page
3. ✅ If not, click **"Dashboard"** in the left sidebar (icon: Home)
4. ✅ Verify you see dashboard cards/sections showing:
   - **Active Applications** count or list
   - **Commission Ledger Summary** with:
     - Total Earned
     - Pending Amount
     - Paid Amount
     - Current Balance
5. ✅ Verify the numbers match what you see in:
   - Applications page (for application count)
   - Ledger page (for balance)
6. ✅ Look for a **"New Application"** button (quick action)
7. ✅ Click the button
8. ✅ Verify you are taken to the New Application page

#### Expected Result:
- ✅ Dashboard displays CLIENT-specific metrics
- ✅ Numbers are accurate
- ✅ Quick action buttons work

---

### M5.2: KAM - Dashboard

**Role:** KAM  
**Requirement:** P0.14

#### Steps:
1. ✅ Login as KAM (`kam@test.com` / `Test@123456`)
2. ✅ Click **"Dashboard"** in the left sidebar
3. ✅ Verify you see dashboard cards/sections showing:
   - **Managed Clients** count
   - **Pending Reviews** count (applications awaiting KAM review)
   - **Active Applications** from managed clients
4. ✅ Verify the numbers are accurate
5. ✅ Look for quick action buttons (if any)

#### Expected Result:
- ✅ Dashboard displays KAM-specific metrics
- ✅ Shows data for managed clients only

---

### M5.3: CREDIT - Dashboard

**Role:** CREDIT TEAM  
**Requirement:** P0.14

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ Click **"Dashboard"** in the left sidebar
3. ✅ Verify you see dashboard cards/sections showing:
   - **Pending Reviews** count
   - **Payout Requests** count (pending approval)
   - **All Applications** overview
4. ✅ Verify the numbers are accurate
5. ✅ Look for quick action buttons (if any)

#### Expected Result:
- ✅ Dashboard displays CREDIT-specific metrics
- ✅ Shows global data (all clients)

---

### M5.4: Quick Action Buttons

**Role:** CLIENT, KAM, CREDIT, NBFC  
**Requirement:** P0.15

#### Steps for CLIENT:
1. ✅ Login as CLIENT
2. ✅ Navigate to an application with status **"Draft"**
3. ✅ Verify you see **"Submit"** and **"Withdraw"** buttons (if applicable)
4. ✅ Navigate to an application with status **"Query with Client"**
5. ✅ Verify you see **"Reply to Query"** button

#### Steps for KAM:
1. ✅ Login as KAM
2. ✅ Navigate to an application with status **"Pending KAM Review"**
3. ✅ Verify you see:
   - **"Forward to Credit"** button
   - **"Raise Query"** button
4. ✅ Verify you do NOT see buttons for actions you cannot perform

#### Steps for CREDIT:
1. ✅ Login as CREDIT
2. ✅ Navigate to an application with status **"Pending Credit Review"**
3. ✅ Verify you see:
   - **"Approve"** button
   - **"Reject"** button
   - **"Assign NBFC"** button
   - **"Mark Disbursed"** button (if application is approved)
4. ✅ Verify buttons are only shown when appropriate

#### Steps for NBFC:
1. ✅ Login as NBFC
2. ✅ Navigate to an application with status **"Sent to NBFC"**
3. ✅ Verify you see **"Record Decision"** button
4. ✅ Click the button
5. ✅ Verify a form/modal appears to record:
   - Decision (Approved/Rejected)
   - Approved Amount (if approved)
   - Remarks

#### Expected Result:
- ✅ Action buttons appear based on user role and application status
- ✅ Only valid actions are available
- ✅ Buttons work correctly when clicked

---

## M6: Daily Summary Reports

### M6.1: CREDIT - Generate Daily Summary

**Role:** CREDIT TEAM  
**Requirement:** P0.16

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Reports"** (icon: Bar Chart)
3. ✅ Wait for the page to load
4. ✅ Look for a **"Generate Report"** or **"Generate Daily Summary"** button
5. ✅ Click the button
6. ✅ Verify a loading indicator appears (if implemented)
7. ✅ Wait for the report to generate
8. ✅ Verify a success message appears (e.g., "Daily summary generated successfully")
9. ✅ Verify a new report entry appears in the reports list with:
   - Today's date
   - Timestamp
   - Report content or summary
10. ✅ Click on the report to view details
11. ✅ Verify the report contains sections for:
    - New applications
    - Status changes
    - Commission transactions
    - Queries raised/resolved

#### Expected Result:
- ✅ Report generation button works
- ✅ Report is generated and saved
- ✅ Report contains relevant summary information

---

## M7: AI File Summary

### M7.1: CREDIT/KAM - Generate AI Summary

**Role:** CREDIT TEAM or KAM  
**Requirement:** P0.18

#### Prerequisites:
- An application with documents uploaded

#### Steps:
1. ✅ Login as CREDIT TEAM (`credit@test.com` / `Test@123456`)
2. ✅ In the left sidebar, click **"Applications"**
3. ✅ Click on an application that has documents uploaded
4. ✅ Scroll down to find the **"AI File Summary"** section (usually in the sidebar)
5. ✅ If no summary exists, verify you see a **"Generate AI Summary"** button
6. ✅ Click **"Generate AI Summary"**
7. ✅ Verify a loading indicator appears (e.g., "Generating AI summary...")
8. ✅ Wait for the summary to generate (may take a few moments)
9. ✅ Verify the summary appears in the panel with sections such as:
   - Applicant Profile
   - Loan Details
   - Strengths
   - Risks
10. ✅ Verify the summary is formatted and readable
11. ✅ If summary already exists, verify you see a **"Refresh Summary"** button

#### Expected Result:
- ✅ AI summary generation button works
- ✅ Summary is generated and displayed
- ✅ Summary contains relevant insights about the application

---

### M7.2: View AI Summary

**Role:** All  
**Requirement:** P0.19

#### Steps:
1. ✅ Login as any role (e.g., CLIENT)
2. ✅ Navigate to an application that has an AI summary generated
3. ✅ Scroll to the **"AI File Summary"** section
4. ✅ Verify the summary is displayed in a formatted panel
5. ✅ Verify the summary text is readable and well-formatted
6. ✅ Navigate to an application without an AI summary
7. ✅ Verify you see a **"Generate Summary"** button (if you have permission)
8. ✅ Or verify the section shows "No AI summary available yet"

#### Expected Result:
- ✅ AI summary displays correctly when available
- ✅ Appropriate message shown when summary doesn't exist
- ✅ Generate button appears for authorized users

---

## Cross-Module: Authentication & Authorization

### CROSS.1: Login and Authentication

**Role:** All  
**Requirement:** P0.20

#### Steps:
1. ✅ Open the application in your browser
2. ✅ If you're already logged in, click **"Logout"** (usually in top right or sidebar)
3. ✅ You should be redirected to the **Login** page
4. ✅ Enter invalid credentials (wrong email or password)
5. ✅ Click **"Login"** or **"Sign In"**
6. ✅ Verify an error message appears (e.g., "Invalid credentials")
7. ✅ Enter valid credentials for CLIENT (`client@test.com` / `Test@123456`)
8. ✅ Click **"Login"**
9. ✅ Verify you are redirected to the Dashboard
10. ✅ Verify you see the CLIENT dashboard (not KAM or CREDIT dashboard)
11. ✅ Verify the sidebar shows CLIENT-appropriate menu items
12. ✅ Try to access a KAM-only page by typing the URL directly (e.g., `/kam/dashboard`)
13. ✅ Verify you are denied access or redirected (403 error or redirect to your dashboard)

#### Expected Result:
- ✅ Login works with valid credentials
- ✅ Login fails with invalid credentials
- ✅ Users are redirected to role-appropriate dashboard
- ✅ Users cannot access pages for other roles

---

### CROSS.2: Protected Routes

**Role:** All  
**Requirement:** P0.20

#### Steps:
1. ✅ Logout from the application
2. ✅ Try to access a protected page directly (e.g., `/applications`, `/ledger`)
3. ✅ Verify you are redirected to the **Login** page
4. ✅ Login as CLIENT
5. ✅ Verify you can access CLIENT pages:
   - `/dashboard`
   - `/applications`
   - `/ledger`
6. ✅ Try to access a KAM-only page (if you know the URL)
7. ✅ Verify access is denied or you're redirected

#### Expected Result:
- ✅ Protected pages require login
- ✅ Users can only access pages appropriate for their role
- ✅ Unauthorized access attempts are blocked

---

## Test Summary

### How to Report Issues

When you find an issue:

1. **Note the test case** (e.g., "M1.1 - CLIENT View Commission Ledger")
2. **Describe what happened** vs. what was expected
3. **Take a screenshot** if possible
4. **Note the browser and version** you're using
5. **Include any error messages** you see

### Test Completion Checklist

- [ ] M1: Pay In/Out Ledger (5 test cases)
- [ ] M2: Master Form Builder + New Application (4 test cases)
- [ ] M3: Status Tracking + Listings (6 test cases)
- [ ] M4: Audit Log/Queries (3 test cases)
- [ ] M5: Action Center (4 test cases)
- [ ] M6: Daily Summary Reports (1 test case)
- [ ] M7: AI File Summary (2 test cases)
- [ ] CROSS: Authentication & Authorization (2 test cases)

**Total: 27 manual test cases**

---

**Last Updated:** 2025-01-27  
**Maintained By:** QA Team

