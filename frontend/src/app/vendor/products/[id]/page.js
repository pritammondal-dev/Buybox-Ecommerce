"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProductEditor from "@/components/catalog/ProductEditor";

export default function VendorProductDetailPage() {
  const params = useParams();
  const productId = params?.id;

  return (
    <ProductEditor
      mode="edit"
      portal="vendor"
      productId={productId}
    />
  );
}
