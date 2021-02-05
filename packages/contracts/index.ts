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
  version: number;
  id: string;
  items: OrderLine[];
  customerName: string;
  shipping: Shipping;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  status: "placed" | "fulfilled" | "cancelled";
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
export function assertCents(cents:number):void {
 if(!Number.isSafeInteger(cents)||cents<0)throw new RangeError('Money must be non-negative safe integer cents.');
}
export function shippingCents(shipping:Shipping,subtotal:number):number {
 assertCents(subtotal);
 if(shipping!=='standard'&&shipping!=='express')throw new RangeError('Unknown delivery option.');
 return shipping==='express'?1200:subtotal>=7500?0:600;
}
const currencyFormatter=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
export function money(cents:number):string {
 assertCents(cents);
 return currencyFormatter.formatToParts(BigInt(cents)/100n).map(part=>part.type==='fraction'?String(cents%100).padStart(2,'0'):part.value).join('');
}
