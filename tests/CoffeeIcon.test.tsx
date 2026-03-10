import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoffeeIcon } from "../src/components/CoffeeIcon";

describe("CoffeeIcon", () => {
  it("renders an img element", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Espresso");
  });

  it("uses default size of 80", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "80");
  });

  it("uses custom size", () => {
    render(<CoffeeIcon recipe="Espresso" size={120} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "120");
  });

  it("calculates height based on 720/1080 ratio", () => {
    render(<CoffeeIcon recipe="Espresso" size={120} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("height", String(Math.round(120 * (720 / 1080))));
  });

  it("is not draggable", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("draggable", "false");
  });

  it("falls back to freestyle placeholder for unknown recipe", () => {
    render(<CoffeeIcon recipe="Unknown Coffee" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Unknown Coffee");
    // Should still render (with fallback image)
    expect(img).toBeInTheDocument();
  });
});
