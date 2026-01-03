import { createSlug } from '../utils/slug';

describe('createSlug', () => {
  describe('basic functionality', () => {
    it('should convert text to lowercase', () => {
      expect(createSlug('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(createSlug('hello world test')).toBe('hello-world-test');
    });

    it('should remove special characters', () => {
      expect(createSlug('hello! world? test.')).toBe('hello-world-test');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(createSlug('hello   world')).toBe('hello-world');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(createSlug('  hello world  ')).toBe('hello-world');
    });
  });

  describe('German umlaut handling', () => {
    it('should convert ä to ae', () => {
      expect(createSlug('Käse')).toBe('kaese');
    });

    it('should convert ö to oe', () => {
      expect(createSlug('Öl')).toBe('oel');
    });

    it('should convert ü to ue', () => {
      expect(createSlug('Tür')).toBe('tuer');
    });

    it('should convert ß to ss', () => {
      expect(createSlug('Straße')).toBe('strasse');
    });

    it('should handle multiple umlauts', () => {
      expect(createSlug('Überwachungskämera')).toBe('ueberwachungskaemera');
    });

    it('should handle uppercase umlauts', () => {
      expect(createSlug('ÜBER')).toBe('ueber');
    });
  });

  describe('real-world SEO keywords', () => {
    it('should handle "Body Cam"', () => {
      expect(createSlug('Body Cam')).toBe('body-cam');
    });

    it('should handle "Überwachungskamera Test"', () => {
      expect(createSlug('Überwachungskamera Test')).toBe('ueberwachungskamera-test');
    });

    it('should handle "Dashcam Test 2024"', () => {
      expect(createSlug('Dashcam Test 2024')).toBe('dashcam-test-2024');
    });

    it('should handle "Körperkamera für Polizei"', () => {
      expect(createSlug('Körperkamera für Polizei')).toBe('koerperkamera-fuer-polizei');
    });

    it('should handle "Beste Body-Cam Kaufen"', () => {
      expect(createSlug('Beste Body-Cam Kaufen')).toBe('beste-body-cam-kaufen');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(createSlug('')).toBe('');
    });

    it('should handle numbers only', () => {
      expect(createSlug('12345')).toBe('12345');
    });

    it('should handle mixed content', () => {
      expect(createSlug('Test-123_ABC!')).toBe('test-123-abc');
    });

    it('should handle only special characters', () => {
      expect(createSlug('!@#$%')).toBe('');
    });
  });
});
