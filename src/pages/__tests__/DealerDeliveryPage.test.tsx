import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../i18n';
import { DealerDeliveryPage } from '../DealerDeliveryPage';
import { airtableGet, airtableWrite, uploadToUrl } from '../../services/engineClient';
import { apiService } from '../../services/api';
import * as stampFlow from '../../lib/postSubmitEngine/stampFlow';
import { INSURANCE_SAVED_AT, VEHICLE_SAVED_AT, DELIVERY_SUBMITTED_AT, DELIVERY_COMPLETED_AT } from '../../lib/deliveryFieldRules';

vi.mock('../../services/engineClient', () => ({
  airtableGet: vi.fn(),
  airtableWrite: vi.fn(async () => ({})),
  uploadToUrl: vi.fn(async () => 'https://files.example/upload.jpg'),
  readAirtableField: (record: Record<string, unknown>, column: string) => record[column],
  fillSanctionLetter: vi.fn(async () => 'https://files.example/s.pdf'),
  fillLoanAgreement: vi.fn(async () => 'https://files.example/a.pdf'),
  fillCkyc: vi.fn(async () => 'https://files.example/c.pdf'),
}));

vi.mock('../../lib/postSubmitEngine/dlaLead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postSubmitEngine/dlaLead')>();
  return {
    ...actual,
    fireDlaLead: vi.fn(async (input: { formData: Record<string, unknown> }) => input.formData),
  };
});

vi.mock('../../lib/postSubmitEngine/stampFlow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/postSubmitEngine/stampFlow')>();
  return {
    ...actual,
    runStampFreeChecks: vi.fn(),
    placeStampOrder: vi.fn(),
    fetchStampStatus: vi.fn(),
    mergeSigningPack: vi.fn(),
  };
});

vi.mock('../../services/api', () => ({
  apiService: {
    submitApplication: vi.fn(),
    getApplication: vi.fn(),
    getNotifications: vi.fn(async () => ({ success: true, data: [] })),
  },
}));

vi.mock('../../lib/crmEvents', () => ({
  flushCrm: vi.fn(async (formData: Record<string, unknown>) => formData),
  fireEvent: vi.fn(async (_name: string, input: { formData: Record<string, unknown> }) => input.formData),
}));

vi.mock('../../lib/kamFlagsDeadline', () => ({
  ensureDeadlineMissFlag: vi.fn(async ({ formData }: { formData: Record<string, unknown> }) => ({
    formData,
    flagged: false,
  })),
}));

vi.mock('../../lib/geoPhotoStamp', () => ({
  stampGeoPhoto: vi.fn(async () => ({ blob: new Blob(['jpg'], { type: 'image/jpeg' }) })),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'dealer@example.com', role: 'client', name: 'Dealer', clientId: 'c1' },
    loading: false,
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    refetch: vi.fn(),
  }),
}));

const DO_APPROVED = { '_meta.doRequest.fulfilledAt': '2026-06-01T00:00:00.000Z' };
const SIGNED = { '_meta.esign.stage': 'signed' };
const CHASSIS = 'MA1TA2ABCD1234567';

const insuranceValues = {
  'insurance.cost': '1500.50',
  'insurance.provider': 'ICICI Lombard',
  'insurance.policyNumber': 'POL123',
  'insurance.issuedDate': '2026-11-01',
  'insurance.periodMonths': '12',
};

const vehicleValues = {
  'vehicle.cost': '90000',
  'vehicle.manufacturingYear': '2024',
  'vehicle.invoiceNumber': 'INV-1',
  'vehicle.invoiceDate': '2026-11-01',
  'vehicle.downpayment': '10000',
  'vehicle.registrationCost': '0',
  'vehicle.chassisNumber': CHASSIS,
};

function expressReady(): Record<string, unknown> {
  return {
    loan_product_id: 'EV-1',
    'dealer.id': 'd1',
    'dealer.displayLabel': 'Seven Wheels',
    'dealer.tradeName': 'Seven Wheels',
    'dealer.name': 'Seven Wheels',
    'dealer.contact': '9876543210',
    'dealer.email': 'dealer@example.com',
    'dealer.gstNumber': '09BMCPG4250M1ZY',
    'dealer.pan': 'ABCDE1234F',
    'dealer.ifscCode': 'HDFC0001885',
    '_meta.supportPersonType': 'co_applicant',
    'coApplicant.name': 'Rita Rao',
    'coApplicant.dob': '1990-01-01',
    'coApplicant.email': 'rita@example.com',
    'coApplicant.pan': 'ABCDE1234F',
    'coApplicant.address.line1': '1 Road',
    'coApplicant.address.village': 'Andheri',
    'coApplicant.address.pincode': '400001',
    'coApplicant.address.district': 'Mumbai',
    'coApplicant.address.state': 'Maharashtra',
    'coApplicant.mobile': '9876543210',
    'coApplicant.relationship': 'Spouse',
    'borrower.firstName': 'Asha',
    'borrower.lastName': 'Rao',
    'borrower.gender': 'Female',
    'borrower.dob': '1992-02-02',
    'borrower.fatherName': 'Ravi',
    'borrower.mobile': '9876543210',
    'borrower.email': 'asha@example.com',
    'borrower.pan': 'ABCDE1234F',
    'borrower.address.line1': '1 Road',
    'borrower.address.village': 'Andheri',
    'borrower.address.pincode': '400001',
    'borrower.address.district': 'Mumbai',
    'borrower.address.state': 'Maharashtra',
    'loan.amount': '71395',
    'loan.interestRate': '18',
    'loan.tenureMonths': '24',
    'loan.processingFee': '1000',
    'loan.gpsCharges': '2000',
    'compliance.vkycDone': 'true',
    'compliance.loanAgreementSigned': 'true',
    'compliance.enachDone': 'true',
    ...insuranceValues,
    ...vehicleValues,
    ...geoValues(),
  };
}

function geoValues() {
  const slots = ['withSupportPerson', 'withVehicle', 'atResidence'] as const;
  const data: Record<string, string> = {};
  for (const slot of slots) {
    data[`geoPhotos.${slot}.url`] = `https://files.example/${slot}.jpg`;
    data[`geoPhotos.${slot}.latitude`] = '19.076';
    data[`geoPhotos.${slot}.longitude`] = '72.8777';
  }
  return data;
}

function renderPage(formData: Record<string, unknown>) {
  vi.mocked(airtableGet).mockResolvedValue({
    records: [{ id: 'rec123', 'Form Data': JSON.stringify(formData) }],
  } as never);
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/dealer/delivery/SFMWJHW7BR']}>
        <Routes>
          <Route path="/dealer/delivery/:fileId" element={<DealerDeliveryPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}

async function shown() {
  expect(await screen.findByTestId('delivery-banner')).toBeInTheDocument();
}

function lastWritten(): Record<string, unknown> {
  const call = vi.mocked(airtableWrite).mock.calls.at(-1);
  if (!call) throw new Error('no write');
  return JSON.parse(String(call[0].fields['Form Data'])) as Record<string, unknown>;
}

describe('DealerDeliveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getApplication).mockResolvedValue({
      success: true,
      data: { status: 'draft' },
    } as never);
    vi.mocked(apiService.submitApplication).mockResolvedValue({ success: true, data: {} } as never);
    class FakeImage {
      naturalWidth = 40;
      naturalHeight = 20;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:preview',
      revokeObjectURL: () => undefined,
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    vi.mocked(stampFlow.runStampFreeChecks).mockReset();
    vi.mocked(stampFlow.runStampFreeChecks).mockResolvedValue({
      ok: true,
      config: {
        stamp_state: 'Delhi',
        stamp_article_code: '5',
        stamp_purpose: 'Loan Agreement',
        stamp_denomination: 100,
        stamp_first_party: 'Fintree',
        stamp_project: 'seven_dealer_ev',
      },
      productId: 'p1',
      papers: [
        { refId: 'SF1-S1', firstParty: 'Fintree', secondParty: 'Asha', rowLabel: 'Applicant' },
        { refId: 'SF1-S2', firstParty: 'Fintree', secondParty: 'Rita', rowLabel: 'Co-applicant' },
        { refId: 'SF1-S3', firstParty: 'Fintree', secondParty: 'Asha & Rita', rowLabel: 'Both' },
      ],
      quote: { total: 300, affordable: true },
    });
    vi.mocked(stampFlow.placeStampOrder).mockReset();
  });

  it('unlocks insurance, vehicle, and photos after e-sign, and keeps IoT locked until vehicle is done', async () => {
    renderPage({ ...DO_APPROVED, ...SIGNED, 'borrower.customerName': 'Asha Rao' });
    await shown();
    expect(screen.getByTestId('delivery-banner')).toHaveTextContent('Ready for delivery.');
    expect(screen.getByLabelText(/Insurance Cost/)).toBeEnabled();
    expect(screen.getByLabelText(/Cost of Vehicle/)).toBeEnabled();
    expect(screen.getByTestId('geo-file-withSupportPerson')).toBeEnabled();
    expect(screen.getByTestId('delivery-card-iot')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('delivery-card-iot')).toHaveTextContent(
      'Opens after vehicle details are saved.'
    );
  });

  it('keeps photos and IoT locked when only the old signing-sent key is set', async () => {
    renderPage({ '_meta.signing.sentAt': '2026-06-01T00:00:00.000Z' });
    await shown();
    expect(screen.getByTestId('delivery-card-geo')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('delivery-card-iot')).toHaveAttribute('data-locked', 'true');
    expect(screen.queryByTestId('geo-file-withSupportPerson')).not.toBeInTheDocument();
  });

  it('locks every card until the disbursement order is approved', async () => {
    renderPage({});
    await shown();
    expect(screen.getByTestId('delivery-banner')).toHaveTextContent(
      'Waiting for disbursement order approval.'
    );
    for (const id of ['insurance', 'vehicle', 'geo', 'iot']) {
      const card = screen.getByTestId(`delivery-card-${id}`);
      expect(card).toHaveAttribute('data-locked', 'true');
      expect(card).toHaveTextContent('Opens after the disbursement order is approved.');
    }
  });

  it('writes one insurance field on blur without validating or submitting', async () => {
    const user = userEvent.setup();
    renderPage({ ...DO_APPROVED });
    await shown();
    await user.type(screen.getByLabelText(/Insurance Cost/), '1200');
    await user.tab();
    await waitFor(() => expect(airtableWrite).toHaveBeenCalled());
    const written = lastWritten();
    expect(written['insurance.cost']).toBe('1200');
    expect(written['insurance.provider']).toBeUndefined();
    expect(written[INSURANCE_SAVED_AT]).toBeUndefined();
    expect(screen.queryByText('Enter the insurance cost in rupees.')).not.toBeInTheDocument();
    expect(apiService.submitApplication).not.toHaveBeenCalled();
  });

  it('reloads drafted insurance fields and leaves the card pending', async () => {
    const user = userEvent.setup();
    renderPage({ ...DO_APPROVED });
    await shown();
    await user.type(screen.getByLabelText(/Insurance Cost/), '1500');
    await user.tab();
    await user.type(screen.getByLabelText(/Insurance Provider/), 'ICICI');
    await user.tab();
    await user.type(screen.getByLabelText(/Policy Number/), 'POL9');
    await user.tab();
    await waitFor(() => expect(lastWritten()['insurance.policyNumber']).toBe('POL9'));
    const drafted = lastWritten();
    cleanup();
    renderPage(drafted);
    expect(await screen.findByLabelText(/Insurance Cost/)).toHaveValue('1500');
    expect(screen.getByLabelText(/Insurance Provider/)).toHaveValue('ICICI');
    expect(screen.getByLabelText(/Policy Number/)).toHaveValue('POL9');
    expect(screen.getByTestId('delivery-card-insurance')).toHaveAttribute('data-done', 'false');
  });

  it('blocks vehicle save when the chassis number is missing', async () => {
    const user = userEvent.setup();
    renderPage({ ...DO_APPROVED, ...SIGNED });
    await shown();
    fireEvent.change(screen.getByLabelText(/Cost of Vehicle/), { target: { value: '90000' } });
    fireEvent.change(screen.getByLabelText(/Manufacturing Year/), { target: { value: '2024' } });
    fireEvent.change(screen.getByLabelText(/Sales Invoice Date/), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/Downpayment Paid/), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText(/Vehicle Registration Cost/), { target: { value: '0' } });
    await user.click(screen.getByTestId('delivery-card-vehicle-save'));
    expect(await screen.findByText('Enter the 17-character chassis number.')).toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(airtableWrite).mock.calls)).not.toContain(VEHICLE_SAVED_AT);
  });

  it('captures the device location, rejects a denial and a point outside India', async () => {
    const user = userEvent.setup();
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 19.076, longitude: 72.8777, accuracy: 12.2 } as GeolocationCoordinates,
        timestamp: Date.now(),
      });
    });
    renderPage({ ...DO_APPROVED, ...SIGNED });
    await shown();
    await user.click(screen.getByTestId('geo-locate-withSupportPerson'));
    expect(await screen.findByTestId('geo-location-note-withSupportPerson')).toHaveTextContent(
      'Location captured (±12 m)'
    );

    const file = new File(['img'], 'borrower.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('geo-file-withSupportPerson'), file);
    const slot = screen.getByTestId('geo-slot-withSupportPerson');
    await user.click(within(slot).getByRole('button', { name: 'Preview stamped photo' }));
    await user.click(await screen.findByTestId('geo-use-withSupportPerson'));
    await waitFor(() => expect(lastWritten()['_meta.geo.withSupportPerson']).toMatchObject({ source: 'device' }));
    const saved = lastWritten()['_meta.geo.withSupportPerson'] as { source: string; lat: number };
    expect(saved.lat).toBe(19.076);
    expect(uploadToUrl).toHaveBeenCalled();

    cleanup();
    getCurrentPosition.mockImplementation((_success: PositionCallback, failure?: PositionErrorCallback) => {
      failure?.({ code: 1 } as GeolocationPositionError);
    });
    renderPage({ ...DO_APPROVED, ...SIGNED });
    await shown();
    await user.click(screen.getByTestId('geo-locate-withSupportPerson'));
    expect(
      await screen.findByText(
        'Could not read your location. Paste a Google Maps link or type the coordinates.'
      )
    ).toBeInTheDocument();

    cleanup();
    getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 0, longitude: 0, accuracy: 5 } as GeolocationCoordinates,
        timestamp: Date.now(),
      });
    });
    renderPage({ ...DO_APPROVED, ...SIGNED });
    await shown();
    await user.click(screen.getByTestId('geo-locate-withSupportPerson'));
    expect(await screen.findByText('This location is not in India. Check the link.')).toBeInTheDocument();
  });

  it('rejects a short maps link and does not upload', async () => {
    const user = userEvent.setup();
    renderPage({ ...DO_APPROVED, ...SIGNED });
    await shown();
    const file = new File(['img'], 'borrower.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('geo-file-withSupportPerson'), file);
    await user.type(screen.getByTestId('geo-maps-withSupportPerson'), 'https://maps.app.goo.gl/abc');
    await user.click(
      within(screen.getByTestId('geo-slot-withSupportPerson')).getByRole('button', {
        name: 'Preview stamped photo',
      })
    );
    expect(
      await screen.findByText(
        "Short links cannot be read. Tap 'Use my current location', or open the link and copy the coordinates."
      )
    ).toBeInTheDocument();
    expect(uploadToUrl).not.toHaveBeenCalled();
  });

  it('keeps the IoT chassis read-only and stores the device photo before linking', async () => {
    const user = userEvent.setup();
    renderPage({
      ...DO_APPROVED,
      ...SIGNED,
      ...vehicleValues,
      [VEHICLE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
    });
    await shown();
    const chassis = screen.getByTestId('iot-chassis');
    expect(chassis).toHaveValue(CHASSIS);
    expect(chassis).toHaveAttribute('readonly');
    const photo = new File(['iot'], 'device.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByTestId('iot-photo-input'), photo);
    await waitFor(() => expect(lastWritten()['iot.devicePhoto']).toBe('https://files.example/upload.jpg'));
    expect(apiService.submitApplication).not.toHaveBeenCalled();
    expect(lastWritten()['iot.taggedAt']).toBeUndefined();
  });

  it('does not submit when the last card is completed', async () => {
    const user = userEvent.setup();
    renderPage({
      ...DO_APPROVED,
      ...SIGNED,
      ...insuranceValues,
      [INSURANCE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      ...vehicleValues,
      [VEHICLE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      ...geoValues(),
    });
    await shown();
    await user.type(screen.getByLabelText(/IoT device ID/), 'ABC12345');
    await user.click(screen.getByTestId('iot-link'));
    await waitFor(() => expect(lastWritten()['iot.taggedAt']).toEqual(expect.any(String)));
    expect(apiService.submitApplication).not.toHaveBeenCalled();
    expect(screen.getByTestId('delivery-complete-block')).toBeInTheDocument();
  });

  it('submits once from Complete delivery and writes the completion keys', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    vi.mocked(apiService.submitApplication).mockImplementation(
      () => new Promise((resolve) => {
        release = resolve;
      }) as never
    );
    renderPage({
      ...DO_APPROVED,
      ...SIGNED,
      ...expressReady(),
      'borrower.customerName': 'Asha Rao',
      [INSURANCE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      [VEHICLE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      'iot.deviceId': 'ABC12345',
      'iot.chassisNumber': CHASSIS,
      'iot.taggedAt': '2026-11-18T01:00:00.000Z',
    });
    await shown();
    await user.click(screen.getByTestId('delivery-submit-button'));
    expect(screen.getByTestId('delivery-submit-confirm')).toHaveTextContent(
      'Submit this delivery for Asha Rao? You will not be able to edit it afterwards.'
    );
    const confirm = screen.getByTestId('delivery-submit-confirm-button');
    await user.click(confirm);
    await user.click(confirm);
    await waitFor(() => expect(apiService.submitApplication).toHaveBeenCalledTimes(1));
    release({ success: true, data: {} });
    await waitFor(() => expect(screen.getByTestId('delivery-success')).toBeInTheDocument());
    const written = lastWritten();
    expect(written[DELIVERY_SUBMITTED_AT]).toEqual(expect.any(String));
    expect(written[DELIVERY_COMPLETED_AT]).toEqual(expect.any(String));
    expect(apiService.submitApplication).toHaveBeenCalledTimes(1);
  });

  it('keeps card data when submit fails and retries once', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.submitApplication)
      .mockResolvedValueOnce({
        success: false,
        error: 'Missing required fields',
        data: { missingFields: [{ fieldId: 'insurance.provider', label: 'Insurance Provider' }] },
      } as never)
      .mockResolvedValueOnce({ success: true, data: {} } as never);
    renderPage({
      ...DO_APPROVED,
      ...SIGNED,
      ...expressReady(),
      'borrower.customerName': 'Asha Rao',
      [INSURANCE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      [VEHICLE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      'iot.deviceId': 'ABC12345',
      'iot.chassisNumber': CHASSIS,
      'iot.taggedAt': '2026-11-18T01:00:00.000Z',
    });
    await shown();
    await user.click(screen.getByTestId('delivery-submit-button'));
    await user.click(screen.getByTestId('delivery-submit-confirm-button'));
    expect(await screen.findByTestId('delivery-submit-error')).toHaveTextContent(
      'Could not submit the delivery. Missing required fields Missing: Insurance Provider'
    );
    expect(screen.getByTestId('delivery-card-insurance')).toHaveAttribute('data-done', 'true');
    expect(screen.getByLabelText(/Insurance Provider/)).toHaveValue('ICICI Lombard');
    expect(JSON.stringify(vi.mocked(airtableWrite).mock.calls)).not.toContain(DELIVERY_SUBMITTED_AT);
    await user.click(screen.getByTestId('delivery-submit-retry'));
    await user.click(screen.getByTestId('delivery-submit-confirm-button'));
    await waitFor(() => expect(apiService.submitApplication).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('delivery-success')).toBeInTheDocument());
  });

  it('shows stamps on a fulfilled file and runs the free quote without ordering', async () => {
    const user = userEvent.setup();
    renderPage({
      ...DO_APPROVED,
      'borrower.customerName': 'Asha Rao',
      'loan.amount': '71395',
      '_meta.docs.sanctionLetter': 'https://files.example/s.pdf',
      '_meta.docs.loanAgreement': 'https://files.example/a.pdf',
      '_meta.docs.ckyc': 'https://files.example/c.pdf',
    });
    await shown();
    expect(screen.getByTestId('stamps-signing-state')).toHaveTextContent('Not started');
    expect(screen.getByTestId('stamps-paid-off')).toHaveTextContent(
      'Paid step is switched off. Contact support.'
    );
    expect(screen.getByTestId('delivery-card-geo')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('delivery-card-iot')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('delivery-submit-button')).toBeDisabled();
    expect(screen.getByTestId('delivery-submit-blockers')).toHaveTextContent(
      'Loan documents are not signed yet'
    );
    await user.click(screen.getByTestId('open-stamps-and-signing'));
    expect(await screen.findByText(/quote ₹300/)).toBeInTheDocument();
    expect(stampFlow.runStampFreeChecks).toHaveBeenCalled();
    expect(stampFlow.placeStampOrder).not.toHaveBeenCalled();
  });

  it('shows delivery complete without submitting when submittedAt is already set', async () => {
    renderPage({
      ...DO_APPROVED,
      ...SIGNED,
      [DELIVERY_SUBMITTED_AT]: '2026-11-18T02:00:00.000Z',
    });
    expect(await screen.findByTestId('delivery-success')).toBeInTheDocument();
    expect(apiService.submitApplication).not.toHaveBeenCalled();
    expect(apiService.getApplication).not.toHaveBeenCalled();
  });
});
