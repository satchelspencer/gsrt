import "regenerator-runtime/runtime.js";
import React from "react";
import ReactDOM from "react-dom";
import { Root } from "./src/app";

const root = document.createElement("div");
root.id = "root";
document.body.appendChild(root);

ReactDOM.render(<Root/>, root);
