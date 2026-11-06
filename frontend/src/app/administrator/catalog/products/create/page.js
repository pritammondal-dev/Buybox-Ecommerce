"use client";

import React from "react";
import ProductEditor from "@/components/catalog/ProductEditor";

export default function AdminProductCreatePage() {
  return <ProductEditor mode="create" portal="admin" />;
}
