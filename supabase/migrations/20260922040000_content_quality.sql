-- Content quality settings per campaign.
-- product_mention: where the product appears ('cta' = only on the CTA slide, 'last_slide' = the last
-- content slide ties the topic to the product). style_examples: slideshows the team likes, used as
-- tone and rhythm reference for the AI.
alter table campaigns add column product_mention text not null default 'cta' check (product_mention in ('cta', 'last_slide'));
alter table campaigns add column style_examples text not null default '';

-- AI image matching: a short description of every image (written once by the AI), and a per-campaign
-- switch between matching images to the slide text and plain rotation.
alter table assets add column description text;
alter table campaigns add column image_matching boolean not null default true;
