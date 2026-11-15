/** India state codes from Experian / bureau address.state_code. */
export const STATE_BY_CODE: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
};

export function mapStateCodeToName(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return '';
  return STATE_BY_CODE[trimmed] || trimmed;
}

/** Match mapped state name to a dropdown option (case-insensitive). */
export function matchStateDropdownOption(
  mappedName: string,
  options: Array<{ value: string; label: string }>
): string {
  const needle = mappedName.trim().toLowerCase();
  if (!needle) return '';
  const hit = options.find(
    (opt) =>
      opt.value.trim().toLowerCase() === needle ||
      opt.label.trim().toLowerCase() === needle
  );
  return hit?.value ?? '';
}
