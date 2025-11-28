# Component Library Documentation

## UI Components

### Button
Flexible button component with multiple variants and states.

**Props:**
- `variant`: 'primary' | 'secondary' | 'tertiary' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `icon`: LucideIcon component
- `iconPosition`: 'left' | 'right'
- `loading`: boolean
- All standard button HTML attributes

**Usage:**
```tsx
<Button variant="primary" icon={Plus} loading={false}>
  Submit
</Button>
```

### Input
Text input with label, error states, and icon support.

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- `icon`: LucideIcon
- `iconPosition`: 'left' | 'right'
- All standard input HTML attributes

**Usage:**
```tsx
<Input
  label="Email"
  type="email"
  icon={Mail}
  error="Invalid email"
  required
/>
```

### Select
Dropdown select component.

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- `options`: Array<{ value: string; label: string }>
- All standard select HTML attributes

**Usage:**
```tsx
<Select
  label="Status"
  options={statusOptions}
  value={status}
  onChange={(e) => setStatus(e.target.value)}
/>
```

### TextArea
Multi-line text input.

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- All standard textarea HTML attributes

**Usage:**
```tsx
<TextArea
  label="Description"
  rows={4}
  placeholder="Enter details..."
/>
```

### Badge
Status indicator with color variants.

**Props:**
- `variant`: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'
- `children`: ReactNode

**Usage:**
```tsx
<Badge variant="success">Approved</Badge>
<Badge variant="warning">Pending</Badge>
```

### Card
Container for grouped content.

**Components:**
- `Card`: Main container
- `CardHeader`: Header section
- `CardTitle`: Title text
- `CardContent`: Main content area
- `CardFooter`: Footer section

**Props (Card):**
- `hoverable`: boolean - Enable hover effect
- `onClick`: function - Click handler
- `className`: string

**Usage:**
```tsx
<Card hoverable onClick={handleClick}>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Modal
Dialog overlay component.

**Components:**
- `Modal`: Main container
- `ModalHeader`: Header with close button
- `ModalBody`: Scrollable content area
- `ModalFooter`: Action buttons area

**Props (Modal):**
- `isOpen`: boolean
- `onClose`: function
- `size`: 'sm' | 'md' | 'lg' | 'xl'

**Usage:**
```tsx
<Modal isOpen={isOpen} onClose={handleClose} size="md">
  <ModalHeader onClose={handleClose}>
    Confirmation
  </ModalHeader>
  <ModalBody>
    Are you sure?
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={handleClose}>
      Cancel
    </Button>
    <Button variant="primary" onClick={handleConfirm}>
      Confirm
    </Button>
  </ModalFooter>
</Modal>
```

### DataTable
Responsive table with sorting and mobile card view.

**Props:**
- `columns`: Array of column definitions
- `data`: Array of data objects
- `keyExtractor`: function to get unique key
- `onRowClick`: function (optional)
- `sortColumn`: string (optional)
- `sortDirection`: 'asc' | 'desc' (optional)
- `onSort`: function (optional)
- `loading`: boolean
- `emptyMessage`: string

**Column Definition:**
```tsx
interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
}
```

**Usage:**
```tsx
const columns: Column<Application>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <Badge variant="success">{value}</Badge>
  },
  { key: 'amount', label: 'Amount', align: 'right' },
];

<DataTable
  columns={columns}
  data={applications}
  keyExtractor={(row) => row.id}
  onRowClick={handleRowClick}
  sortColumn={sortColumn}
  sortDirection={sortDirection}
  onSort={handleSort}
/>
```

### SearchBar
Search input with clear button.

**Props:**
- `value`: string
- `onChange`: function
- `placeholder`: string
- `className`: string

**Usage:**
```tsx
<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search applications..."
/>
```

### Toast
Temporary notification component.

**Components:**
- `Toast`: Single toast notification
- `ToastContainer`: Container for multiple toasts

**Props (Toast):**
- `type`: 'success' | 'error' | 'info' | 'warning'
- `message`: string
- `onClose`: function
- `duration`: number (default: 5000ms)

**Usage:**
```tsx
// In your app component
const [toasts, setToasts] = useState([]);

const addToast = (type, message) => {
  const id = Math.random().toString();
  setToasts(prev => [...prev, { id, type, message }]);
};

const removeToast = (id) => {
  setToasts(prev => prev.filter(t => t.id !== id));
};

// Render
<ToastContainer
  toasts={toasts}
  onRemove={removeToast}
/>

// Usage
addToast('success', 'Application submitted successfully');
```

### FileUpload
Drag-and-drop file upload component.

**Props:**
- `onFilesSelected`: function - Called with File[] when files selected
- `acceptedTypes`: string[] - MIME types (e.g., ['image/*', 'application/pdf'])
- `maxSizeInMB`: number - Maximum file size
- `maxFiles`: number - Maximum number of files
- `uploadedFiles`: Array of uploaded file objects
- `onRemoveFile`: function - Called to remove a file

**UploadedFile Interface:**
```tsx
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
  error?: string;
}
```

**Usage:**
```tsx
const [uploadedFiles, setUploadedFiles] = useState([]);

const handleFilesSelected = (files) => {
  const newFiles = files.map(file => ({
    id: Math.random().toString(),
    name: file.name,
    size: file.size,
    type: file.type,
    progress: 0,
  }));
  setUploadedFiles(prev => [...prev, ...newFiles]);
};

const handleRemoveFile = (fileId) => {
  setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
};

<FileUpload
  onFilesSelected={handleFilesSelected}
  acceptedTypes={['application/pdf', 'image/*']}
  maxSizeInMB={10}
  maxFiles={5}
  uploadedFiles={uploadedFiles}
  onRemoveFile={handleRemoveFile}
/>
```

## Layout Components

### MainLayout
Complete application layout with sidebar and topbar.

**Props:**
- `children`: ReactNode - Main content
- `sidebarItems`: Array of navigation items
- `activeItem`: string - Currently active item ID
- `onItemClick`: function - Navigation handler
- `pageTitle`: string - Current page title
- `userRole`: string - User's role for display
- `userName`: string - User's name
- `notificationCount`: number - Notification badge count

**Navigation Item Interface:**
```tsx
interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}
```

**Usage:**
```tsx
const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/' },
  { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
];

<MainLayout
  sidebarItems={sidebarItems}
  activeItem={activeItem}
  onItemClick={setActiveItem}
  pageTitle="Dashboard"
  userRole="Key Account Manager"
  userName="John Doe"
  notificationCount={3}
>
  {/* Your page content */}
</MainLayout>
```

### Sidebar
Navigation sidebar (used internally by MainLayout).

**Props:**
- `items`: Array of navigation items
- `activeItem`: string
- `onItemClick`: function
- `isOpen`: boolean
- `onToggle`: function
- `userRole`: string

### TopBar
Header bar with notifications (used internally by MainLayout).

**Props:**
- `title`: string
- `onMenuToggle`: function
- `notificationCount`: number
- `userName`: string

## Color Variants

### Status Colors
- **success**: Green (`#28A745`) - Approved, Disbursed, Success
- **warning**: Yellow (`#FFC107`) - Pending, Requires Attention
- **error**: Red (`#DC3545`) - Rejected, Error, Failure
- **info**: Blue (`#17A2B8`) - Forwarded, In Process, Information
- **neutral**: Gray - Default, Inactive

### Brand Colors
- **brand-primary**: FinCorp Blue (`#2A5DB0`) - Primary actions, active states
- **brand-secondary**: Accent Green (`#20A070`) - Secondary highlights, success

## Responsive Breakpoints

- **xs**: 480px
- **sm**: 576px
- **md**: 768px - Tablet
- **lg**: 992px - Desktop
- **xl**: 1200px
- **2xl**: 1400px

## Accessibility

All components include:
- Proper ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader friendly markup
- WCAG AA contrast compliance
- Semantic HTML structure

## Best Practices

1. **Use semantic variants** - Choose button/badge variants that match the action's intent
2. **Provide labels** - Always include labels for form inputs
3. **Show feedback** - Use loading states and toast notifications
4. **Handle errors** - Display validation errors inline with forms
5. **Mobile-first** - Test responsive behavior at all breakpoints
6. **Accessibility** - Ensure keyboard navigation and screen reader support
7. **Consistent spacing** - Use the 4px grid system (spacing-1 through spacing-8)
