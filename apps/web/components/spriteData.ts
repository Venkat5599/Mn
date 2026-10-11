// Pixel sprites from the scrappypet landing hero (github.com/Venkat5599/Gameboy), extracted from its rendered markup.
// Two-frame sprites carry a .swim wrapper with .swim-a / .swim-b frames that alternate.
export type Sprite = { top: number; left: number; width: number; rotate: number; dur: number; delay: number; svg: string };

export const SPRITES: Sprite[] = [
  {
    "top": 7,
    "left": 4,
    "width": 132,
    "rotate": -6,
    "dur": 6.5,
    "delay": 0,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM3 6h1v1h-1zM8 6h1v1h-1zM2 7h2v1h-2zM7 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM4 6h1v1h-1zM9 6h1v1h-1zM3 7h2v1h-2zM8 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg></div>"
  },
  {
    "top": 10,
    "left": 20,
    "width": 26,
    "rotate": 0,
    "dur": 4.2,
    "delay": 0.6,
    "svg": "<svg viewBox=\"0 0 5 5\" shape-rendering=\"crispEdges\"><rect x=\"1\" y=\"0\" width=\"3\" height=\"5\" fill=\"#d4a017\"></rect><rect x=\"0\" y=\"1\" width=\"5\" height=\"3\" fill=\"#d4a017\"></rect><rect x=\"1\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffffff\"></rect></svg>"
  },
  {
    "top": 30,
    "left": 12,
    "width": 118,
    "rotate": 5,
    "dur": 5.2,
    "delay": 0.8,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM10 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM10 5h2v1h-2z\" fill=\"#ffae45\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM9 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM10 5h1v1h-1zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM9 5h1v1h-1z\" fill=\"#ffae45\"></path></svg></div>"
  },
  {
    "top": 55,
    "left": 3,
    "width": 84,
    "rotate": -4,
    "dur": 7,
    "delay": 0.3,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 8 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M2 0h4v1h-4zM1 1h6v1h-6zM0 2h2v1h-2zM3 2h2v1h-2zM6 2h2v1h-2zM0 3h8v1h-8zM1 4h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM3 6h1v1h-1zM6 6h1v1h-1zM4 7h1v1h-1z\" fill=\"#d4367c\"></path><path d=\"M2 2h1v1h-1zM5 2h1v1h-1z\" fill=\"#ffffff\"></path></svg><svg viewBox=\"0 0 8 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M2 0h4v1h-4zM1 1h6v1h-6zM0 2h2v1h-2zM3 2h2v1h-2zM6 2h2v1h-2zM0 3h8v1h-8zM2 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM1 6h1v1h-1zM4 6h1v1h-1zM7 6h1v1h-1zM3 7h1v1h-1z\" fill=\"#d4367c\"></path><path d=\"M2 2h1v1h-1zM5 2h1v1h-1z\" fill=\"#ffffff\"></path></svg></div>"
  },
  {
    "top": 44,
    "left": 22,
    "width": 18,
    "rotate": 0,
    "dur": 4.6,
    "delay": 1.4,
    "svg": "<svg viewBox=\"0 0 5 5\" shape-rendering=\"crispEdges\"><rect x=\"1\" y=\"0\" width=\"3\" height=\"5\" fill=\"#ffffff\"></rect><rect x=\"0\" y=\"1\" width=\"5\" height=\"3\" fill=\"#ffffff\"></rect><rect x=\"1\" y=\"1\" width=\"1\" height=\"1\" fill=\"#c4bbfd\"></rect></svg>"
  },
  {
    "top": 77,
    "left": 13,
    "width": 124,
    "rotate": 6,
    "dur": 5.8,
    "delay": 1.2,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M1 1h2v1h-2zM0 2h1v1h-1zM3 2h2v1h-2zM8 2h3v1h-3zM0 3h6v1h-6zM7 3h2v1h-2zM10 3h2v1h-2zM5 4h3v1h-3z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M1 4h4v1h-4zM8 4h1v1h-1zM11 4h1v1h-1zM4 5h3v1h-3z\" fill=\"#9b87ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M1 1h2v1h-2zM8 1h3v1h-3zM0 2h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h2v1h-2zM0 3h8v1h-8z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M11 3h1v1h-1zM1 4h6v1h-6z\" fill=\"#9b87ff\"></path></svg></div>"
  },
  {
    "top": 6,
    "left": 80,
    "width": 128,
    "rotate": 6,
    "dur": 6.2,
    "delay": 0.4,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M1 1h2v1h-2zM0 2h1v1h-1zM3 2h2v1h-2zM8 2h3v1h-3zM0 3h6v1h-6zM7 3h2v1h-2zM10 3h2v1h-2zM5 4h3v1h-3z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M1 4h4v1h-4zM8 4h1v1h-1zM11 4h1v1h-1zM4 5h3v1h-3z\" fill=\"#9b87ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M1 1h2v1h-2zM8 1h3v1h-3zM0 2h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h2v1h-2zM0 3h8v1h-8z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M11 3h1v1h-1zM1 4h6v1h-6z\" fill=\"#9b87ff\"></path></svg></div>"
  },
  {
    "top": 18,
    "left": 72,
    "width": 20,
    "rotate": 0,
    "dur": 4.8,
    "delay": 1.5,
    "svg": "<svg viewBox=\"0 0 5 5\" shape-rendering=\"crispEdges\"><rect x=\"1\" y=\"0\" width=\"3\" height=\"5\" fill=\"#ffffff\"></rect><rect x=\"0\" y=\"1\" width=\"5\" height=\"3\" fill=\"#ffffff\"></rect><rect x=\"1\" y=\"1\" width=\"1\" height=\"1\" fill=\"#c4bbfd\"></rect></svg>"
  },
  {
    "top": 31,
    "left": 88,
    "width": 76,
    "rotate": 5,
    "dur": 5.5,
    "delay": 1,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 8 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M2 0h4v1h-4zM1 1h6v1h-6zM0 2h2v1h-2zM3 2h2v1h-2zM6 2h2v1h-2zM0 3h8v1h-8zM1 4h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM3 6h1v1h-1zM6 6h1v1h-1zM4 7h1v1h-1z\" fill=\"#d4367c\"></path><path d=\"M2 2h1v1h-1zM5 2h1v1h-1z\" fill=\"#ffffff\"></path></svg><svg viewBox=\"0 0 8 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M2 0h4v1h-4zM1 1h6v1h-6zM0 2h2v1h-2zM3 2h2v1h-2zM6 2h2v1h-2zM0 3h8v1h-8zM2 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM1 6h1v1h-1zM4 6h1v1h-1zM7 6h1v1h-1zM3 7h1v1h-1z\" fill=\"#d4367c\"></path><path d=\"M2 2h1v1h-1zM5 2h1v1h-1z\" fill=\"#ffffff\"></path></svg></div>"
  },
  {
    "top": 52,
    "left": 82,
    "width": 140,
    "rotate": 4,
    "dur": 6.8,
    "delay": 0.2,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM3 6h1v1h-1zM8 6h1v1h-1zM2 7h2v1h-2zM7 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM4 6h1v1h-1zM9 6h1v1h-1zM3 7h2v1h-2zM8 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg></div>"
  },
  {
    "top": 70,
    "left": 74,
    "width": 24,
    "rotate": 0,
    "dur": 5,
    "delay": 0.6,
    "svg": "<svg viewBox=\"0 0 5 5\" shape-rendering=\"crispEdges\"><rect x=\"1\" y=\"0\" width=\"3\" height=\"5\" fill=\"#d4a017\"></rect><rect x=\"0\" y=\"1\" width=\"5\" height=\"3\" fill=\"#d4a017\"></rect><rect x=\"1\" y=\"1\" width=\"1\" height=\"1\" fill=\"#ffffff\"></rect></svg>"
  },
  {
    "top": 79,
    "left": 85,
    "width": 112,
    "rotate": -6,
    "dur": 5.1,
    "delay": 0.9,
    "svg": "<div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM10 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM10 5h2v1h-2z\" fill=\"#ffae45\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\" style=\"transform:scaleX(-1)\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM9 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM10 5h1v1h-1zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM9 5h1v1h-1z\" fill=\"#ffae45\"></path></svg></div></div></div></div><div class=\"mb-4 flex items-end justify-center gap-4 lg:hidden\"><div class=\"hero-pet w-20\" style=\"animation-delay:0s\"><div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM3 6h1v1h-1zM8 6h1v1h-1zM2 7h2v1h-2zM7 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M5 0h4v1h-4zM4 1h3v1h-3zM9 1h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h1v1h-1zM3 3h1v1h-1zM5 3h2v1h-2zM9 3h1v1h-1zM11 3h1v1h-1zM3 4h2v1h-2zM7 4h2v1h-2zM10 4h2v1h-2zM3 5h8v1h-8z\" fill=\"#6e54ff\"></path><path d=\"M7 1h2v1h-2zM5 2h2v1h-2zM9 2h1v1h-1zM4 3h1v1h-1zM7 3h2v1h-2zM10 3h1v1h-1zM5 4h2v1h-2zM9 4h1v1h-1z\" fill=\"#2f9e4f\"></path><path d=\"M1 3h2v1h-2zM0 4h1v1h-1zM2 4h1v1h-1zM1 5h2v1h-2zM4 6h1v1h-1zM9 6h1v1h-1zM3 7h2v1h-2zM8 7h2v1h-2z\" fill=\"#edc7b0\"></path><path d=\"M1 4h1v1h-1z\" fill=\"#f4f1ff\"></path></svg></div></div><div class=\"hero-pet w-20\" style=\"animation-delay:0.3s\"><div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM10 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM10 5h2v1h-2z\" fill=\"#ffae45\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM9 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM10 5h1v1h-1zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM9 5h1v1h-1z\" fill=\"#ffae45\"></path></svg></div></div><div class=\"hero-pet w-20\" style=\"animation-delay:0.6s\"><div class=\"swim\"><svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M1 1h2v1h-2zM0 2h1v1h-1zM3 2h2v1h-2zM8 2h3v1h-3zM0 3h6v1h-6zM7 3h2v1h-2zM10 3h2v1h-2zM5 4h3v1h-3z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M1 4h4v1h-4zM8 4h1v1h-1zM11 4h1v1h-1zM4 5h3v1h-3z\" fill=\"#9b87ff\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M1 1h2v1h-2zM8 1h3v1h-3zM0 2h1v1h-1zM3 2h2v1h-2zM7 2h2v1h-2zM10 2h2v1h-2zM0 3h8v1h-8z\" fill=\"#c41a1a\"></path><path d=\"M1 2h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M2 2h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M11 3h1v1h-1zM1 4h6v1h-6z\" fill=\"#9b87ff\"></path></svg>"
  }
];

export const FINN = "<svg viewBox=\"0 0 12 8\" class=\"swim-a\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM10 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM10 5h2v1h-2z\" fill=\"#ffae45\"></path></svg><svg viewBox=\"0 0 12 8\" class=\"swim-b\" shape-rendering=\"crispEdges\"><path d=\"M3 1h4v1h-4zM2 2h6v1h-6zM9 2h1v1h-1zM1 3h1v1h-1zM4 3h5v1h-5zM10 3h1v1h-1zM1 4h8v1h-8zM10 4h1v1h-1zM2 5h6v1h-6zM10 5h1v1h-1zM3 6h4v1h-4z\" fill=\"#d4a017\"></path><path d=\"M2 3h1v1h-1z\" fill=\"#ffffff\"></path><path d=\"M3 3h1v1h-1z\" fill=\"#f4f1ff\"></path><path d=\"M9 3h1v1h-1zM9 4h1v1h-1zM9 5h1v1h-1z\" fill=\"#ffae45\"></path></svg>";
