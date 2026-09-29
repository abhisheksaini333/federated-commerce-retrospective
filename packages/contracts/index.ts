/** Shared wire and component contracts. Runtime validation remains the API's responsibility. */
export type Category = "Desk" | "Carry" | "Tools";
export type Shipping = "standard" | "express";
export interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  priceCents: number;
  stock: number;
  color: string;
  artwork: "notebook" | "pencil" | "tote" | "bottle" | "lamp" | "tray";
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface CheckoutRequest {
  items: CartItem[];
  customerName: string;
  shipping: Shipping;
}
export interface OrderLine extends CartItem {
  name: string;
  unitPriceCents: number;
}
export interface Order {
  id: string;
  items: OrderLine[];
  customerName: string;
  shipping: Shipping;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  status: "placed" | "fulfilled";
}
export interface ApiError {
  error: string;
  code: string;
}
export interface CatalogProps {
  products: Product[];
  onAdd: (product: Product) => void;
}
export interface CartProps {
  products: Product[];
  items: CartItem[];
  onQuantity: (id: string, quantity: number) => void;
  onCheckout: () => void;
}
export const shippingCents = (shipping: Shipping, subtotal: number) =>
  shipping === "express" ? 1200 : subtotal >= 7500 ? 0 : 600;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
