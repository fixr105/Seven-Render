import { describe, expect, it } from 'vitest';
import {
  buildBureauCachePanFilter,
  extractBureauAddresses,
  mapBureauCacheFieldsToProfile,
  mapBureauCacheRecordToFormDataPatch,
  pickBureauCacheRecord,
} from '../bureauCacheLookup';

describe('buildBureauCachePanFilter', () => {
  it('builds an Airtable filter for a normalized PAN', () => {
    expect(buildBureauCachePanFilter('kmpps3552c')).toBe("{pan} = 'KMPPS3552C'");
  });

  it('escapes single quotes in PAN', () => {
    expect(buildBureauCachePanFilter("ABCDE1234F'")).toBe("{pan} = 'ABCDE1234F\\''");
  });
});

describe('extractBureauAddresses', () => {
  it('returns every structured address, not only the first', () => {
    const addresses = extractBureauAddresses({
      applicant: {
        name: 'SHARAN KRISHNAN S',
        addresses: [
          { line1: '12 Main Street', line2: 'Near Temple', city: 'Chennai', pincode: '600001', state: 'Tamil Nadu' },
          { line1: '88 Lake Road', city: 'Madurai', pin: '625001', state_code: '33' },
        ],
      },
    });

    expect(addresses).toEqual([
      {
        line1: '12 Main Street',
        line2: 'Near Temple',
        line3: '',
        city: 'Chennai',
        pin: '600001',
        state_code: 'Tamil Nadu',
      },
      {
        line1: '88 Lake Road',
        line2: '',
        line3: '',
        city: 'Madurai',
        pin: '625001',
        state_code: '33',
      },
    ]);
  });

  it('keeps the current Experian address and a different CAIS address', () => {
    const addresses = extractBureauAddresses({
      raw_response: JSON.stringify({
        result: {
          credit_report: {
            Current_Application: {
              Current_Application_Details: {
                Current_Applicant_Address_Details: {
                  FlatNoPlotNoHouseNo: '2 FLOOR MI STORE',
                  RoadNoNameAreaLocality: 'JP NAGAR',
                  City: 'BANGALORE',
                  State: '29',
                  PINCode: '560078',
                },
              },
            },
            CAIS_Account: {
              CAIS_Account_DETAILS: [
                {
                  CAIS_Holder_Address_Details: {
                    First_Line_Of_Address_non_normalized: '14 RESIDENCY ROAD',
                    Second_Line_Of_Address_non_normalized: 'ASHOK NAGAR',
                    City_non_normalized: 'BANGALORE',
                    State_non_normalized: '29',
                    ZIP_Postal_Code_non_normalized: '560025',
                  },
                },
              ],
            },
          },
        },
      }),
    });

    expect(addresses.map((address) => address.line1)).toEqual([
      '2 FLOOR MI STORE',
      '14 RESIDENCY ROAD',
    ]);
    expect(addresses[1]).toMatchObject({
      line2: 'ASHOK NAGAR',
      city: 'BANGALORE',
      pin: '560025',
      state_code: '29',
    });
  });

  it('drops a repeated line and pin', () => {
    const addresses = extractBureauAddresses({
      applicant: {
        addresses: [
          { line1: '12 Main Street', city: 'Chennai', pincode: '600001' },
          { line1: '12 main street', city: 'chennai', pin: '600001' },
        ],
      },
    });
    expect(addresses).toHaveLength(1);
  });

  it('still maps the flat profile from the first address', () => {
    const profile = mapBureauCacheFieldsToProfile({
      applicant: {
        name: 'SHARAN KRISHNAN S',
        addresses: [
          { line1: '12 Main Street', city: 'Chennai', pincode: '600001', state: 'Tamil Nadu' },
          { line1: '88 Lake Road', city: 'Madurai', pin: '625001' },
        ],
      },
    });
    expect(profile?.['address Line 1']).toBe('12 Main Street');
    expect(profile?.['village/City']).toBe('Chennai');
  });
});

describe('mapBureauCacheFieldsToProfile', () => {
  it('maps structured applicant object with address array', () => {
    const profile = mapBureauCacheFieldsToProfile({
      pan: 'KMPPS3552C',
      mobile: '8217432973',
      score: 712,
      applicant: {
        name: 'SHARAN KRISHNAN S',
        dob: '15-06-1995',
        gender: 'male',
        father_name: 'KRISHNAN',
        email: 'sharan@example.com',
        addresses: [
          {
            line1: '12 Main Street',
            line2: 'Near Temple',
            city: 'Chennai',
            pincode: '600001',
            district: 'Chennai',
            state: 'Tamil Nadu',
          },
        ],
      },
    });

    expect(profile).toMatchObject({
      first_name: 'SHARAN',
      last_name: 'KRISHNAN S',
      customer_name: 'SHARAN KRISHNAN S',
      date_of_birth: '15-06-1995',
      gender: 'male',
      father_name: 'KRISHNAN',
      email: 'sharan@example.com',
      mobile_number: '8217432973',
      pan_card: 'KMPPS3552C',
      cibil_score: '712',
      'address Line 1': '12 Main Street',
      'address Line 2': 'Near Temple',
      'village/City': 'Chennai',
      pincode: '600001',
      district: 'Chennai',
      state: 'Tamil Nadu',
    });
  });

  it('parses applicant JSON string and first_name/last_name', () => {
    const profile = mapBureauCacheFieldsToProfile({
      pan: 'BAIPG3083L',
      mobile: '9687599179',
      score: '731',
      applicant: JSON.stringify({
        first_name: 'RAHUL',
        last_name: 'YADAV',
        dob: '1993-04-07',
        gender: 'Male',
        addresses: { address_line_1: '107 Villa', village: 'Bhavnagar', pincode: '364002' },
      }),
    });

    expect(profile?.first_name).toBe('RAHUL');
    expect(profile?.last_name).toBe('YADAV');
    expect(profile?.customer_name).toBe('RAHUL YADAV');
    expect(profile?.['address Line 1']).toBe('107 Villa');
    expect(profile?.cibil_score).toBe('731');
  });

  it('returns null for malformed applicant JSON', () => {
    expect(
      mapBureauCacheFieldsToProfile({
        pan: 'BAIPG3083L',
        applicant: '{not-json',
      })
    ).toBeNull();
  });

  it('returns null when applicant has no name or address', () => {
    expect(
      mapBureauCacheFieldsToProfile({
        pan: 'BAIPG3083L',
        mobile: '9687599179',
        score: 700,
        applicant: { gender: 'Male' },
      })
    ).toBeNull();
  });

  it('maps Experian raw_response when applicant object is absent (live Bureau Cache shape)', () => {
    const profile = mapBureauCacheFieldsToProfile({
      pan: 'HSJPP5704A',
      mobile: '7355621712',
      name: 'govindpandey',
      score: 807,
      raw_response: JSON.stringify({
        result: {
          name: 'govindpandey',
          pan: 'HSJPP5704A',
          mobile: '7355621712',
          credit_score: '807',
          credit_report: {
            Current_Application: {
              Current_Application_Details: {
                Current_Applicant_Details: {
                  First_Name: 'Govind',
                  Last_Name: 'Pandey',
                  Gender_Code: '1',
                  Date_Of_Birth_Applicant: '20050616',
                  IncomeTaxPan: 'HSJPP5704A',
                },
                Current_Applicant_Address_Details: {
                  FlatNoPlotNoHouseNo: '2 FLOOR MI STORE JP NAGAR 7TH PHASE',
                  RoadNoNameAreaLocality: 'PUTTENAHALLI ROAD JP NAGAR BANGALORE',
                  City: 'BANGALORE',
                  State: '29',
                  PINCode: '560078',
                },
              },
            },
          },
        },
      }),
    });

    expect(profile).toMatchObject({
      first_name: 'Govind',
      last_name: 'Pandey',
      pan_card: 'HSJPP5704A',
      mobile_number: '7355621712',
      cibil_score: '807',
      date_of_birth: '2005-06-16',
      gender: 'Male',
      'address Line 1': '2 FLOOR MI STORE JP NAGAR 7TH PHASE',
      pincode: '560078',
    });
  });
});

describe('mapBureauCacheRecordToFormDataPatch', () => {
  it('maps flat airtable_get records (no nested fields wrapper)', () => {
    const patch = mapBureauCacheRecordToFormDataPatch(
      {
        id: 'recFLAT1',
        createdTime: '2026-11-12T19:26:55.000Z',
        pan: 'HSJPP5704A',
        mobile: '7355621712',
        name: 'govindpandey',
        score: 807,
        raw_response: JSON.stringify({
          result: {
            name: 'GOVIND PANDEY',
            pan: 'HSJPP5704A',
            mobile: '7355621712',
            credit_score: '807',
            credit_report: {
              Current_Application: {
                Current_Application_Details: {
                  Current_Applicant_Details: {
                    First_Name: 'GOVIND',
                    Last_Name: 'PANDEY',
                    Gender_Code: '1',
                    Date_Of_Birth_Applicant: '20050616',
                  },
                  Current_Applicant_Address_Details: {
                    FlatNoPlotNoHouseNo: '2 FLOOR MI STORE',
                    RoadNoNameAreaLocality: 'JP NAGAR',
                    City: 'BANGALORE',
                    State: 'Karnataka',
                    PINCode: '560078',
                  },
                },
              },
            },
          },
        }),
      } as never,
      'borrower'
    );

    expect(patch).toMatchObject({
      'borrower.firstName': 'GOVIND',
      'borrower.lastName': 'PANDEY',
      'borrower.pan': 'HSJPP5704A',
      'borrower.mobile': '7355621712',
      'borrower.dob': '2005-06-16',
      'borrower.gender': 'Male',
      'borrower.address.line1': '2 FLOOR MI STORE',
      'borrower.address.pincode': '560078',
      '_meta.panLookup.cibilScore': '807',
    });
  });

  it('maps a cache hit to borrower form patch including score', () => {
    const patch = mapBureauCacheRecordToFormDataPatch(
      {
        fields: {
          pan: 'BAIPG3083L',
          mobile: '9687599179',
          score: 731,
          applicant: {
            name: 'RAHUL YADAV',
            dob: '07/04/1993',
            gender: 'Male',
            addresses: [{ line1: '107 Villa', city: 'Bhavnagar', pincode: '364002' }],
          },
        },
      },
      'borrower'
    );

    expect(patch).toMatchObject({
      'borrower.firstName': 'RAHUL',
      'borrower.lastName': 'YADAV',
      'borrower.customerName': 'RAHUL YADAV',
      'borrower.dob': '1993-04-07',
      'borrower.gender': 'Male',
      'borrower.mobile': '9687599179',
      'borrower.pan': 'BAIPG3083L',
      'borrower.address.line1': '107 Villa',
      '_meta.panLookup.cibilScore': '731',
    });
  });

  it('maps a cache hit to co-applicant form patch', () => {
    const patch = mapBureauCacheRecordToFormDataPatch(
      {
        fields: {
          pan: 'FGHIJ5678K',
          mobile: '9876543211',
          applicant: {
            name: 'PRIYA SHARMA',
            dob: '1992-02-02',
            addresses: [{ line1: '12 Main Street', city: 'Delhi', pincode: '110001' }],
          },
        },
      },
      'coApplicant'
    );

    expect(patch).toMatchObject({
      'coApplicant.name': 'PRIYA SHARMA',
      'coApplicant.pan': 'FGHIJ5678K',
      'coApplicant.mobile': '9876543211',
      'coApplicant.address.line1': '12 Main Street',
    });
  });

  it('returns null patch for empty records', () => {
    expect(mapBureauCacheRecordToFormDataPatch({ fields: {} }, 'borrower')).toBeNull();
  });
});

describe('pickBureauCacheRecord', () => {
  it('picks the first record with a meaningful profile', () => {
    const record = pickBureauCacheRecord({
      records: [
        { id: 'rec1', fields: { pan: 'X', score: 1 } },
        {
          id: 'rec2',
          fields: {
            pan: 'BAIPG3083L',
            applicant: { name: 'RAHUL YADAV', addresses: [{ line1: 'A' }] },
          },
        },
      ],
    });
    expect(record?.id).toBe('rec2');
  });

  it('picks flat records that only expose raw_response (live n8n shape)', () => {
    const record = pickBureauCacheRecord({
      records: [
        {
          id: 'recFlat',
          createdTime: '2026-11-12T19:26:55.000Z',
          pan: 'HSJPP5704A',
          mobile: '7355621712',
          score: 807,
          raw_response: JSON.stringify({
            result: {
              name: 'GOVIND PANDEY',
              credit_score: '807',
              credit_report: {
                Current_Application: {
                  Current_Application_Details: {
                    Current_Applicant_Details: {
                      First_Name: 'GOVIND',
                      Last_Name: 'PANDEY',
                      Date_Of_Birth_Applicant: '20050616',
                    },
                    Current_Applicant_Address_Details: {
                      FlatNoPlotNoHouseNo: 'ADDR1',
                      PINCode: '560078',
                    },
                  },
                },
              },
            },
          }),
        } as never,
      ],
    });
    expect(record?.id).toBe('recFlat');
  });

  it('reads the applicant stored on result_json', () => {
    const profile = mapBureauCacheFieldsToProfile({
      pan: 'HSJPP5704A',
      mobile: '7355621712',
      result_json: JSON.stringify({
        applicant: {
          name: 'GOVIND PANDEY',
          dob: '1990-01-01',
          pan: 'HSJPP5704A',
          mobile: '7355621712',
        },
        score: 807,
      }),
    });
    expect(profile?.customer_name).toBe('GOVIND PANDEY');
    expect(profile?.cibil_score).toBe('807');
  });

  it('returns null on miss', () => {
    expect(pickBureauCacheRecord({ records: [] })).toBeNull();
    expect(pickBureauCacheRecord({})).toBeNull();
  });
});
