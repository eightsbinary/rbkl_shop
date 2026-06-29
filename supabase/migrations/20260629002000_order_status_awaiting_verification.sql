-- Adding an enum value must not share a transaction with DDL that uses it.
alter type public.order_status add value if not exists 'awaiting_verification' after 'awaiting_payment';
