-- Paid order whose items aren't in stock yet (pre-order). Not a terminal ship state.
alter type public.ship_status add value if not exists 'awaiting_stock' after 'pending';
