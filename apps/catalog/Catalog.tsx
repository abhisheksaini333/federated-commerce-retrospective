import {matchesSearch,sortProducts,SortOrder} from "./search";
import React, { useState } from "react";
import {
  type CatalogProps,
  type Category,
  money,
} from "../../packages/contracts";
import { Artwork } from "../../packages/ui/Artwork";

export default function Catalog({ products, onAdd,filters,onFilters }: CatalogProps) {
  const {category,search}=filters;
  const setCategory=(category:typeof filters.category)=>onFilters({...filters,category});
  const setSearch=(search:string)=>onFilters({...filters,search});
  const filtered = sortProducts(products.filter(
    (product) =>
      (category === "All finds" || product.category === category) &&
      matchesSearch(product,search),
  ),filters.sort??"featured");
  return (
    <section
      id="collection"
      aria-labelledby="collection-title"
      className="collection"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE EVERYDAY COLLECTION</span>
          <h2 id="collection-title">Small things. Well considered.</h2>
        </div>
        <p>Useful by nature. Good to have around.</p>
      </div>
      <div className="collection-toolbar">
        <div className="filters" aria-label="Filter by category">
          {(["All finds", "Desk", "Carry", "Tools"] as const).map((item) => (
            <button
              key={item}
              aria-pressed={category === item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label>Sort finds <select value={filters.sort??'featured'} onChange={event=>onFilters({...filters,sort:event.target.value as SortOrder})}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label>
        <label className="search-label">
          <span className="sr-only">Search the collection</span>
          <input
            type="search"
            placeholder="Find your everyday…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <p className="result-count" role="status">
        {filtered.length} considered finds
      </p>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No finds just yet.</h3>
          <p>Try a different word or explore the whole collection.</p>
          <button
            className="button"
            onClick={() => {
              onFilters({search:"",category:"All finds"});
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((product, index) => (
            <article className="product-card" key={product.id}>
              <div
                className="product-art"
                style={{ backgroundColor: product.color }}
              >
                <span className="product-number">0{index + 1} / FIELDWORK</span>
                <Artwork kind={product.artwork} />
                {product.stock <= 4 && (
                  <span className="stock-tag">
                    {product.stock > 0
                      ? `${product.stock} left for now`
                      : "Back soon"}
                  </span>
                )}
              </div>
              <div className="product-meta">
                <span className="eyebrow">{product.category}</span>
                <span>{money(product.priceCents)}</span>
              </div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <button
                className="add-button"
                onClick={() => onAdd(product)}
                disabled={product.stock === 0}
                aria-label={`Add ${product.name}`}
              >
                {product.stock === 0 ? "Out of stock" : "Add to bag"}
                <span aria-hidden="true">+</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
