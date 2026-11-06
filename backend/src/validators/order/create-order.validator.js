const { z } = require("zod");

const guestAddressSchema = z
  .object({
    fullName: z.string().trim().max(150).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    phone: z.string().trim().min(5, "Valid phone number is required").max(20),
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(200),
    addressLine2: z.string().trim().max(200).optional().default(""),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().min(1, "State is required").max(100),
    postalCode: z.string().trim().min(3, "Postal code is required").max(20),
    country: z.string().trim().max(2).toUpperCase().default("IN"),
  })
  .refine((data) => Boolean(data.fullName || data.firstName), {
    message: "Full name or first name is required",
    path: ["fullName"],
  });

const createOrderSchema = z
  .object({
    shippingAddressId: z
      .string()
      .regex(
        /^[0-9a-fA-F]{24}$/,
        "Invalid shipping address ID"
      )
      .optional()
      .nullable(),

    guestShippingAddress: guestAddressSchema.optional().nullable(),

    guestEmail: z
      .string()
      .trim()
      .email("Valid email required for guest order updates")
      .optional()
      .nullable(),

    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((value) => value.toUpperCase())
      .optional()
      .nullable(),

    deliveryOptionId: z
      .string()
      .trim()
      .max(50)
      .optional()
      .default("standard"),

    quoteReference: z
      .string()
      .trim()
      .max(10000)
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.shippingAddressId || data.guestShippingAddress),
    {
      message: "Either shippingAddressId or guestShippingAddress must be provided",
      path: ["shippingAddressId"],
    }
  );

const checkoutQuoteSchema = z
  .object({
    shippingAddressId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid shipping address ID")
      .optional()
      .nullable(),

    guestShippingAddress: guestAddressSchema.optional().nullable(),

    couponCode: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .transform((value) => value.toUpperCase())
      .optional()
      .nullable(),

    deliveryOptionId: z
      .string()
      .trim()
      .max(50)
      .optional()
      .default("standard"),
  })
  .strict();

module.exports = {
  createOrderSchema,
  checkoutQuoteSchema,
  guestAddressSchema,
};

