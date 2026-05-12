---
globs: "**/*.test.ts,**/*.spec.ts,**/__tests__/**/*.ts"
---

# Testing Rules

## Structure
- Use `describe` blocks to group tests by function or method
- Use nested `describe` for subcategories: happy path, edge cases, error cases
- Use `it` (not `test`) for individual test cases
- One logical assertion per test — multiple `expect` calls are fine if they assert on the same behavior

## Naming
- `describe` blocks: use the function/class name, no "should" prefix
- `it` blocks: describe the expected behavior as a specification
  - Good: `it('returns null when the key does not exist')`
  - Bad: `it('should work')`, `it('test getUserById')`

## Arrange-Act-Assert
Every test follows the AAA pattern:
```typescript
it('computes the total with tax', () => {
  // Arrange
  const cart = createCart([{ price: 100, quantity: 2 }]);

  // Act
  const total = cart.computeTotal({ taxRate: 0.1 });

  // Assert
  expect(total).toBe(220);
});
```

## Assertions
- Use exact equality where possible: `toBe`, `toEqual`, `toStrictEqual`
- Avoid loose matchers: `toBeTruthy()`, `toBeDefined()` alone are insufficient
- For async: `await expect(fn()).resolves.toEqual(...)` or `await expect(fn()).rejects.toThrow(...)`
- For floating point: `toBeCloseTo(expected, precision)`

## Mocking
- Reset all mocks in `beforeEach`: `vi.resetAllMocks()` or `jest.resetAllMocks()`
- Type your mocks — `vi.fn<[ArgType], ReturnType>()`
- Mock at the boundary (HTTP, DB, filesystem), not internal modules
- Prefer dependency injection over module-level mocking

## Test Independence
- No shared mutable state between tests
- Each test creates its own fixtures
- Use `beforeEach` for common setup, never `beforeAll` with mutable state
- Tests must pass when run individually or in any order

## Coverage
- Aim for meaningful coverage, not line-count coverage
- Every public function needs at least: one happy path, one edge case, one error case
- Don't test private implementation details — test through the public API
