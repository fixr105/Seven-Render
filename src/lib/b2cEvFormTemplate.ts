import { B2C_EV_FORM_TEMPLATE_ID } from '../config/forms/b2cEvFormSchema';
import { parseFormDataField } from './mergeFormDataPatch';

export { B2C_EV_FORM_TEMPLATE_ID };

export function isB2cEvFormTemplate(formData: Record<string, unknown>): boolean {
  const template = formData['_meta.formTemplate'];
  return template === B2C_EV_FORM_TEMPLATE_ID;
}

export function parseApplicationFormData(application: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!application) return {};
  const rawForm =
    application.form_data ??
    application.formData ??
    application['Form Data'];
  return parseFormDataField(rawForm);
}
