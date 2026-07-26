insert into public.book_purchases (book_id, user_id, amount_paid_cents, status, is_comp, comp_reason, environment, guarantee_deadline)
select b.id, b.user_id, 0, 'active', true, 'Owner/tester comp', 'sandbox',
       greatest(coalesce(b.milestone_date, now()::date) - 90, (now() + interval '30 days')::date)
from public.books b
where b.id='7dd247e0-d9e3-42bb-a837-fc296e83e552'
and not exists (select 1 from public.book_purchases p where p.book_id=b.id and p.status='active');
update public.pending_comps set redeemed_book_id='7dd247e0-d9e3-42bb-a837-fc296e83e552'::uuid where email='mtamer@tamerpartners.com';