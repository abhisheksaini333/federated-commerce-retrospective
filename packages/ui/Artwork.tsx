import React from "react";
import type { Product } from "../contracts";

/** Original CSS product illustrations; no external image requests. */
export function Artwork({
  kind,
  hero = false,
}: {
  kind: Product["artwork"];
  hero?: boolean;
}) {
  return (
    <div
      className={`artwork ${kind}${hero ? " hero-artwork" : ""}`}
      aria-hidden="true"
    >
      <div className="object">
        <span className="object-label">
          {kind === "notebook" ? (
            <>
              FIELD
              <br />
              NOTES<span className="small-label">A PLACE TO BEGIN</span>
            </>
          ) : kind === "tote" ? (
            <>
              fieldwork<span className="small-label">TAKE THE LONG WAY.</span>
            </>
          ) : kind === "bottle" ? (
            "fw."
          ) : (
            ""
          )}
        </span>
      </div>
      <i className="detail detail-one" />
      <i className="detail detail-two" />
      <i className="detail detail-three" />
    </div>
  );
}
