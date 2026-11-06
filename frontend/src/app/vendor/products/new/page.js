"use client";

import React from "react";
import ProductEditor from "@/components/catalog/ProductEditor";

export default function NewVendorProductPage() {
  return <ProductEditor mode="create" portal="vendor" />;
}
