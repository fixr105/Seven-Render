import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { FileUpload } from '../components/ui/FileUpload';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Save, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
}

interface FormData {
  applicant_name: string;
  loan_product_id: string;
  requested_loan_amount: string;
  form_data: Record<string, any>;
}

export const NewApplication: React.FC = () => {
  const navigate = useNavigate();
  const { userRole, userRoleId } = useAuth();
  const { unreadCount } = useNotifications();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState<FormData>({
    applicant_name: '',
    loan_product_id: '',
    requested_loan_amount: '',
    form_data: {},
  });

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  useEffect(() => {
    fetchClientId();
    fetchLoanProducts();
  }, [userRoleId]);

  const fetchClientId = async () => {
    if (userRole !== 'client' || !userRoleId) return;
    
    try {
      const { data } = await supabase
        .from('dsa_clients')
        .select('id')
        .eq('user_id', userRoleId)
        .maybeSingle();
      
      if (data) setClientId(data.id);
    } catch (error) {
      console.error('Error fetching client ID:', error);
    }
  };

  const fetchLoanProducts = async () => {
    try {
      const { data } = await supabase
        .from('loan_products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (data) setLoanProducts(data);
    } catch (error) {
      console.error('Error fetching loan products:', error);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    
    if (!formData.applicant_name || !formData.loan_product_id || !formData.requested_loan_amount) {
      alert('Please fill in all required fields: Applicant Name, Loan Product, and Requested Loan Amount');
      return;
    }

    if (!clientId) {
      alert('Client information not found. Please contact support.');
      return;
    }

    setLoading(true);

    try {
      // Generate file number
      const timestamp = Date.now().toString(36).toUpperCase();
      const fileNumber = `SF${timestamp.slice(-8)}`;

      // Prepare application data - only direct inputs per JSON spec
      const applicationData: any = {
        file_number: fileNumber,
        client_id: clientId,
        applicant_name: formData.applicant_name,
        loan_product_id: formData.loan_product_id,
        requested_loan_amount: parseFloat(formData.requested_loan_amount.replace(/[^0-9.]/g, '')) || 0,
        status: saveAsDraft ? 'draft' : 'pending_kam_review',
        form_data: formData.form_data, // Store additional form data
        // Computed fields - set automatically
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(saveAsDraft ? {} : { submitted_at: new Date().toISOString() }),
      };

      const { data, error } = await supabase
        .from('loan_applications')
        .insert(applicationData)
        .select()
        .single();

      if (error) throw error;

      // TODO: Upload documents to storage and link to application
      // For now, we'll handle document uploads separately

      // Create audit log entry
      await supabase.from('audit_logs').insert({
        application_id: data.id,
        user_id: userRoleId,
        action_type: saveAsDraft ? 'draft_saved' : 'application_submitted',
        message: saveAsDraft ? 'Application saved as draft' : 'Application submitted for review',
        metadata: { file_number: fileNumber },
      });

      alert(saveAsDraft ? 'Application saved as draft successfully!' : 'Application submitted successfully!');
      navigate('/applications');
    } catch (error: any) {
      console.error('Error saving application:', error);
      alert(`Failed to ${saveAsDraft ? 'save' : 'submit'} application: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="New Loan Application"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
      notificationCount={unreadCount}
    >
      <form onSubmit={(e) => handleSubmit(e, false)}>
        {/* Core Required Fields per JSON Specification */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Applicant Name *"
                placeholder="Enter applicant's full name"
                value={formData.applicant_name}
                onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                required
              />
              <Select
                label="Loan Product *"
                options={[
                  { value: '', label: 'Select Loan Product' },
                  ...loanProducts.map(p => ({ value: p.id, label: p.name }))
                ]}
                value={formData.loan_product_id}
                onChange={(e) => setFormData({ ...formData, loan_product_id: e.target.value })}
                required
              />
              <Input
                label="Requested Loan Amount *"
                type="text"
                placeholder="₹ 50,00,000"
                value={formData.requested_loan_amount}
                onChange={(e) => setFormData({ ...formData, requested_loan_amount: e.target.value })}
                required
                helperText="Enter amount in Indian Rupees"
              />
            </div>
          </CardContent>
        </Card>

        {/* Additional Form Data - Stored in form_data JSON field */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Information (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="applicant@example.com"
                onChange={(e) => setFormData({
                  ...formData,
                  form_data: { ...formData.form_data, email: e.target.value }
                })}
              />
              <Input
                label="Mobile Number"
                type="tel"
                placeholder="+91 98765 43210"
                onChange={(e) => setFormData({
                  ...formData,
                  form_data: { ...formData.form_data, phone: e.target.value }
                })}
              />
              <Input
                label="PAN Number"
                placeholder="ABCDE1234F"
                onChange={(e) => setFormData({
                  ...formData,
                  form_data: { ...formData.form_data, pan: e.target.value }
                })}
              />
              <Input
                label="Aadhaar Number"
                placeholder="1234 5678 9012"
                onChange={(e) => setFormData({
                  ...formData,
                  form_data: { ...formData.form_data, aadhaar: e.target.value }
                })}
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
            <div className="mb-4 p-4 bg-brand-primary/10 border border-brand-primary/30 rounded">
              <p className="text-sm text-brand-primary font-medium mb-2">Please upload the following documents:</p>
              <ul className="text-sm text-brand-primary space-y-1 ml-4 list-disc">
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
