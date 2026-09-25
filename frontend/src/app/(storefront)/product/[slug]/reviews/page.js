import React from "react";
import { notFound } from "next/navigation";
import { productService } from "../../../../../services/product.service.js";
import { reviewService } from "../../../../../services/review.service.js";
import { ProductReviewsPageView } from "./ProductReviewsPageView.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    let res;
    try {
      res = await productService.getProductBySlug(slug);
    } catch {
      res = await productService.getProductById(slug);
    }
    const product = res?.data?.product || res?.data;

    if (product) {
      return {
        title: `Customer Reviews: ${product.name} | Buybox`,
        description: `Read verified customer ratings, honest reviews, and audio feedback for ${product.name} on Buybox.`,
      };
    }
  } catch {
    // fallback
  }

  return {
    title: "Customer Reviews | Buybox",
    description: "Read verified customer reviews for products on Buybox.",
  };
}

export default async function ProductReviewsPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let product = null;
  let reviews = [];

  try {
    let res;
    try {
      res = await productService.getProductBySlug(slug);
    } catch {
      res = await productService.getProductById(slug);
    }
    product = res?.data?.product || res?.data;

    if (!product) {
      notFound();
    }

    const reviewsRes = await reviewService.getProductReviews(product._id || product.id);
    reviews = Array.isArray(reviewsRes?.data) ? reviewsRes.data : reviewsRes?.data?.reviews || [];
  } catch (err) {
    if (!product) {
      notFound();
    }
  }

  return <ProductReviewsPageView product={product} initialReviews={reviews} />;
}
