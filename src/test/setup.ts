import '@testing-library/jest-dom';

// Mock window.scrollTo for jsdom
Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});
