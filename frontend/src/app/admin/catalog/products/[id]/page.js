"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProductEditor from "@/components/catalog/ProductEditor";

export default function AdminEditProductPage() {
  const params = useParams();
  const productId = params?.id;

  return (
    <ProductEditor
      mode="edit"
      portal="admin"
      productId={productId}
    />
  );
}
