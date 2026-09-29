import type { Product } from "../../packages/contracts";

export const seedProducts: Product[] = [
  {
    id: "notebook",
    name: "Everyday notebook",
    category: "Desk",
    description:
      "A little space for your next big idea. 160 dotted pages, made for the everyday.",
    priceCents: 2400,
    stock: 12,
    color: "#d5d9a8",
    artwork: "notebook",
  },
  {
    id: "pencil",
    name: "The pencil set",
    category: "Tools",
    description:
      "Six well-balanced pencils. For rough sketches and considered words.",
    priceCents: 1800,
    stock: 24,
    color: "#ead5b9",
    artwork: "pencil",
  },
  {
    id: "tote",
    name: "Sunday carryall",
    category: "Carry",
    description: "Room for a book, a market find, and a very open afternoon.",
    priceCents: 4200,
    stock: 8,
    color: "#e6cbbd",
    artwork: "tote",
  },
  {
    id: "bottle",
    name: "Trail flask",
    category: "Carry",
    description:
      "An easy companion for the long way home. 500 ml, double-walled.",
    priceCents: 3800,
    stock: 9,
    color: "#c6d5cd",
    artwork: "bottle",
  },
  {
    id: "lamp",
    name: "Evening desk light",
    category: "Desk",
    description: "A quiet pool of warm light for the good work still to come.",
    priceCents: 8600,
    stock: 4,
    color: "#dfd2aa",
    artwork: "lamp",
  },
  {
    id: "tray",
    name: "Catchall tray",
    category: "Desk",
    description:
      "A landing place for keys, paper clips, and pocket-sized things.",
    priceCents: 2800,
    stock: 10,
    color: "#d2cedc",
    artwork: "tray",
  },
];
