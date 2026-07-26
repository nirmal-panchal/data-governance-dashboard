import { ClassificationService } from './classification.service';
import { SensitivityTag } from '../generated/prisma/enums';

describe('ClassificationService', () => {
  const service = new ClassificationService();

  describe('classifyColumn — by column name', () => {
    it('tags an email column', () => {
      expect(service.classifyColumn('email', [])).toBe(SensitivityTag.EMAIL);
      expect(service.classifyColumn('Work E-Mail', [])).toBe(
        SensitivityTag.EMAIL,
      );
    });

    it('tags phone, name, and address columns', () => {
      expect(service.classifyColumn('mobile_phone', [])).toBe(
        SensitivityTag.PHONE,
      );
      expect(service.classifyColumn('full_name', [])).toBe(
        SensitivityTag.NAME,
      );
      expect(service.classifyColumn('street_address', [])).toBe(
        SensitivityTag.ADDRESS,
      );
    });

    it('tags id columns but not words merely ending in "id"', () => {
      expect(service.classifyColumn('id', [])).toBe(SensitivityTag.ID);
      expect(service.classifyColumn('user_id', [])).toBe(SensitivityTag.ID);
      expect(service.classifyColumn('valid', [])).toBe(SensitivityTag.NONE);
    });
  });

  describe('classifyColumn — by value pattern', () => {
    it('detects emails from values when the name is unhelpful', () => {
      const values = ['a@b.com', 'c@d.org', 'e@f.net', 'g@h.io'];
      expect(service.classifyColumn('contact', values)).toBe(
        SensitivityTag.EMAIL,
      );
    });

    it('detects credit cards via the Luhn check', () => {
      // Valid test Visa numbers (Luhn-valid).
      const values = ['4111111111111111', '4012888888881881'];
      expect(service.classifyColumn('payment', values)).toBe(
        SensitivityTag.CREDIT_CARD,
      );
    });

    it('does NOT misclassify date values as phone numbers', () => {
      // Regression: dates like 2023-01-15 satisfy the loose phone shape.
      const dates = ['2023-01-15', '2024-06-30', '2022-12-01', '2021-03-09'];
      expect(service.classifyColumn('captured', dates)).toBe(
        SensitivityTag.DATE,
      );
    });

    it('leaves free-text columns unclassified', () => {
      expect(
        service.classifyColumn('comment', ['great', 'ok', 'bad']),
      ).toBe(SensitivityTag.NONE);
    });
  });

  describe('isValidForTag', () => {
    it('flags malformed emails as invalid', () => {
      expect(service.isValidForTag(SensitivityTag.EMAIL, 'a@b.com')).toBe(true);
      expect(service.isValidForTag(SensitivityTag.EMAIL, 'not-an-email')).toBe(
        false,
      );
    });

    it('treats tags without a strict format as always valid', () => {
      expect(service.isValidForTag(SensitivityTag.NAME, 'anything')).toBe(true);
    });
  });
});
