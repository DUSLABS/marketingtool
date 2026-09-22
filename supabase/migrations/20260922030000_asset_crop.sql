-- Per-image framing: zoom and pan applied whenever the image fills a slide.
-- { "zoom": 1.0-2.5, "x": pan as fraction of the canvas width, "y": pan as fraction of the height }
alter table assets add column crop jsonb;
