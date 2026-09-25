import React from "react";
import { notFound } from "next/navigation";
import { productService } from "../../../../../services/product.service.js";
import { questionService } from "../../../../../services/question.service.js";
import { ProductQuestionsPageView } from "./ProductQuestionsPageView.jsx";

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
        title: `Questions & Answers: ${product.name} | Buybox`,
        description: `Community questions and verified answers regarding compatibility, specs, and features for ${product.name} on Buybox.`,
      };
    }
  } catch {
    // fallback
  }

  return {
    title: "Product Q&A | Buybox",
    description: "Browse questions and answers from verified customers and vendors on Buybox.",
  };
}

export default async function ProductQuestionsPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let product = null;
  let questions = [];

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

    const qRes = await questionService.getProductQuestions(product._id || product.id);
    questions = Array.isArray(qRes?.data) ? qRes.data : qRes?.data?.questions || [];
  } catch {
    if (!product) {
      notFound();
    }
  }

  return <ProductQuestionsPageView product={product} initialQuestions={questions} />;
}
