"use client";

import { useState, useEffect, useCallback } from "react";
import { productService } from "../services/product.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";

/**
 * Reusable Products Hook for Client Components
 *
 * For Server Components, call `productService.getProducts(params)` directly.
 *
 * @param {Object} [initialParams]
 * @param {boolean} [autoFetch=true]
 */
export function useProducts(initialParams = {}, autoFetch = true) {
  const [params, setParams] = useState(initialParams);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(Boolean(autoFetch));
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async (customParams = null) => {
    const queryParams = customParams || params;
    setIsLoading(true);
    setError(null);

    try {
      const response = await productService.getProducts(queryParams);
      const data = response?.data?.products || response?.data || [];
      const responseMeta = response?.meta || {
        page: queryParams.page || 1,
        limit: queryParams.limit || 20,
        total: data.length,
        totalPages: 1,
      };

      setProducts(data);
      setMeta(responseMeta);
      setIsLoading(false);
      return { products: data, meta: responseMeta };
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      setIsLoading(false);
      throw normalized;
    }
  }, [params]);

  useEffect(() => {
    if (!autoFetch) return;

    let isSubscribed = true;

    productService
      .getProducts(params)
      .then((response) => {
        if (!isSubscribed) return;
        const data = response?.data?.products || response?.data || [];
        const responseMeta = response?.meta || {
          page: params.page || 1,
          limit: params.limit || 20,
          total: data.length,
          totalPages: 1,
        };
        setProducts(data);
        setMeta(responseMeta);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        const normalized = normalizeApiError(err);
        setError(normalized.message);
        setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [autoFetch, params]);

  return {
    products,
    meta,
    isLoading,
    error,
    params,
    setParams,
    refetch: fetchProducts,
  };
}

export default useProducts;
