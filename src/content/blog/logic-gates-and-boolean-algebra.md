---
# SAMPLE POST: replace with a real lesson. Drafts only show in `npm run dev`.
title: Logic gates and Boolean algebra
description: Lesson 2 of Digital Design Foundations. The gates everything is built from, and the algebra for simplifying them.
date: 2026-10-24
type: video
youtubeId: xxxxxxxxxxx
track: digital-design-foundations
lesson: 2
tags: [vlsi, logic]
draft: true
---

## Truth tables

| A | B | A AND B | A OR B |
| - | - | ------- | ------ |
| 0 | 0 | 0       | 0      |
| 0 | 1 | 0       | 1      |
| 1 | 0 | 0       | 1      |
| 1 | 1 | 1       | 1      |

## In Verilog

```verilog
module and_or (
  input  wire a, b,
  output wire y_and, y_or
);
  assign y_and = a & b;
  assign y_or  = a | b;
endmodule
```
