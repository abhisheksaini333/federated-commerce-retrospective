import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles.css";

if (__EAGER_CART__)
  void import("cart/Cart").catch(() => {
    /* The visible boundary handles remote failure when opened. */
  });
ReactDOM.render(<App />, document.getElementById("root"));
