import React, { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { TextArea } from '../components/ui/TextArea';
import { FileUpload } from '../components/ui/FileUpload';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, Send } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
}

export const NewApplication: React.FC = () => {
  const [activeItem, setActiveItem] = useState('applications');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
    { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
    { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const loanTypeOptions = [
    { value: '', label: 'Select Loan Type' },
    { value: 'home', label: 'Home Loan' },
    { value: 'lap', label: 'Loan Against Property' },
    { value: 'business', label: 'Business Loan' },
    { value: 'personal', label: 'Personal Loan' },
    { value: 'working-capital', label: 'Working Capital' },
  ];

  const employmentTypeOptions = [
    { value: '', label: 'Select Employment Type' },
    { value: 'salaried', label: 'Salaried' },
    { value: 'self-employed', label: 'Self-Employed' },
    { value: 'professional', label: 'Professional' },
    { value: 'business', label: 'Business Owner' },
  ];

  const handleFilesSelected = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach(file => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadedFiles(prev =>
          prev.map(f =>
            f.id === file.id ? { ...f, progress: Math.min(progress, 100) } : f
          )
        );
        if (progress >= 100) clearInterval(interval);
      }, 200);
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      console.log(saveAsDraft ? 'Saved as draft' : 'Application submitted');
    }, 1500);
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={setActiveItem}
      pageTitle="New Loan Application"
      userRole="DSA Client"
      userName="ABC Corp"
      notificationCount={3}
    >
      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Applicant Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Applicant Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="Enter applicant's full name"
                required
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="applicant@example.com"
                required
              />
              <Input
                label="Mobile Number"
                type="tel"
                placeholder="+91 98765 43210"
                required
              />
              <Input
                label="Date of Birth"
                type="date"
                required
              />
              <Input
                label="PAN Number"
                placeholder="ABCDE1234F"
                required
              />
              <Input
                label="Aadhaar Number"
                placeholder="1234 5678 9012"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Loan Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Loan Type"
                options={loanTypeOptions}
                required
              />
              <Input
                label="Loan Amount"
                type="number"
                placeholder="₹ 50,00,000"
                required
              />
              <Input
                label="Loan Tenure (months)"
                type="number"
                placeholder="240"
                required
              />
              <Input
                label="Monthly Income"
                type="number"
                placeholder="₹ 1,00,000"
                required
              />
              <Select
                label="Employment Type"
                options={employmentTypeOptions}
                required
              />
              <Input
                label="Company/Business Name"
                placeholder="Enter company name"
              />
            </div>
            <div className="mt-4">
              <TextArea
                label="Purpose of Loan"
                placeholder="Describe the purpose of the loan..."
                required
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Property Details (for Home Loan / LAP) */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Property Details (if applicable)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Property Address"
                placeholder="Enter property address"
              />
              <Input
                label="Property Value"
                type="number"
                placeholder="₹ 75,00,000"
              />
              <Input
                label="Property Type"
                placeholder="e.g., Residential, Commercial"
              />
              <Input
                label="City"
                placeholder="Enter city"
              />
            </div>
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Required Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800 font-medium mb-2">Please upload the following documents:</p>
              <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
                <li>PAN Card</li>
                <li>Aadhaar Card</li>
                <li>Last 3 months bank statements</li>
                <li>Last 2 years ITR (for self-employed)</li>
                <li>Salary slips (for salaried)</li>
                <li>Property documents (if applicable)</li>
              </ul>
            </div>

            <FileUpload
              onFilesSelected={handleFilesSelected}
              acceptedTypes={['application/pdf', 'image/*']}
              maxSizeInMB={10}
              maxFiles={10}
              uploadedFiles={uploadedFiles}
              onRemoveFile={handleRemoveFile}
            />
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <TextArea
              label="Additional Notes"
              placeholder="Any additional information you'd like to share..."
              rows={4}
              helperText="Optional: Add any relevant details that may help in processing your application"
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            icon={Save}
            onClick={(e) => handleSubmit(e as any, true)}
            loading={loading}
          >
            Save as Draft
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            loading={loading}
          >
            Submit Application
          </Button>
        </div>
      </form>
    </MainLayout>
  );
};
