import { Injectable } from '@nestjs/common';
import { SensitivityTag } from '../generated/prisma/enums';

/** Fraction of sampled values that must match a pattern to auto-tag by value. */
const VALUE_MATCH_THRESHOLD = 0.7;
/** Cap how many values we inspect per column for performance. */
const SAMPLE_SIZE = 200;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 7-15 digits, optionally with +, spaces, dashes, parens.
const PHONE_ALLOWED_RE = /^\+?[\d\s()\-.]{7,}$/;

/** Column-name keyword hints per category (checked as substrings, lowercased). */
const NAME_HINTS: Record<string, string[]> = {
  EMAIL: ['email', 'e-mail', 'mail'],
  PHONE: ['phone', 'mobile', 'cell', 'tel', 'contact number', 'contactnumber'],
  CREDIT_CARD: ['credit', 'card number', 'cardnumber', 'ccnum', 'creditcard'],
  ID: [
    'ssn',
    'social security',
    'passport',
    'national id',
    'nationalid',
    'aadhaar',
    'tax id',
    'taxid',
  ],
  NAME: ['name', 'firstname', 'lastname', 'fullname', 'surname'],
  ADDRESS: [
    'address',
    'street',
    'city',
    'zip',
    'zipcode',
    'postal',
    'postcode',
  ],
  DATE: ['date', 'dob', 'birth', 'created', 'updated', 'timestamp'],
};

/**
 * Auto-tags columns that look like sensitive data using simple, explainable
 * pattern matching on the column name and a sample of its values. Also exposes
 * per-value format validation reused by the quality checks.
 */
@Injectable()
export class ClassificationService {
  classifyColumn(name: string, values: string[]): SensitivityTag {
    const lower = name.toLowerCase();
    const sample = values.filter((v) => v !== '').slice(0, SAMPLE_SIZE);

    const frac = (pred: (v: string) => boolean): number => {
      if (sample.length === 0) return 0;
      return sample.filter(pred).length / sample.length;
    };

    // Pass 1: trust the column name. A human-authored header is a stronger,
    // less ambiguous signal than value shape (e.g. "signup_date" holds
    // digit-and-dash values that could otherwise look like phone numbers).
    const byName = this.classifyByName(lower);
    if (byName !== SensitivityTag.NONE) return byName;

    // Pass 2: fall back to value patterns. Date is checked before phone since
    // date strings can satisfy the loose phone digit test.
    if (frac((v) => EMAIL_RE.test(v)) >= VALUE_MATCH_THRESHOLD) {
      return SensitivityTag.EMAIL;
    }
    if (frac((v) => this.isCreditCard(v)) >= VALUE_MATCH_THRESHOLD) {
      return SensitivityTag.CREDIT_CARD;
    }
    if (frac((v) => this.isDate(v)) >= VALUE_MATCH_THRESHOLD) {
      return SensitivityTag.DATE;
    }
    if (frac((v) => this.isPhone(v)) >= VALUE_MATCH_THRESHOLD) {
      return SensitivityTag.PHONE;
    }
    return SensitivityTag.NONE;
  }

  /** Match a column purely by its (lowercased) name. */
  private classifyByName(lower: string): SensitivityTag {
    if (NAME_HINTS.EMAIL.some((h) => lower.includes(h))) {
      return SensitivityTag.EMAIL;
    }
    if (NAME_HINTS.CREDIT_CARD.some((h) => lower.includes(h))) {
      return SensitivityTag.CREDIT_CARD;
    }
    if (NAME_HINTS.PHONE.some((h) => lower.includes(h))) {
      return SensitivityTag.PHONE;
    }
    if (this.isIdName(lower)) {
      return SensitivityTag.ID;
    }
    // "date" is checked before "name": "date" is unambiguous, whereas some
    // hints could co-occur.
    if (NAME_HINTS.DATE.some((h) => lower.includes(h))) {
      return SensitivityTag.DATE;
    }
    if (NAME_HINTS.NAME.some((h) => lower.includes(h))) {
      return SensitivityTag.NAME;
    }
    if (NAME_HINTS.ADDRESS.some((h) => lower.includes(h))) {
      return SensitivityTag.ADDRESS;
    }
    return SensitivityTag.NONE;
  }

  /** True for `id`, `*_id`, `* id`, or explicit identifier keywords. */
  private isIdName(lower: string): boolean {
    if (lower === 'id' || /(_| )id$/.test(lower)) return true;
    return NAME_HINTS.ID.some((h) => lower.includes(h));
  }

  /**
   * Whether a value is validly formatted for its tag. Used by quality checks to
   * flag "obviously invalid" values (e.g. a malformed email in an email column).
   * Tags without a strict format always return true.
   */
  isValidForTag(tag: SensitivityTag, value: string): boolean {
    switch (tag) {
      case SensitivityTag.EMAIL:
        return EMAIL_RE.test(value);
      case SensitivityTag.PHONE:
        return this.isPhone(value);
      case SensitivityTag.CREDIT_CARD:
        return this.isCreditCard(value);
      default:
        return true;
    }
  }

  private isPhone(value: string): boolean {
    if (!PHONE_ALLOWED_RE.test(value)) return false;
    // A date like 2023-01-15 satisfies the loose phone shape — exclude it.
    if (this.isDate(value)) return false;
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  private isCreditCard(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    return this.luhnValid(digits);
  }

  private luhnValid(digits: string): boolean {
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (double) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      double = !double;
    }
    return sum % 10 === 0;
  }

  private isDate(value: string): boolean {
    // Require a date-ish shape before trusting Date.parse (which is lax).
    if (!/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(value)) return false;
    const t = Date.parse(value);
    return !Number.isNaN(t);
  }
}
