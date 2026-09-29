declare module "catalog/Catalog" {
  const Catalog: import("react").ComponentType<
    import("../../packages/contracts").CatalogProps
  >;
  export default Catalog;
}
declare module "cart/Cart" {
  const Cart: import("react").ComponentType<
    import("../../packages/contracts").CartProps
  >;
  export default Cart;
}
declare const __EAGER_CART__: boolean;
