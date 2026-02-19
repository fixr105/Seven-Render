# Loan Products – Records Collected for Application

**Source:** GET `/webhook/loanproducts` (Airtable: Loan Products)  
**Fetched:** 8 products

---

## Schema Overview

### Core Product Fields
| Column | Description |
|--------|-------------|
| `id` | Airtable record ID |
| `Product ID` | e.g. LP008, LP009, LP011 |
| `Product Name` | e.g. Credit Card, MoneyMultiplier, Term Loan |
| `Active` | True/False |
| `Description` | Product description |
| `createdTime` | Record creation timestamp |

### Section Keys (Y/N – include in form or not)
Each section is a column. Value `Y` = show in form, `N` = hide.

| Section Key | Label |
|-------------|-------|
| `SECTION 1A – PERSONAL KYC (Applicants)` | Personal KYC – Applicants |
| `SECTION 1B – PERSONAL KYC (Co-Applicants)` | Personal KYC – Co-Applicants |
| `SECTION 2A – BUSINESS KYC – PRIVATE LIMITED` | Business KYC – Private Limited |
| `SECTION 2B – BUSINESS KYC – LLP` | Business KYC – LLP |
| `SECTION 2C – BUSINESS KYC – PARTNERSHIP FIRM` | Business KYC – Partnership Firm |
| `SECTION 2D – BUSINESS KYC – SELF EMPLOYED / PROPRIETOR` | Business KYC – Self Employed / Proprietor |
| `SECTION 3A – ASSET WISE – HOUSING LOAN / LAP` | Asset Wise – Housing Loan / LAP |
| `SECTION 3B – ASSET WISE – FLEET / EV FINANCING` | Asset Wise – Fleet / EV Financing |
| `SECTION 3C – ASSET WISE – MACHINERY / EQUIPMENT (MM PRODUCT)` | Asset Wise – Machinery / Equipment |
| `SECTION 4 – SUPPORTING / PROGRAM SPECIFIC DOCUMENTS` | Supporting / Program Specific Documents |

### Field Keys (document labels)
Each field is a column. Value = label shown in form. `Empty` = omit from form.

**77 field keys** in format `Field N.X` or `Field NA.M` (e.g. `Field 1A.1`, `Field 2C.10`).

---

## Section → Field Mapping

### Section 1A – PERSONAL KYC (Applicants)
| Field Key | Example Label |
|-----------|---------------|
| Field 1A.1 | PAN Card |
| Field 1A.2 | Aadhaar Card / Passport / Voter ID |
| Field 1A.3 | Passport Size Photograph |
| Field 1A.4 | Residence Address Proof (Utility Bill / Rent Agreement) |
| Field 1A.5 | Personal Bank Statement – Last 6/12 Months |
| Field 1A.6 | ITR – Last 2 Years |
| Field 1A.7 | Personal Cheque |

### Section 1B – PERSONAL KYC (Co-Applicants)
| Field Key | Example Label |
|-----------|---------------|
| Field 1B.1 | PAN Card |
| Field 1B.2 | Aadhaar Card / Passport / Voter ID / Driving License |
| Field 1B.3 | Passport Size Photograph |
| Field 1B.4 | Residence Address Proof |
| Field 1B.5 | Personal Bank Statement – Last 6 Months |
| Field 1B.6 | ITR – Last 2 Years |
| Field 1B.7 | Personal Cheque |

### Section 2A – BUSINESS KYC – PRIVATE LIMITED
| Field Key | Example Label |
|-----------|---------------|
| Field 2A.1 | Certificate of Incorporation (COI) |
| Field 2A.2 | Company PAN Card |
| Field 2A.3 | GST Certificate |
| Field 2A.4 | MSME or Udyam certificate |
| Field 2A.5 | MOA & AOA |
| Field 2A.6 | Board Resolution for Borrowing |
| Field 2A.7 | Company Address Proof |
| Field 2A.8 | Company Bank Statement – 12 Months |
| Field 2A.9 | Company ITR – Last 2 Years |
| Field 2A.10 | Latest Audited Financials |
| Field 2A.11 | GST 3B – Last 12 Months |
| Field 2A.12 | Security Cheques - 6 |

### Section 2B – BUSINESS KYC – LLP
| Field Key | Example Label |
|-----------|---------------|
| Field 2B.1 | LLP Incorporation Certificate |
| Field 2B.2 | LLP Agreement |
| Field 2B.3 | LLP PAN Card |
| Field 2B.4 | GST Certificate |
| Field 2B.5 | LLP Bank Statement – 12 Months |
| Field 2B.6 | LLP ITR – Last 2 Years |
| Field 2B.7 | Partner KYC Documents |
| Field 2B.8 | Security Cheques - 6 |

### Section 2C – BUSINESS KYC – PARTNERSHIP FIRM
| Field Key | Example Label |
|-----------|---------------|
| Field 2C.1 | Partnership Deed |
| Field 2C.2 | Registration Certificate |
| Field 2C.3 | MSME or Udyam certificate |
| Field 2C.4 | Firm PAN Card |
| Field 2C.5 | GST Certificate |
| Field 2C.6 | Firm Bank Statement – 12 Months |
| Field 2C.7 | Firm ITR – Last 2 Years |
| Field 2C.8 | GST 3B – Last 12 Months |
| Field 2C.9 | List of Partners with Shareholding Pattern |
| Field 2C.10 | Security Cheques - 6 |

### Section 2D – BUSINESS KYC – SELF EMPLOYED / PROPRIETOR
| Field Key | Example Label |
|-----------|---------------|
| Field 2D.1 | GST / Trade License / Udyam Registration |
| Field 2D.2 | Business PAN (if applicable) |
| Field 2D.3 | Business Bank Statement – 12 Months |
| Field 2D.4 | ITR – Last 2 Years with Computation |
| Field 2D.5 | Balance Sheet & P&L |
| Field 2D.6 | Office Address Proof |
| Field 2D.7 | Security Cheques - 6 |

### Section 3A – ASSET WISE – HOUSING LOAN / LAP
| Field Key | Example Label |
|-----------|---------------|
| Field 3A.1 | Sale Deed / Title Deed |
| Field 3A.2 | Mother Deed / Chain Documents |
| Field 3A.3 | Encumbrance Certificate (EC) |
| Field 3A.4 | Khata / Property Tax Receipt |
| Field 3A.5 | Approved Building Plan |
| Field 3A.6 | Occupancy / Completion Certificate |
| Field 3A.7 | Latest Electricity / Water Bill |

### Section 3B – ASSET WISE – FLEET / EV FINANCING
| Field Key | Example Label |
|-----------|---------------|
| Field 3B.1 | Vehicle Proforma Invoice |
| Field 3B.2 | Dealer Quotation |
| Field 3B.3 | RC Copy (if takeover) |
| Field 3B.4 | Existing Loan Statement (BT cases) |
| Field 3B.5 | Insurance Copy |
| Field 3B.6 | Permit Copy (if commercial vehicle) |

### Section 3C – ASSET WISE – MACHINERY / EQUIPMENT (MM PRODUCT)
| Field Key | Example Label |
|-----------|---------------|
| Field 3C.1 | Proforma Invoice |
| Field 3C.2 | Purchase Order (PO) |
| Field 3C.3 | Goods Receipt Note (GRN) |
| Field 3C.4 | Tax Invoice |
| Field 3C.5 | Payment Receipt / Bank Proof |
| Field 3C.6 | Supplier KYC |

### Section 4 – SUPPORTING / PROGRAM SPECIFIC DOCUMENTS
| Field Key | Example Label |
|-----------|---------------|
| Field 4.1 | Existing Loan Sanction Letter |
| Field 4.2 | Loan Repayment Track – Last 6–12 Months |
| Field 4.3 | NACH / ECS Mandate |
| Field 4.4 | Beneficial Ownership Declaration |
| Field 4.5 | Processing Fee Cheque Copy |
| Field 4.6 | Rental Agreement (if rental income considered) |
| Field 4.7 | Stock Statement (if CC/OD based assessment) |

---

## Products (8)

| Product ID | Product Name |
|------------|--------------|
| LP011 | MoneyMultiplier |
| LP014 | Term Loan |
| LP013 | Loan Against Property |
| LP012 | Working Capital |
| LP008 | Credit Card |
| LP010 | Vehicle Loan (EV) |
| LP009 | RBF (EV) |

---

## Application Form Data Flow

1. **Client selects Loan Product** (e.g. LP008 Credit Card)
2. **GET /client/form-config?productId=LP008** → returns categories (sections) with fields
3. **Only sections with Y** and **fields with non-Empty labels** are included
4. **NewApplication** renders each category as a Card; each field uses 3-radio UI: "Added to link" | "To be shared" | "Not available"
5. **form_data** stores `fieldId: value` (e.g. `field-1a.1: "added_to_link"`)
6. **Submit** → POST to Loan Applications with `form_data`

---

## For Redesign

- All fields are **document-type** (file upload status: Added to link / To be shared / Not available)
- Sections are **product-specific** – each product enables different sections/fields
- Current UI: flat list of categories with radio groups per field
- Redesign can improve: layout, grouping, progress, validation, mobile UX
