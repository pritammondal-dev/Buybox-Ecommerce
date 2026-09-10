const {
  updateAddressSchema,
} = require("../src/validators/address/update-address.validator");

describe("Address Update Validator (BUG-03)", () => {
  it("exports updateAddressSchema with a safeParse method", () => {
    expect(updateAddressSchema).toBeDefined();
    expect(typeof updateAddressSchema.safeParse).toBe("function");
  });

  it("accepts a single-field partial update", () => {
    const result = updateAddressSchema.safeParse({
      phone: "9876543210",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      phone: "9876543210",
    });
  });

  it("accepts a multiple-field partial update", () => {
    const result = updateAddressSchema.safeParse({
      city: "Bengaluru",
      postalCode: "560001",
      state: "Karnataka",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      city: "Bengaluru",
      postalCode: "560001",
      state: "Karnataka",
    });
  });

  it("accepts a valid isDefault partial update", () => {
    const result = updateAddressSchema.safeParse({
      isDefault: true,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      isDefault: true,
    });
  });

  it("rejects invalid country, type, and phone values", () => {
    // Country not 2 characters
    const countryResult = updateAddressSchema.safeParse({
      country: "India",
    });
    expect(countryResult.success).toBe(false);

    // Invalid type (not in home, work, other)
    const typeResult = updateAddressSchema.safeParse({
      type: "vacation",
    });
    expect(typeResult.success).toBe(false);

    // Phone too short (min 7)
    const phoneResult = updateAddressSchema.safeParse({
      phone: "123",
    });
    expect(phoneResult.success).toBe(false);
  });

  it("rejects addressType and extra unknown fields", () => {
    const addressTypeResult = updateAddressSchema.safeParse({
      addressType: "home",
    });
    expect(addressTypeResult.success).toBe(false);
    expect(
      addressTypeResult.error.issues.some((issue) =>
        issue.message.includes("addressType")
      )
    ).toBe(true);

    const unknownFieldResult = updateAddressSchema.safeParse({
      phone: "9876543210",
      unexpectedProperty: true,
    });
    expect(unknownFieldResult.success).toBe(false);
    expect(
      unknownFieldResult.error.issues.some((issue) =>
        issue.message.includes("unexpectedProperty")
      )
    ).toBe(true);
  });

  it("rejects an empty body {}", () => {
    const result = updateAddressSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes("At least one field must be provided for update")
      )
    ).toBe(true);
  });
});
