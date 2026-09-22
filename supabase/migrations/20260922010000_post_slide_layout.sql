-- Each post slide keeps a full snapshot of its layout (box, style, align, dim), so rendered posts
-- stay reproducible when the campaign layout changes later.
alter table post_slides rename column box to layout;
alter table post_slides drop column text_style_id;
