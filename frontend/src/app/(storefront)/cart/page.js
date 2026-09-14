import React from "react";
import { CartPageView } from "../../../components/storefront/cart/CartPageView.jsx";

export const metadata = {
  title: "Shopping Cart | Buybox",
  description: "View and manage items in your Buybox shopping cart.",
};

export default function CartPage() {
  return <CartPageView />;
}
